import { logger } from '../utils/logger.js';
import {
  verifyWebhookSignature,
  handlePaymentFailure,
} from '../services/stripe.js';
import billingService from '../services/billing.js';
import { credit } from '../services/wallet.js';
import {
  activateSubscription,
  allocateFreeCredits,
  deactivateSubscription,
} from '../services/subscription.js';
import prisma from '../services/prisma.js';
import Stripe from 'stripe';
import { sendSuccess } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';
import { PaymentStatus } from '../utils/prismaEnums.js';
import { resolveTaxTreatment, resolveTaxRateForInvoice } from '../services/tax-resolver.js';
import { upsertTaxEvidence } from '../services/tax-evidence.js';
import { upsertInvoiceRecord, recordSubscriptionInvoiceTransaction } from '../services/invoices.js';
import { syncBillingProfileFromStripe } from '../services/billing-profile.js';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  })
  : null;

const extractTaxId = (taxIds = []) => {
  if (!Array.isArray(taxIds)) return null;
  const vat = taxIds.find((entry) => entry.type === 'eu_vat') || taxIds[0];
  if (!vat) return null;
  return {
    value: vat.value || vat.id || null,
    country: vat.country || null,
    verified: vat.verification?.status === 'verified',
  };
};

const extractTaxDetailsFromSession = (session) => {
  const customerDetails = session?.customer_details || {};
  const taxId = extractTaxId(customerDetails.tax_ids || []);
  const billingCountry = customerDetails.address?.country || null;
  const subtotal = session.amount_subtotal ?? null;
  const taxAmount = session.total_details?.amount_tax ?? null;

  return {
    billingCountry,
    vatId: taxId?.value || null,
    vatIdValidated: taxId?.verified || false,
    subtotal,
    taxAmount,
  };
};

const extractTaxDetailsFromInvoice = (invoice) => {
  const taxId = extractTaxId(invoice?.customer_tax_ids || []);
  const billingCountry = invoice?.customer_address?.country || null;
  const subtotal = invoice?.subtotal ?? null;
  const taxAmount = invoice?.tax ?? null;

  return {
    billingCountry,
    vatId: taxId?.value || null,
    vatIdValidated: taxId?.verified || false,
    subtotal,
    taxAmount,
  };
};

const resolveShopIdFromStripeEvent = async (event) => {
  const object = event?.data?.object || {};
  const metadata = object.metadata || {};
  const metadataShopId = metadata.shopId || metadata.storeId;
  if (metadataShopId) {
    return metadataShopId;
  }

  const customerId =
    typeof object.customer === 'string'
      ? object.customer
      : object.customer?.id;

  if (customerId) {
    const shop = await prisma.shop.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (shop?.id) {
      return shop.id;
    }
  }

  let subscriptionId = null;
  if (typeof object.subscription === 'string') {
    subscriptionId = object.subscription;
  } else if (object.object === 'subscription' && object.id) {
    subscriptionId = object.id;
  }

  if (subscriptionId) {
    const shop = await prisma.shop.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      select: { id: true },
    });
    if (shop?.id) {
      return shop.id;
    }

    const record = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      select: { shopId: true },
    });
    if (record?.shopId) {
      return record.shopId;
    }
  }

  return null;
};

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(req, res) {
  try {
    const signature = req.headers['stripe-signature'];
    const payload = req.rawBody || JSON.stringify(req.body);

    if (!signature) {
      throw new ValidationError('Stripe signature header is required');
    }

    // Verify webhook signature
    const event = verifyWebhookSignature(payload, signature);

    // P0: Webhook replay protection
    const webhookReplay = (await import('../services/webhook-replay.js')).default;
    const shopId = await resolveShopIdFromStripeEvent(event);

    if (!shopId) {
      const payloadHash = webhookReplay.generateEventHash(payload);
      const existing = await webhookReplay.checkWebhookReplay(
        'stripe',
        event.id,
        payloadHash,
        null,
      );
      if (!existing) {
        await webhookReplay.recordWebhookEvent('stripe', event.id, {
          eventHash: payloadHash,
          payloadHash,
          eventType: event.type,
          shopId: null,
          payload: event,
          status: 'unmatched',
        });
      }

      logger.warn('Stripe webhook unmatched (no shop resolved)', {
        eventType: event.type,
        eventId: event.id,
      });

      return sendSuccess(res, {
        message: 'Webhook received (unmatched)',
        unmatched: true,
      });
    }
    const result = await webhookReplay.processWebhookWithReplayProtection(
      'stripe',
      event.id,
      async () => {
        logger.info('Stripe webhook received', {
          eventType: event.type,
          eventId: event.id,
          shopId,
        });

        // Handle different event types
        switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event.data.object);
          break;

        case 'checkout.session.expired':
          await handleCheckoutSessionExpired(event.data.object);
          break;

        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await handlePaymentIntentFailed(event.data.object);
          break;

        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(event.data.object);
          break;

        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;

        case 'charge.refunded':
        case 'payment_intent.refunded':
          await handleRefund(event);
          break;

        default:
          logger.info('Unhandled Stripe event type', {
            eventType: event.type,
            eventId: event.id,
          });
        }

        return { processed: true };
      },
      {
        eventHash: webhookReplay.generateEventHash(payload),
        payloadHash: webhookReplay.generateEventHash(payload),
        eventType: event.type,
        shopId,
        payload: event,
        eventTimestamp: new Date(event.created * 1000), // Stripe uses Unix timestamp
      },
    );

    // Return 200 OK even for duplicates (prevent retries)
    return sendSuccess(res, {
      message: result.processed ? 'Webhook processed successfully' : 'Webhook already processed',
      duplicate: !result.processed,
    });
  } catch (error) {
    logger.error('Stripe webhook processing failed', {
      error: error.message,
      headers: req.headers,
    });
    throw error; // Let global error handler process it
  }
}

/**
 * Handle checkout session completed
 * Routes to appropriate handler based on payment type (subscription, top-up, or pack)
 */
async function handleCheckoutSessionCompleted(session) {
  try {
    logger.info('Checkout session completed', {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      metadata: session.metadata,
      mode: session.mode,
    });

    if (session.payment_status !== 'paid') {
      logger.warn('Checkout session completed but not paid', {
        sessionId: session.id,
        paymentStatus: session.payment_status,
      });
      return;
    }

    const metadata = session.metadata || {};
    const type = metadata.type;

    // Route based on payment type
    if (type === 'subscription' || session.mode === 'subscription') {
      await handleCheckoutSessionCompletedForSubscription(session);
    } else if (type === 'credit_topup') {
      await handleCheckoutSessionCompletedForTopup(session);
    } else {
      // Legacy: Handle package purchase (credit packs)
      const event = {
        type: 'checkout.session.completed',
        data: { object: session },
        id: `evt_${session.id}`,
      };
      await billingService.handleStripeWebhook(event);
    }
  } catch (error) {
    logger.error('Failed to handle checkout session completed', {
      error: error.message,
      sessionId: session.id,
    });
    throw error;
  }
}

/**
 * Handle checkout.session.completed for subscription
 */
async function handleCheckoutSessionCompletedForSubscription(session) {
  const metadata = session.metadata || {};
  const shopId = metadata.shopId || metadata.storeId;
  const planType = metadata.planType;

  if (!shopId || !planType) {
    logger.warn(
      { sessionId: session.id },
      'Subscription checkout missing required metadata',
    );
    return;
  }

  if (!['starter', 'pro'].includes(planType)) {
    logger.warn(
      { sessionId: session.id, planType },
      'Invalid plan type in subscription checkout',
    );
    return;
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;

  if (!subscriptionId || !customerId) {
    logger.warn(
      { sessionId: session.id },
      'Subscription checkout missing subscription or customer ID',
    );
    return;
  }

  logger.info(
    { shopId, planType, subscriptionId, sessionId: session.id },
    'Processing subscription checkout completion',
  );

  try {
    // Retrieve subscription from Stripe
    let stripeSubscription = null;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (err) {
      logger.warn(
        { subscriptionId, err: err.message },
        'Failed to retrieve subscription from Stripe',
      );
    }

    // Activate subscription (sets planType, subscriptionStatus, and allowance tracking)
    logger.info(
      { shopId, planType, subscriptionId },
      'Activating subscription',
    );
    // Extract interval from Stripe subscription before calling activateSubscription
    // This prevents passing the entire Stripe object as the interval parameter
    const { extractIntervalFromStripeSubscription } = await import('../services/stripe-mapping.js');
    const extractedInterval = extractIntervalFromStripeSubscription(stripeSubscription);

    await activateSubscription(
      shopId,
      customerId,
      subscriptionId,
      planType,
      extractedInterval, // Pass string, not object
      stripeSubscription, // Pass as last parameter (optional)
    );
    logger.info(
      { shopId, planType, subscriptionId },
      'Subscription activated successfully with allowance tracking',
    );

    // Allocate free credits (idempotent)
    // Pass planType explicitly to avoid race condition with database read
    logger.info(
      { shopId, planType, subscriptionId },
      'Allocating free credits for subscription',
    );
    const result = await allocateFreeCredits(
      shopId,
      planType,
      `sub_${subscriptionId}`,
      stripeSubscription,
    );

    if (result.allocated) {
      logger.info(
        {
          shopId,
          planType,
          subscriptionId,
          credits: result.credits,
        },
        'Free credits allocated successfully',
      );
    } else {
      logger.info(
        {
          shopId,
          planType,
          subscriptionId,
          reason: result.reason,
          credits: result.credits || 0,
        },
        'Free credits not allocated (already allocated or other reason)',
      );
    }

    const taxDetails = extractTaxDetailsFromSession(session);
    if (taxDetails.billingCountry || taxDetails.vatId) {
      const treatment = resolveTaxTreatment({
        billingCountry: taxDetails.billingCountry,
        vatId: taxDetails.vatId,
        vatIdValidated: taxDetails.vatIdValidated,
      });
      const taxRateApplied = resolveTaxRateForInvoice({
        subtotal: taxDetails.subtotal,
        tax: taxDetails.taxAmount,
      });

      await upsertTaxEvidence({
        shopId,
        billingCountry: taxDetails.billingCountry,
        vatIdProvided: taxDetails.vatId,
        vatIdValidated: taxDetails.vatIdValidated,
        taxRateApplied,
        taxJurisdiction: treatment.taxJurisdiction,
        taxTreatment: treatment.mode,
      });

      await syncBillingProfileFromStripe({
        shopId,
        session,
        taxTreatment: treatment.mode,
        taxExempt: treatment.taxRate === 0,
      });
    }
  } catch (err) {
    logger.error(
      {
        shopId,
        planType,
        subscriptionId,
        err: err.message,
        stack: err.stack,
      },
      'Failed to process subscription checkout',
    );
    throw err;
  }
}

/**
 * Handle checkout.session.completed for credit top-up
 */
async function handleCheckoutSessionCompletedForTopup(session) {
  const metadata = session.metadata || {};
  const shopId = metadata.shopId || metadata.storeId;
  const credits = Number(metadata.credits);
  const priceEur = Number(metadata.priceEur);

  if (!shopId || !credits || !priceEur) {
    logger.warn(
      { sessionId: session.id },
      'Credit top-up checkout missing required metadata',
    );
    return;
  }

  logger.info(
    { shopId, credits, priceEur, sessionId: session.id },
    'Processing credit top-up checkout completion',
  );

  // Validate payment amount matches expected amount (fraud prevention)
  const expectedAmountCents = Math.round(priceEur * 100);
  const actualAmountCents = session.amount_total || 0;

  // Allow small rounding differences (up to 1 cent)
  if (Math.abs(actualAmountCents - expectedAmountCents) > 1) {
    logger.error(
      {
        shopId,
        sessionId: session.id,
        expectedAmountCents,
        actualAmountCents,
        credits,
        priceEur,
      },
      'Payment amount mismatch - potential fraud or configuration error',
    );
    throw new Error(
      `Payment amount mismatch: expected ${expectedAmountCents} cents, got ${actualAmountCents} cents`,
    );
  }

  // Check if already processed (idempotency)
  const existingTxn = await prisma.creditTransaction.findFirst({
    where: {
      shopId,
      reason: 'stripe:topup',
      meta: {
        path: ['sessionId'],
        equals: session.id,
      },
    },
  });

  if (existingTxn) {
    logger.info(
      {
        shopId,
        sessionId: session.id,
        transactionId: existingTxn.id,
        credits,
      },
      'Credit top-up already processed (idempotency check)',
    );
    return;
  }

  try {
    logger.debug({ shopId, credits, priceEur }, 'Adding credits to wallet');
    await prisma.$transaction(async tx => {
      // Credit wallet
      await credit(
        shopId,
        credits,
        {
          reason: 'stripe:topup',
          meta: {
            sessionId: session.id,
            paymentIntentId: session.payment_intent || null,
            customerId: session.customer || null,
            credits,
            priceEur,
            currency: session.currency?.toUpperCase() || 'EUR',
            purchasedAt: new Date().toISOString(),
          },
        },
        tx,
      );

      // Record billing transaction (idempotent)
      try {
        await tx.billingTransaction.create({
          data: {
            shopId,
            creditsAdded: credits,
            amount: actualAmountCents,
            currency: session.currency?.toUpperCase() || 'EUR',
            packageType: 'topup',
            stripeSessionId: session.id,
            stripePaymentId: session.payment_intent || null,
            idempotencyKey: `stripe:topup:${session.id}`,
            status: 'completed',
          },
        });
      } catch (err) {
        if (err?.code !== 'P2002') {
          throw err;
        }
      }
    });

    const taxDetails = extractTaxDetailsFromSession(session);
    const treatment = resolveTaxTreatment({
      billingCountry: taxDetails.billingCountry,
      vatId: taxDetails.vatId,
      vatIdValidated: taxDetails.vatIdValidated,
    });
    const taxRateApplied = resolveTaxRateForInvoice({
      subtotal: taxDetails.subtotal,
      tax: taxDetails.taxAmount,
    });

    await upsertTaxEvidence({
      shopId,
      billingCountry: taxDetails.billingCountry,
      vatIdProvided: taxDetails.vatId,
      vatIdValidated: taxDetails.vatIdValidated,
      taxRateApplied,
      taxJurisdiction: treatment.taxJurisdiction,
      taxTreatment: treatment.mode,
    });

    await syncBillingProfileFromStripe({
      shopId,
      session,
      taxTreatment: treatment.mode,
      taxExempt: treatment.taxRate === 0,
    });

    logger.info(
      {
        shopId,
        credits,
        priceEur,
        sessionId: session.id,
        paymentIntentId: session.payment_intent,
      },
      'Credit top-up processed successfully',
    );
  } catch (err) {
    logger.error(
      { shopId, credits, err: err.message, stack: err.stack },
      'Failed to process credit top-up',
    );
    throw err;
  }
}

/**
 * Handle checkout session expired
 */
async function handleCheckoutSessionExpired(session) {
  try {
    logger.info('Checkout session expired', {
      sessionId: session.id,
      metadata: session.metadata,
    });

    await handlePaymentFailure(session);
  } catch (error) {
    logger.error('Failed to handle checkout session expired', {
      error: error.message,
      sessionId: session.id,
    });
    throw error;
  }
}

/**
 * Handle payment intent succeeded
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    logger.info('Payment intent succeeded', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });

    // Additional processing if needed
    // The main logic is handled in checkout.session.completed
  } catch (error) {
    logger.error('Failed to handle payment intent succeeded', {
      error: error.message,
      paymentIntentId: paymentIntent.id,
    });
    throw error;
  }
}

/**
 * Handle payment intent failed
 * Updates pending transactions to failed status
 */
async function handlePaymentIntentFailed(paymentIntent) {
  try {
    logger.info('Payment intent failed', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      failureCode: paymentIntent.last_payment_error?.code,
      failureMessage: paymentIntent.last_payment_error?.message,
    });

    // Update any pending transactions with this payment intent
    const prisma = (await import('../services/prisma.js')).default;

    const updated = await prisma.billingTransaction.updateMany({
      where: {
        stripePaymentId: paymentIntent.id,
        status: PaymentStatus.pending,
      },
      data: {
        status: PaymentStatus.failed,
      },
    });

    logger.info('Updated failed transactions', {
      paymentIntentId: paymentIntent.id,
      updatedCount: updated.count,
    });
  } catch (error) {
    logger.error('Failed to handle payment intent failed', {
      error: error.message,
      paymentIntentId: paymentIntent.id,
    });
    throw error;
  }
}

/**
 * Handle invoice.payment_succeeded event
 * This is fired for subscription renewals
 */
async function handleInvoicePaymentSucceeded(invoice) {
  logger.info(
    { invoiceId: invoice.id, billingReason: invoice.billing_reason },
    'Processing invoice payment succeeded',
  );

  const customerId = invoice.customer;

  if (!customerId) {
    logger.warn(
      { invoiceId: invoice.id },
      'Invoice missing customer ID',
    );
    return;
  }

  logger.debug(
    { invoiceId: invoice.id, subscriptionId, customerId },
    'Looking up shop for invoice',
  );

  // Find shop by Stripe customer ID
  const shop = await prisma.shop.findFirst({
    where: {
      stripeCustomerId: customerId,
    },
    select: {
      id: true,
      planType: true,
      subscriptionStatus: true,
      stripeSubscriptionId: true,
    },
  });

  if (!shop) {
    logger.warn(
      { customerId, invoiceId: invoice.id },
      'Shop not found for invoice',
    );
    return;
  }

  // Skip subscription_create invoices - they are handled by checkout.session.completed
  if (invoice.billing_reason === 'subscription_create') {
    logger.debug(
      { invoiceId: invoice.id, billingReason: invoice.billing_reason },
      'Skipping subscription_create invoice (handled by checkout.session.completed)',
    );
    return;
  }

  // Only process subscription_cycle invoices (recurring billing)
  if (invoice.billing_reason !== 'subscription_cycle') {
    logger.debug(
      { invoiceId: invoice.id, billingReason: invoice.billing_reason },
      'Skipping non-subscription-cycle invoice',
    );
    return;
  }

  const subscriptionId = invoice.subscription;

  if (!subscriptionId) {
    logger.warn(
      { invoiceId: invoice.id },
      'Invoice missing subscription ID',
    );
    return;
  }

  // Verify subscription ID matches
  if (shop.stripeSubscriptionId !== subscriptionId) {
    logger.warn(
      {
        shopId: shop.id,
        shopSubscriptionId: shop.stripeSubscriptionId,
        invoiceSubscriptionId: subscriptionId,
      },
      'Subscription ID mismatch between shop and invoice',
    );
    return;
  }

  const invoiceRecord = await upsertInvoiceRecord(shop.id, invoice);
  const taxDetails = extractTaxDetailsFromInvoice(invoice);
  const treatment = resolveTaxTreatment({
    billingCountry: taxDetails.billingCountry,
    vatId: taxDetails.vatId,
    vatIdValidated: taxDetails.vatIdValidated,
  });
  const taxRateApplied = resolveTaxRateForInvoice({
    subtotal: taxDetails.subtotal,
    tax: taxDetails.taxAmount,
  });

  await upsertTaxEvidence({
    shopId: shop.id,
    invoiceId: invoiceRecord.id,
    billingCountry: taxDetails.billingCountry,
    vatIdProvided: taxDetails.vatId,
    vatIdValidated: taxDetails.vatIdValidated,
    taxRateApplied,
    taxJurisdiction: treatment.taxJurisdiction,
    taxTreatment: treatment.mode,
  });

  await syncBillingProfileFromStripe({
    shopId: shop.id,
    invoice,
    taxTreatment: treatment.mode,
    taxExempt: treatment.taxRate === 0,
  });

  // Clear last billing error on successful payment
  await prisma.shop.update({
    where: { id: shop.id },
    data: { lastBillingError: null },
  });

  let allocatedCredits = 0;
  if (shop.subscriptionStatus !== 'active') {
    logger.warn(
      {
        shopId: shop.id,
        subscriptionStatus: shop.subscriptionStatus,
        invoiceId: invoice.id,
      },
      'Shop subscription not active - skipping credit allocation',
    );
  }

  // Get subscription details from Stripe
  let stripeSubscription = null;
  try {
    stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    logger.debug(
      {
        subscriptionId,
        billingPeriodStart: stripeSubscription.current_period_start,
        billingPeriodEnd: stripeSubscription.current_period_end,
      },
      'Retrieved subscription details from Stripe',
    );
  } catch (err) {
    logger.warn(
      { subscriptionId, err: err.message },
      'Failed to retrieve subscription from Stripe',
    );
  }

  // Reset allowance for new billing period (idempotent)
  if (stripeSubscription) {
    const { resetAllowanceForNewPeriod } = await import('../services/subscription.js');
    try {
      const resetResult = await resetAllowanceForNewPeriod(shop.id, stripeSubscription);
      if (resetResult.reset) {
        logger.info(
          {
            shopId: shop.id,
            planType: shop.planType,
            invoiceId: invoice.id,
            includedSms: resetResult.includedSms,
            periodStart: resetResult.periodStart,
            periodEnd: resetResult.periodEnd,
          },
          'Allowance reset for new billing period',
        );
      } else {
        logger.info(
          {
            shopId: shop.id,
            invoiceId: invoice.id,
            reason: resetResult.reason,
          },
          'Allowance not reset (already reset or other reason)',
        );
      }
    } catch (resetErr) {
      logger.error(
        {
          shopId: shop.id,
          invoiceId: invoice.id,
          err: resetErr.message,
        },
        'Failed to reset allowance for new period',
      );
      // Continue with credit allocation even if reset fails
    }
  }

  if (shop.subscriptionStatus === 'active') {
    // Allocate free credits for this billing cycle (idempotent)
    logger.info(
      {
        shopId: shop.id,
        planType: shop.planType,
        invoiceId: invoice.id,
        subscriptionId,
      },
      'Allocating free credits for billing cycle',
    );

    try {
      const result = await allocateFreeCredits(
        shop.id,
        shop.planType,
        invoice.id,
        stripeSubscription,
      );
      if (result.allocated) {
        allocatedCredits = result.credits || 0;
        logger.info(
          {
            shopId: shop.id,
            planType: shop.planType,
            invoiceId: invoice.id,
            credits: result.credits,
            subscriptionId,
          },
          'Free credits allocated successfully for billing cycle',
        );
      } else {
        logger.info(
          {
            shopId: shop.id,
            invoiceId: invoice.id,
            reason: result.reason,
            credits: result.credits || 0,
          },
          'Free credits not allocated (already allocated or other reason)',
        );
      }
    } catch (err) {
      logger.error(
        {
          shopId: shop.id,
          invoiceId: invoice.id,
          subscriptionId,
          err: err.message,
          stack: err.stack,
        },
        'Failed to allocate free credits for billing cycle',
      );
      throw err;
    }
  }

  await recordSubscriptionInvoiceTransaction(shop.id, invoice, {
    creditsAdded: allocatedCredits,
  });
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(invoice) {
  logger.info(
    { invoiceId: invoice.id, billingReason: invoice.billing_reason },
    'Processing invoice payment failed',
  );

  const subscriptionId = invoice.subscription;
  const customerId = invoice.customer;

  if (!subscriptionId || !customerId) {
    logger.warn(
      { invoiceId: invoice.id },
      'Invoice missing subscription or customer ID',
    );
    return;
  }

  // Find shop by Stripe customer ID
  const shop = await prisma.shop.findFirst({
    where: {
      stripeCustomerId: customerId,
    },
    select: {
      id: true,
      subscriptionStatus: true,
    },
  });

  if (!shop) {
    logger.warn(
      { customerId, invoiceId: invoice.id },
      'Shop not found for invoice',
    );
    return;
  }

  // Log payment failure (don't deactivate subscription immediately - Stripe will retry)
  logger.warn(
    {
      shopId: shop.id,
      invoiceId: invoice.id,
      subscriptionId,
    },
    'Invoice payment failed - subscription may be past_due',
  );

  // Store last billing error for UI visibility
  const errorMessage =
    invoice.last_payment_error?.message ||
    invoice.status ||
    'Invoice payment failed';
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      lastBillingError: String(errorMessage).slice(0, 255),
    },
  });
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(subscription) {
  logger.info(
    { subscriptionId: subscription.id, status: subscription.status },
    'Processing subscription updated',
  );

  const subscriptionId = subscription.id;
  const customerId = subscription.customer;

  if (!subscriptionId || !customerId) {
    logger.warn({ subscriptionId }, 'Subscription missing customer ID');
    return;
  }

  // Find shop by Stripe customer ID
  const shop = await prisma.shop.findFirst({
    where: {
      stripeCustomerId: customerId,
    },
    select: {
      id: true,
      planType: true,
      subscriptionStatus: true,
      stripeSubscriptionId: true,
    },
  });

  if (!shop) {
    logger.warn(
      { customerId, subscriptionId },
      'Shop not found for subscription',
    );
    return;
  }

  // Verify subscription ID matches
  if (shop.stripeSubscriptionId !== subscriptionId) {
    logger.warn(
      {
        shopId: shop.id,
        shopSubscriptionId: shop.stripeSubscriptionId,
        eventSubscriptionId: subscriptionId,
      },
      'Subscription ID mismatch',
    );
    return;
  }

  // Determine new status
  let newStatus = shop.subscriptionStatus;
  if (subscription.status === 'active') {
    newStatus = 'active';
  } else if (subscription.status === 'trialing') {
    newStatus = 'trialing';
  } else if (subscription.status === 'past_due') {
    newStatus = 'past_due';
  } else if (subscription.status === 'unpaid') {
    newStatus = 'unpaid';
  } else if (subscription.status === 'incomplete') {
    newStatus = 'incomplete';
  } else if (subscription.status === 'paused') {
    newStatus = 'paused';
  } else if (
    subscription.status === 'canceled' ||
    subscription.status === 'incomplete_expired'
  ) {
    newStatus = 'cancelled';
  }

  // Extract planType from subscription metadata or price ID
  // Use Plan Catalog to resolve planCode, interval, currency from priceId
  const planCatalog = await import('../services/plan-catalog.js');
  const priceId = subscription.items?.data?.[0]?.price?.id;

  let newPlanType = shop.planType;
  let interval = null;
  let currency = shop.currency || 'EUR';

  // Try metadata first (for backward compatibility)
  const subscriptionMetadata = subscription.metadata || {};
  const metadataPlanType = subscriptionMetadata.planType;
  const metadataInterval = subscriptionMetadata.interval;

  if (metadataPlanType && ['starter', 'pro'].includes(metadataPlanType)) {
    newPlanType = metadataPlanType;
  }
  if (metadataInterval && ['month', 'year'].includes(metadataInterval)) {
    interval = metadataInterval;
  }

  // Use Plan Catalog to resolve from priceId (more reliable)
  if (priceId) {
    const resolved = planCatalog.resolvePlanFromPriceId(priceId);
    if (resolved) {
      newPlanType = resolved.planCode;
      interval = resolved.interval;
      currency = resolved.currency;
    }
  }

  // Fallback: extract interval from Stripe subscription if not resolved
  if (!interval && subscription.items?.data?.[0]?.price?.recurring) {
    interval = subscription.items.data[0].price.recurring.interval; // 'month' or 'year'
  }

  // Fallback: extract currency from Stripe subscription if not resolved
  if (!currency && subscription.items?.data?.[0]?.price?.currency) {
    currency = String(subscription.items.data[0].price.currency).toUpperCase();
  }

  // Extract cancelAtPeriodEnd
  const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;

  // Extract period dates
  const currentPeriodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000)
    : null;
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;

  // Check if period changed (new billing cycle)
  const shopWithPeriod = await prisma.shop.findUnique({
    where: { id: shop.id },
    select: {
      currentPeriodStart: true,
      subscriptionInterval: true,
    },
  });

  const periodChanged =
    currentPeriodStart &&
    shopWithPeriod?.currentPeriodStart &&
    currentPeriodStart.getTime() !== shopWithPeriod.currentPeriodStart.getTime();

  const statusChanged = shop.subscriptionStatus !== newStatus;
  const planTypeChanged = newPlanType && shop.planType !== newPlanType;
  const intervalChanged = interval && shopWithPeriod?.subscriptionInterval !== interval;

  // Reset allowance if period changed (new billing cycle)
  if (periodChanged && subscription) {
    const { resetAllowanceForNewPeriod } = await import('../services/subscription.js');
    try {
      const resetResult = await resetAllowanceForNewPeriod(shop.id, subscription);
      if (resetResult.reset) {
        logger.info(
          {
            shopId: shop.id,
            planType: shop.planType,
            includedSms: resetResult.includedSms,
            periodStart: resetResult.periodStart,
            periodEnd: resetResult.periodEnd,
          },
          'Allowance reset for new billing period (subscription updated)',
        );
      }
    } catch (resetErr) {
      logger.error(
        {
          shopId: shop.id,
          err: resetErr.message,
        },
        'Failed to reset allowance for new period (subscription updated)',
      );
    }
  }

  if (statusChanged || planTypeChanged || intervalChanged || periodChanged) {
    logger.info(
      {
        shopId: shop.id,
        oldStatus: shop.subscriptionStatus,
        newStatus,
        oldPlanType: shop.planType,
        newPlanType,
        oldInterval: shopWithPeriod?.subscriptionInterval,
        newInterval: interval,
        periodChanged,
      },
      'Updating subscription status, planType, interval, and/or period',
    );

    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        ...(statusChanged && { subscriptionStatus: newStatus }),
        ...(statusChanged && newStatus === 'active' && { lastBillingError: null }),
        ...(planTypeChanged && { planType: newPlanType }),
        ...(intervalChanged && { subscriptionInterval: interval }),
        ...(periodChanged && {
          currentPeriodStart,
          currentPeriodEnd,
        }),
        cancelAtPeriodEnd,
      },
    });

    logger.info(
      {
        shopId: shop.id,
        oldStatus: shop.subscriptionStatus,
        newStatus,
        oldPlanType: shop.planType,
        newPlanType,
        interval,
        periodChanged,
      },
      'Subscription updated',
    );
  } else {
    logger.debug(
      {
        shopId: shop.id,
        status: shop.subscriptionStatus,
        planType: shop.planType,
        interval: shopWithPeriod?.subscriptionInterval,
      },
      'Subscription unchanged',
    );
  }

  const subscriptionCurrency = subscription.items?.data?.[0]?.price?.currency
    ? String(subscription.items.data[0].price.currency).toUpperCase()
    : null;

  // TODO: Remove try-catch once migration 20250206000000_add_subscription_interval_fields is deployed
  try {
    await prisma.subscription.upsert({
      where: { shopId: shop.id },
      update: {
        stripeCustomerId: customerId,
        interval: interval || undefined,
        stripeSubscriptionId: subscriptionId,
        planCode: newPlanType,
        status: newStatus,
        currency: subscriptionCurrency,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        trialEndsAt: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
        metadata: subscription.metadata || undefined,
        lastSyncedAt: new Date(),
        sourceOfTruth: 'webhook',
      },
      create: {
        shopId: shop.id,
        provider: 'stripe',
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        planCode: newPlanType,
        interval: interval || undefined,
        status: newStatus,
        currency: subscriptionCurrency,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        trialEndsAt: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
        metadata: subscription.metadata || undefined,
        lastSyncedAt: new Date(),
        sourceOfTruth: 'webhook',
      },
    });
  } catch (err) {
    // If columns don't exist yet, fallback to basic upsert without new fields
    if (err.message?.includes('does not exist') || err.code === 'P2025') {
      logger.warn('Subscription interval fields not yet migrated, using fallback upsert', { shopId: shop.id });
      await prisma.subscription.upsert({
        where: { shopId: shop.id },
        update: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          planCode: newPlanType,
          status: newStatus,
          currency: subscriptionCurrency,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          trialEndsAt: subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : null,
          metadata: subscription.metadata || undefined,
        },
        create: {
          shopId: shop.id,
          provider: 'stripe',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          planCode: newPlanType,
          status: newStatus,
          currency: subscriptionCurrency,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          trialEndsAt: subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : null,
          metadata: subscription.metadata || undefined,
        },
      });
    } else {
      throw err;
    }
  }
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(subscription) {
  logger.info(
    { subscriptionId: subscription.id },
    'Processing subscription deleted',
  );

  const subscriptionId = subscription.id;
  const customerId = subscription.customer;

  if (!subscriptionId || !customerId) {
    logger.warn({ subscriptionId }, 'Subscription missing customer ID');
    return;
  }

  // Find shop by Stripe customer ID
  const shop = await prisma.shop.findFirst({
    where: {
      stripeCustomerId: customerId,
    },
    select: {
      id: true,
      subscriptionStatus: true,
      stripeSubscriptionId: true,
    },
  });

  if (!shop) {
    logger.warn(
      { customerId, subscriptionId },
      'Shop not found for subscription',
    );
    return;
  }

  // Verify subscription ID matches
  if (shop.stripeSubscriptionId !== subscriptionId) {
    logger.warn(
      {
        shopId: shop.id,
        shopSubscriptionId: shop.stripeSubscriptionId,
        eventSubscriptionId: subscriptionId,
      },
      'Subscription ID mismatch',
    );
    return;
  }

  // Deactivate subscription
  await deactivateSubscription(shop.id, 'cancelled');

  await prisma.subscription.updateMany({
    where: { shopId: shop.id },
    data: {
      status: 'cancelled',
      cancelAtPeriodEnd: false,
    },
  });

  logger.info(
    {
      shopId: shop.id,
      subscriptionId,
    },
    'Subscription deactivated',
  );
}

/**
 * Handle refund events
 * Processes refunds and deducts credits
 */
async function handleRefund(event) {
  try {
    logger.info('Refund event received', {
      eventType: event.type,
      eventId: event.id,
    });

    const charge = event.data.object;
    const chargeId = charge.id;
    const paymentIntentId = charge.payment_intent;

    if (!paymentIntentId) {
      logger.warn({ chargeId }, 'Refund missing payment intent ID');
      return;
    }

    // Find original credit transaction
    const originalTxn = await prisma.creditTransaction.findFirst({
      where: {
        type: 'credit',
        meta: {
          path: ['paymentIntentId'],
          equals: paymentIntentId,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!originalTxn) {
      logger.warn(
        { paymentIntentId, chargeId },
        'Original credit transaction not found for refund',
      );
      // Use billing service as fallback for legacy transactions
      await billingService.handleStripeWebhook(event);
      return;
    }

    // Check if refund already processed (idempotency)
    const existingRefund = await prisma.creditTransaction.findFirst({
      where: {
        shopId: originalTxn.shopId,
        type: 'refund',
        reason: 'stripe:refund',
        meta: {
          path: ['chargeId'],
          equals: chargeId,
        },
      },
    });

    if (existingRefund) {
      logger.info(
        { shopId: originalTxn.shopId, chargeId },
        'Refund already processed (idempotency check)',
      );
      return;
    }

    // Determine credits to deduct
    let creditsToDeduct = originalTxn.amount;
    if (originalTxn.reason === 'stripe:topup' && originalTxn.meta?.credits) {
      creditsToDeduct = originalTxn.meta.credits;
    }

    // Deduct credits (atomic transaction)
    const { refund } = await import('../services/wallet.js');
    await refund(originalTxn.shopId, creditsToDeduct, {
      reason: 'stripe:refund',
      meta: {
        chargeId,
        paymentIntentId,
        originalTransactionId: originalTxn.id,
        originalReason: originalTxn.reason,
        refundedAt: new Date().toISOString(),
      },
    });

    // Update Purchase status if exists
    const purchase = await prisma.purchase.findFirst({
      where: {
        shopId: originalTxn.shopId,
        stripePaymentIntentId: paymentIntentId,
        status: 'paid',
      },
    });

    if (purchase) {
      await prisma.purchase.update({
        where: { id: purchase.id },
        data: { status: 'refunded' },
      });
      logger.info(
        {
          shopId: originalTxn.shopId,
          purchaseId: purchase.id,
        },
        'Purchase status updated to refunded',
      );
    }

    logger.info(
      {
        shopId: originalTxn.shopId,
        chargeId,
        creditsDeducted: creditsToDeduct,
      },
      'Refund processed successfully',
    );
  } catch (error) {
    logger.error('Failed to handle refund', {
      error: error.message,
      eventType: event.type,
      eventId: event.id,
    });
    // Don't throw - log and continue (refund might be for different system)
    logger.warn('Refund processing failed, but continuing', {
      error: error.message,
    });
  }
}

export default {
  handleStripeWebhook,
};
