import { logger } from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { getStoreId } from '../middlewares/store-resolution.js';
import {
  getSubscriptionStatus,
  activateSubscription,
  allocateFreeCredits,
  getPlanConfig,
} from '../services/subscription.js';
import { getSubscriptionStatusWithStripeSync } from '../services/stripe-sync.js';
import { SubscriptionPlanType } from '../utils/prismaEnums.js';
import { computeAllowedActions } from '../services/subscription-actions.js';
import {
  createSubscriptionCheckoutSession,
  cancelSubscription,
  resumeSubscription,
  getCheckoutSession,
  ensureStripeCustomer,
} from '../services/stripe.js';
import { syncBillingProfileFromStripe } from '../services/billing-profile.js';
import { resolveTaxTreatment, resolveTaxRateForInvoice } from '../services/tax-resolver.js';
import { upsertTaxEvidence } from '../services/tax-evidence.js';
import {
  decideChangeMode,
  isValidScheduledChange,
} from '../services/subscription-change-policy.js';
import { getImpliedInterval } from '../services/plan-catalog.js';
import prisma from '../services/prisma.js';
import Stripe from 'stripe';
import { getBillingProfile } from '../services/billing-profile.js';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  })
  : null;

function normalizeInterval(value) {
  if (value == null) {
    return null;
  }
  const str = String(value).toLowerCase();
  return ['month', 'year'].includes(str) ? str : null;
}

function enforceImpliedIntervalOrSendError(res, planType, requestedInterval) {
  const implied = getImpliedInterval(planType);
  if (!implied) {
    sendError(res, 400, 'INVALID_PLAN_TYPE', `Invalid plan type: ${planType}`);
    return { ok: false };
  }

  if (requestedInterval == null) {
    return { ok: true, resolvedInterval: implied };
  }

  const normalized = normalizeInterval(requestedInterval);
  if (!normalized) {
    sendError(
      res,
      400,
      'VALIDATION_ERROR',
      `Invalid interval: ${requestedInterval}. Allowed: month, year`,
    );
    return { ok: false };
  }

  if (normalized !== implied) {
    sendError(
      res,
      400,
      'INVALID_INTERVAL_FOR_PLAN',
      'Invalid interval for plan. starter=month, pro=year',
      { planType, interval: normalized, impliedInterval: implied },
    );
    return { ok: false };
  }

  return { ok: true, resolvedInterval: normalized };
}

/**
 * GET /api/subscriptions/status
 * Get current subscription status
 */
export async function getStatus(req, res, next) {
  try {
    const shopId = getStoreId(req);

    const subscription = await getSubscriptionStatusWithStripeSync(shopId);

    // Add plan config to response (aligned with Retail)
    const planType = subscription.planCode || subscription.planType;
    const plan = planType ? getPlanConfig(planType) : null;

    // Compute allowed actions (backend-driven action matrix)
    const allowedActions = computeAllowedActions(subscription);

    return sendSuccess(
      res,
      {
        ...subscription,
        plan, // Include plan config
        allowedActions, // Server-computed allowed actions (prevents frontend/backend drift)
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
    // Use StripeSyncService for absolute transparency
    const subscription = await getSubscriptionStatusWithStripeSync(shopId);
    const reconciled = subscription.mismatchDetected || subscription.sourceOfTruth === 'stripe_verified';

    if (!reconciled && !subscription.stripeSubscriptionId) {
      return sendSuccess(
        res,
        {
          reconciled: false,
          reason: 'No Stripe subscription to reconcile',
          subscription: null,
        },
        'No Stripe subscription to reconcile',
      );
    }

    return sendSuccess(
      res,
      {
        reconciled,
        reason: reconciled
          ? 'Subscription reconciled with Stripe'
          : 'Subscription already in sync',
        subscription,
      },
      reconciled
        ? 'Subscription reconciled successfully'
        : 'Subscription already in sync',
    );
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
    const { planType, interval, currency: requestedCurrencyParam } = req.body;

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

    // Simplified policy: starter=month, pro=year (interval may be omitted; if provided must match).
    const intervalCheck = enforceImpliedIntervalOrSendError(res, planType, interval);
    if (!intervalCheck.ok) {
      return;
    }
    const resolvedInterval = intervalCheck.resolvedInterval;

    // Get currency from request or shop settings (aligned with Retail)
    const validCurrencies = ['EUR', 'USD'];
    let currency = 'EUR';

    if (
      requestedCurrencyParam &&
      validCurrencies.includes(requestedCurrencyParam.toUpperCase())
    ) {
      currency = requestedCurrencyParam.toUpperCase();
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

    const { getFrontendBaseUrlSync } = await import('../utils/frontendUrl.js');
    const { normalizeBaseUrl } = await import('../utils/url-helpers.js');

    // Build success URL with {CHECKOUT_SESSION_ID} token (must NOT be URL-encoded)
    // Stripe requires literal {CHECKOUT_SESSION_ID} string in URL, not encoded
    const baseUrl = normalizeBaseUrl(getFrontendBaseUrlSync());
    if (!baseUrl) {
      throw new Error('FRONTEND_URL is not configured. Please set FRONTEND_URL environment variable.');
    }
    // Route is /app/shopify/billing/success (Next.js app router structure)
    const successUrl = `${baseUrl}/app/shopify/billing/success?session_id={CHECKOUT_SESSION_ID}&type=subscription`;

    // Build cancel URL
    const cancelUrl = `${baseUrl}/app/shopify/billing/cancel`;

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

    // PHASE 3.5: Remove pre-checkout billing profile gating
    // Stripe Checkout collects all required billing details (email, address, tax ID)
    // We no longer require in-app billing profile to be complete before checkout
    // Billing profile will be auto-synced from Stripe after successful checkout

    // Get existing billing profile (if any) for pre-filling checkout email
    const billingProfile = await getBillingProfile(shopId);

    // Validate Stripe Checkout configuration instead of DB profile
    // Checkout must be configured to collect required details
    // This is already ensured in createSubscriptionCheckoutSession:
    // - billing_address_collection: 'required'
    // - tax_id_collection: { enabled: true }
    // - customer_email or customer creation

    logger.info('Allowing checkout without pre-filled billing profile', {
      shopId,
      hasBillingProfile: !!billingProfile,
      note: 'Billing details will be collected in Stripe Checkout and synced after payment',
    });

    // Ensure Stripe customer exists (use billing profile email if available, otherwise let Checkout collect it)
    const stripeCustomerId = await ensureStripeCustomer({
      shopId,
      shopDomain,
      shopName: req.ctx?.store?.shopName,
      currency,
      stripeCustomerId: currentSubscription.stripeCustomerId,
      billingProfile, // Pre-fill email if available, but not required
    });

    const session = await createSubscriptionCheckoutSession({
      shopId,
      shopDomain,
      planType,
      interval: resolvedInterval,
      currency, // Use resolved currency
      stripeCustomerId,
      billingProfile, // Pass billing profile for email
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
    const { interval: targetInterval, planType: targetPlanCode } = req.body;
    let changeMode = null;
    let normalizedTarget = null;

    if (!targetInterval && !targetPlanCode) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'Either interval or planType must be provided',
      );
    }

    // Use StripeSyncService for absolute transparency
    const subscription = await getSubscriptionStatusWithStripeSync(shopId);

    if (!subscription.active || !subscription.stripeSubscriptionId) {
      return sendError(
        res,
        400,
        'NO_ACTIVE_SUBSCRIPTION',
        'No active subscription found. Please subscribe first.',
      );
    }

    // If planType is provided, use update endpoint logic
    if (targetPlanCode) {
      // Update will handle the change logic (including Pro Yearly downgrade exception)
      return update(req, res, next);
    }

    // If only interval switch (same plan, different interval)
    if (targetInterval) {
      // Simplified policy: interval is implied by plan (starter=month, pro=year).
      // Do not allow switching to an unsupported interval.
      const currentPlan = subscription.planCode || subscription.planType;
      const implied = getImpliedInterval(currentPlan);
      normalizedTarget = normalizeInterval(targetInterval);
      if (!normalizedTarget) {
        return sendError(
          res,
          400,
          'VALIDATION_ERROR',
          `Invalid interval: ${targetInterval}. Allowed: month, year`,
        );
      }
      if (implied && normalizedTarget !== implied) {
        return sendError(
          res,
          400,
          'INVALID_INTERVAL_FOR_PLAN',
          'Invalid interval for plan. starter=month, pro=year',
          { planType: currentPlan, interval: normalizedTarget, impliedInterval: implied },
        );
      }

      // If requested interval equals current interval, treat as no-op.
      if (subscription.interval && normalizedTarget === String(subscription.interval).toLowerCase()) {
        const updatedStatus = await getSubscriptionStatusWithStripeSync(shopId);
        const subscriptionDto = {
          ...updatedStatus,
          allowedActions: computeAllowedActions(updatedStatus),
        };
        return sendSuccess(
          res,
          {
            interval: normalizedTarget,
            changeMode: 'none',
            scheduled: false,
            subscription: subscriptionDto,
          },
          'Subscription already on requested interval',
        );
      }

      const { switchSubscriptionInterval } = await import('../services/subscription.js');
      changeMode = decideChangeMode(
        {
          planCode: subscription.planCode || subscription.planType,
          interval: subscription.interval,
        },
        {
          planCode: subscription.planCode || subscription.planType,
          interval: normalizedTarget,
        },
      );

      // If policy says checkout is required, do not mutate subscription here.
      // Return a Stripe portal URL to complete the change (acts as the "checkout" flow).
      if (changeMode === 'checkout') {
        const updatedStatus = await getSubscriptionStatusWithStripeSync(shopId);
        const { getCustomerPortalUrl } = await import('../services/stripe.js');
        const { getFrontendBaseUrlSync } = await import('../utils/frontendUrl.js');
        const { normalizeBaseUrl } = await import('../utils/url-helpers.js');

        const baseUrl = normalizeBaseUrl(getFrontendBaseUrlSync());
        const returnUrl = `${baseUrl}/app/shopify/billing?fromPortal=true`;
        const stripeCustomerId = updatedStatus.stripeCustomerId || subscription.stripeCustomerId;
        const portalUrl = stripeCustomerId ? await getCustomerPortalUrl(stripeCustomerId, returnUrl) : null;

        const subscriptionDto = {
          ...updatedStatus,
          allowedActions: computeAllowedActions(updatedStatus),
        };

        return sendSuccess(
          res,
          {
            changeMode,
            checkoutUrl: portalUrl,
            subscription: subscriptionDto,
          },
          'Action requires payment. Please complete the change in Stripe.',
        );
      }

      const behavior = changeMode === 'scheduled' ? 'period_end' : 'immediate';
      await switchSubscriptionInterval(shopId, normalizedTarget, behavior);

      // Sync DB to Stripe immediately
      const { fetchStripeSubscription, deriveCanonicalFields, syncDbToStripe } = await import('../services/stripe-sync.js');
      const updatedStripeSubscription = await fetchStripeSubscription(subscription.stripeSubscriptionId);
      if (updatedStripeSubscription) {
        const canonicalFields = await deriveCanonicalFields(updatedStripeSubscription);
        if (canonicalFields) {
          await syncDbToStripe(shopId, canonicalFields, 'switch_interval');
        }
      }
    }

    // Return updated subscription status (with Stripe sync)
    const updatedStatus = await getSubscriptionStatusWithStripeSync(shopId);
    const subscriptionDto = {
      ...updatedStatus,
      allowedActions: computeAllowedActions(updatedStatus),
    };
    return sendSuccess(
      res,
      {
        interval: normalizedTarget,
        changeMode,
        scheduled: changeMode === 'scheduled',
        effectiveAt: changeMode === 'scheduled' ? updatedStatus.currentPeriodEnd || null : null,
        subscription: subscriptionDto,
      },
      `Subscription interval switched to ${normalizedTarget} successfully`,
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
    const { planType: targetPlanCode, interval: targetInterval, currency: requestedCurrencyParam } = req.body;

    // Use StripeSyncService for absolute transparency
    const subscription = await getSubscriptionStatusWithStripeSync(shopId);

    if (!subscription.active || !subscription.stripeSubscriptionId) {
      return sendError(
        res,
        400,
        'NO_ACTIVE_SUBSCRIPTION',
        'No active subscription found. Please subscribe first.',
      );
    }

    // Simplified policy: starter=month, pro=year (interval may be omitted; if provided must match).
    // For plan updates we always resolve to the target plan implied interval.
    const intervalCheck = enforceImpliedIntervalOrSendError(res, targetPlanCode, targetInterval);
    if (!intervalCheck.ok) {
      return;
    }
    const resolvedInterval = intervalCheck.resolvedInterval;

    // Check if already on the requested plan and interval
    if (subscription.planCode === targetPlanCode && (!targetInterval || subscription.interval === resolvedInterval)) {
      return sendError(
        res,
        400,
        'ALREADY_ON_PLAN',
        `You are already on the ${targetPlanCode} plan${targetInterval ? ` with ${resolvedInterval}ly billing` : ''}.`,
        {
          currentPlan: targetPlanCode,
          currentInterval: subscription.interval,
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

      if (stripePlanType === targetPlanCode && subscription.planCode === targetPlanCode) {
        logger.info(
          {
            shopId,
            subscriptionId: subscription.stripeSubscriptionId,
            planType: targetPlanCode,
          },
          'Subscription already on requested plan (idempotency check)',
        );

        return sendSuccess(
          res,
          {
            planType: targetPlanCode,
            alreadyUpdated: true,
          },
          `Subscription is already on the ${targetPlanCode} plan`,
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
    const validCurrencies = ['EUR', 'USD'];
    let currency = 'EUR';

    if (
      requestedCurrencyParam &&
      validCurrencies.includes(requestedCurrencyParam.toUpperCase())
    ) {
      currency = requestedCurrencyParam.toUpperCase();
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

    // Determine change behavior
    const changeMode = decideChangeMode(
      {
        planCode: subscription.planCode || subscription.planType,
        interval: subscription.interval,
      },
      {
        planCode: targetPlanCode,
        interval: resolvedInterval,
      },
    );

    // If policy says checkout is required, do not mutate subscription here.
    // Return a Stripe portal URL to complete the change (acts as the "checkout" flow).
    if (changeMode === 'checkout') {
      const updatedStatus = await getSubscriptionStatusWithStripeSync(shopId);
      const subscriptionDto = {
        ...updatedStatus,
        allowedActions: computeAllowedActions(updatedStatus),
      };
      const { getCustomerPortalUrl } = await import('../services/stripe.js');
      const { getFrontendBaseUrlSync } = await import('../utils/frontendUrl.js');
      const { normalizeBaseUrl } = await import('../utils/url-helpers.js');

      const baseUrl = normalizeBaseUrl(getFrontendBaseUrlSync());
      const returnUrl = `${baseUrl}/app/shopify/billing?fromPortal=true`;
      const stripeCustomerId = updatedStatus.stripeCustomerId || subscription.stripeCustomerId;
      const portalUrl = stripeCustomerId ? await getCustomerPortalUrl(stripeCustomerId, returnUrl) : null;

      return sendSuccess(
        res,
        {
          planType: targetPlanCode,
          planCode: targetPlanCode,
          interval: resolvedInterval,
          currency,
          changeMode,
          checkoutUrl: portalUrl,
          subscription: subscriptionDto,
        },
        'Action requires payment. Please complete the change in Stripe.',
      );
    }

    // Determine behavior: scheduled only for allowed downgrade
    const behavior = changeMode === 'scheduled' ? 'period_end' : 'immediate';

    // Update or schedule Stripe subscription change
    let updatedStripeSubscription = null;
    if (behavior === 'period_end') {
      const { scheduleSubscriptionChange } = await import('../services/stripe.js');
      const scheduleResult = await scheduleSubscriptionChange(
        subscription.stripeSubscriptionId,
        targetPlanCode,
        currency,
        resolvedInterval,
      );
      updatedStripeSubscription = scheduleResult?.subscription || null;
    } else {
      const { updateSubscription } = await import('../services/stripe.js');
      updatedStripeSubscription = await updateSubscription(
        subscription.stripeSubscriptionId,
        targetPlanCode,
        currency,
        resolvedInterval,
        behavior,
      );
    }

    // If scheduled (Pro Yearly downgrade), store pendingChange in DB
    if (behavior === 'period_end') {
      const effectiveAt = subscription.currentPeriodEnd || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Default to 1 year if not available

      try {
        await prisma.subscription.updateMany({
          where: { shopId },
          data: {
            pendingChangePlanCode: targetPlanCode,
            pendingChangeInterval: resolvedInterval,
            pendingChangeCurrency: currency,
            pendingChangeEffectiveAt: effectiveAt,
          },
        });
      } catch (err) {
        logger.warn('Could not update pendingChange in Subscription table', {
          shopId,
          error: err.message,
        });
      }
    }

    // Sync DB to Stripe immediately (even for scheduled changes, we update current state)
    const { deriveCanonicalFields, syncDbToStripe } = await import('../services/stripe-sync.js');
    const canonicalFields = await deriveCanonicalFields(updatedStripeSubscription);
    if (canonicalFields) {
      await syncDbToStripe(shopId, canonicalFields, 'subscription_change');
    } else {
      // Fallback: use activateSubscription
      await activateSubscription(
        shopId,
        subscription.stripeCustomerId,
        subscription.stripeSubscriptionId,
        targetPlanCode,
        resolvedInterval,
      );
    }

    // Get updated status (with Stripe sync)
    const updatedStatus = await getSubscriptionStatusWithStripeSync(shopId);
    const subscriptionDto = {
      ...updatedStatus,
      allowedActions: computeAllowedActions(updatedStatus),
    };

    logger.info(
      {
        shopId,
        oldPlan: subscription.planCode,
        newPlan: targetPlanCode,
        oldInterval: subscription.interval,
        newInterval: resolvedInterval,
        behavior,
        subscriptionId: subscription.stripeSubscriptionId,
      },
      'Subscription plan updated',
    );

    const message = behavior === 'period_end'
      ? `Downgrade scheduled for end of term (${updatedStatus.currentPeriodEnd ? new Date(updatedStatus.currentPeriodEnd).toLocaleDateString() : 'period end'})`
      : changeMode === 'checkout'
        ? `Subscription updated to ${targetPlanCode} plan (${resolvedInterval}ly). Payment will be processed immediately.`
        : `Subscription updated to ${targetPlanCode} plan (${resolvedInterval}ly) successfully`;

    return sendSuccess(
      res,
      {
        planType: targetPlanCode,
        planCode: targetPlanCode,
        interval: resolvedInterval,
        currency,
        behavior,
        changeMode,
        scheduled: behavior === 'period_end',
        effectiveAt: behavior === 'period_end' ? updatedStatus.currentPeriodEnd : null,
        subscription: subscriptionDto,
      },
      message,
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
 * POST /subscriptions/scheduled/change
 * Change a scheduled subscription downgrade (Pro Yearly only)
 */
export async function changeScheduled(req, res, next) {
  try {
    const shopId = getStoreId(req);
    const { planType: targetPlanCode, interval: targetInterval, currency: requestedCurrencyParam } = req.body;

    const subscription = await getSubscriptionStatusWithStripeSync(shopId);

    if (!subscription.active || !subscription.stripeSubscriptionId) {
      return sendError(
        res,
        400,
        'NO_ACTIVE_SUBSCRIPTION',
        'No active subscription found.',
      );
    }

    if (!subscription.pendingChange) {
      return sendError(
        res,
        400,
        'NO_SCHEDULED_CHANGE',
        'No scheduled subscription change found.',
      );
    }

    const isScheduled = isValidScheduledChange(
      {
        planCode: subscription.planCode || subscription.planType,
        interval: subscription.interval,
      },
      subscription.pendingChange,
    );

    if (!isScheduled) {
      return sendError(
        res,
        400,
        'INVALID_SCHEDULED_CHANGE',
        'Scheduled changes are only allowed for Pro Yearly downgrades.',
      );
    }

    const validIntervals = ['month', 'year'];
    let resolvedInterval = targetInterval;
    if (!resolvedInterval || !validIntervals.includes(String(resolvedInterval).toLowerCase())) {
      resolvedInterval = subscription.interval || (targetPlanCode === 'starter' ? 'month' : 'year');
    } else {
      resolvedInterval = String(resolvedInterval).toLowerCase();
    }

    const validCurrencies = ['EUR', 'USD'];
    let currency = 'EUR';
    if (
      requestedCurrencyParam &&
      validCurrencies.includes(String(requestedCurrencyParam).toUpperCase())
    ) {
      currency = String(requestedCurrencyParam).toUpperCase();
    } else {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { currency: true },
      });
      if (shop?.currency && validCurrencies.includes(shop.currency.toUpperCase())) {
        currency = shop.currency.toUpperCase();
      }
    }

    const changeMode = decideChangeMode(
      {
        planCode: subscription.planCode || subscription.planType,
        interval: subscription.interval,
      },
      {
        planCode: targetPlanCode,
        interval: resolvedInterval,
      },
    );

    if (changeMode !== 'scheduled') {
      return sendError(
        res,
        400,
        'INVALID_SCHEDULED_CHANGE',
        'This change cannot be scheduled. Only Pro Yearly downgrades are scheduled.',
      );
    }

    const { scheduleSubscriptionChange } = await import('../services/stripe.js');
    await scheduleSubscriptionChange(
      subscription.stripeSubscriptionId,
      targetPlanCode,
      currency,
      resolvedInterval,
    );

    const effectiveAt = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : null;

    try {
      await prisma.subscription.updateMany({
        where: { shopId },
        data: {
          pendingChangePlanCode: targetPlanCode,
          pendingChangeInterval: resolvedInterval,
          pendingChangeCurrency: currency,
          pendingChangeEffectiveAt: effectiveAt,
          lastSyncedAt: new Date(),
          sourceOfTruth: 'scheduled_change',
        },
      });
    } catch (err) {
      logger.warn('Could not update scheduled change in Subscription record', {
        shopId,
        error: err.message,
      });
    }

    const updatedStatus = await getSubscriptionStatusWithStripeSync(shopId);
    const subscriptionDto = {
      ...updatedStatus,
      allowedActions: computeAllowedActions(updatedStatus),
    };
    return sendSuccess(
      res,
      {
        scheduled: true,
        changeMode,
        effectiveAt: updatedStatus.currentPeriodEnd || null,
        subscription: subscriptionDto,
      },
      'Scheduled change updated successfully',
    );
  } catch (error) {
    logger.error('Change scheduled subscription error', {
      error: error.message,
      shopId: getStoreId(req),
    });
    next(error);
  }
}

/**
 * POST /subscriptions/scheduled/cancel
 * Cancel a scheduled subscription downgrade
 */
export async function cancelScheduled(req, res, next) {
  try {
    const shopId = getStoreId(req);
    const subscription = await getSubscriptionStatusWithStripeSync(shopId);

    if (!subscription.active || !subscription.stripeSubscriptionId) {
      return sendError(
        res,
        400,
        'NO_ACTIVE_SUBSCRIPTION',
        'No active subscription found.',
      );
    }

    if (!subscription.pendingChange) {
      return sendError(
        res,
        400,
        'NO_SCHEDULED_CHANGE',
        'No scheduled subscription change found.',
      );
    }

    const isScheduled = isValidScheduledChange(
      {
        planCode: subscription.planCode || subscription.planType,
        interval: subscription.interval,
      },
      subscription.pendingChange,
    );

    if (!isScheduled) {
      return sendError(
        res,
        400,
        'INVALID_SCHEDULED_CHANGE',
        'Scheduled changes are only allowed for Pro Yearly downgrades.',
      );
    }

    const { cancelScheduledSubscriptionChange } = await import('../services/stripe.js');
    await cancelScheduledSubscriptionChange(subscription.stripeSubscriptionId);

    try {
      await prisma.subscription.updateMany({
        where: { shopId },
        data: {
          pendingChangePlanCode: null,
          pendingChangeInterval: null,
          pendingChangeCurrency: null,
          pendingChangeEffectiveAt: null,
          lastSyncedAt: new Date(),
          sourceOfTruth: 'scheduled_cancel',
        },
      });
    } catch (err) {
      logger.warn('Could not clear scheduled change in Subscription record', {
        shopId,
        error: err.message,
      });
    }

    const updatedStatus = await getSubscriptionStatusWithStripeSync(shopId);
    const subscriptionDto = {
      ...updatedStatus,
      allowedActions: computeAllowedActions(updatedStatus),
    };
    return sendSuccess(
      res,
      {
        scheduled: false,
        subscription: subscriptionDto,
      },
      'Scheduled change cancelled successfully',
    );
  } catch (error) {
    logger.error('Cancel scheduled subscription error', {
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

    const subscription = await getSubscriptionStatusWithStripeSync(shopId);

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

    // Cancel subscription in Stripe (at period end - professional behavior)
    // This sets cancel_at_period_end=true, so status remains 'active' until period ends
    await cancelSubscription(subscription.stripeSubscriptionId, false);

    // Update local DB: set cancelAtPeriodEnd=true, but keep status as 'active'
    // Status will change to 'cancelled' when period ends (via webhook)
    await prisma.shop.update({
      where: { id: shopId },
      data: {
        cancelAtPeriodEnd: true,
        // Keep status as 'active' - Stripe keeps it active until period end
        // Do NOT call deactivateSubscription here
      },
    });

    // Also update Subscription record if it exists
    try {
      await prisma.subscription.updateMany({
        where: { shopId },
        data: {
          cancelAtPeriodEnd: true,
          // Status remains 'active' until period end
        },
      });
    } catch (updateErr) {
      // Ignore if Subscription table doesn't have these columns yet
      logger.debug('Could not update Subscription record for cancel', {
        shopId,
        error: updateErr.message,
      });
    }

    logger.info(
      {
        shopId,
        subscriptionId: subscription.stripeSubscriptionId,
      },
      'Subscription cancelled',
    );

    // Sync DB to Stripe and return updated status
    const { fetchStripeSubscription, deriveCanonicalFields, syncDbToStripe } = await import('../services/stripe-sync.js');
    const updatedStripeSubscription = await fetchStripeSubscription(subscription.stripeSubscriptionId);
    if (updatedStripeSubscription) {
      const canonicalFields = await deriveCanonicalFields(updatedStripeSubscription);
      if (canonicalFields) {
        await syncDbToStripe(shopId, canonicalFields, 'cancel');
      }
    }

    const updatedStatus = await getSubscriptionStatusWithStripeSync(shopId);
    return sendSuccess(
      res,
      {
        cancelledAt: new Date().toISOString(),
        subscription: updatedStatus,
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
 * POST /api/subscriptions/resume
 * Resume subscription (undo cancellation)
 */
export async function resume(req, res, next) {
  try {
    const shopId = getStoreId(req);

    // Use StripeSyncService for absolute transparency
    const subscription = await getSubscriptionStatusWithStripeSync(shopId);

    if (!subscription.active || !subscription.stripeSubscriptionId) {
      return sendError(
        res,
        400,
        'NO_ACTIVE_SUBSCRIPTION',
        'No active subscription found.',
      );
    }

    if (!subscription.cancelAtPeriodEnd) {
      return sendError(
        res,
        400,
        'NOT_CANCELLED',
        'Subscription is not scheduled for cancellation.',
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

    // Resume subscription in Stripe
    await resumeSubscription(subscription.stripeSubscriptionId);

    // Update local DB: remove cancellation flag
    await prisma.shop.update({
      where: { id: shopId },
      data: {
        cancelAtPeriodEnd: false,
      },
    });

    // Also update Subscription record if it exists
    try {
      await prisma.subscription.updateMany({
        where: { shopId },
        data: {
          cancelAtPeriodEnd: false,
        },
      });
    } catch (updateErr) {
      // Ignore if Subscription table doesn't have these columns yet
      logger.debug('Could not update Subscription record for resume', {
        shopId,
        error: updateErr.message,
      });
    }

    logger.info(
      {
        shopId,
        subscriptionId: subscription.stripeSubscriptionId,
      },
      'Subscription resumed',
    );

    // Sync DB to Stripe and return updated status
    const { fetchStripeSubscription, deriveCanonicalFields, syncDbToStripe } = await import('../services/stripe-sync.js');
    const updatedStripeSubscription = await fetchStripeSubscription(subscription.stripeSubscriptionId);
    if (updatedStripeSubscription) {
      const canonicalFields = await deriveCanonicalFields(updatedStripeSubscription);
      if (canonicalFields) {
        await syncDbToStripe(shopId, canonicalFields, 'resume');
      }
    }

    const updatedStatus = await getSubscriptionStatusWithStripeSync(shopId);
    return sendSuccess(
      res,
      {
        subscription: updatedStatus,
      },
      'Subscription resumed successfully',
    );
  } catch (error) {
    logger.error('Resume subscription error', {
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
      // Extract interval from Stripe subscription if available
      const { extractIntervalFromStripeSubscription } = await import('../services/stripe-mapping.js');
      const extractedInterval = stripeSubscription
        ? extractIntervalFromStripeSubscription(stripeSubscription)
        : null;

      await activateSubscription(
        shopId,
        customerId,
        subscriptionId,
        planType,
        extractedInterval, // Pass string, not object
        stripeSubscription || null, // Pass as last parameter (optional)
      );

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

// Test-only exports (no runtime behavior change)
export const __test = {
  normalizeInterval,
  enforceImpliedIntervalOrSendError,
};

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
    const { getFrontendBaseUrlSync } = await import('../utils/frontendUrl.js');
    const { normalizeBaseUrl } = await import('../utils/url-helpers.js');
    // Add fromPortal param to trigger sync on return
    const baseUrl = normalizeBaseUrl(getFrontendBaseUrlSync());
    const returnUrl = `${baseUrl}/app/shopify/billing?fromPortal=true`;

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

/**
 * POST /subscriptions/finalize
 * Finalize subscription from Stripe checkout session
 * Called by frontend success page as fallback if webhook is delayed
 * Body: { sessionId: string, type?: string }
 */
export async function finalize(req, res, next) {
  try {
    const shopId = getStoreId(req);
    const { sessionId, type } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'sessionId is required and must be a string',
      );
    }

    // Validate sessionId is not the placeholder token
    if (sessionId.includes('{') || sessionId.includes('CHECKOUT_SESSION_ID')) {
      return sendError(
        res,
        400,
        'INVALID_SESSION_ID',
        'Invalid session ID. Please complete the checkout process.',
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

    // Retrieve checkout session from Stripe
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'customer', 'line_items'],
      });
    } catch (err) {
      logger.error('Failed to retrieve Stripe checkout session', {
        sessionId,
        error: err.message,
        shopId,
      });
      return sendError(
        res,
        404,
        'SESSION_NOT_FOUND',
        'Checkout session not found. Please contact support if payment was completed.',
      );
    }

    // Verify session belongs to this shop
    const metadata = session.metadata || {};
    const sessionShopId = metadata.shopId || metadata.storeId;
    if (sessionShopId !== shopId) {
      logger.warn('Session shopId mismatch', {
        sessionId,
        sessionShopId,
        requestShopId: shopId,
      });
      return sendError(
        res,
        403,
        'SESSION_MISMATCH',
        'This checkout session does not belong to your shop.',
      );
    }

    // Only process subscription type
    const sessionType = type || metadata.type || (session.mode === 'subscription' ? 'subscription' : null);
    if (sessionType !== 'subscription') {
      return sendError(
        res,
        400,
        'INVALID_SESSION_TYPE',
        'This endpoint only processes subscription checkouts.',
      );
    }

    // Check if session is already paid
    if (session.payment_status !== 'paid') {
      return sendError(
        res,
        400,
        'PAYMENT_NOT_COMPLETE',
        'Payment is not complete. Please complete the checkout process.',
      );
    }

    // Extract subscription and customer IDs
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;
    const customerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;

    if (!subscriptionId || !customerId) {
      logger.warn('Session missing subscription or customer ID', {
        sessionId,
        shopId,
      });
      return sendError(
        res,
        400,
        'INCOMPLETE_SESSION',
        'Checkout session is incomplete. Webhook will process this automatically.',
      );
    }

    const planType = metadata.planType;
    if (!planType || !['starter', 'pro'].includes(planType)) {
      return sendError(
        res,
        400,
        'INVALID_PLAN_TYPE',
        'Invalid plan type in checkout session.',
      );
    }

    // Check if subscription is already activated (idempotency)
    // TODO: Remove select once migration 20250206000000_add_subscription_interval_fields is deployed
    // Temporary backward-compatible query to prevent crashes if DB doesn't have interval column yet
    const existingSubscription = await prisma.subscription.findUnique({
      where: { shopId },
      select: {
        id: true,
        shopId: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        planCode: true,
        status: true,
        currency: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        trialEndsAt: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        // interval and pendingChange fields may not exist in DB yet - will be null if missing
        // This is safe because we check for stripeSubscriptionId and status which definitely exist
      },
    });

    if (existingSubscription?.stripeSubscriptionId === subscriptionId && existingSubscription?.status === 'active') {
      logger.info('Subscription already finalized', {
        shopId,
        subscriptionId,
      });
      const subscriptionStatus = await getSubscriptionStatus(shopId);
      return sendSuccess(res, {
        finalized: true,
        alreadyActive: true,
        subscription: subscriptionStatus,
      }, 'Subscription already active');
    }

    // Retrieve subscription from Stripe
    let stripeSubscription = null;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (err) {
      logger.warn('Failed to retrieve subscription from Stripe', {
        subscriptionId,
        error: err.message,
      });
    }

    // Activate subscription (idempotent)
    logger.info('Finalizing subscription from checkout session', {
      shopId,
      planType,
      subscriptionId,
      sessionId,
    });

    // Extract interval from Stripe subscription before calling activateSubscription
    // This prevents passing the entire Stripe object as the interval parameter
    const { extractIntervalFromStripeSubscription } = await import('../services/stripe-mapping.js');
    const extractedInterval = stripeSubscription
      ? extractIntervalFromStripeSubscription(stripeSubscription)
      : null;

    await activateSubscription(
      shopId,
      customerId,
      subscriptionId,
      planType,
      extractedInterval, // Pass string, not object
      stripeSubscription, // Pass as last parameter (optional)
    );

    // Allocate free credits (idempotent)
    const creditResult = await allocateFreeCredits(
      shopId,
      planType,
      `sub_${subscriptionId}`,
      stripeSubscription,
    );

    if (creditResult?.allocated) {
      try {
        const { recordFreeCreditsGrant } = await import('../services/invoices.js');
        const periodInfo = stripeSubscription
          ? {
            periodStart: stripeSubscription.current_period_start
              ? new Date(stripeSubscription.current_period_start * 1000).toISOString()
              : null,
            periodEnd: stripeSubscription.current_period_end
              ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
              : null,
          }
          : {};
        const grantCurrency = stripeSubscription?.items?.data?.[0]?.price?.currency
          ? String(stripeSubscription.items.data[0].price.currency).toUpperCase()
          : 'EUR';

        await recordFreeCreditsGrant(
          shopId,
          planType,
          creditResult.credits || 0,
          `sub_${subscriptionId}`,
          periodInfo,
          grantCurrency,
        );
      } catch (recordErr) {
        logger.warn('Failed to record free credits grant during finalize', {
          shopId,
          subscriptionId,
          error: recordErr.message,
        });
      }
    }

    // PHASE 3.5: Always sync billing profile from checkout session (authoritative source)
    // Stripe Checkout collected all required billing details, sync them to DB
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

    const customerDetails = session?.customer_details || {};
    const taxId = extractTaxId(customerDetails.tax_ids || []);
    const billingCountry = customerDetails.address?.country || null;
    const subtotal = session.amount_subtotal ?? null;
    const taxAmount = session.total_details?.amount_tax ?? null;

    // Always sync billing profile from checkout session (even if no tax details)
    // This ensures DB reflects what was collected in Checkout
    try {
      const treatment = billingCountry || taxId?.value
        ? resolveTaxTreatment({
          billingCountry,
          vatId: taxId?.value || null,
          vatIdValidated: taxId?.verified || false,
        })
        : { mode: null, taxRate: null, taxJurisdiction: null };

      if (billingCountry || taxId?.value) {
        const taxRateApplied = resolveTaxRateForInvoice({
          subtotal,
          tax: taxAmount,
        });

        await upsertTaxEvidence({
          shopId,
          billingCountry,
          vatIdProvided: taxId?.value || null,
          vatIdValidated: taxId?.verified || false,
          taxRateApplied,
          taxJurisdiction: treatment.taxJurisdiction,
          taxTreatment: treatment.mode,
        });
      }

      // Sync billing profile from checkout session (always, even if minimal data)
      await syncBillingProfileFromStripe({
        shopId,
        session,
        taxTreatment: treatment.mode,
        taxExempt: treatment.taxRate === 0,
      });

      logger.info('Billing profile synced from checkout session', {
        shopId,
        hasEmail: !!customerDetails.email,
        hasAddress: !!customerDetails.address,
        hasTaxId: !!taxId?.value,
      });
    } catch (syncError) {
      // Log but don't fail finalize if billing profile sync fails
      logger.warn('Failed to sync billing profile from checkout session', {
        shopId,
        error: syncError.message,
      });
    }

    // Get final subscription status
    const subscriptionStatus = await getSubscriptionStatus(shopId);

    logger.info('Subscription finalized successfully', {
      shopId,
      planType,
      subscriptionId,
      creditsAllocated: creditResult.allocated,
    });

    return sendSuccess(res, {
      finalized: true,
      subscription: subscriptionStatus,
      creditsAllocated: creditResult.allocated,
      credits: creditResult.credits || 0,
    }, 'Subscription finalized successfully');
  } catch (error) {
    logger.error('Finalize subscription error', {
      error: error.message,
      stack: error.stack,
      shopId: getStoreId(req),
      sessionId: req.body?.sessionId,
    });
    next(error);
  }
}
