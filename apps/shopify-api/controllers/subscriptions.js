import { logger } from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { getStoreId } from '../middlewares/store-resolution.js';
import {
  getSubscriptionStatus,
  activateSubscription,
  deactivateSubscription,
  allocateFreeCredits,
  getPlanConfig,
  reconcileSubscriptionFromStripe,
} from '../services/subscription.js';
import { SubscriptionPlanType } from '../utils/prismaEnums.js';
import {
  createSubscriptionCheckoutSession,
  updateSubscription,
  cancelSubscription,
  getCheckoutSession,
  ensureStripeCustomer,
} from '../services/stripe.js';
import prisma from '../services/prisma.js';
import Stripe from 'stripe';
import { getBillingProfile } from '../services/billing-profile.js';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  })
  : null;

/**
 * GET /api/subscriptions/status
 * Get current subscription status
 */
export async function getStatus(req, res, next) {
  try {
    const shopId = getStoreId(req);

    const subscription = await getSubscriptionStatus(shopId);

    // Add plan config to response (aligned with Retail)
    const plan = subscription.planType
      ? getPlanConfig(subscription.planType)
      : null;

    return sendSuccess(
      res,
      {
        ...subscription,
        plan, // Include plan config
      },
      'Subscription status retrieved',
    );
  } catch (error) {
    logger.error('Get subscription status error', {
      error: error.message,
      shopId: getStoreId(req),
    });
    next(error);
  }
}

/**
 * POST /api/subscriptions/reconcile
 * Manual reconciliation against Stripe (recovery for missed webhooks)
 */
export async function reconcile(req, res) {
  const requestId = req.id || req.headers['x-request-id'] || 'unknown';
  try {
    const shopId = getStoreId(req);
    const result = await reconcileSubscriptionFromStripe(shopId);

    if (!result.reconciled) {
      return sendSuccess(
        res,
        result,
        'No Stripe subscription to reconcile',
      );
    }

    return sendSuccess(res, result, 'Subscription reconciled');
  } catch (error) {
    if (error.message?.includes('Stripe is not configured')) {
      return sendError(
        res,
        503,
        'STRIPE_NOT_CONFIGURED',
        'Payment processing unavailable',
        { requestId },
      );
    }

    logger.error('Subscription reconcile error', {
      requestId,
      error: error.message,
      shopId: getStoreId(req),
      stack: error.stack,
    });
    return sendError(
      res,
      500,
      'RECONCILE_FAILED',
      'Failed to reconcile subscription',
      { requestId },
    );
  }
}

/**
 * POST /api/subscriptions/subscribe
 * Create subscription checkout session
 * Body: { planType: 'starter' | 'pro' }
 */
export async function subscribe(req, res, next) {
  try {
    const shopId = getStoreId(req);
    const shopDomain = req.ctx?.store?.shopDomain;
    const { planType } = req.body;

    // Check if shop already has an active subscription
    const currentSubscription = await getSubscriptionStatus(shopId);
    if (currentSubscription.active) {
      logger.info(
        {
          shopId,
          currentPlanType: currentSubscription.planType,
          requestedPlanType: planType,
        },
        'Shop attempted to subscribe while already having active subscription',
      );
      return sendError(
        res,
        400,
        'ALREADY_SUBSCRIBED',
        'You already have an active subscription. Please cancel your current subscription before subscribing to a new plan.',
        {
          currentPlan: currentSubscription.planType,
        },
      );
    }

    // Get currency from request or shop settings (aligned with Retail)
    const requestedCurrency = req.body?.currency;
    const validCurrencies = ['EUR', 'USD'];
    let currency = 'EUR';

    if (
      requestedCurrency &&
      validCurrencies.includes(requestedCurrency.toUpperCase())
    ) {
      currency = requestedCurrency.toUpperCase();
    } else {
      // Get shop currency
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { currency: true },
      });
      if (
        shop?.currency &&
        validCurrencies.includes(shop.currency.toUpperCase())
      ) {
        currency = shop.currency.toUpperCase();
      }
    }

    const { buildFrontendUrl } = await import('../utils/frontendUrl.js');

    // Build success URL with query parameters
    // Note: Stripe requires {CHECKOUT_SESSION_ID} as literal string in URL
    const successUrl = buildFrontendUrl('/app/billing/success', null, {
      session_id: '{CHECKOUT_SESSION_ID}',
      type: 'subscription',
    });

    // Build cancel URL
    const cancelUrl = buildFrontendUrl('/app/billing/cancel');

    // Validate URLs before passing to Stripe (fail fast with clear error)
    const { isValidAbsoluteUrl } = await import('../utils/url-helpers.js');
    if (!isValidAbsoluteUrl(successUrl)) {
      logger.error('Invalid success URL for subscription checkout', {
        successUrl,
        shopId,
        planType,
      });
      return sendError(
        res,
        500,
        'CONFIG_ERROR',
        `Invalid frontend URL configuration. Success URL is not valid: ${successUrl}. Please set FRONTEND_URL environment variable to a valid absolute URL (e.g., https://astronote.onrender.com).`,
      );
    }
    if (!isValidAbsoluteUrl(cancelUrl)) {
      logger.error('Invalid cancel URL for subscription checkout', {
        cancelUrl,
        shopId,
        planType,
      });
      return sendError(
        res,
        500,
        'CONFIG_ERROR',
        `Invalid frontend URL configuration. Cancel URL is not valid: ${cancelUrl}. Please set FRONTEND_URL environment variable to a valid absolute URL (e.g., https://astronote.onrender.com).`,
      );
    }

    const billingProfile = await getBillingProfile(shopId);
    const stripeCustomerId = await ensureStripeCustomer({
      shopId,
      shopDomain,
      shopName: req.ctx?.store?.shopName,
      currency,
      stripeCustomerId: currentSubscription.stripeCustomerId,
      billingProfile,
    });

    const session = await createSubscriptionCheckoutSession({
      shopId,
      shopDomain,
      planType,
      currency, // Use resolved currency
      stripeCustomerId,
      successUrl,
      cancelUrl,
    });

    return sendSuccess(
      res,
      {
        checkoutUrl: session.url,
        sessionId: session.id,
        planType,
        currency, // Include currency in response (aligned with Retail)
      },
      'Subscription checkout session created',
      201,
    );
  } catch (error) {
    // Handle specific error cases
    if (error.message?.includes('Stripe price ID not found')) {
      return sendError(res, 400, 'MISSING_PRICE_ID', error.message);
    }
    if (
      error.message?.includes('not a recurring price') ||
      error.message?.includes('recurring price')
    ) {
      return sendError(res, 400, 'INVALID_PRICE_TYPE', error.message);
    }
    if (error.message?.includes('not found in Stripe')) {
      return sendError(res, 400, 'PRICE_NOT_FOUND', error.message);
    }
    if (error.message?.includes('Stripe is not configured')) {
      return sendError(
        res,
        503,
        'STRIPE_NOT_CONFIGURED',
        'Payment processing unavailable',
      );
    }
    if (error.message?.includes('Stripe error:')) {
      return sendError(res, 400, 'STRIPE_ERROR', error.message);
    }
    if (error.message?.includes('Invalid plan type')) {
      return sendError(res, 400, 'INVALID_PLAN_TYPE', error.message);
    }

    logger.error('Subscribe error', {
      error: error.message,
      shopId: getStoreId(req),
    });
    next(error);
  }
}

/**
 * POST /api/subscriptions/switch
 * Switch subscription interval (monthly/yearly) or plan
 * Body: { interval?: 'month' | 'year', planType?: 'starter' | 'pro' }
 */
export async function switchInterval(req, res, next) {
  try {
    const shopId = getStoreId(req);
    const { interval, planType } = req.body;

    if (!interval && !planType) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'Either interval or planType must be provided',
      );
    }

    const subscription = await getSubscriptionStatus(shopId);

    if (!subscription.active || !subscription.stripeSubscriptionId) {
      return sendError(
        res,
        400,
        'NO_ACTIVE_SUBSCRIPTION',
        'No active subscription found. Please subscribe first.',
      );
    }

    // Switch interval if provided
    if (interval) {
      const { switchSubscriptionInterval } = await import('../services/subscription.js');
      await switchSubscriptionInterval(shopId, interval);
    }

    // Update plan if provided
    if (planType) {
      await update(req, res, next);
      return; // update() already sends response
    }

    // If only interval was provided, return success
    return sendSuccess(
      res,
      {
        interval,
      },
      `Subscription interval switched to ${interval} successfully`,
    );
  } catch (error) {
    logger.error('Switch subscription interval error', {
      error: error.message,
      shopId: getStoreId(req),
    });
    next(error);
  }
}

/**
 * POST /api/subscriptions/update
 * Update subscription plan (upgrade/downgrade)
 * Body: { planType: 'starter' | 'pro' }
 */
export async function update(req, res, next) {
  try {
    const shopId = getStoreId(req);
    const { planType } = req.body;

    const subscription = await getSubscriptionStatus(shopId);

    if (!subscription.active || !subscription.stripeSubscriptionId) {
      return sendError(
        res,
        400,
        'NO_ACTIVE_SUBSCRIPTION',
        'No active subscription found. Please subscribe first.',
      );
    }

    // Check if already on the requested plan
    if (subscription.planType === planType) {
      return sendError(
        res,
        400,
        'ALREADY_ON_PLAN',
        `You are already on the ${planType} plan.`,
        {
          currentPlan: planType,
        },
      );
    }

    // Check if update is already in progress (idempotency check)
    // Get current subscription from Stripe to check metadata
    if (!stripe) {
      return sendError(
        res,
        503,
        'STRIPE_NOT_CONFIGURED',
        'Payment processing unavailable',
      );
    }

    let stripeSubscription = null;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId,
      );

      // Check if planType in Stripe already matches requested planType
      const stripeMetadata = stripeSubscription.metadata || {};
      const stripePlanType = stripeMetadata.planType;

      if (stripePlanType === planType && subscription.planType === planType) {
        logger.info(
          {
            shopId,
            subscriptionId: subscription.stripeSubscriptionId,
            planType,
          },
          'Subscription already on requested plan (idempotency check)',
        );

        return sendSuccess(
          res,
          {
            planType,
            alreadyUpdated: true,
          },
          `Subscription is already on the ${planType} plan`,
        );
      }
    } catch (err) {
      logger.warn(
        {
          subscriptionId: subscription.stripeSubscriptionId,
          err: err.message,
        },
        'Failed to retrieve subscription from Stripe for idempotency check',
      );
      // Continue with update anyway
    }

    // Get currency from request or shop settings (aligned with Retail)
    const requestedCurrency = req.body?.currency;
    const validCurrencies = ['EUR', 'USD'];
    let currency = 'EUR';

    if (
      requestedCurrency &&
      validCurrencies.includes(requestedCurrency.toUpperCase())
    ) {
      currency = requestedCurrency.toUpperCase();
    } else {
      // Get shop currency
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { currency: true },
      });
      if (
        shop?.currency &&
        validCurrencies.includes(shop.currency.toUpperCase())
      ) {
        currency = shop.currency.toUpperCase();
      }
    }

    await updateSubscription(
      subscription.stripeSubscriptionId,
      planType,
      currency, // Pass currency to update (aligned with Retail)
    );

    // Update local DB immediately (idempotent - activateSubscription checks current state)
    await activateSubscription(
      shopId,
      subscription.stripeCustomerId,
      subscription.stripeSubscriptionId,
      planType,
    );

    logger.info(
      {
        shopId,
        oldPlan: subscription.planType,
        newPlan: planType,
        subscriptionId: subscription.stripeSubscriptionId,
      },
      'Subscription plan updated',
    );

    return sendSuccess(
      res,
      {
        planType,
        currency, // Include currency in response (aligned with Retail)
      },
      `Subscription updated to ${planType} plan successfully`,
    );
  } catch (error) {
    logger.error('Update subscription error', {
      error: error.message,
      shopId: getStoreId(req),
    });
    next(error);
  }
}

/**
 * POST /api/subscriptions/cancel
 * Cancel subscription
 */
export async function cancel(req, res, next) {
  try {
    const shopId = getStoreId(req);

    const subscription = await getSubscriptionStatus(shopId);

    if (!subscription.active || !subscription.stripeSubscriptionId) {
      return sendError(
        res,
        400,
        'NO_ACTIVE_SUBSCRIPTION',
        'No active subscription found.',
      );
    }

    if (!stripe) {
      return sendError(
        res,
        503,
        'STRIPE_NOT_CONFIGURED',
        'Payment processing unavailable',
      );
    }

    // Cancel subscription in Stripe using service function
    await cancelSubscription(subscription.stripeSubscriptionId);

    // Update local DB immediately
    await deactivateSubscription(shopId, 'cancelled');

    logger.info(
      {
        shopId,
        subscriptionId: subscription.stripeSubscriptionId,
      },
      'Subscription cancelled',
    );

    return sendSuccess(
      res,
      {
        cancelledAt: new Date().toISOString(),
      },
      'Subscription cancelled successfully',
    );
  } catch (error) {
    logger.error('Cancel subscription error', {
      error: error.message,
      shopId: getStoreId(req),
    });
    next(error);
  }
}

/**
 * POST /api/subscriptions/verify-session
 * Manual verification of subscription payment
 * Body: { sessionId: string }
 */
export async function verifySession(req, res, next) {
  try {
    const shopId = getStoreId(req);
    const { sessionId } = req.body;

    if (!sessionId) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Session ID is required');
    }

    if (!stripe) {
      return sendError(
        res,
        503,
        'STRIPE_NOT_CONFIGURED',
        'Payment processing unavailable',
      );
    }

    // Retrieve session from Stripe
    const session = await getCheckoutSession(sessionId);

    // Verify session belongs to this shop
    const metadataShopId =
      session.metadata?.shopId || session.metadata?.storeId;
    if (metadataShopId !== shopId) {
      return sendError(
        res,
        403,
        'FORBIDDEN',
        'Session does not belong to this shop',
      );
    }

    // Check if subscription already active (idempotency)
    const currentSubscription = await getSubscriptionStatus(shopId);
    if (
      currentSubscription.active &&
      currentSubscription.stripeSubscriptionId
    ) {
      return sendSuccess(
        res,
        {
          subscription: currentSubscription,
          alreadyProcessed: true,
        },
        'Subscription already active',
      );
    }

    // Process subscription activation
    if (session.mode === 'subscription' && session.subscription) {
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription.id;
      const customerId =
        typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id;

      if (!subscriptionId || !customerId) {
        return sendError(
          res,
          400,
          'INVALID_SESSION',
          'Session does not contain valid subscription or customer information',
        );
      }

      // Retrieve subscription from Stripe
      const stripeSubscription =
        await stripe.subscriptions.retrieve(subscriptionId);
      const planType =
        session.metadata?.planType || stripeSubscription.metadata?.planType;

      if (
        !planType ||
        ![
          SubscriptionPlanType.starter,
          SubscriptionPlanType.pro,
        ].includes(planType)
      ) {
        return sendError(
          res,
          400,
          'INVALID_PLAN_TYPE',
          'Invalid plan type in session',
        );
      }

      // Activate subscription
      await activateSubscription(shopId, customerId, subscriptionId, planType);

      // Allocate free credits
      const result = await allocateFreeCredits(
        shopId,
        planType,
        `sub_${subscriptionId}`,
        stripeSubscription,
      );

      return sendSuccess(
        res,
        {
          subscription: await getSubscriptionStatus(shopId),
          creditsAllocated: result.allocated ? result.credits : 0,
        },
        'Subscription verified and activated',
      );
    }

    return sendError(
      res,
      400,
      'INVALID_SESSION',
      'Session is not a subscription session',
    );
  } catch (error) {
    logger.error('Verify session error', {
      error: error.message,
      shopId: getStoreId(req),
    });
    next(error);
  }
}

/**
 * GET /api/subscriptions/portal
 * Get Stripe Customer Portal URL
 */
export async function getPortal(req, res, _next) {
  const requestId =
    req.id ||
    req.headers['x-request-id'] ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const shopId = getStoreId(req);
    const shopDomain = req.ctx?.store?.shopDomain;
    const subscription = await getSubscriptionStatus(shopId);

    // Resolve or create Stripe customer (aligned with Retail)
    let stripeCustomerId = subscription.stripeCustomerId;

    // Check if customer ID is valid
    const isValidStripeCustomerId = (value) =>
      typeof value === 'string' && value.startsWith('cus_');

    if (!isValidStripeCustomerId(stripeCustomerId)) {
      // Try to resolve from subscription if available
      if (subscription.stripeSubscriptionId && stripe) {
        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(
            subscription.stripeSubscriptionId,
          );
          const resolvedCustomerId =
            typeof stripeSubscription.customer === 'string'
              ? stripeSubscription.customer
              : stripeSubscription.customer?.id;
          if (isValidStripeCustomerId(resolvedCustomerId)) {
            stripeCustomerId = resolvedCustomerId;
            // Update shop record
            await prisma.shop.update({
              where: { id: shopId },
              data: { stripeCustomerId },
            });
          }
        } catch (err) {
          logger.warn({
            requestId,
            shopId,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            err: err.message,
          }, 'Failed to resolve Stripe customer from subscription');
        }
      }

      // Create customer if still missing (aligned with Retail)
      if (!isValidStripeCustomerId(stripeCustomerId)) {
        if (!stripe) {
          return sendError(
            res,
            503,
            'STRIPE_NOT_CONFIGURED',
            'Payment processing unavailable',
            { requestId },
          );
        }

        const shop = await prisma.shop.findUnique({
          where: { id: shopId },
          select: { shopName: true, currency: true },
        });

        const customer = await stripe.customers.create({
          email: `${shopDomain}@astronote.com`,
          name: shop?.shopName || shopDomain,
          metadata: {
            shopId: String(shopId),
            shopDomain: shopDomain || '',
            billingCurrency: shop?.currency || 'EUR',
          },
        });

        stripeCustomerId = customer.id;

        // Update shop record
        await prisma.shop.update({
          where: { id: shopId },
          data: { stripeCustomerId },
        });

        logger.info({
          requestId,
          shopId,
          customerId: stripeCustomerId,
        }, 'Created Stripe customer for portal access');
      }
    }

    if (!isValidStripeCustomerId(stripeCustomerId)) {
      return sendError(
        res,
        400,
        'MISSING_CUSTOMER_ID',
        'No payment account found. Please subscribe to a plan first.',
        { requestId },
      );
    }

    const { getCustomerPortalUrl } = await import('../services/stripe.js');
    const { buildFrontendUrl } = await import('../utils/frontendUrl.js');
    const returnUrl = buildFrontendUrl('/app/billing');

    const portalUrl = await getCustomerPortalUrl(stripeCustomerId, returnUrl);

    return sendSuccess(res, { portalUrl });
  } catch (error) {
    if (error.message?.includes('Stripe is not configured')) {
      return sendError(
        res,
        503,
        'STRIPE_NOT_CONFIGURED',
        'Payment processing unavailable',
        { requestId },
      );
    }
    logger.error('Get portal error', {
      requestId,
      error: error.message,
      shopId: getStoreId(req),
      stack: error.stack,
    });
    return sendError(
      res,
      502,
      'STRIPE_PORTAL_ERROR',
      'Failed to create customer portal session',
      { requestId },
    );
  }
}
