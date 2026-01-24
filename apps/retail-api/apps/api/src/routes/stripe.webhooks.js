// apps/api/src/routes/stripe.webhooks.js
const express = require('express');
const prisma = require('../lib/prisma');
const { verifyWebhookSignature, getCheckoutSession, stripe } = require('../services/stripe.service');
const { credit } = require('../services/wallet.service');
const {
  resetAllowanceForPeriod,
  activateSubscription,
  deactivateSubscription,
  getIntervalForPlan,
  resolveIntervalFromStripe,
  getIncludedSmsForInterval,
  // calculateTopupPrice // Unused - kept for potential future use
} = require('../services/subscription.service');
const { resolveTaxTreatment, resolveTaxRateForInvoice } = require('../services/tax-resolver.service');
const { upsertTaxEvidence } = require('../services/tax-evidence.service');
const { upsertInvoiceRecord, recordSubscriptionInvoiceTransaction } = require('../services/invoices.service');
const { syncBillingProfileFromStripe } = require('../services/billing-profile.service');
const { createPaymentFromInvoice, createPaymentFromCheckoutSession, getSubscriptionPaymentKind } = require('../services/payments.service');
const { getTopupTierByPriceId } = require('../billing/topupCatalog');
const {
  generateEventHash,
  processWebhookWithReplayProtection,
  recordWebhookEvent,
} = require('../services/webhook-replay.service');
const pino = require('pino');

const router = express.Router();
const logger = pino({ transport: { target: 'pino-pretty' } });

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const INCLUDED_CREDITS_MONTHLY = Number(process.env.CREDITS_INCLUDED_MONTHLY || 0);
const INCLUDED_CREDITS_YEARLY = Number(process.env.CREDITS_INCLUDED_YEARLY || 0);

const resolveIncludedCredits = (kind) => {
  if (kind === 'monthly') {
    return Number.isInteger(INCLUDED_CREDITS_MONTHLY) ? INCLUDED_CREDITS_MONTHLY : 0;
  }
  if (kind === 'yearly') {
    return Number.isInteger(INCLUDED_CREDITS_YEARLY) ? INCLUDED_CREDITS_YEARLY : 0;
  }
  return 0;
};

const extractTaxId = (taxIds = []) => {
  if (!Array.isArray(taxIds)) {
    return null;
  }
  const vat = taxIds.find((entry) => entry.type === 'eu_vat') || taxIds[0];
  if (!vat) {
    return null;
  }
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

const resolveOwnerIdFromStripeEvent = async (event) => {
  const object = event?.data?.object || {};
  const metadata = object.metadata || {};
  const metadataOwnerId = metadata.ownerId || metadata.userId;
  if (metadataOwnerId) {
    const parsed = Number(metadataOwnerId);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  const clientReferenceId = object.client_reference_id || object.client_referenceId;
  if (clientReferenceId && typeof clientReferenceId === 'string' && clientReferenceId.startsWith('owner_')) {
    const parsed = Number(clientReferenceId.replace('owner_', ''));
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  const customerId =
    typeof object.customer === 'string'
      ? object.customer
      : object.customer?.id;

  if (customerId) {
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (user?.id) {
      return user.id;
    }
  }

  let subscriptionId = null;
  if (typeof object.subscription === 'string') {
    subscriptionId = object.subscription;
  } else if (object.object === 'subscription' && object.id) {
    subscriptionId = object.id;
  }

  if (subscriptionId) {
    const user = await prisma.user.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      select: { id: true },
    });
    if (user?.id) {
      return user.id;
    }

    const record = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      select: { ownerId: true },
    });
    if (record?.ownerId) {
      return record.ownerId;
    }
  }

  return null;
};

const mapStripeStatus = (status) => {
  switch (status) {
  case 'active':
    return 'active';
  case 'trialing':
    return 'trialing';
  case 'past_due':
    return 'past_due';
  case 'unpaid':
    return 'unpaid';
  case 'incomplete':
    return 'incomplete';
  case 'paused':
    return 'paused';
  case 'canceled':
  case 'cancelled':
    return 'cancelled';
  default:
    return 'inactive';
  }
};

const extractSubscriptionPeriod = (subscription) => {
  const currentPeriodStart = subscription?.current_period_start
    ? new Date(subscription.current_period_start * 1000)
    : null;
  const currentPeriodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;
  const interval = resolveIntervalFromStripe(subscription);
  const cancelAtPeriodEnd = Boolean(subscription?.cancel_at_period_end);

  return {
    interval,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd,
  };
};

const derivePendingChangeFromSchedule = async (subscription) => {
  const planCatalog = require('../services/plan-catalog.service');
  const scheduleRef = subscription?.schedule;
  if (!scheduleRef) {
    return null;
  }

  let schedule = scheduleRef;
  if (typeof scheduleRef === 'string') {
    if (!stripe) {
      return null;
    }
    try {
      schedule = await stripe.subscriptionSchedules.retrieve(scheduleRef);
    } catch (err) {
      logger.warn({ scheduleId: scheduleRef, err: err.message }, 'Failed to retrieve subscription schedule');
      return null;
    }
  }

  const phases = schedule?.phases;
  if (!Array.isArray(phases) || phases.length < 2) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const nextPhase = phases.find((phase) => phase?.start_date && phase.start_date > now);
  if (!nextPhase || !Array.isArray(nextPhase.items) || nextPhase.items.length === 0) {
    return null;
  }

  const nextPrice = nextPhase.items[0]?.price || null;
  const nextPriceId = typeof nextPrice === 'string' ? nextPrice : nextPrice?.id;
  if (!nextPriceId) {
    return null;
  }

  const resolved = planCatalog.resolvePlanFromPriceId(nextPriceId);
  if (!resolved) {
    return null;
  }

  return {
    planCode: resolved.planCode,
    interval: resolved.interval,
    currency: resolved.currency,
    effectiveAt: nextPhase.start_date ? new Date(nextPhase.start_date * 1000) : null,
  };
};

async function recordBillingTransaction({
  ownerId,
  creditsAdded,
  amount,
  currency,
  packageType,
  stripeSessionId,
  stripePaymentId,
  idempotencyKey,
}) {
  try {
    return await prisma.billingTransaction.create({
      data: {
        ownerId,
        creditsAdded,
        amount,
        currency,
        packageType,
        stripeSessionId: stripeSessionId || null,
        stripePaymentId: stripePaymentId || null,
        idempotencyKey: idempotencyKey || null,
        status: 'paid',
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      return prisma.billingTransaction.findFirst({
        where: { ownerId, idempotencyKey },
      });
    }
    logger.error({ ownerId, error: error.message }, 'Failed to record billing transaction');
    throw error;
  }
}

/**
 * Handle checkout.session.completed event
 * This is fired when a customer successfully completes a payment
 * Handles both package purchases and subscriptions/credit top-ups
 */
async function handleCheckoutCompleted(session) {
  const metadata = session.metadata || {};
  const ownerId = Number(metadata.ownerId);
  const type = metadata.type; // 'subscription', 'credit_topup', or undefined (package purchase)

  // Handle subscription checkout
  if (type === 'subscription') {
    return handleCheckoutSessionCompletedForSubscription(session);
  }

  // Handle credit top-up checkout
  if (type === 'credit_topup') {
    return handleCheckoutSessionCompletedForTopup(session);
  }

  // Legacy: Handle package purchase
  const packageId = Number(metadata.packageId);
  const units = Number(metadata.units);
  const currency = metadata.currency || 'EUR';

  if (!ownerId || !packageId || !units) {
    logger.warn({ session: session.id }, 'Checkout session missing required metadata');
    return;
  }

  // Find the purchase record
  // First try with all constraints, then fallback to just session ID (for robustness)
  let purchase = await prisma.purchase.findFirst({
    where: {
      stripeSessionId: session.id,
      ownerId,
      packageId,
      status: 'pending',
    },
    include: { package: true },
  });

  // Fallback: find by session ID only (in case metadata doesn't match exactly)
  if (!purchase) {
    purchase = await prisma.purchase.findFirst({
      where: {
        stripeSessionId: session.id,
        status: 'pending',
      },
      include: { package: true },
    });
  }

  if (!purchase) {
    logger.warn({ sessionId: session.id, ownerId, packageId }, 'Purchase record not found for completed checkout');
    return;
  }

  // Validate ownerId matches if we found by session ID only
  if (purchase.ownerId !== ownerId) {
    logger.warn({
      sessionId: session.id,
      purchaseOwnerId: purchase.ownerId,
      metadataOwnerId: ownerId,
    }, 'Owner ID mismatch in purchase record');
    return;
  }

  // Check if already processed (idempotency)
  if (purchase.status === 'paid') {
    logger.info({ purchaseId: purchase.id }, 'Purchase already processed');
    return;
  }

  // Validate payment amount matches expected amount (fraud prevention)
  const expectedAmountCents = purchase.priceCents;
  const actualAmountCents = session.amount_total || 0;

  // Allow small rounding differences (up to 1 cent)
  if (Math.abs(actualAmountCents - expectedAmountCents) > 1) {
    logger.error({
      ownerId,
      sessionId: session.id,
      purchaseId: purchase.id,
      expectedAmountCents,
      actualAmountCents,
      packageId,
      units,
    }, 'Payment amount mismatch - potential fraud or configuration error');
    throw new Error(`Payment amount mismatch: expected ${expectedAmountCents} cents, got ${actualAmountCents} cents`);
  }

  // Update purchase status and link Stripe data
  // Credit wallet atomically within the same transaction
  try {
    await prisma.$transaction(async (tx) => {
      await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          status: 'paid',
          stripePaymentIntentId: session.payment_intent || null,
          stripeCustomerId: session.customer || null,
          updatedAt: new Date(),
        },
      });

      // Credit the wallet (pass tx to avoid nested transaction)
      await credit(ownerId, units, {
        reason: `stripe:purchase:${purchase.package.name}`,
        meta: {
          purchaseId: purchase.id,
          packageId: purchase.packageId,
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent,
          currency,
        },
      }, tx);
    });

    await recordBillingTransaction({
      ownerId,
      creditsAdded: units,
      amount: session.amount_total || expectedAmountCents,
      currency: currency || 'EUR',
      packageType: 'package',
      stripeSessionId: session.id,
      stripePaymentId: session.payment_intent || null,
      idempotencyKey: `stripe:payment_intent:${session.payment_intent || session.id}`,
    });
  } catch (err) {
    logger.error({
      err,
      purchaseId: purchase.id,
      ownerId,
      units,
    }, 'Failed to process purchase completion');
    throw err; // Re-throw to be caught by webhook handler
  }

  logger.info({ purchaseId: purchase.id, ownerId, units }, 'Purchase completed and wallet credited');
}

/**
 * Handle payment_intent.succeeded event (backup/alternative)
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  const metadata = paymentIntent.metadata || {};
  const ownerId = Number(metadata.ownerId);
  const packageId = Number(metadata.packageId);

  if (!ownerId || !packageId) {
    // Try to find purchase by payment intent ID
    const purchase = await prisma.purchase.findFirst({
      where: {
        stripePaymentIntentId: paymentIntent.id,
        status: 'pending',
      },
    });

    if (purchase) {
      // Get session to extract metadata
      if (purchase.stripeSessionId) {
        const session = await getCheckoutSession(purchase.stripeSessionId);
        return handleCheckoutCompleted(session);
      }
      // If no session ID, we can't get metadata, skip
      logger.warn({ purchaseId: purchase.id }, 'Purchase has no session ID, cannot process');
    }

    logger.warn({ paymentIntentId: paymentIntent.id }, 'Payment intent missing metadata and no purchase found');
    return;
  }

  // Similar handling as checkout completed
  // First try with all constraints, then fallback to just payment intent ID
  let purchase = await prisma.purchase.findFirst({
    where: {
      stripePaymentIntentId: paymentIntent.id,
      ownerId,
      packageId,
      status: 'pending',
    },
    include: { package: true },
  });

  // Fallback: find by payment intent ID only
  if (!purchase) {
    purchase = await prisma.purchase.findFirst({
      where: {
        stripePaymentIntentId: paymentIntent.id,
        status: 'pending',
      },
      include: { package: true },
    });
  }

  if (!purchase) {
    logger.warn({ paymentIntentId: paymentIntent.id, ownerId, packageId }, 'Purchase not found for payment intent');
    return;
  }

  // Validate ownerId matches if we found by payment intent ID only
  if (purchase.ownerId !== ownerId) {
    logger.warn({
      paymentIntentId: paymentIntent.id,
      purchaseOwnerId: purchase.ownerId,
      metadataOwnerId: ownerId,
    }, 'Owner ID mismatch in purchase record');
    return;
  }

  if (purchase.status === 'paid') {
    logger.info({ purchaseId: purchase.id }, 'Purchase already processed');
    return;
  }

  const units = purchase.units;
  const currency = purchase.currency || 'EUR';

  try {
    await prisma.$transaction(async (tx) => {
      await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          status: 'paid',
          stripeCustomerId: paymentIntent.customer || null,
          updatedAt: new Date(),
        },
      });

      // Credit wallet (pass tx to avoid nested transaction)
      await credit(ownerId, units, {
        reason: `stripe:purchase:${purchase.package.name}`,
        meta: {
          purchaseId: purchase.id,
          packageId: purchase.packageId,
          stripePaymentIntentId: paymentIntent.id,
          currency,
        },
      }, tx);
    });

    await recordBillingTransaction({
      ownerId,
      creditsAdded: units,
      amount: paymentIntent.amount || purchase.priceCents,
      currency: currency || 'EUR',
      packageType: 'package',
      stripePaymentId: paymentIntent.id,
      idempotencyKey: `stripe:payment_intent:${paymentIntent.id}`,
    });
  } catch (err) {
    logger.error({
      err,
      purchaseId: purchase.id,
      ownerId,
      units,
    }, 'Failed to process payment intent success');
    throw err; // Re-throw to be caught by webhook handler
  }

  logger.info({ purchaseId: purchase.id, ownerId, units }, 'Payment intent succeeded, wallet credited');
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentFailed(paymentIntent) {
  const purchase = await prisma.purchase.findFirst({
    where: {
      stripePaymentIntentId: paymentIntent.id,
      status: 'pending',
    },
  });

  if (purchase) {
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        status: 'failed',
        updatedAt: new Date(),
      },
    });
    logger.info({ purchaseId: purchase.id }, 'Purchase marked as failed');
  }

  await prisma.billingTransaction.updateMany({
    where: {
      stripePaymentId: paymentIntent.id,
      status: 'pending',
    },
    data: { status: 'failed' },
  });
}

/**
 * Handle checkout.session.completed for subscription
 */
async function handleCheckoutSessionCompletedForSubscription(session) {
  const metadata = session.metadata || {};
  const ownerId = Number(metadata.ownerId);
  const planType = metadata.planType;
  const previousStripeSubscriptionId = metadata.previousStripeSubscriptionId
    ? String(metadata.previousStripeSubscriptionId).trim()
    : null;

  if (!ownerId || !planType) {
    logger.warn({ sessionId: session.id }, 'Subscription checkout missing required metadata');
    return;
  }

  if (!['starter', 'pro'].includes(planType)) {
    logger.warn({ sessionId: session.id, planType }, 'Invalid plan type in subscription checkout');
    return;
  }

  // Get subscription ID from session
  const subscriptionId = session.subscription;
  const customerId = session.customer;

  if (!subscriptionId) {
    logger.warn({ sessionId: session.id }, 'Subscription checkout missing subscription ID');
    return;
  }

  try {
    logger.info({ ownerId, planType, subscriptionId, sessionId: session.id }, 'Processing subscription checkout completion');

    // Get subscription details from Stripe first (needed for billing period)
    let stripeSubscription = null;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      logger.debug({ subscriptionId, billingPeriod: stripeSubscription.current_period_start }, 'Retrieved subscription details from Stripe');
    } catch (err) {
      logger.warn({ subscriptionId, err: err.message }, 'Failed to retrieve subscription from Stripe');
    }

    const period = extractSubscriptionPeriod(stripeSubscription);
    const subscriptionCurrency = stripeSubscription?.items?.data?.[0]?.price?.currency
      ? String(stripeSubscription.items.data[0].price.currency).toUpperCase()
      : metadata.currency || null;

    // Activate subscription (sets planType and subscriptionStatus)
    logger.info({ ownerId, planType, subscriptionId }, 'Activating subscription');
    await activateSubscription(ownerId, customerId, subscriptionId, planType, {
      interval: period.interval || getIntervalForPlan(planType),
      currentPeriodStart: period.currentPeriodStart,
      currentPeriodEnd: period.currentPeriodEnd,
      cancelAtPeriodEnd: period.cancelAtPeriodEnd,
      currency: subscriptionCurrency,
      stripeSubscription,
    });
    logger.info({ ownerId, planType, subscriptionId }, 'Subscription activated successfully');

    // Shopify parity: if this checkout was a subscription change (upgrade), cancel the previous subscription.
    // Best-effort and idempotent: cancelling an already-cancelled subscription should be safe.
    if (
      previousStripeSubscriptionId &&
      previousStripeSubscriptionId.startsWith('sub_') &&
      previousStripeSubscriptionId !== subscriptionId
    ) {
      try {
        await stripe.subscriptions.cancel(previousStripeSubscriptionId);
        logger.info(
          { ownerId, previousStripeSubscriptionId, newSubscriptionId: subscriptionId },
          'Cancelled previous subscription after successful subscription change',
        );
      } catch (cancelErr) {
        logger.warn(
          { ownerId, previousStripeSubscriptionId, err: cancelErr.message },
          'Failed to cancel previous subscription (non-fatal)',
        );
      }
    }

    // Reset allowance for first billing cycle (idempotent)
    // Use subscription ID as invoice ID for idempotency (first invoice will be created separately)
    logger.info({ ownerId, planType, subscriptionId }, 'Resetting allowance for subscription');
    const result = await resetAllowanceForPeriod(ownerId, planType, `sub_${subscriptionId}`, stripeSubscription);

    if (!result.allocated) {
      logger.warn({
        ownerId,
        planType,
        subscriptionId,
        reason: result.reason,
        includedSmsPerPeriod: result.includedSmsPerPeriod || 0,
      }, 'Allowance not reset - may already be processed or subscription not active');
    } else {
      logger.info({
        ownerId,
        planType,
        subscriptionId,
        includedSmsPerPeriod: result.includedSmsPerPeriod,
        invoiceId: `sub_${subscriptionId}`,
      }, 'Subscription activated and allowance reset successfully');
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
        ownerId,
        billingCountry: taxDetails.billingCountry,
        vatIdProvided: taxDetails.vatId,
        vatIdValidated: taxDetails.vatIdValidated,
        taxRateApplied,
        taxJurisdiction: treatment.taxJurisdiction,
        taxTreatment: treatment.mode,
      });

      await syncBillingProfileFromStripe({
        ownerId,
        session,
        taxTreatment: treatment.mode,
        taxExempt: treatment.taxRate === 0,
      });
    }
  } catch (err) {
    logger.error({
      ownerId,
      planType,
      subscriptionId,
      sessionId: session.id,
      err: err.message,
      stack: err.stack,
    }, 'Failed to process subscription checkout');
    throw err;
  }
}

/**
 * Handle checkout.session.completed for credit top-up
 */
async function handleCheckoutSessionCompletedForTopup(session) {
  const metadata = session.metadata || {};
  const ownerId = Number(metadata.ownerId);
  const currency = String(metadata.currency || session.currency || 'EUR').toUpperCase();
  let priceId = metadata.priceId || null;

  if (!ownerId) {
    logger.warn({ sessionId: session.id }, 'Credit top-up checkout missing owner metadata');
    return;
  }

  if (!priceId && Array.isArray(session.line_items?.data)) {
    priceId = session.line_items.data?.[0]?.price?.id || null;
  }

  if (!priceId && stripe) {
    try {
      const expanded = await stripe.checkout.sessions.retrieve(session.id, { expand: ['line_items'] });
      priceId = expanded.line_items?.data?.[0]?.price?.id || priceId;
    } catch (err) {
      logger.warn({ sessionId: session.id, err: err.message }, 'Failed to retrieve checkout session line items');
    }
  }

  let tier = null;
  try {
    tier = getTopupTierByPriceId(priceId, currency);
  } catch (err) {
    logger.warn({ sessionId: session.id, ownerId, priceId, err: err.message }, 'Failed to resolve top-up tier');
    return;
  }
  if (!tier) {
    logger.warn({ sessionId: session.id, ownerId, priceId }, 'Credit top-up tier not found for price ID');
    return;
  }

  const credits = tier.credits;
  const priceAmount = tier.amount;

  logger.info({ ownerId, credits, priceAmount, currency, sessionId: session.id }, 'Processing credit top-up checkout completion');

  // Validate payment amount matches expected amount (fraud prevention)
  const expectedAmountCents = tier.amountCents;
  const actualAmountCents = session.amount_total || 0;

  if (expectedAmountCents && actualAmountCents && actualAmountCents + 1 < expectedAmountCents) {
    logger.error({
      ownerId,
      sessionId: session.id,
      expectedAmountCents,
      actualAmountCents,
      credits,
      priceAmount,
      currency,
    }, 'Payment amount lower than expected for top-up');
    throw new Error(`Payment amount mismatch: expected at least ${expectedAmountCents} cents, got ${actualAmountCents} cents`);
  }

  // Check if already processed (idempotency)
  const existingTxn = await prisma.creditTransaction.findFirst({
    where: {
      ownerId,
      reason: 'stripe:topup',
      meta: {
        path: ['sessionId'],
        equals: session.id,
      },
    },
  });

  if (existingTxn) {
    logger.info({
      ownerId,
      sessionId: session.id,
      transactionId: existingTxn.id,
      credits,
    }, 'Credit top-up already processed (idempotency check)');
    return;
  }

  try {
    logger.debug({ ownerId, credits, priceAmount, currency }, 'Adding credits to wallet');
    await prisma.$transaction(async (tx) => {
      // Credit wallet
      await credit(ownerId, credits, {
        reason: 'stripe:topup',
        meta: {
          sessionId: session.id,
          paymentIntentId: session.payment_intent || null,
          customerId: session.customer || null,
          credits,
          priceAmount,
          currency,
          priceId,
          purchasedAt: new Date().toISOString(),
        },
      }, tx);
    });

    await recordBillingTransaction({
      ownerId,
      creditsAdded: credits,
      amount: session.amount_total || expectedAmountCents,
      currency: currency || 'EUR',
      packageType: 'credit_topup',
      stripeSessionId: session.id,
      stripePaymentId: session.payment_intent || null,
      idempotencyKey: `stripe:topup:${session.payment_intent || session.id}`,
    });

    await createPaymentFromCheckoutSession(ownerId, session, { kind: 'topup' });

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
        ownerId,
        billingCountry: taxDetails.billingCountry,
        vatIdProvided: taxDetails.vatId,
        vatIdValidated: taxDetails.vatIdValidated,
        taxRateApplied,
        taxJurisdiction: treatment.taxJurisdiction,
        taxTreatment: treatment.mode,
      });

      await syncBillingProfileFromStripe({
        ownerId,
        session,
        taxTreatment: treatment.mode,
        taxExempt: treatment.taxRate === 0,
      });
    }

    logger.info({
      ownerId,
      credits,
      priceAmount,
      currency,
      sessionId: session.id,
      paymentIntentId: session.payment_intent,
    }, 'Credit top-up processed successfully');
  } catch (err) {
    logger.error({ ownerId, credits, err: err.message, stack: err.stack }, 'Failed to process credit top-up');
    throw err;
  }
}

/**
 * Handle invoice.payment_succeeded event
 * This is fired for subscription renewals and first payment
 */
async function handleInvoicePaymentSucceeded(invoice) {
  logger.info({ invoiceId: invoice.id, billingReason: invoice.billing_reason }, 'Processing invoice payment succeeded');

  // Process only subscription invoices.
  // For subscription_create we still store the invoice + record the charge,
  // but we avoid resetting allowance here to prevent race conditions with checkout.session.completed.
  if (invoice.billing_reason !== 'subscription_cycle' && invoice.billing_reason !== 'subscription_create') {
    logger.debug({ invoiceId: invoice.id, billingReason: invoice.billing_reason }, 'Skipping non-subscription-cycle invoice');
    return;
  }

  const subscriptionId = invoice.subscription;
  const customerId = invoice.customer;

  if (!subscriptionId || !customerId) {
    logger.warn({ invoiceId: invoice.id }, 'Invoice missing subscription or customer ID');
    return;
  }

  logger.debug({ invoiceId: invoice.id, subscriptionId, customerId }, 'Looking up user for invoice');

  // Find user by Stripe customer ID
  const user = await prisma.user.findFirst({
    where: {
      stripeCustomerId: customerId,
    },
    select: {
      id: true,
      planType: true,
      subscriptionStatus: true,
      stripeSubscriptionId: true,
      subscriptionInterval: true,
    },
  });

  if (!user) {
    logger.warn({ customerId, invoiceId: invoice.id }, 'User not found for invoice');
    return;
  }

  // Verify subscription ID matches
  if (user.stripeSubscriptionId !== subscriptionId) {
    logger.warn({
      userId: user.id,
      userSubscriptionId: user.stripeSubscriptionId,
      invoiceSubscriptionId: subscriptionId,
    }, 'Subscription ID mismatch between user and invoice');
    return;
  }

  const invoiceRecord = await upsertInvoiceRecord(user.id, invoice);
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
    ownerId: user.id,
    invoiceId: invoiceRecord.id,
    billingCountry: taxDetails.billingCountry,
    vatIdProvided: taxDetails.vatId,
    vatIdValidated: taxDetails.vatIdValidated,
    taxRateApplied,
    taxJurisdiction: treatment.taxJurisdiction,
    taxTreatment: treatment.mode,
  });

  await syncBillingProfileFromStripe({
    ownerId: user.id,
    invoice,
    taxTreatment: treatment.mode,
    taxExempt: treatment.taxRate === 0,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastBillingError: null },
  });

  await createPaymentFromInvoice(user.id, invoice, {
    fallbackPlanType: user.planType,
    fallbackInterval: user.subscriptionInterval,
  });

  const paymentKind = getSubscriptionPaymentKind(invoice, {
    fallbackPlanType: user.planType,
    fallbackInterval: user.subscriptionInterval,
  });
  const creditsToGrant = resolveIncludedCredits(paymentKind.kind);

  // For subscription_create: store invoice + record charge, but avoid allowance reset here.
  // Allowance is reset in checkout.session.completed (idempotent).
  if (invoice.billing_reason === 'subscription_create') {
    await recordSubscriptionInvoiceTransaction(user.id, invoice, { creditsAdded: creditsToGrant });
    return;
  }

  if (user.subscriptionStatus !== 'active') {
    logger.warn({
      userId: user.id,
      subscriptionStatus: user.subscriptionStatus,
      invoiceId: invoice.id,
    }, 'User subscription not active - skipping allowance reset');
  }

  // Get subscription details from Stripe
  let stripeSubscription = null;
  try {
    stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    logger.debug({
      subscriptionId,
      billingPeriodStart: stripeSubscription.current_period_start,
      billingPeriodEnd: stripeSubscription.current_period_end,
    }, 'Retrieved subscription details from Stripe');
  } catch (err) {
    logger.warn({ subscriptionId, err: err.message }, 'Failed to retrieve subscription from Stripe');
  }

  if (invoice.billing_reason === 'subscription_cycle' && user.subscriptionStatus === 'active') {
    // Reset allowance for this billing cycle (idempotent)
    logger.info({
      userId: user.id,
      planType: user.planType,
      invoiceId: invoice.id,
      subscriptionId,
    }, 'Resetting allowance for billing cycle');

    try {
      const result = await resetAllowanceForPeriod(user.id, user.planType, invoice.id, stripeSubscription);
      if (result.allocated) {
        logger.info({
          userId: user.id,
          planType: user.planType,
          invoiceId: invoice.id,
          includedSmsPerPeriod: result.includedSmsPerPeriod,
          subscriptionId,
        }, 'Allowance reset successfully for billing cycle');
      } else {
        logger.info({
          userId: user.id,
          invoiceId: invoice.id,
          reason: result.reason,
          includedSmsPerPeriod: result.includedSmsPerPeriod || 0,
        }, 'Allowance not reset (already allocated or other reason)');
      }
    } catch (err) {
      logger.error({
        userId: user.id,
        invoiceId: invoice.id,
        subscriptionId,
        err: err.message,
        stack: err.stack,
      }, 'Failed to reset allowance for invoice');
      throw err;
    }
  }

  await recordSubscriptionInvoiceTransaction(user.id, invoice, {
    creditsAdded: creditsToGrant,
  });
}

/**
 * Handle invoice.payment_failed event
 * This is fired when a subscription renewal payment fails
 */
async function handleInvoicePaymentFailed(invoice) {
  logger.info({ invoiceId: invoice.id, billingReason: invoice.billing_reason }, 'Processing invoice payment failed');

  // Only process subscription invoices
  if (invoice.billing_reason !== 'subscription_cycle' && invoice.billing_reason !== 'subscription_update') {
    logger.debug({ invoiceId: invoice.id, billingReason: invoice.billing_reason }, 'Skipping non-subscription invoice');
    return;
  }

  const subscriptionId = invoice.subscription;
  const customerId = invoice.customer;

  if (!subscriptionId || !customerId) {
    logger.warn({ invoiceId: invoice.id }, 'Invoice missing subscription or customer ID');
    return;
  }

  logger.debug({ invoiceId: invoice.id, subscriptionId, customerId }, 'Looking up user for failed invoice');

  // Find user by Stripe customer ID
  const user = await prisma.user.findFirst({
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

  if (!user) {
    logger.warn({ customerId, invoiceId: invoice.id }, 'User not found for failed invoice');
    return;
  }

  // Verify subscription ID matches
  if (user.stripeSubscriptionId !== subscriptionId) {
    logger.warn({
      userId: user.id,
      userSubscriptionId: user.stripeSubscriptionId,
      invoiceSubscriptionId: subscriptionId,
    }, 'Subscription ID mismatch between user and invoice');
    return;
  }

  await upsertInvoiceRecord(user.id, invoice);

  // Get subscription from Stripe to check current status
  let stripeSubscription = null;
  try {
    stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    logger.debug({
      subscriptionId,
      stripeStatus: stripeSubscription.status,
    }, 'Retrieved subscription details from Stripe');
  } catch (err) {
    logger.warn({ subscriptionId, err: err.message }, 'Failed to retrieve subscription from Stripe');
  }

  // Update subscription status based on Stripe status
  // If subscription is past_due or unpaid, mark as inactive
  // If subscription is cancelled, mark as cancelled
  const stripeStatus = stripeSubscription?.status;
  const newStatus = stripeStatus ? mapStripeStatus(stripeStatus) : user.subscriptionStatus;
  const billingError = invoice?.last_payment_error?.message || invoice?.status || 'payment_failed';

  try {
    const updateData = {
      lastBillingError: billingError,
    };

    if (user.subscriptionStatus !== newStatus) {
      updateData.subscriptionStatus = newStatus;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    logger.info({
      userId: user.id,
      subscriptionId,
      oldStatus: user.subscriptionStatus,
      newStatus,
      invoiceId: invoice.id,
    }, 'Subscription status updated after payment failure');
  } catch (err) {
    logger.error({
      userId: user.id,
      subscriptionId,
      err: err.message,
      stack: err.stack,
    }, 'Failed to update subscription status after payment failure');
    throw err;
  }
}

const resolveOwnerIdFromCustomer = async (customerId) => {
  if (!customerId) {
    return null;
  }
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return user?.id || null;
};

const resolvePaymentForCharge = async (charge) => {
  if (!charge) {
    return null;
  }
  const paymentIntentId = charge.payment_intent || null;
  const invoiceId = charge.invoice || null;
  const chargeId = charge.id || null;

  const filters = [];
  if (paymentIntentId) {
    filters.push({ stripePaymentIntentId: paymentIntentId });
  }
  if (invoiceId) {
    filters.push({ stripeInvoiceId: invoiceId });
  }
  if (chargeId) {
    filters.push({ stripeChargeId: chargeId });
  }

  if (!filters.length) {
    return null;
  }

  return prisma.payment.findFirst({
    where: { OR: filters },
  });
};

const resolveCreditsGrantedForPayment = async (tx, ownerId, payment) => {
  if (!payment || !ownerId) {
    return 0;
  }
  const sessionIds = [];
  if (payment.stripeInvoiceId) {
    sessionIds.push(payment.stripeInvoiceId);
  }
  if (payment.stripeSessionId) {
    sessionIds.push(payment.stripeSessionId);
  }
  const paymentIntentId = payment.stripePaymentIntentId;

  const filters = [];
  if (sessionIds.length) {
    filters.push({ stripeSessionId: { in: sessionIds } });
  }
  if (paymentIntentId) {
    filters.push({ stripePaymentId: paymentIntentId });
  }

  if (!filters.length) {
    return 0;
  }

  const transactions = await tx.billingTransaction.findMany({
    where: {
      ownerId,
      status: 'paid',
      OR: filters,
    },
    select: { creditsAdded: true },
  });

  return transactions.reduce((sum, row) => sum + (row.creditsAdded || 0), 0);
};

const resolveCreditsGrantedForPaymentIntent = async (tx, paymentIntentId, fallbackOwnerId = null) => {
  if (!paymentIntentId) {
    return { ownerId: fallbackOwnerId, credits: 0, creditTxn: null };
  }

  const creditTxn = await tx.creditTransaction.findFirst({
    where: {
      type: 'credit',
      OR: [
        {
          reason: 'stripe:topup',
          meta: {
            path: ['paymentIntentId'],
            equals: paymentIntentId,
          },
        },
        {
          reason: {
            startsWith: 'stripe:purchase:',
          },
          meta: {
            path: ['stripePaymentIntentId'],
            equals: paymentIntentId,
          },
        },
      ],
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!creditTxn) {
    return { ownerId: fallbackOwnerId, credits: 0, creditTxn: null };
  }

  let credits = 0;
  if (creditTxn.reason === 'stripe:topup') {
    const meta = creditTxn.meta || {};
    credits = meta.credits || 0;
  } else if (creditTxn.reason?.startsWith('stripe:purchase:')) {
    const purchase = await tx.purchase.findFirst({
      where: {
        stripePaymentIntentId: paymentIntentId,
        ownerId: creditTxn.ownerId,
      },
      include: { package: true },
    });
    if (purchase?.package) {
      credits = purchase.package.units;
    } else {
      credits = creditTxn.amount || 0;
    }
  } else {
    credits = creditTxn.amount || 0;
  }

  return { ownerId: creditTxn.ownerId, credits, creditTxn };
};

const fetchReversedCreditsForPayment = async (tx, ownerId, paymentId) => {
  if (!ownerId || !paymentId) {
    return 0;
  }

  const result = await tx.creditTransaction.aggregate({
    where: {
      ownerId,
      type: 'debit',
      OR: [
        { reason: 'stripe:refund' },
        { reason: 'stripe:dispute' },
      ],
      meta: {
        path: ['paymentId'],
        equals: paymentId,
      },
    },
    _sum: { amount: true },
  });

  return result?._sum?.amount || 0;
};

const fetchReversedCreditsForPaymentIntent = async (tx, ownerId, paymentIntentId, reason) => {
  if (!ownerId || !paymentIntentId) {
    return 0;
  }

  const result = await tx.creditTransaction.aggregate({
    where: {
      ownerId,
      type: 'debit',
      reason,
      meta: {
        path: ['paymentIntentId'],
        equals: paymentIntentId,
      },
    },
    _sum: { amount: true },
  });

  return result?._sum?.amount || 0;
};

const setBillingHold = async (ownerId, reason, tx) => {
  if (!ownerId) {
    return;
  }
  const payload = {
    billingHold: true,
    billingHoldReason: reason || 'billing_hold',
    billingHoldAt: new Date(),
  };
  if (tx) {
    await tx.user.update({ where: { id: ownerId }, data: payload });
    return;
  }
  await prisma.user.update({ where: { id: ownerId }, data: payload });
};

const clearBillingHoldIfMatches = async (ownerId, expectedReason, tx) => {
  if (!ownerId) {
    return;
  }
  const user = await (tx || prisma).user.findUnique({
    where: { id: ownerId },
    select: { billingHold: true, billingHoldReason: true },
  });
  if (!user?.billingHold) {
    return;
  }
  if (expectedReason && user.billingHoldReason !== expectedReason) {
    return;
  }
  const payload = {
    billingHold: false,
    billingHoldReason: null,
    billingHoldAt: null,
  };
  await (tx || prisma).user.update({ where: { id: ownerId }, data: payload });
};

const ensurePaymentAdjustment = async (tx, data) => {
  const {
    ownerId,
    paymentId,
    type,
    amount,
    currency,
    stripeChargeId,
    stripeRefundId,
    stripeDisputeId,
    status,
    reason,
    occurredAt,
    meta,
  } = data;

  if (!ownerId || !type || !Number.isFinite(amount) || !occurredAt) {
    return null;
  }

  if (stripeRefundId) {
    const existing = await tx.paymentAdjustment.findFirst({
      where: { stripeRefundId },
    });
    if (existing) {
      return existing;
    }
  }

  if (stripeDisputeId) {
    const existing = await tx.paymentAdjustment.findFirst({
      where: { stripeDisputeId },
    });
    if (existing) {
      return tx.paymentAdjustment.update({
        where: { id: existing.id },
        data: {
          status: status || existing.status,
          reason: reason || existing.reason,
          amount,
          currency,
          paymentId: paymentId || existing.paymentId,
          stripeChargeId: stripeChargeId || existing.stripeChargeId,
          occurredAt,
          meta: meta || existing.meta,
        },
      });
    }
  }

  if (!stripeRefundId && !stripeDisputeId && stripeChargeId) {
    const existing = await tx.paymentAdjustment.findFirst({
      where: {
        stripeChargeId,
        stripeRefundId: null,
        stripeDisputeId: null,
        amount,
        occurredAt,
        type,
      },
    });
    if (existing) {
      return existing;
    }
  }

  return tx.paymentAdjustment.create({
    data: {
      ownerId,
      paymentId: paymentId || null,
      type,
      amount,
      currency: currency || 'EUR',
      stripeChargeId: stripeChargeId || null,
      stripeRefundId: stripeRefundId || null,
      stripeDisputeId: stripeDisputeId || null,
      status: status || null,
      reason: reason || null,
      occurredAt,
      meta: meta || undefined,
    },
  });
};

const reverseCreditsForAdjustment = async ({
  tx,
  ownerId,
  payment,
  paymentIntentId,
  refundAmount,
  paymentAmountOverride,
  adjustmentType,
  adjustmentId,
  chargeId,
  invoiceId,
}) => {
  if (!ownerId || !refundAmount || refundAmount <= 0) {
    return { reversed: false, reason: 'invalid_amount' };
  }

  const reason = adjustmentType === 'dispute' ? 'stripe:dispute' : 'stripe:refund';
  const idKey = adjustmentType === 'dispute' ? 'disputeId' : 'refundId';

  const existingDebit = await tx.creditTransaction.findFirst({
    where: {
      ownerId,
      type: 'debit',
      reason,
      meta: {
        path: [idKey],
        equals: adjustmentId,
      },
    },
  });

  if (existingDebit) {
    return { reversed: false, reason: 'already_reversed' };
  }

  let creditsGranted = 0;
  let paymentAmount = 0;
  const paymentId = payment?.id || null;

  if (payment) {
    creditsGranted = await resolveCreditsGrantedForPayment(tx, ownerId, payment);
    paymentAmount = payment.amount || 0;
  }

  if (!paymentAmount && Number.isFinite(paymentAmountOverride)) {
    paymentAmount = paymentAmountOverride;
  }

  if (!creditsGranted && paymentIntentId) {
    const resolved = await resolveCreditsGrantedForPaymentIntent(tx, paymentIntentId, ownerId);
    creditsGranted = resolved.credits;
    if (!ownerId && resolved.ownerId) {
      ownerId = resolved.ownerId;
    }
  }

  if (!creditsGranted) {
    await setBillingHold(ownerId, `${adjustmentType}:${adjustmentId || chargeId || 'unknown'}`, tx);
    return { reversed: false, reason: 'missing_credits' };
  }

  let creditsToReverse = creditsGranted;
  if (paymentAmount > 0 && refundAmount < paymentAmount) {
    creditsToReverse = Math.ceil((creditsGranted * refundAmount) / paymentAmount);
  }

  if (paymentId) {
    const alreadyReversed = await fetchReversedCreditsForPayment(tx, ownerId, paymentId);
    const remaining = Math.max(0, creditsGranted - alreadyReversed);
    if (remaining <= 0) {
      return { reversed: false, reason: 'already_reversed' };
    }
    creditsToReverse = Math.min(creditsToReverse, remaining);
  } else if (paymentIntentId) {
    const alreadyReversed = await fetchReversedCreditsForPaymentIntent(tx, ownerId, paymentIntentId, reason);
    const remaining = Math.max(0, creditsGranted - alreadyReversed);
    if (remaining <= 0) {
      return { reversed: false, reason: 'already_reversed' };
    }
    creditsToReverse = Math.min(creditsToReverse, remaining);
  }

  if (!creditsToReverse || creditsToReverse <= 0) {
    return { reversed: false, reason: 'zero_remaining' };
  }

  const { debit } = require('../services/wallet.service');

  try {
    await debit(ownerId, creditsToReverse, {
      reason,
      meta: {
        [idKey]: adjustmentId,
        chargeId,
        paymentId: paymentId || undefined,
        paymentIntentId: paymentIntentId || undefined,
        invoiceId: invoiceId || undefined,
        refundedAmount: refundAmount,
      },
    }, tx);
    return { reversed: true, credits: creditsToReverse };
  } catch (err) {
    if (err.message === 'INSUFFICIENT_CREDITS') {
      await setBillingHold(ownerId, `${adjustmentType}:${adjustmentId || chargeId || 'unknown'}`, tx);
      return { reversed: false, reason: 'insufficient_credits' };
    }
    throw err;
  }
};

/**
 * Handle charge.refunded event
 * This is fired when a payment is refunded
 */
async function handleChargeRefunded(charge) {
  logger.info({ chargeId: charge.id, amount: charge.amount, amountRefunded: charge.amount_refunded }, 'Processing charge refunded event');

  const paymentIntentId = charge.payment_intent;
  const customerId = charge.customer;
  const invoiceId = charge.invoice || null;
  const currency = charge.currency ? String(charge.currency).toUpperCase() : 'EUR';
  const refunds = Array.isArray(charge.refunds?.data) ? charge.refunds.data : [];
  const fallbackRefunds = refunds.length
    ? refunds
    : (charge.amount_refunded || 0) > 0
      ? [{
        id: null,
        amount: charge.amount_refunded,
        status: 'succeeded',
        reason: null,
        created: charge.created || Math.floor(Date.now() / 1000),
      }]
      : [];

  const payment = await resolvePaymentForCharge(charge);
  let ownerId = payment?.ownerId || null;
  if (!ownerId) {
    ownerId = await resolveOwnerIdFromCustomer(customerId);
  }

  await prisma.$transaction(async (tx) => {
    let resolvedPayment = payment || null;
    if (!resolvedPayment && paymentIntentId) {
      resolvedPayment = await tx.payment.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
      });
    }
    if (!resolvedPayment && invoiceId) {
      resolvedPayment = await tx.payment.findFirst({
        where: { stripeInvoiceId: invoiceId },
      });
    }
    if (!resolvedPayment) {
      resolvedPayment = await tx.payment.findFirst({
        where: { stripeChargeId: charge.id },
      });
    }

    if (resolvedPayment) {
      const refundTotal = charge.amount_refunded || 0;
      const refundAt = fallbackRefunds.length ? new Date(fallbackRefunds[0].created * 1000) : new Date();
      const isFullRefund = refundTotal >= (resolvedPayment.amount || 0) && refundTotal > 0;
      await tx.payment.update({
        where: { id: resolvedPayment.id },
        data: {
          stripeChargeId: resolvedPayment.stripeChargeId || charge.id,
          refundedAmount: refundTotal || null,
          refundedAt: refundTotal > 0 ? refundAt : resolvedPayment.refundedAt,
          status: isFullRefund ? 'refunded' : resolvedPayment.status,
        },
      });
      ownerId = ownerId || resolvedPayment.ownerId;
    }

    if (!ownerId) {
      logger.warn({ chargeId: charge.id, paymentIntentId }, 'Refund owner could not be resolved');
      return;
    }

    for (const refund of fallbackRefunds) {
      const refundId = refund.id || null;
      const refundAmount = refund.amount || 0;
      if (!refundAmount) {
        continue;
      }
      const occurredAt = refund.created ? new Date(refund.created * 1000) : new Date();
      await ensurePaymentAdjustment(tx, {
        ownerId,
        paymentId: resolvedPayment?.id || null,
        type: 'refund',
        amount: refundAmount,
        currency,
        stripeChargeId: charge.id,
        stripeRefundId: refundId,
        status: refund.status || null,
        reason: refund.reason || null,
        occurredAt,
        meta: {
          paymentIntentId,
          invoiceId,
          chargeId: charge.id,
        },
      });

      await reverseCreditsForAdjustment({
        tx,
        ownerId,
        payment: resolvedPayment || null,
        paymentIntentId,
        refundAmount,
        paymentAmountOverride: resolvedPayment?.amount || charge.amount || 0,
        adjustmentType: 'refund',
        adjustmentId: refundId || charge.id,
        chargeId: charge.id,
        invoiceId,
      });
    }

    const purchase = paymentIntentId
      ? await tx.purchase.findFirst({
        where: {
          stripePaymentIntentId: paymentIntentId,
          ownerId,
        },
      })
      : null;

    if (purchase && purchase.status !== 'refunded') {
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { status: 'refunded', updatedAt: new Date() },
      });
      logger.info({ purchaseId: purchase.id }, 'Purchase marked as refunded');
    }
  });
}

/**
 * Handle charge.dispute.created / updated event
 */
async function handleChargeDisputeUpdated(dispute) {
  if (!dispute) {
    return;
  }
  const chargeId = dispute.charge;
  const paymentIntentId = dispute.payment_intent || null;
  const amount = dispute.amount || 0;
  const currency = dispute.currency ? String(dispute.currency).toUpperCase() : 'EUR';
  const status = dispute.status || null;
  const reason = dispute.reason || null;
  const occurredAt = dispute.created ? new Date(dispute.created * 1000) : new Date();

  await prisma.$transaction(async (tx) => {
    let payment = null;
    if (chargeId) {
      payment = await tx.payment.findFirst({
        where: {
          OR: [
            { stripeChargeId: chargeId },
            paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : undefined,
          ].filter(Boolean),
        },
      });
    }

    let ownerId = payment?.ownerId || null;
    if (!ownerId && dispute.customer) {
      ownerId = await resolveOwnerIdFromCustomer(dispute.customer);
    }

    if (!ownerId) {
      logger.warn({ disputeId: dispute.id, chargeId }, 'Dispute owner could not be resolved');
      return;
    }

    if (payment) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          stripeChargeId: payment.stripeChargeId || chargeId || null,
          stripeDisputeId: dispute.id,
          disputeStatus: status,
          disputeReason: reason,
          disputeAmount: amount || null,
          disputedAt: occurredAt,
        },
      });
    }

    await ensurePaymentAdjustment(tx, {
      ownerId,
      paymentId: payment?.id || null,
      type: 'dispute',
      amount,
      currency,
      stripeChargeId: chargeId || null,
      stripeDisputeId: dispute.id,
      status,
      reason,
      occurredAt,
      meta: {
        paymentIntentId,
        chargeId,
      },
    });

    if (amount > 0) {
      await reverseCreditsForAdjustment({
        tx,
        ownerId,
        payment,
        paymentIntentId,
        refundAmount: amount,
        paymentAmountOverride: payment?.amount || 0,
        adjustmentType: 'dispute',
        adjustmentId: dispute.id,
        chargeId,
        invoiceId: null,
      });
    }

    if (status && status !== 'won') {
      await setBillingHold(ownerId, `dispute:${dispute.id}`, tx);
    }
  });
}

/**
 * Handle charge.dispute.closed event
 */
async function handleChargeDisputeClosed(dispute) {
  if (!dispute) {
    return;
  }
  const status = dispute.status || null;
  await prisma.$transaction(async (tx) => {
    const adjustment = await tx.paymentAdjustment.findFirst({
      where: { stripeDisputeId: dispute.id },
    });
    if (adjustment) {
      await tx.paymentAdjustment.update({
        where: { id: adjustment.id },
        data: {
          status,
          reason: dispute.reason || adjustment.reason,
          occurredAt: dispute.created ? new Date(dispute.created * 1000) : adjustment.occurredAt,
        },
      });
    }

    const payment = await tx.payment.findFirst({
      where: { stripeDisputeId: dispute.id },
    });
    if (payment) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          disputeStatus: status,
        },
      });
    }

    if (status === 'won') {
      const ownerId = adjustment?.ownerId || payment?.ownerId || null;
      if (ownerId) {
        await clearBillingHoldIfMatches(ownerId, `dispute:${dispute.id}`, tx);
      }
    }
  });
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(subscription) {
  const subscriptionId = subscription.id;
  const customerId = subscription.customer;

  logger.info({ subscriptionId, customerId }, 'Processing subscription deleted event');

  if (!subscriptionId) {
    logger.warn({ subscription }, 'Subscription deleted event missing subscription ID');
    return;
  }

  // Find user by Stripe subscription ID
  const user = await prisma.user.findFirst({
    where: {
      stripeSubscriptionId: subscriptionId,
    },
    select: {
      id: true,
      subscriptionStatus: true,
      planType: true,
      subscriptionInterval: true,
    },
  });

  if (!user) {
    logger.warn({ subscriptionId, customerId }, 'User not found for deleted subscription');
    return;
  }

  logger.info({
    userId: user.id,
    subscriptionId,
    currentStatus: user.subscriptionStatus,
    planType: user.planType,
  }, 'Deactivating subscription in local database');

  // Deactivate subscription
  try {
    await deactivateSubscription(user.id, 'cancelled');
    await prisma.subscription.update({
      where: { ownerId: user.id },
      data: {
        status: 'cancelled',
        cancelAtPeriodEnd: false,
      },
    }).catch((err) => {
      if (err?.code !== 'P2025') {
        logger.warn({ userId: user.id, err: err.message }, 'Failed to update subscription record on delete');
      }
    });
    logger.info({
      userId: user.id,
      subscriptionId,
      planType: user.planType,
    }, 'Subscription deactivated successfully');
  } catch (err) {
    logger.error({
      userId: user.id,
      subscriptionId,
      err: err.message,
      stack: err.stack,
    }, 'Failed to deactivate subscription');
    throw err;
  }
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(subscription) {
  const subscriptionId = subscription.id;
  const customerId = subscription.customer;
  const status = subscription.status;

  logger.info({ subscriptionId, customerId, status }, 'Processing subscription updated event');

  if (!subscriptionId) {
    logger.warn({ subscription }, 'Subscription updated event missing subscription ID');
    return;
  }

  // Find user by Stripe subscription ID
  const user = await prisma.user.findFirst({
    where: {
      stripeSubscriptionId: subscriptionId,
    },
    select: {
      id: true,
      subscriptionStatus: true,
      planType: true,
    },
  });

  if (!user) {
    logger.warn({ subscriptionId, customerId }, 'User not found for updated subscription');
    return;
  }

  // Extract planType from subscription metadata or price ID
  let newPlanType = user.planType;
  const subscriptionMetadata = subscription.metadata || {};
  const metadataPlanType = subscriptionMetadata.planType;

  // Try to get planType from metadata first
  if (metadataPlanType && ['starter', 'pro'].includes(metadataPlanType)) {
    newPlanType = metadataPlanType;
  } else if (subscription.items?.data?.[0]?.price?.id) {
    // Fallback: determine planType from price ID
    const priceId = subscription.items.data[0].price.id;
    const planCatalog = require('../services/plan-catalog.service');
    const resolved = planCatalog.resolvePlanFromPriceId(priceId);
    if (resolved?.planCode) {
      newPlanType = resolved.planCode;
    }
  }

  // Update subscription status based on Stripe status
  const newStatus = mapStripeStatus(status);
  const period = extractSubscriptionPeriod(subscription);
  const derivedInterval = period.interval || (newPlanType ? getIntervalForPlan(newPlanType) : null);
  const includedSmsPerPeriod = derivedInterval ? getIncludedSmsForInterval(derivedInterval) : null;
  const pendingChange = await derivePendingChangeFromSchedule(subscription);

  // Determine what needs to be updated
  const statusChanged = user.subscriptionStatus !== newStatus;
  const planTypeChanged = newPlanType && user.planType !== newPlanType;
  const intervalChanged = derivedInterval && user.subscriptionInterval !== derivedInterval;
  const hasPeriodUpdate = period.currentPeriodStart || period.currentPeriodEnd || period.cancelAtPeriodEnd !== null;

  if (statusChanged || planTypeChanged || intervalChanged || hasPeriodUpdate) {
    logger.info({
      userId: user.id,
      subscriptionId,
      oldStatus: user.subscriptionStatus,
      newStatus,
      oldPlanType: user.planType,
      newPlanType,
      interval: derivedInterval,
      stripeStatus: status,
    }, 'Updating subscription status/plan/interval');

    try {
      const updateData = {};
      if (statusChanged) {
        updateData.subscriptionStatus = newStatus;
      }
      if (planTypeChanged) {
        updateData.planType = newPlanType;
      }
      if (derivedInterval) {
        updateData.subscriptionInterval = derivedInterval;
        updateData.includedSmsPerPeriod = includedSmsPerPeriod;
      }
      if (period.currentPeriodStart) {
        updateData.subscriptionCurrentPeriodStart = period.currentPeriodStart;
      }
      if (period.currentPeriodEnd) {
        updateData.subscriptionCurrentPeriodEnd = period.currentPeriodEnd;
      }
      if (period.cancelAtPeriodEnd !== null && period.cancelAtPeriodEnd !== undefined) {
        updateData.cancelAtPeriodEnd = period.cancelAtPeriodEnd;
      }
      if (newStatus === 'active') {
        updateData.lastBillingError = null;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
      logger.info({
        userId: user.id,
        subscriptionId,
        oldStatus: user.subscriptionStatus,
        newStatus,
        oldPlanType: user.planType,
        newPlanType,
      }, 'Subscription updated successfully');
    } catch (err) {
      logger.error({
        userId: user.id,
        subscriptionId,
        err: err.message,
        stack: err.stack,
      }, 'Failed to update subscription');
      throw err;
    }
  } else {
    logger.debug({
      userId: user.id,
      subscriptionId,
      status: user.subscriptionStatus,
      planType: user.planType,
      stripeStatus: status,
    }, 'Subscription status and planType unchanged');
  }

  const subscriptionCurrency = subscription.items?.data?.[0]?.price?.currency
    ? String(subscription.items.data[0].price.currency).toUpperCase()
    : null;

  await prisma.subscription.upsert({
    where: { ownerId: user.id },
    update: {
      stripeCustomerId: customerId || null,
      stripeSubscriptionId: subscriptionId,
      planCode: newPlanType,
      status: newStatus,
      currency: subscriptionCurrency,
      currentPeriodStart: period.currentPeriodStart || null,
      currentPeriodEnd: period.currentPeriodEnd || null,
      cancelAtPeriodEnd: period.cancelAtPeriodEnd ?? false,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      pendingChangePlanCode: pendingChange?.planCode || null,
      pendingChangeInterval: pendingChange?.interval || null,
      pendingChangeCurrency: pendingChange?.currency || null,
      pendingChangeEffectiveAt: pendingChange?.effectiveAt || null,
      metadata: subscription.metadata || undefined,
    },
    create: {
      ownerId: user.id,
      provider: 'stripe',
      stripeCustomerId: customerId || null,
      stripeSubscriptionId: subscriptionId,
      planCode: newPlanType,
      status: newStatus,
      currency: subscriptionCurrency,
      currentPeriodStart: period.currentPeriodStart || null,
      currentPeriodEnd: period.currentPeriodEnd || null,
      cancelAtPeriodEnd: period.cancelAtPeriodEnd ?? false,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      pendingChangePlanCode: pendingChange?.planCode || null,
      pendingChangeInterval: pendingChange?.interval || null,
      pendingChangeCurrency: pendingChange?.currency || null,
      pendingChangeEffectiveAt: pendingChange?.effectiveAt || null,
      metadata: subscription.metadata || undefined,
    },
  });
}

/**
 * POST /webhooks/stripe
 * Stripe webhook endpoint
 * Must be configured in Stripe dashboard with the webhook secret
 */
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const requestId =
    req.headers['x-request-id'] ||
    req.id ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  if (!WEBHOOK_SECRET) {
    logger.error({ requestId }, 'STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ message: 'Webhook secret not configured', code: 'WEBHOOK_CONFIG_ERROR', requestId });
  }

  if (!signature) {
    logger.warn({ requestId }, 'Stripe webhook missing signature header');
    return res.status(400).json({ message: 'Missing stripe-signature header', code: 'MISSING_SIGNATURE', requestId });
  }

  const rawPayload = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : null);
  if (!rawPayload) {
    logger.error({ requestId }, 'Stripe webhook missing raw payload for signature verification');
    return res.status(400).json({ message: 'Missing raw body for signature verification', code: 'MISSING_RAW_BODY', requestId });
  }

  let event;
  try {
    event = verifyWebhookSignature(rawPayload, signature, WEBHOOK_SECRET);
  } catch (err) {
    const payloadHash = generateEventHash(rawPayload);
    logger.warn({ requestId, err: err.message, payloadHash }, 'Stripe webhook signature verification failed');
    return res.status(400).json({ message: `Webhook signature verification failed: ${err.message}`, code: 'INVALID_SIGNATURE', requestId });
  }

  const payloadHash = generateEventHash(rawPayload);
  const ownerId = await resolveOwnerIdFromStripeEvent(event);

  if (!ownerId) {
    await recordWebhookEvent('stripe', event.id, {
      eventType: event.type,
      payloadHash,
      payload: event.data?.object || null,
      status: 'unmatched',
      error: 'owner_not_found',
    });
    logger.warn({ requestId, eventType: event.type, eventId: event.id, payloadHash }, 'Stripe webhook could not be matched to tenant');
    return res.json({ received: true, unmatched: true, requestId });
  }

  try {
    const result = await processWebhookWithReplayProtection(
      'stripe',
      event.id,
      async () => {
        switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object);
          break;

        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await handlePaymentFailed(event.data.object);
          break;

        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(event.data.object);
          break;

        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object);
          break;

        case 'charge.refunded':
          await handleChargeRefunded(event.data.object);
          break;

        case 'charge.dispute.created':
        case 'charge.dispute.updated':
        case 'charge.dispute.funds_withdrawn':
        case 'charge.dispute.funds_reinstated':
          await handleChargeDisputeUpdated(event.data.object);
          break;

        case 'charge.dispute.closed':
          await handleChargeDisputeClosed(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
          break;

        default:
          logger.debug({ type: event.type }, 'Unhandled Stripe event type');
        }
      },
      {
        payloadHash,
        eventType: event.type,
        ownerId,
        payload: event.data?.object || null,
        eventTimestamp: event.created ? new Date(event.created * 1000) : null,
      },
    );

    if (!result.processed) {
      return res.json({
        received: true,
        duplicate: result.reason === 'duplicate',
        reason: result.reason,
      });
    }

    return res.json({ received: true });
  } catch (err) {
    logger.error({ requestId, err, eventType: event.type, errMessage: err.message, errStack: err.stack }, 'Error processing Stripe webhook');

    // Determine if error is retryable
    // Retryable errors: database connection issues, temporary service unavailability
    // Non-retryable errors: validation errors, business logic errors, data not found
    const isRetryable =
      err.message?.includes('ECONNREFUSED') ||
      err.message?.includes('ETIMEDOUT') ||
      err.message?.includes('database') ||
      err.message?.includes('connection') ||
      err.code === 'ECONNREFUSED' ||
      err.code === 'ETIMEDOUT';

    if (isRetryable) {
      // Return 500 to allow Stripe to retry
      logger.warn({ requestId, eventType: event.type, err: err.message }, 'Retryable error - returning 500 for Stripe retry');
      return res.status(500).json({ message: 'Temporary error processing webhook', code: 'WEBHOOK_PROCESSING_ERROR', retryable: true, requestId });
    } else {
      // Return 200 for non-retryable errors (acknowledge to prevent infinite retries)
      // Log for manual investigation
      logger.error({ requestId, eventType: event.type, err: err.message }, 'Non-retryable error - acknowledging to prevent retries');
      return res.status(200).json({ received: true, message: 'Processing failed but acknowledged', code: 'WEBHOOK_PROCESSING_FAILED', retryable: false, requestId });
    }
  }
});

module.exports = router;
