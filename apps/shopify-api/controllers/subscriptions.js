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
import prisma from '../services/prisma.js';
import Stripe from 'stripe';
import { getBillingProfile, validateBillingProfileForCheckout, upsertBillingProfile } from '../services/billing-profile.js';

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

    // Validate and resolve interval
    const validIntervals = ['month', 'year'];
    let resolvedInterval = interval;
    if (!resolvedInterval || !validIntervals.includes(resolvedInterval.toLowerCase())) {
      // Legacy: use defaults (starter=month, pro=year)
      resolvedInterval = planType === 'starter' ? 'month' : 'year';
    } else {
      resolvedInterval = resolvedInterval.toLowerCase();
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

    // Get billing profile and attempt auto-sync from Stripe if incomplete
    let billingProfile = await getBillingProfile(shopId);
    let profileValidation = validateBillingProfileForCheckout(billingProfile);

    // If profile is incomplete but we have a Stripe customer, try to sync from Stripe
    if (!profileValidation.valid && currentSubscription.stripeCustomerId && stripe) {
      const isValidStripeCustomerId = (value) =>
        typeof value === 'string' && value.startsWith('cus_');

      if (isValidStripeCustomerId(currentSubscription.stripeCustomerId)) {
        try {
          logger.info('Attempting auto-sync billing profile from Stripe', {
            shopId,
            stripeCustomerId: currentSubscription.stripeCustomerId,
          });

          // Fetch customer from Stripe
          const customer = await stripe.customers.retrieve(currentSubscription.stripeCustomerId, {
            expand: ['tax_ids'],
          });

          // Map Stripe customer to billing profile
          const taxId = customer.tax_ids?.data?.find((t) => t.type === 'eu_vat') || customer.tax_ids?.data?.[0];
          const address = customer.address;

          billingProfile = await upsertBillingProfile(shopId, {
            billingEmail: customer.email || billingProfile?.billingEmail || null,
            legalName: customer.name || billingProfile?.legalName || null,
            billingAddress: address
              ? {
                line1: address.line1 || billingProfile?.billingAddress?.line1 || null,
                line2: address.line2 || billingProfile?.billingAddress?.line2 || null,
                city: address.city || billingProfile?.billingAddress?.city || null,
                state: address.state || billingProfile?.billingAddress?.state || null,
                postalCode: address.postal_code || billingProfile?.billingAddress?.postalCode || null,
                country: address.country || billingProfile?.billingAddress?.country || null,
              }
              : billingProfile?.billingAddress || null,
            vatNumber: taxId?.value
              ? String(taxId.value).replace(/\s+/g, '').toUpperCase()
              : billingProfile?.vatNumber || null,
            vatCountry: taxId?.country || address?.country || billingProfile?.vatCountry || null,
          });

          // Re-validate after sync
          profileValidation = validateBillingProfileForCheckout(billingProfile);

          logger.info('Auto-sync billing profile completed', {
            shopId,
            valid: profileValidation.valid,
            missingFields: profileValidation.missingFields,
          });
        } catch (syncError) {
          logger.warn('Auto-sync billing profile from Stripe failed', {
            shopId,
            error: syncError.message,
          });
          // Continue with original validation - don't fail subscribe if sync fails
        }
      }
    }

    // Validate billing profile completeness after auto-sync attempt
    if (!profileValidation.valid) {
      logger.warn('Billing profile incomplete for checkout', {
        shopId,
        missingFields: profileValidation.missingFields,
        vatRequired: profileValidation.vatRequired,
      });
      const errorMessage = profileValidation.vatMessage
        ? profileValidation.vatMessage
        : 'Billing profile is incomplete. Please complete your billing details before subscribing.';
      return sendError(
        res,
        400,
        'BILLING_PROFILE_INCOMPLETE',
        errorMessage,
        {
          missingFields: profileValidation.missingFields,
          vatRequired: profileValidation.vatRequired || false,
          vatMessage: profileValidation.vatMessage || null,
        },
      );
    }

    // Ensure Stripe customer exists with correct email from billing profile
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
      const { switchSubscriptionInterval } = await import('../services/subscription.js');
      await switchSubscriptionInterval(shopId, targetInterval);

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
    return sendSuccess(
      res,
      {
        interval: targetInterval,
        subscription: updatedStatus,
      },
      `Subscription interval switched to ${targetInterval} successfully`,
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

    // Validate and resolve interval (keep current if not provided)
    const validIntervals = ['month', 'year'];
    let resolvedInterval = targetInterval;
    if (!resolvedInterval || !validIntervals.includes(resolvedInterval.toLowerCase())) {
      // Keep current interval if not provided
      resolvedInterval = subscription.interval || (targetPlanCode === 'starter' ? 'month' : 'year');
    } else {
      resolvedInterval = resolvedInterval.toLowerCase();
    }

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

    // Determine change type and behavior
    const planCatalog = await import('../services/plan-catalog.js');
    const changeType = planCatalog.getPlanChangeType(subscription.planCode, targetPlanCode);
    const isProYearlyDowngrade = subscription.planCode === 'pro' && subscription.interval === 'year' && changeType === 'downgrade';

    // Determine behavior: immediate for all except Pro Yearly downgrades
    const behavior = isProYearlyDowngrade ? 'period_end' : 'immediate';

    // Update Stripe subscription
    const { updateSubscription } = await import('../services/stripe.js');
    const updatedStripeSubscription = await updateSubscription(
      subscription.stripeSubscriptionId,
      targetPlanCode,
      currency,
      resolvedInterval,
      behavior,
    );

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
      : `Subscription updated to ${targetPlanCode} plan (${resolvedInterval}ly) successfully`;

    return sendSuccess(
      res,
      {
        planType: targetPlanCode,
        planCode: targetPlanCode,
        interval: resolvedInterval,
        currency,
        behavior,
        scheduled: behavior === 'period_end',
        effectiveAt: behavior === 'period_end' ? updatedStatus.currentPeriodEnd : null,
        subscription: updatedStatus,
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

    // Extract tax details and sync billing profile
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

    if (billingCountry || taxId?.value) {
      const treatment = resolveTaxTreatment({
        billingCountry,
        vatId: taxId?.value || null,
        vatIdValidated: taxId?.verified || false,
      });
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

      await syncBillingProfileFromStripe({
        shopId,
        session,
        taxTreatment: treatment.mode,
        taxExempt: treatment.taxRate === 0,
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
