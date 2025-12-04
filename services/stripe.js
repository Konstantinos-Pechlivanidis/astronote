import Stripe from 'stripe';
import prisma from './prisma.js';
import { logger } from '../utils/logger.js';

// Initialize Stripe (only if API key is available)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  })
  : null;

/**
 * Create Stripe checkout session for credit purchase
 */
export async function createStripeCheckoutSession({
  packageId,
  _packageName, // Renamed to indicate unused
  credits,
  price,
  currency,
  stripePriceId,
  shopId,
  shopDomain,
  metadata = {},
  successUrl,
  cancelUrl,
}) {
  try {
    if (!stripe) {
      logger.error('Stripe is not initialized', {
        hasStripeSecretKey: !!process.env.STRIPE_SECRET_KEY,
        shopId,
        packageId,
      });
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.');
    }

    // Validate required parameters
    if (!stripePriceId) {
      logger.error('Missing stripePriceId', { shopId, packageId, currency });
      throw new Error('Stripe price ID is required');
    }

    if (!shopId) {
      logger.error('Missing shopId', { packageId, currency });
      throw new Error('Shop ID is required');
    }

    if (!shopDomain) {
      logger.error('Missing shopDomain', { shopId, packageId });
      throw new Error('Shop domain is required');
    }

    // Merge provided metadata with required fields
    // Ensure shopId is always present (use from metadata if provided, otherwise from parameter)
    const finalMetadata = {
      shopId: metadata.shopId || metadata.storeId || shopId, // Support both shopId and storeId
      storeId: metadata.storeId || shopId, // Keep storeId for backward compatibility
      packageId: metadata.packageId || packageId,
      credits: metadata.credits || credits.toString(),
      shopDomain: metadata.shopDomain || shopDomain,
      ...metadata, // Spread any additional metadata (e.g., transactionId)
    };

    logger.debug('Creating Stripe checkout session', {
      stripePriceId,
      shopId,
      shopDomain,
      packageId,
      credits,
      price,
      currency,
      successUrl,
      cancelUrl,
    });

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: stripePriceId,
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?canceled=true`,
        metadata: finalMetadata,
        customer_email: `${shopDomain}@astronote.com`, // Use shop domain as email
        billing_address_collection: 'required',
        shipping_address_collection: {
          allowed_countries: ['US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'GR'],
        },
        payment_intent_data: {
          statement_descriptor: 'ASTRONOTE MARKETING',
        },
      });

      logger.info('Stripe checkout session created', {
        sessionId: session.id,
        shopId,
        packageId,
        credits,
        price,
        currency,
      });
    } catch (stripeError) {
      logger.error('Stripe API error', {
        error: stripeError.message,
        errorType: stripeError.type,
        errorCode: stripeError.code,
        stripeRequestId: stripeError.requestId,
        shopId,
        packageId,
        stripePriceId,
        currency,
      });

      // Provide more helpful error messages
      if (stripeError.type === 'StripeInvalidRequestError') {
        if (stripeError.message.includes('price')) {
          throw new Error(`Invalid Stripe price ID: ${stripePriceId}. Please configure the correct STRIPE_PRICE_ID environment variable.`);
        }
        throw new Error(`Stripe configuration error: ${stripeError.message}`);
      }

      throw stripeError;
    }

    return session;
  } catch (error) {
    logger.error('Failed to create Stripe checkout session', {
      error: error.message,
      errorName: error.name,
      shopId,
      packageId,
      stripePriceId,
    });
    throw error;
  }
}

/**
 * Retrieve Stripe checkout session
 */
export async function getCheckoutSession(sessionId) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error) {
    logger.error('Failed to retrieve Stripe checkout session', {
      error: error.message,
      sessionId,
    });
    throw error;
  }
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(payload, signature) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.');
    }

    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );

    return event;
  } catch (error) {
    logger.error('Failed to verify Stripe webhook signature', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Handle successful payment
 *
 * NOTE: This function is kept for backward compatibility.
 * For new implementations, use billingService.handleStripeWebhook() which has:
 * - Idempotency checks
 * - Atomic transactions via addCredits()
 * - WalletTransaction record creation
 *
 * @deprecated Prefer using billingService.handleStripeWebhook() for secure processing
 */
export async function handlePaymentSuccess(session) {
  try {
    // Support both shopId and storeId in metadata (they are the same - shop.id)
    const shopId = session.metadata.shopId || session.metadata.storeId;
    const { packageId, credits, transactionId } = session.metadata;

    if (!shopId || !packageId || !credits) {
      throw new Error('Missing required metadata in session. Required: shopId/storeId, packageId, credits');
    }

    const creditsToAdd = parseInt(credits);

    // If transactionId is provided, check for idempotency
    if (transactionId) {
      const transaction = await prisma.billingTransaction.findUnique({
        where: { id: transactionId },
      });

      if (transaction && transaction.status === 'completed') {
        // Get current shop balance
        const shop = await prisma.shop.findUnique({
          where: { id: shopId },
          select: { credits: true },
        });

        logger.warn('Transaction already completed (idempotency check)', {
          transactionId,
          sessionId: session.id,
        });
        return {
          success: true,
          creditsAdded: 0,
          newBalance: shop?.credits || 0,
          alreadyProcessed: true,
        };
      }
    }

    // Use atomic transaction for credit addition
    const result = await prisma.$transaction(async (tx) => {
      // Update shop credits
      const updatedShop = await tx.shop.update({
        where: { id: shopId },
        data: {
          credits: {
            increment: creditsToAdd,
          },
        },
        select: { credits: true },
      });

      // Update billing transaction status (if transactionId provided)
      if (transactionId) {
        await tx.billingTransaction.update({
          where: { id: transactionId },
          data: {
            status: 'completed',
            stripePaymentId: session.payment_intent,
          },
        });
      } else {
        // Fallback: update by session ID (less precise)
        await tx.billingTransaction.updateMany({
          where: {
            shopId,
            stripeSessionId: session.id,
            status: 'pending',
          },
          data: {
            status: 'completed',
            stripePaymentId: session.payment_intent,
          },
        });
      }

      // Create wallet transaction record for audit trail
      await tx.walletTransaction.create({
        data: {
          shopId,
          type: 'purchase',
          credits: creditsToAdd,
          ref: `stripe:${session.id}`,
          meta: {
            sessionId: session.id,
            paymentIntent: session.payment_intent,
            packageId,
            transactionId: transactionId || null,
          },
        },
      });

      return updatedShop;
    });

    logger.info('Payment processed successfully', {
      shopId,
      packageId,
      creditsAdded: creditsToAdd,
      newBalance: result.credits,
      sessionId: session.id,
    });

    return {
      success: true,
      creditsAdded: creditsToAdd,
      newBalance: result.credits,
    };
  } catch (error) {
    logger.error('Failed to handle payment success', {
      error: error.message,
      sessionId: session.id,
    });
    throw error;
  }
}

/**
 * Handle failed payment
 */
export async function handlePaymentFailure(session) {
  try {
    // Support both shopId and storeId in metadata
    const shopId = session.metadata.shopId || session.metadata.storeId;

    if (!shopId) {
      throw new Error('Missing shopId/storeId in session metadata');
    }

    // Update billing transaction status
    await prisma.billingTransaction.updateMany({
      where: {
        shopId,
        stripeSessionId: session.id,
        status: 'pending',
      },
      data: {
        status: 'failed',
      },
    });

    logger.info('Payment failed', {
      shopId,
      sessionId: session.id,
    });

    return {
      success: true,
      message: 'Payment failure recorded',
    };
  } catch (error) {
    logger.error('Failed to handle payment failure', {
      error: error.message,
      sessionId: session.id,
    });
    throw error;
  }
}

/**
 * Get Stripe customer by email
 */
export async function getCustomerByEmail(email) {
  try {
    const customers = await stripe.customers.list({
      email,
      limit: 1,
    });

    return customers.data[0] || null;
  } catch (error) {
    logger.error('Failed to get Stripe customer', {
      error: error.message,
      email,
    });
    throw error;
  }
}

/**
 * Create Stripe customer
 */
export async function createCustomer({ email, name, shopDomain }) {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        shopDomain,
      },
    });

    logger.info('Stripe customer created', {
      customerId: customer.id,
      email,
      shopDomain,
    });

    return customer;
  } catch (error) {
    logger.error('Failed to create Stripe customer', {
      error: error.message,
      email,
      shopDomain,
    });
    throw error;
  }
}
export default {
  createStripeCheckoutSession,
  getCheckoutSession,
  verifyWebhookSignature,
  handlePaymentSuccess,
  handlePaymentFailure,
  getCustomerByEmail,
  createCustomer,
};

