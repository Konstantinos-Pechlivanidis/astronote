import { logger } from '../utils/logger.js';
import {
  verifyWebhookSignature,
  handlePaymentFailure,
} from '../services/stripe.js';
import billingService from '../services/billing.js';
import { sendSuccess } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

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

    logger.info('Stripe webhook received', {
      eventType: event.type,
      eventId: event.id,
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

    return sendSuccess(res, { message: 'Webhook processed successfully' });
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
 * Uses billingService.handleStripeWebhook for secure processing with:
 * - Idempotency checks
 * - Atomic transactions
 * - WalletTransaction record creation
 */
async function handleCheckoutSessionCompleted(session) {
  try {
    logger.info('Checkout session completed', {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      metadata: session.metadata,
    });

    if (session.payment_status === 'paid') {
      // Use billing service which has proper idempotency, atomic transactions, and WalletTransaction creation
      const event = {
        type: 'checkout.session.completed',
        data: { object: session },
        id: `evt_${session.id}`, // Generate event ID for logging
      };

      await billingService.handleStripeWebhook(event);
    } else {
      logger.warn('Checkout session completed but not paid', {
        sessionId: session.id,
        paymentStatus: session.payment_status,
      });
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
        status: 'pending',
      },
      data: {
        status: 'failed',
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
 * Handle refund events
 * Processes refunds through billing service
 */
async function handleRefund(event) {
  try {
    logger.info('Refund event received', {
      eventType: event.type,
      eventId: event.id,
    });

    // Use billing service to handle refund
    await billingService.handleStripeWebhook(event);
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
