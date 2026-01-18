// apps/api/src/routes/billing.js
const { Router } = require('express');
const prisma = require('../lib/prisma');
const {
  buildRetailFrontendUrl,
  buildRetailSuccessUrl,
  buildRetailCancelUrl,
  warnIfEncodedCheckoutPlaceholder,
} = require('../lib/frontendUrl');
const { isValidAbsoluteUrl } = require('../lib/url-helpers');
const requireAuth = require('../middleware/requireAuth');
const { getBalance } = require('../services/wallet.service');
const {
  getSubscriptionStatus,
  getPlanConfig,
  calculateTopupPrice,
  getIntervalForPlan,
} = require('../services/subscription.service');
const { getSubscriptionStatusWithStripeSync } = require('../services/stripe-sync.service');
const { getBillingProfile, upsertBillingProfile } = require('../services/billing-profile.service');
const { listInvoices } = require('../services/invoices.service');
const { resolveBillingCurrency } = require('../billing/currency');
const { CONFIG_ERROR_CODE, getPackagePriceId } = require('../billing/stripePrices');
const {
  createSubscriptionCheckoutSession,
  createCreditTopupCheckoutSession,
  getCustomerPortalUrl,
  cancelSubscription,
  ensureStripeCustomer,
  syncStripeCustomerBillingProfile,
} = require('../services/stripe.service');
const pino = require('pino');
const crypto = require('crypto');

const r = Router();
const logger = pino({ name: 'billing-routes' });

const isValidStripeCustomerId = (value) => typeof value === 'string' && value.startsWith('cus_');

async function resolveStripeCustomerId({
  userId,
  subscription,
  allowCreate = false,
  requestId = null,
}) {
  const stripe = require('../services/stripe.service').stripe;
  let stripeCustomerId = subscription.stripeCustomerId;

  if (isValidStripeCustomerId(stripeCustomerId)) {
    return stripeCustomerId;
  }

  const stripeSubscriptionId = subscription.stripeSubscriptionId;
  if (stripe && stripeSubscriptionId) {
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const resolvedCustomerId =
        typeof stripeSubscription.customer === 'string'
          ? stripeSubscription.customer
          : stripeSubscription.customer?.id;
      if (isValidStripeCustomerId(resolvedCustomerId)) {
        stripeCustomerId = resolvedCustomerId;
      }
    } catch (err) {
      logger.warn({
        requestId,
        userId,
        stripeSubscriptionId,
        err: err.message,
      }, 'Failed to resolve Stripe customer from subscription');
    }
  }

  if (!isValidStripeCustomerId(stripeCustomerId) && allowCreate) {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, company: true, billingCurrency: true },
    });
    const billingProfile = await getBillingProfile(userId);
    stripeCustomerId = await ensureStripeCustomer({
      ownerId: userId,
      userEmail: user?.email || undefined,
      userName: user?.company || undefined,
      currency: user?.billingCurrency || 'EUR',
      stripeCustomerId,
      billingProfile,
    });
  }

  if (!isValidStripeCustomerId(stripeCustomerId)) {
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: null },
    });
    return null;
  }

  if (stripeCustomerId !== subscription.stripeCustomerId) {
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId },
    });
  }

  return stripeCustomerId;
}

/**
 * GET /billing/balance
 * Returns balance and subscription status
 */
r.get('/billing/balance', requireAuth, async (req, res, next) => {
  try {
    const balance = await getBalance(req.user.id);
    const subscription = await getSubscriptionStatusWithStripeSync(req.user.id);
    if (subscription?.stripeCustomerId && !isValidStripeCustomerId(subscription.stripeCustomerId)) {
      subscription.stripeCustomerId = await resolveStripeCustomerId({
        userId: req.user.id,
        subscription,
        allowCreate: false,
      });
    }
    const allowance = {
      includedPerPeriod: subscription?.includedSmsPerPeriod || 0,
      usedThisPeriod: subscription?.usedSmsThisPeriod || 0,
      remainingThisPeriod: subscription?.remainingSmsThisPeriod || 0,
      currentPeriodStart: subscription?.currentPeriodStart || null,
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
      interval: subscription?.interval || null,
    };
    res.json({ balance, subscription, allowance, billingCurrency: subscription?.billingCurrency || 'EUR' });
  } catch (e) { next(e); }
});

/**
 * GET /billing/wallet
 * Alias for balance (legacy frontend support)
 */
r.get('/billing/wallet', requireAuth, async (req, res, next) => {
  try {
    const balance = await getBalance(req.user.id);
    const subscription = await getSubscriptionStatusWithStripeSync(req.user.id);
    if (subscription?.stripeCustomerId && !isValidStripeCustomerId(subscription.stripeCustomerId)) {
      subscription.stripeCustomerId = await resolveStripeCustomerId({
        userId: req.user.id,
        subscription,
        allowCreate: false,
      });
    }
    const allowance = {
      includedPerPeriod: subscription?.includedSmsPerPeriod || 0,
      usedThisPeriod: subscription?.usedSmsThisPeriod || 0,
      remainingThisPeriod: subscription?.remainingSmsThisPeriod || 0,
      currentPeriodStart: subscription?.currentPeriodStart || null,
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
      interval: subscription?.interval || null,
    };
    res.json({ balance, subscription, allowance, billingCurrency: subscription?.billingCurrency || 'EUR' });
  } catch (e) { next(e); }
});

/**
 * GET /billing/summary
 * Returns subscription summary, allowance, and credits balance
 */
r.get('/billing/summary', requireAuth, async (req, res, next) => {
  try {
    const [balance, subscription] = await Promise.all([
      getBalance(req.user.id),
      getSubscriptionStatusWithStripeSync(req.user.id),
    ]);

    const allowance = {
      includedPerPeriod: subscription?.includedSmsPerPeriod || 0,
      usedThisPeriod: subscription?.usedSmsThisPeriod || 0,
      remainingThisPeriod: subscription?.remainingSmsThisPeriod || 0,
      currentPeriodStart: subscription?.currentPeriodStart || null,
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
      interval: subscription?.interval || null,
    };

    res.json({
      credits: { balance },
      subscription,
      allowance,
      billingCurrency: subscription?.billingCurrency || 'EUR',
    });
  } catch (e) { next(e); }
});

/**
 * GET /billing/profile
 * Returns billing profile for the tenant
 */
r.get('/billing/profile', requireAuth, async (req, res, next) => {
  try {
    const profile = await getBillingProfile(req.user.id);

    if (!profile) {
      return res.json({
        legalName: null,
        vatNumber: null,
        vatCountry: null,
        billingEmail: null,
        billingAddress: null,
        currency: 'EUR',
        taxStatus: null,
        taxExempt: false,
        isBusiness: false,
        vatValidated: false,
      });
    }

    res.json({
      ...profile,
      isBusiness: profile.isBusiness ?? Boolean(profile.vatNumber),
      vatValidated: profile.taxStatus === 'verified',
    });
  } catch (e) { next(e); }
});

/**
 * PUT /billing/profile
 * Update billing profile
 */
r.put('/billing/profile', requireAuth, async (req, res, next) => {
  try {
    const input = req.body || {};
    const currency = typeof input.currency === 'string'
      ? input.currency.trim().toUpperCase()
      : null;
    const normalizedCurrency = ['EUR', 'USD'].includes(currency) ? currency : null;

    if (input.currency && !normalizedCurrency) {
      return res.status(400).json({
        message: 'Unsupported currency. Use EUR or USD.',
        code: 'INVALID_CURRENCY',
      });
    }

    const payload = {
      legalName: input.legalName ? String(input.legalName).trim() : null,
      vatNumber: input.vatNumber ? String(input.vatNumber).trim() : null,
      vatCountry: input.vatCountry ? String(input.vatCountry).trim().toUpperCase() : null,
      billingEmail: input.billingEmail ? String(input.billingEmail).trim() : null,
      billingAddress: input.billingAddress && typeof input.billingAddress === 'object'
        ? {
          ...input.billingAddress,
          country: input.billingAddress?.country
            ? String(input.billingAddress.country).trim().toUpperCase()
            : input.billingAddress?.country || null,
        }
        : null,
      ...(normalizedCurrency ? { currency: normalizedCurrency } : {}),
      taxExempt: typeof input.taxExempt === 'boolean' ? input.taxExempt : undefined,
      isBusiness: typeof input.isBusiness === 'boolean' ? input.isBusiness : undefined,
    };

    const profile = await upsertBillingProfile(req.user.id, payload);

    if (normalizedCurrency) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { billingCurrency: normalizedCurrency },
      });
    }

    if (profile?.currency && profile.currency !== normalizedCurrency && normalizedCurrency) {
      profile.currency = normalizedCurrency;
    }

    const normalizedProfile = {
      ...profile,
      isBusiness: profile?.isBusiness ?? Boolean(profile?.vatNumber),
      vatValidated: profile?.taxStatus === 'verified',
    };

    const subscription = await getSubscriptionStatus(req.user.id);
    await syncStripeCustomerBillingProfile({
      stripeCustomerId: subscription?.stripeCustomerId,
      billingProfile: normalizedProfile,
    });

    res.json({ ok: true, billingProfile: normalizedProfile });
  } catch (e) { next(e); }
});

/**
 * GET /billing/invoices
 * Returns invoice history
 */
r.get('/billing/invoices', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
    const status = req.query.status ? String(req.query.status) : undefined;
    const result = await listInvoices(req.user.id, { page, pageSize, status });
    res.json(result);
  } catch (e) { next(e); }
});

/**
 * GET /billing/transactions
 * Query: page(1), pageSize(10..100)
 */
r.get('/billing/transactions', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 10)));
    const [total, items] = await Promise.all([
      prisma.creditTransaction.count({ where: { ownerId: req.user.id } }),
      prisma.creditTransaction.findMany({
        where: { ownerId: req.user.id },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ page, pageSize, total, items });
  } catch (e) { next(e); }
});

/**
 * GET /billing/packages
 * List active packages with Stripe price IDs
 * Credit packs are only available when user has active subscription
 */
r.get('/billing/packages', requireAuth, async (req, res, next) => {
  try {
    // Check subscription status - credit packs are only unlocked for active subscriptions
    const subscription = await getSubscriptionStatus(req.user.id);

    // Only return packages if user has active subscription
    // This ensures credit packs are "unlocked" only for subscribed users
    if (!subscription.active) {
      return res.json([]);
    }

    const currency = await resolveBillingCurrency({
      userId: req.user.id,
      currency: req.query.currency,
    });
    const items = await prisma.package.findMany({
      where: { active: true },
      orderBy: { units: 'asc' },
      select: {
        id: true,
        name: true,
        units: true,
        priceCents: true,
        priceCentsUsd: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        // Include Stripe price IDs if available
        stripePriceIdEur: true,
        stripePriceIdUsd: true,
      },
    });

    if (items.length === 0) {
      logger.warn({ userId: req.user.id }, 'No active packages found');
    }

    const enriched = items.map(pkg => {
      const priceId = getPackagePriceId(pkg.name, currency, pkg);
      const resolvedPriceCents =
        currency === 'USD' && Number.isFinite(pkg.priceCentsUsd)
          ? pkg.priceCentsUsd
          : pkg.priceCents;
      const amount = Number((resolvedPriceCents / 100).toFixed(2));

      return {
        id: pkg.id,
        name: pkg.name,
        displayName: pkg.name,
        units: pkg.units,
        priceCents: resolvedPriceCents,
        amount,
        price: amount,
        currency,
        priceId,
        stripePriceId: priceId,
        available: !!priceId,
        type: 'credit_topup',
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
      };
    });

    if (enriched.length > 0) {
      const etagSource = JSON.stringify(enriched.map((pkg) => ({
        id: pkg.id,
        updatedAt: pkg.updatedAt,
        priceCents: pkg.priceCents,
        priceId: pkg.priceId,
        currency: pkg.currency,
      })));
      const etagValue = `W/"${crypto.createHash('sha256').update(etagSource).digest('hex')}"`;
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch && ifNoneMatch === etagValue) {
        return res.status(304).end();
      }
      res.set('ETag', etagValue);
    }
    return res.json(enriched);
  } catch (e) { next(e); }
});

/**
 * GET /billing/purchases
 * List user's purchase history
 * Query: page, pageSize, status? (pending/paid/failed/refunded)
 */
r.get('/billing/purchases', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 10)));
    const status = req.query.status; // Optional filter by status

    const where = { ownerId: req.user.id };
    if (status && ['pending', 'paid', 'failed', 'refunded'].includes(status)) {
      where.status = status;
    }

    const [total, items] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.findMany({
        where,
        include: { package: { select: { id: true, name: true, units: true } } },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ page, pageSize, total, items });
  } catch (e) { next(e); }
});

/**
 * GET /billing/billing-history
 * Retail parity endpoint: unified billing ledger based on BillingTransaction.
 * Includes subscription charges, included credits, and topups (when recorded).
 */
r.get('/billing/billing-history', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));

    const [total, items] = await Promise.all([
      prisma.billingTransaction.count({ where: { ownerId: req.user.id } }),
      prisma.billingTransaction.findMany({
        where: { ownerId: req.user.id },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({
      transactions: items.map((t) => ({
        id: t.id,
        type: t.packageType || 'billing',
        amount: Number.isFinite(t.amount) ? Number((t.amount / 100).toFixed(2)) : 0,
        currency: t.currency || 'EUR',
        creditsAdded: t.creditsAdded,
        status: t.status,
        createdAt: t.createdAt,
        stripeSessionId: t.stripeSessionId || null,
        stripePaymentId: t.stripePaymentId || null,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page < Math.ceil(total / pageSize),
        hasPrevPage: page > 1,
      },
    });
  } catch (e) { next(e); }
});

/**
 * POST /billing/seed-packages  (DEV only - optional)
 * Body: { items: [{ name, units, priceCents }] }
 */
r.post('/billing/seed-packages', requireAuth, async (req, res, next) => {
  try {
    // Simple guard: allow only if env allows seeding
    if (process.env.ALLOW_BILLING_SEED !== '1') {
      return res.status(403).json({
        message: 'Database seeding is disabled',
        code: 'FORBIDDEN',
      });
    }
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const data = items.map(x => ({
      name: String(x.name),
      units: Number(x.units),
      priceCents: Number(x.priceCents),
      priceCentsUsd: Number.isFinite(Number(x.priceCentsUsd)) ? Number(x.priceCentsUsd) : null,
      active: true,
      stripePriceIdEur: x.stripePriceIdEur || null,
      stripePriceIdUsd: x.stripePriceIdUsd || null,
    })).filter(x => x.name && x.units > 0 && x.priceCents >= 0);

    // Upsert by unique name
    for (const p of data) {
      await prisma.package.upsert({
        where: { name: p.name },
        update: {
          units: p.units,
          priceCents: p.priceCents,
          priceCentsUsd: p.priceCentsUsd,
          active: true,
          stripePriceIdEur: p.stripePriceIdEur,
          stripePriceIdUsd: p.stripePriceIdUsd,
        },
        create: p,
      });
    }
    const all = await prisma.package.findMany({ where: { active: true }, orderBy: { units: 'asc' } });
    res.json({ ok: true, items: all });
  } catch (e) { next(e); }
});

/**
 * POST /billing/purchase
 * Body: { packageId, currency? (EUR/USD) }
 * Creates a Stripe checkout session for the package
 */
r.post('/billing/purchase', requireAuth, async (req, res, next) => {
  try {
    const packageId = Number(req.body?.packageId);
    const currency = await resolveBillingCurrency({
      userId: req.user.id,
      currency: req.body?.currency,
    });
    const idempotencyKeyHeader =
      req.headers['idempotency-key'] ||
      req.headers['x-idempotency-key'];
    const idempotencyKey = idempotencyKeyHeader
      ? String(idempotencyKeyHeader).trim().slice(0, 128)
      : null;

    if (!packageId) {
      return res.status(400).json({
        message: 'Package ID is required',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!idempotencyKey) {
      return res.status(400).json({
        message: 'Idempotency-Key header is required',
        code: 'MISSING_IDEMPOTENCY_KEY',
      });
    }

    const pkg = await prisma.package.findFirst({ where: { id: packageId, active: true } });
    if (!pkg) {
      return res.status(404).json({
        message: 'Credit pack not found or is no longer available',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const priceCents =
      currency === 'USD' && Number.isFinite(pkg.priceCentsUsd)
        ? pkg.priceCentsUsd
        : pkg.priceCents;

    const subscription = await getSubscriptionStatus(req.user.id);
    if (!subscription.active) {
      return res.status(402).json({
        message: 'An active subscription is required to purchase credit packs.',
        code: 'INACTIVE_SUBSCRIPTION',
      });
    }

    const stripePriceId = getPackagePriceId(pkg.name, currency, pkg);
    if (!stripePriceId) {
      const err = new Error(`Stripe price ID not configured for package ${pkg.name} (${currency})`);
      err.code = CONFIG_ERROR_CODE;
      throw err;
    }

    let purchase = await prisma.purchase.findFirst({
      where: {
        ownerId: req.user.id,
        idempotencyKey,
      },
    });

    if (purchase?.stripeSessionId) {
      const { getCheckoutSession } = require('../services/stripe.service');
      let checkoutUrl = null;
      try {
        const session = await getCheckoutSession(purchase.stripeSessionId);
        checkoutUrl = session.url || null;
      } catch (err) {
        logger.warn({
          purchaseId: purchase.id,
          sessionId: purchase.stripeSessionId,
          err: err.message,
        }, 'Failed to retrieve existing checkout session');
      }

      return res.status(200).json({
        ok: true,
        checkoutUrl,
        sessionId: purchase.stripeSessionId,
        purchaseId: purchase.id,
        status: purchase.status,
        idempotent: true,
      });
    }

    if (!purchase) {
      // Create purchase record
      try {
        purchase = await prisma.purchase.create({
          data: {
            ownerId: req.user.id,
            packageId: pkg.id,
            units: pkg.units,
            priceCents,
            status: 'pending',
            currency,
            stripePriceId,
            idempotencyKey,
          },
        });
      } catch (err) {
        if (err?.code === 'P2002') {
          purchase = await prisma.purchase.findFirst({
            where: {
              ownerId: req.user.id,
              idempotencyKey,
            },
          });
        } else {
          throw err;
        }
      }
    }
    if (!purchase) {
      throw new Error('Failed to create purchase record');
    }

    const billingProfile = await getBillingProfile(req.user.id);
    const stripeCustomerId = await ensureStripeCustomer({
      ownerId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.company,
      currency,
      stripeCustomerId: subscription.stripeCustomerId,
      billingProfile,
    });

    const successUrl = buildRetailSuccessUrl();
    const cancelUrl = buildRetailCancelUrl();
    warnIfEncodedCheckoutPlaceholder('package-purchase', successUrl);

    if (!isValidAbsoluteUrl(successUrl) || !isValidAbsoluteUrl(cancelUrl)) {
      return res.status(500).json({
        message: 'Invalid frontend URL configuration. Check FRONTEND_URL/APP_URL.',
        code: 'CONFIG_ERROR',
      });
    }

    // Create Stripe checkout session
    const { createCheckoutSession } = require('../services/stripe.service');
    const session = await createCheckoutSession({
      ownerId: req.user.id,
      userEmail: req.user.email,
      package: pkg,
      currency,
      priceId: stripePriceId,
      successUrl,
      cancelUrl,
      idempotencyKey,
      stripeCustomerId,
    });

    // Link session ID to purchase
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { stripeSessionId: session.id },
    });

    res.status(201).json({
      ok: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      purchaseId: purchase.id,
    });
  } catch (e) {
    if (e.message?.includes('Stripe is not configured')) {
      return res.status(503).json({
        message: 'Payment processing unavailable',
        code: 'STRIPE_NOT_CONFIGURED',
      });
    }
    if (e?.code === CONFIG_ERROR_CODE || e.message?.includes('Stripe price ID not found')) {
      return res.status(500).json({
        message: e.message,
        code: CONFIG_ERROR_CODE,
      });
    }
    next(e);
  }
});

/**
 * GET /api/subscriptions/current
 * Get current subscription status
 */
r.get('/subscriptions/current', requireAuth, async (req, res, next) => {
  try {
    const subscription = await getSubscriptionStatusWithStripeSync(req.user.id);
    const planConfig = subscription.planType ? getPlanConfig(subscription.planType) : null;
    const { computeAllowedActions, getAvailableOptions } = require('../services/subscription-actions.service');
    const allowedActions = computeAllowedActions(subscription);
    const availableOptions = getAvailableOptions(subscription);
    res.json({
      ...subscription,
      plan: planConfig,
      allowedActions,
      availableOptions,
    });
  } catch (e) { next(e); }
});

/**
 * POST /api/subscriptions/reconcile
 * Manual reconciliation against Stripe (recovery for missed webhooks)
 */
r.post('/subscriptions/reconcile', requireAuth, async (req, res) => {
  const requestId =
    req.id ||
    req.headers['x-request-id'] ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Shopify parity: reconcile returns the same DTO as /subscriptions/current
    const subscription = await getSubscriptionStatusWithStripeSync(req.user.id);
    const { computeAllowedActions, getAvailableOptions } = require('../services/subscription-actions.service');
    const allowedActions = computeAllowedActions(subscription);
    const availableOptions = getAvailableOptions(subscription);

    return res.json({
      ok: true,
      ...subscription,
      allowedActions,
      availableOptions,
      reconciled: true,
      requestId,
    });
  } catch (e) {
    if (e.message?.includes('Stripe is not configured')) {
      return res.status(503).json({
        message: 'Payment processing unavailable',
        code: 'STRIPE_NOT_CONFIGURED',
        requestId,
      });
    }
    logger.error({
      requestId,
      userId: req.user.id,
      err: e.message,
      stack: e.stack,
    }, 'Subscription reconciliation failed');
    return res.status(500).json({
      message: 'Failed to reconcile subscription',
      code: 'RECONCILE_FAILED',
      requestId,
    });
  }
});

/**
 * POST /api/subscriptions/subscribe
 * Create subscription checkout session
 * Body: { planType: 'starter' | 'pro' }
 */
r.post('/subscriptions/subscribe', requireAuth, async (req, res, next) => {
  try {
    const planType = req.body?.planType;

    if (!planType || !['starter', 'pro'].includes(planType)) {
      return res.status(400).json({
        message: 'Plan type must be "starter" or "pro"',
        code: 'VALIDATION_ERROR',
      });
    }

    // Check if user already has an active subscription
    const currentSubscription = await getSubscriptionStatus(req.user.id);
    if (currentSubscription.active) {
      logger.info({
        userId: req.user.id,
        currentPlanType: currentSubscription.planType,
        requestedPlanType: planType,
      }, 'User attempted to subscribe while already having active subscription');
      return res.status(400).json({
        message: 'You already have an active subscription. Please cancel your current subscription before subscribing to a new plan.',
        code: 'ALREADY_SUBSCRIBED',
        currentPlan: currentSubscription.planType,
      });
    }

    const currency = await resolveBillingCurrency({
      userId: req.user.id,
      currency: req.body?.currency,
    });

    const billingProfile = await getBillingProfile(req.user.id);
    const stripeCustomerId = await ensureStripeCustomer({
      ownerId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.company,
      currency,
      stripeCustomerId: currentSubscription.stripeCustomerId,
      billingProfile,
    });

    const successUrl = buildRetailSuccessUrl();
    const cancelUrl = buildRetailCancelUrl();
    warnIfEncodedCheckoutPlaceholder('subscription-subscribe', successUrl);

    if (!isValidAbsoluteUrl(successUrl) || !isValidAbsoluteUrl(cancelUrl)) {
      return res.status(500).json({
        message: 'Invalid frontend URL configuration. Check FRONTEND_URL/APP_URL.',
        code: 'CONFIG_ERROR',
      });
    }

    const session = await createSubscriptionCheckoutSession({
      ownerId: req.user.id,
      userEmail: req.user.email,
      planType,
      currency,
      successUrl,
      cancelUrl,
      stripeCustomerId,
    });

    res.status(201).json({
      ok: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      planType,
      currency,
    });
  } catch (e) {
    // Handle specific error cases
    if (e?.code === CONFIG_ERROR_CODE) {
      return res.status(400).json({
        message: e.message,
        code: CONFIG_ERROR_CODE,
      });
    }
    if (e.message?.includes('Stripe price ID not found')) {
      return res.status(400).json({
        message: e.message,
        code: 'MISSING_PRICE_ID',
      });
    }
    if (e.message?.includes('not a recurring price') || e.message?.includes('recurring price')) {
      return res.status(400).json({
        message: e.message,
        code: 'INVALID_PRICE_TYPE',
      });
    }
    if (e.message?.includes('not found in Stripe')) {
      return res.status(400).json({
        message: e.message,
        code: 'PRICE_NOT_FOUND',
      });
    }
    if (e.message?.includes('Stripe is not configured')) {
      return res.status(503).json({
        message: 'Payment processing unavailable',
        code: 'STRIPE_NOT_CONFIGURED',
      });
    }
    if (e.message?.includes('Stripe error:')) {
      return res.status(400).json({
        message: e.message,
        code: 'STRIPE_ERROR',
      });
    }
    if (e.message?.includes('Invalid plan type')) {
      return res.status(400).json({
        message: e.message,
        code: 'INVALID_PLAN_TYPE',
      });
    }
    next(e);
  }
});

/**
 * POST /api/subscriptions/update
 * Update subscription plan (upgrade/downgrade)
 * Body: { planType: 'starter' | 'pro' }
 */
r.post('/subscriptions/update', requireAuth, async (req, res, next) => {
  try {
    const planType = req.body?.planType;
    if (!planType || !['starter', 'pro'].includes(planType)) {
      return res.status(400).json({
        message: 'Plan type must be "starter" or "pro"',
        code: 'VALIDATION_ERROR',
      });
    }

    const planCatalog = require('../services/plan-catalog.service');
    const mode = planCatalog.detectCatalogMode();

    const currency = await resolveBillingCurrency({
      userId: req.user.id,
      currency: req.body?.currency,
    });

    const subscription = await getSubscriptionStatusWithStripeSync(req.user.id);
    if (!subscription.active || !subscription.stripeSubscriptionId) {
      return res.status(400).json({
        message: 'No active subscription found. Please subscribe first.',
        code: 'NO_ACTIVE_SUBSCRIPTION',
      });
    }

    const currentInterval =
      subscription.interval || (subscription.planType ? getIntervalForPlan(subscription.planType) : null);
    const targetInterval =
      mode === 'retail-simple'
        ? getIntervalForPlan(planType)
        : (req.body?.interval === 'month' || req.body?.interval === 'year' ? req.body.interval : getIntervalForPlan(planType));

    if (subscription.planType === planType && currentInterval === targetInterval && !subscription.pendingChange) {
      return res.json({
        ok: true,
        message: 'Subscription already on requested plan',
        planType,
        interval: targetInterval,
        alreadyUpdated: true,
      });
    }

    const decideChangeMode = (current, target) => {
      if (current === 'month' && target === 'year') {
        return 'checkout';
      }
      if (current === 'year' && target === 'month') {
        return 'scheduled';
      }
      return 'immediate';
    };
    const changeMode = decideChangeMode(currentInterval, targetInterval);

    if (changeMode === 'checkout') {
      const billingProfile = await getBillingProfile(req.user.id);
      const stripeCustomerId = await ensureStripeCustomer({
        ownerId: req.user.id,
        userEmail: req.user.email,
        userName: req.user.company,
        currency,
        stripeCustomerId: subscription.stripeCustomerId,
        billingProfile,
      });

      const successUrl = buildRetailSuccessUrl();
      const cancelUrl = buildRetailCancelUrl();
      warnIfEncodedCheckoutPlaceholder('subscription-change', successUrl);
      if (!isValidAbsoluteUrl(successUrl) || !isValidAbsoluteUrl(cancelUrl)) {
        return res.status(500).json({
          message: 'Invalid frontend URL configuration. Check FRONTEND_URL/APP_URL.',
          code: 'CONFIG_ERROR',
        });
      }

      const { createSubscriptionChangeCheckoutSession } = require('../services/stripe.service');
      const session = await createSubscriptionChangeCheckoutSession({
        ownerId: req.user.id,
        userEmail: req.user.email,
        planCode: planType,
        interval: targetInterval,
        currency,
        successUrl,
        cancelUrl,
        stripeCustomerId,
        previousStripeSubscriptionId: subscription.stripeSubscriptionId,
      });

      return res.json({
        ok: true,
        changeMode: 'checkout',
        message: 'Checkout required to complete upgrade',
        checkoutUrl: session.url,
        sessionId: session.id,
        planType,
        interval: targetInterval,
        currency,
      });
    }

    if (changeMode === 'scheduled') {
      const priceId = planCatalog.getPriceId(planType, targetInterval, currency);
      if (!priceId) {
        return res.status(500).json({
          message: `Stripe price ID not configured for ${planType}/${targetInterval}/${currency}`,
          code: CONFIG_ERROR_CODE,
        });
      }

      const { createOrUpdateSubscriptionSchedule } = require('../services/stripe.service');
      const scheduleResult = await createOrUpdateSubscriptionSchedule({
        subscriptionId: subscription.stripeSubscriptionId,
        targetPriceId: priceId,
      });

      await prisma.subscription.updateMany({
        where: { ownerId: req.user.id },
        data: {
          pendingChangePlanCode: planType,
          pendingChangeInterval: targetInterval,
          pendingChangeCurrency: currency,
          pendingChangeEffectiveAt: scheduleResult.effectiveAt,
          lastSyncedAt: new Date(),
          sourceOfTruth: 'scheduled_change_request',
        },
      });

      return res.json({
        ok: true,
        changeMode: 'scheduled',
        message: 'Plan change scheduled at period end',
        pendingChange: {
          planCode: planType,
          interval: targetInterval,
          currency,
          effectiveAt: scheduleResult.effectiveAt,
        },
      });
    }

    const { updateSubscription } = require('../services/stripe.service');
    await updateSubscription(subscription.stripeSubscriptionId, planType, currency);

    const after = await getSubscriptionStatusWithStripeSync(req.user.id);
    return res.json({
      ok: true,
      changeMode: 'immediate',
      message: `Subscription updated to ${planType} plan successfully`,
      planType,
      interval: after.interval || targetInterval,
      currency,
    });
  } catch (e) {
    if (e.message?.includes('Stripe is not configured')) {
      return res.status(503).json({
        message: 'Payment processing unavailable',
        code: 'STRIPE_NOT_CONFIGURED',
      });
    }
    if (e?.code === CONFIG_ERROR_CODE || e.message?.includes('Stripe price ID not found')) {
      return res.status(500).json({
        message: e.message,
        code: CONFIG_ERROR_CODE,
      });
    }
    next(e);
  }
});

/**
 * POST /api/subscriptions/switch
 * Switch subscription interval (month/year) or plan
 * Body: { interval?: 'month'|'year', planType?: 'starter'|'pro', currency?: 'EUR'|'USD' }
 */
r.post('/subscriptions/switch', requireAuth, async (req, res, next) => {
  try {
    const planCatalog = require('../services/plan-catalog.service');
    const mode = planCatalog.detectCatalogMode();

    const requestedPlan = req.body?.planType || req.body?.plan;
    const requestedInterval = req.body?.interval;
    const normalizedInterval =
      requestedInterval === 'month' || requestedInterval === 'year'
        ? requestedInterval
        : null;

    // PHASE 0: retail-simple (default) maps interval-only switches to the two valid SKUs.
    let planType = requestedPlan;
    if (!planType && normalizedInterval) {
      if (mode === 'retail-simple') {
        planType = normalizedInterval === 'year' ? 'pro' : 'starter';
      } else {
        return res.status(400).json({
          message: 'In matrix mode, planType is required when switching by interval.',
          code: 'VALIDATION_ERROR',
        });
      }
    }

    if (!planType || !['starter', 'pro'].includes(planType)) {
      return res.status(400).json({
        message: 'Plan type must be "starter" or "pro"',
        code: 'VALIDATION_ERROR',
      });
    }

    const currency = await resolveBillingCurrency({
      userId: req.user.id,
      currency: req.body?.currency,
    });

    // Use StripeSync-backed DTO to include pendingChange and avoid drift.
    const subscription = await getSubscriptionStatusWithStripeSync(req.user.id);
    if (!subscription.active || !subscription.stripeSubscriptionId) {
      return res.status(400).json({
        message: 'No active subscription found. Please subscribe first.',
        code: 'NO_ACTIVE_SUBSCRIPTION',
      });
    }

    const currentInterval =
      subscription.interval || (subscription.planType ? getIntervalForPlan(subscription.planType) : null);
    const targetInterval =
      mode === 'retail-simple'
        ? getIntervalForPlan(planType)
        : (normalizedInterval || getIntervalForPlan(planType) || null);

    // retail-simple must not accept invalid interval/plan combinations.
    if (mode === 'retail-simple' && normalizedInterval && targetInterval && normalizedInterval !== targetInterval) {
      return res.status(400).json({
        message: `Interval ${normalizedInterval} is not available for ${planType} plan`,
        code: 'INVALID_INTERVAL',
      });
    }

    // Idempotency: if already on requested plan and no scheduled change, return.
    if (subscription.planType === planType && currentInterval === targetInterval && !subscription.pendingChange) {
      return res.json({
        ok: true,
        message: 'Subscription already on requested plan',
        planType,
        interval: targetInterval,
        alreadyUpdated: true,
      });
    }

    const decideChangeMode = (current, target) => {
      if (current === 'month' && target === 'year') {
        return 'checkout';
      }
      if (current === 'year' && target === 'month') {
        return 'scheduled';
      }
      return 'immediate';
    };

    const changeMode = decideChangeMode(currentInterval, targetInterval);

    if (changeMode === 'checkout') {
      const billingProfile = await getBillingProfile(req.user.id);
      const stripeCustomerId = await ensureStripeCustomer({
        ownerId: req.user.id,
        userEmail: req.user.email,
        userName: req.user.company,
        currency,
        stripeCustomerId: subscription.stripeCustomerId,
        billingProfile,
      });

      const successUrl = buildRetailSuccessUrl();
      const cancelUrl = buildRetailCancelUrl();
      warnIfEncodedCheckoutPlaceholder('subscription-change', successUrl);
      if (!isValidAbsoluteUrl(successUrl) || !isValidAbsoluteUrl(cancelUrl)) {
        return res.status(500).json({
          message: 'Invalid frontend URL configuration. Check FRONTEND_URL/APP_URL.',
          code: 'CONFIG_ERROR',
        });
      }

      const { createSubscriptionChangeCheckoutSession } = require('../services/stripe.service');
      const session = await createSubscriptionChangeCheckoutSession({
        ownerId: req.user.id,
        userEmail: req.user.email,
        planCode: planType,
        interval: targetInterval,
        currency,
        successUrl,
        cancelUrl,
        stripeCustomerId,
        previousStripeSubscriptionId: subscription.stripeSubscriptionId,
      });

      return res.json({
        ok: true,
        changeMode: 'checkout',
        message: 'Checkout required to complete upgrade',
        checkoutUrl: session.url,
        sessionId: session.id,
        planType,
        interval: targetInterval,
        currency,
      });
    }

    if (changeMode === 'scheduled') {
      const priceId = planCatalog.getPriceId(planType, targetInterval, currency);
      if (!priceId) {
        return res.status(500).json({
          message: `Stripe price ID not configured for ${planType}/${targetInterval}/${currency}`,
          code: CONFIG_ERROR_CODE,
        });
      }

      const { createOrUpdateSubscriptionSchedule } = require('../services/stripe.service');
      const scheduleResult = await createOrUpdateSubscriptionSchedule({
        subscriptionId: subscription.stripeSubscriptionId,
        targetPriceId: priceId,
      });

      await prisma.subscription.upsert({
        where: { ownerId: req.user.id },
        create: {
          ownerId: req.user.id,
          provider: 'stripe',
          stripeCustomerId: subscription.stripeCustomerId || null,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          planCode: subscription.planCode || subscription.planType || null,
          status: subscription.status || null,
          currency,
          currentPeriodStart: subscription.currentPeriodStart || null,
          currentPeriodEnd: subscription.currentPeriodEnd || null,
          cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
          pendingChangePlanCode: planType,
          pendingChangeInterval: targetInterval,
          pendingChangeCurrency: currency,
          pendingChangeEffectiveAt: scheduleResult.effectiveAt,
          lastSyncedAt: new Date(),
          sourceOfTruth: 'scheduled_change_request',
        },
        update: {
          pendingChangePlanCode: planType,
          pendingChangeInterval: targetInterval,
          pendingChangeCurrency: currency,
          pendingChangeEffectiveAt: scheduleResult.effectiveAt,
          lastSyncedAt: new Date(),
          sourceOfTruth: 'scheduled_change_request',
        },
      });

      return res.json({
        ok: true,
        changeMode: 'scheduled',
        message: 'Plan change scheduled at period end',
        pendingChange: {
          planCode: planType,
          interval: targetInterval,
          currency,
          effectiveAt: scheduleResult.effectiveAt,
        },
      });
    }

    // Immediate change (fallback) - preserves existing behavior where needed.
    const { updateSubscription } = require('../services/stripe.service');
    await updateSubscription(subscription.stripeSubscriptionId, planType, currency);

    const after = await getSubscriptionStatusWithStripeSync(req.user.id);
    return res.json({
      ok: true,
      changeMode: 'immediate',
      message: `Subscription updated to ${planType} plan successfully`,
      planType,
      interval: after.interval || targetInterval,
      currency,
    });
  } catch (e) {
    if (e.message?.includes('Stripe is not configured')) {
      return res.status(503).json({
        message: 'Payment processing unavailable',
        code: 'STRIPE_NOT_CONFIGURED',
      });
    }
    if (e?.code === CONFIG_ERROR_CODE || e.message?.includes('Stripe price ID not found')) {
      return res.status(500).json({
        message: e.message,
        code: CONFIG_ERROR_CODE,
      });
    }
    next(e);
  }
});

/**
 * POST /api/subscriptions/scheduled/change
 * Adjust an existing scheduled change (or create it)
 */
r.post('/subscriptions/scheduled/change', requireAuth, async (req, res, next) => {
  try {
    const planCatalog = require('../services/plan-catalog.service');
    const mode = planCatalog.detectCatalogMode();
    const subscription = await getSubscriptionStatusWithStripeSync(req.user.id);

    if (!subscription.active || !subscription.stripeSubscriptionId) {
      return res.status(400).json({
        message: 'No active subscription found. Please subscribe first.',
        code: 'NO_ACTIVE_SUBSCRIPTION',
      });
    }

    const requestedPlan = req.body?.planType || req.body?.plan || 'starter';
    if (!['starter', 'pro'].includes(requestedPlan)) {
      return res.status(400).json({
        message: 'Plan type must be "starter" or "pro"',
        code: 'VALIDATION_ERROR',
      });
    }

    // Scheduled changes are for downgrades (year -> month).
    // In retail-simple, the only scheduled target is starter/month.
    if (mode === 'retail-simple' && requestedPlan !== 'starter') {
      return res.status(400).json({
        message: 'In retail-simple mode, only downgrade to Starter (monthly) can be scheduled.',
        code: 'INVALID_SCHEDULED_CHANGE',
      });
    }

    const currency = await resolveBillingCurrency({
      userId: req.user.id,
      currency: req.body?.currency,
    });

    const targetInterval = mode === 'retail-simple'
      ? getIntervalForPlan(requestedPlan)
      : (req.body?.interval === 'month' || req.body?.interval === 'year'
        ? req.body.interval
        : getIntervalForPlan(requestedPlan));

    const priceId = planCatalog.getPriceId(requestedPlan, targetInterval, currency);
    if (!priceId) {
      return res.status(500).json({
        message: `Stripe price ID not configured for ${requestedPlan}/${targetInterval}/${currency}`,
        code: CONFIG_ERROR_CODE,
      });
    }

    const { createOrUpdateSubscriptionSchedule } = require('../services/stripe.service');
    const scheduleResult = await createOrUpdateSubscriptionSchedule({
      subscriptionId: subscription.stripeSubscriptionId,
      targetPriceId: priceId,
    });

    await prisma.subscription.updateMany({
      where: { ownerId: req.user.id },
      data: {
        pendingChangePlanCode: requestedPlan,
        pendingChangeInterval: targetInterval,
        pendingChangeCurrency: currency,
        pendingChangeEffectiveAt: scheduleResult.effectiveAt,
        lastSyncedAt: new Date(),
        sourceOfTruth: 'scheduled_change_request',
      },
    });

    return res.json({
      ok: true,
      message: 'Scheduled change updated',
      pendingChange: {
        planCode: requestedPlan,
        interval: targetInterval,
        currency,
        effectiveAt: scheduleResult.effectiveAt,
      },
    });
  } catch (e) { next(e); }
});

/**
 * POST /api/subscriptions/scheduled/cancel
 * Cancel a scheduled change (Shopify parity)
 */
r.post('/subscriptions/scheduled/cancel', requireAuth, async (req, res, next) => {
  try {
    const subscription = await getSubscriptionStatusWithStripeSync(req.user.id);
    if (!subscription.active || !subscription.stripeSubscriptionId) {
      return res.status(400).json({
        message: 'No active subscription found. Please subscribe first.',
        code: 'NO_ACTIVE_SUBSCRIPTION',
      });
    }

    const { cancelSubscriptionSchedule } = require('../services/stripe.service');
    const result = await cancelSubscriptionSchedule(subscription.stripeSubscriptionId);

    await prisma.subscription.updateMany({
      where: { ownerId: req.user.id },
      data: {
        pendingChangePlanCode: null,
        pendingChangeInterval: null,
        pendingChangeCurrency: null,
        pendingChangeEffectiveAt: null,
        lastSyncedAt: new Date(),
        sourceOfTruth: 'scheduled_change_cancelled',
      },
    });

    return res.json({ ok: true, ...result });
  } catch (e) { next(e); }
});

/**
 * POST /api/subscriptions/cancel
 * Cancel subscription (via Stripe API)
 * Immediately updates local DB to avoid race conditions with webhook
 */
r.post('/subscriptions/cancel', requireAuth, async (req, res, next) => {
  try {
    const subscription = await getSubscriptionStatus(req.user.id);

    if (!subscription.active || !subscription.stripeSubscriptionId) {
      return res.status(400).json({
        message: 'No active subscription found to cancel',
        code: 'INACTIVE_SUBSCRIPTION',
      });
    }

    // Cancel subscription in Stripe
    await cancelSubscription(subscription.stripeSubscriptionId);

    // Immediately update local DB to avoid race condition
    // Webhook handler will also process this, but having it here ensures immediate consistency
    const { deactivateSubscription } = require('../services/subscription.service');
    await deactivateSubscription(req.user.id, 'cancelled');

    res.json({ ok: true, message: 'Subscription cancelled successfully' });
  } catch (e) {
    if (e.message?.includes('Stripe is not configured')) {
      return res.status(503).json({
        message: 'Payment processing unavailable',
        code: 'STRIPE_NOT_CONFIGURED',
      });
    }
    next(e);
  }
});

/**
 * GET /api/subscriptions/portal
 * Get Stripe customer portal URL for self-service management
 */
r.get('/subscriptions/portal', requireAuth, async (req, res) => {
  const requestId =
    req.id ||
    req.headers['x-request-id'] ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const subscription = await getSubscriptionStatus(req.user.id);
    const stripeCustomerId = await resolveStripeCustomerId({
      userId: req.user.id,
      subscription,
      allowCreate: true,
      requestId,
    });

    if (!stripeCustomerId) {
      return res.status(400).json({
        message: 'No payment account found. Please subscribe to a plan first.',
        code: 'MISSING_CUSTOMER_ID',
        requestId,
      });
    }

    const returnUrl = buildRetailFrontendUrl('/app/retail/billing', null, { fromPortal: 'true' });
    if (!isValidAbsoluteUrl(returnUrl)) {
      return res.status(500).json({
        message: 'Invalid frontend URL configuration. Check FRONTEND_URL/APP_URL.',
        code: 'CONFIG_ERROR',
        requestId,
      });
    }

    const portalUrl = await getCustomerPortalUrl(stripeCustomerId, returnUrl);

    res.json({ ok: true, portalUrl });
  } catch (e) {
    if (e.message?.includes('Stripe is not configured')) {
      return res.status(503).json({
        message: 'Payment processing unavailable',
        code: 'STRIPE_NOT_CONFIGURED',
      });
    }
    logger.error({
      requestId,
      userId: req.user.id,
      err: e.message,
      stack: e.stack,
    }, 'Failed to create Stripe customer portal session');
    return res.status(502).json({
      message: 'Failed to create customer portal session',
      code: 'STRIPE_PORTAL_ERROR',
      requestId,
    });
  }
});

/**
 * POST /api/billing/topup
 * Create credit top-up checkout session
 * Body: { credits: number }
 */
r.post('/billing/topup', requireAuth, async (req, res, next) => {
  try {
    const credits = Number(req.body?.credits);

    if (!credits || !Number.isInteger(credits) || credits <= 0) {
      return res.status(400).json({
        message: 'Credits must be a positive number',
        code: 'VALIDATION_ERROR',
      });
    }

    // Prevent unreasonably large credit purchases (max 1 million credits per transaction)
    // This prevents potential overflow issues and abuse
    const MAX_CREDITS_PER_PURCHASE = 1000000;
    if (credits > MAX_CREDITS_PER_PURCHASE) {
      return res.status(400).json({
        message: `Maximum ${MAX_CREDITS_PER_PURCHASE.toLocaleString()} credits allowed per purchase`,
        code: 'MAX_CREDITS_EXCEEDED',
      });
    }

    // Credit top-ups are available to all users (subscription not required)
    // This allows users to buy credits even without a subscription

    const currency = await resolveBillingCurrency({
      userId: req.user.id,
      currency: req.body?.currency || req.query?.currency,
    });

    const billingProfile = await getBillingProfile(req.user.id);
    const billingCountry =
      billingProfile?.billingAddress?.country ||
      billingProfile?.vatCountry ||
      null;
    const vatIdValidated = billingProfile?.taxStatus === 'verified';
    const isBusiness = typeof billingProfile?.isBusiness === 'boolean'
      ? billingProfile.isBusiness
      : billingProfile?.vatNumber
        ? true
        : null;

    const price = calculateTopupPrice(credits, {
      currency,
      billingCountry,
      vatId: billingProfile?.vatNumber || null,
      vatIdValidated,
      isBusiness,
      ipCountry: req.headers['cf-ipcountry'] || req.headers['x-country'] || null,
    });

    const stripeCustomerId = await ensureStripeCustomer({
      ownerId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.company,
      currency,
      stripeCustomerId: null,
      billingProfile,
    });

    const successUrl = buildRetailSuccessUrl();
    const cancelUrl = buildRetailCancelUrl();
    warnIfEncodedCheckoutPlaceholder('credit-topup', successUrl);

    if (!isValidAbsoluteUrl(successUrl) || !isValidAbsoluteUrl(cancelUrl)) {
      return res.status(500).json({
        message: 'Invalid frontend URL configuration. Check FRONTEND_URL/APP_URL.',
        code: 'CONFIG_ERROR',
      });
    }

    const session = await createCreditTopupCheckoutSession({
      ownerId: req.user.id,
      userEmail: req.user.email,
      credits,
      priceAmount: price.priceWithVat,
      currency,
      successUrl,
      cancelUrl,
      stripeCustomerId,
    });

    res.status(201).json({
      ok: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      credits,
      currency,
      price: price.priceWithVat,
      priceEur: price.priceEurWithVat,
      priceUsd: price.priceUsdWithVat,
      priceBreakdown: price,
    });
  } catch (e) {
    if (e.message?.includes('Stripe is not configured')) {
      return res.status(503).json({
        message: 'Payment processing unavailable',
        code: 'STRIPE_NOT_CONFIGURED',
      });
    }
    if (e?.code === CONFIG_ERROR_CODE) {
      return res.status(500).json({
        message: e.message,
        code: CONFIG_ERROR_CODE,
      });
    }
    next(e);
  }
});

/**
 * GET /api/billing/topup/calculate
 * Calculate price for given number of credits
 * Query: ?credits=100
 */
r.get('/billing/topup/calculate', requireAuth, async (req, res, next) => {
  try {
    const credits = Number(req.query.credits);

    if (!credits || !Number.isInteger(credits) || credits <= 0) {
      return res.status(400).json({
        message: 'Credits must be a positive number',
        code: 'VALIDATION_ERROR',
      });
    }

    // Prevent unreasonably large credit purchases (max 1 million credits per transaction)
    const MAX_CREDITS_PER_PURCHASE = 1000000;
    if (credits > MAX_CREDITS_PER_PURCHASE) {
      return res.status(400).json({
        message: `Maximum ${MAX_CREDITS_PER_PURCHASE.toLocaleString()} credits allowed per purchase`,
        code: 'MAX_CREDITS_EXCEEDED',
      });
    }

    const currency = await resolveBillingCurrency({
      userId: req.user.id,
      currency: req.query.currency,
    });
    const billingProfile = await getBillingProfile(req.user.id);
    const billingCountry =
      billingProfile?.billingAddress?.country ||
      billingProfile?.vatCountry ||
      null;
    const vatIdValidated = billingProfile?.taxStatus === 'verified';
    const isBusiness = typeof billingProfile?.isBusiness === 'boolean'
      ? billingProfile.isBusiness
      : billingProfile?.vatNumber
        ? true
        : null;
    const price = calculateTopupPrice(credits, {
      currency,
      billingCountry,
      vatId: billingProfile?.vatNumber || null,
      vatIdValidated,
      isBusiness,
      ipCountry: req.headers['cf-ipcountry'] || req.headers['x-country'] || null,
    });

    res.json(price);
  } catch (e) {
    if (e.message?.includes('Invalid credits amount')) {
      return res.status(400).json({
        message: e.message || 'An error occurred while calculating the price',
        code: 'PRICE_CALCULATION_ERROR',
      });
    }
    if (e?.code === 'INVALID_CURRENCY') {
      return res.status(400).json({
        message: e.message || 'Unsupported currency',
        code: 'INVALID_CURRENCY',
      });
    }
    next(e);
  }
});

/**
 * Internal handler: verify and activate subscription from checkout session (idempotent).
 * Used by both /subscriptions/verify-session and /subscriptions/finalize.
 */
async function handleVerifySubscriptionSession(req, res, next) {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        message: 'Session ID is required',
        code: 'VALIDATION_ERROR',
      });
    }

    const { getCheckoutSession } = require('../services/stripe.service');
    const {
      activateSubscription,
      resetAllowanceForPeriod,
    } = require('../services/subscription.service');

    // Retrieve session from Stripe
    const session = await getCheckoutSession(sessionId);

    // Verify session belongs to this user
    const metadata = session.metadata || {};
    const ownerId = Number(metadata.ownerId);

    if (ownerId !== req.user.id) {
      return res.status(403).json({
        message: 'This payment session does not belong to your account',
        code: 'AUTHORIZATION_ERROR',
      });
    }

    // Check if this is a subscription session
    if (session.mode !== 'subscription') {
      return res.status(400).json({
        message: 'This payment session is not for a subscription',
        code: 'VALIDATION_ERROR',
      });
    }

    const planType = metadata.planType;
    if (!planType || !['starter', 'pro'].includes(planType)) {
      return res.status(400).json({
        message: 'Invalid plan type in payment session',
        code: 'VALIDATION_ERROR',
      });
    }

    const subscriptionId = session.subscription;
    const customerId = session.customer;

    if (!subscriptionId) {
      return res.status(400).json({
        message: 'Payment session does not contain a subscription',
        code: 'VALIDATION_ERROR',
      });
    }

    // Get subscription from Stripe
    const stripe = require('../services/stripe.service').stripe;
    if (!stripe) {
      return res.status(503).json({
        message: 'Payment processing unavailable',
        code: 'STRIPE_NOT_CONFIGURED',
      });
    }

    let stripeSubscription = null;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (err) {
      return res.status(400).json({
        message: 'Failed to retrieve subscription information',
        code: 'SUBSCRIPTION_RETRIEVAL_ERROR',
      });
    }

    // Check if subscription is already active (idempotency check)
    // This prevents duplicate activations if webhook already processed
    const currentSubscription = await getSubscriptionStatus(req.user.id);
    if (currentSubscription.active && currentSubscription.stripeSubscriptionId === subscriptionId) {
      logger.info({
        userId: req.user.id,
        subscriptionId,
        planType,
        currentPlanType: currentSubscription.planType,
      }, 'Subscription already active, skipping activation (idempotency)');

      // Still try to reset allowance (idempotent check inside resetAllowanceForPeriod)
      const result = await resetAllowanceForPeriod(req.user.id, planType, `sub_${subscriptionId}`, stripeSubscription);

      return res.json({
        ok: true,
        subscription: {
          active: true,
          planType: currentSubscription.planType || planType,
          subscriptionId,
          customerId,
        },
        allowance: {
          reset: result.allocated,
          includedPerPeriod: result.includedSmsPerPeriod || 0,
          reason: result.reason || 'already_processed',
        },
        credits: {
          allocated: result.allocated,
          credits: result.includedSmsPerPeriod || 0,
          reason: result.reason || 'already_processed',
        },
      });
    }

    // Activate subscription (only if not already active)
    logger.info({
      userId: req.user.id,
      subscriptionId,
      planType,
      currentStatus: currentSubscription.status,
    }, 'Activating subscription via manual verification');
    await activateSubscription(req.user.id, customerId, subscriptionId, planType);

    // Reset allowance for this billing period
    const result = await resetAllowanceForPeriod(req.user.id, planType, `sub_${subscriptionId}`, stripeSubscription);

    res.json({
      ok: true,
      subscription: {
        active: true,
        planType,
        subscriptionId,
        customerId,
      },
      allowance: {
        reset: result.allocated,
        includedPerPeriod: result.includedSmsPerPeriod || 0,
        reason: result.reason,
      },
      credits: {
        allocated: result.allocated,
        credits: result.includedSmsPerPeriod || 0,
        reason: result.reason,
      },
    });
  } catch (e) {
    if (e.message?.includes('Stripe is not configured')) {
      return res.status(503).json({
        message: 'Payment processing unavailable',
        code: 'STRIPE_NOT_CONFIGURED',
      });
    }
    next(e);
  }
}

/**
 * POST /api/subscriptions/verify-session
 * Manually verify and activate subscription from checkout session
 * Body: { sessionId: string }
 * Useful if webhook wasn't processed
 */
r.post('/subscriptions/verify-session', requireAuth, handleVerifySubscriptionSession);

/**
 * POST /api/subscriptions/finalize
 * Alias for verify-session (Shopify parity)
 * Body: { sessionId: string }
 *
 * Used by the Retail billing success page to finalize state after Stripe redirect.
 * Intentionally reuses the same logic as /subscriptions/verify-session.
 */
r.post('/subscriptions/finalize', requireAuth, handleVerifySubscriptionSession);

/**
 * POST /api/billing/verify-payment
 * Generic payment verification endpoint for all payment types
 * Body: { sessionId: string }
 * Returns payment type and verification status
 */
r.post('/billing/verify-payment', requireAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        message: 'Session ID is required',
        code: 'VALIDATION_ERROR',
      });
    }

    const { getCheckoutSession } = require('../services/stripe.service');
    const { getBalance } = require('../services/wallet.service');
    const { getSubscriptionStatus } = require('../services/subscription.service');

    // Retrieve session from Stripe
    const session = await getCheckoutSession(sessionId);

    // Verify session belongs to this user
    const metadata = session.metadata || {};
    const ownerId = Number(metadata.ownerId);

    if (ownerId !== req.user.id) {
      return res.status(403).json({
        message: 'This payment session does not belong to your account',
        code: 'AUTHORIZATION_ERROR',
      });
    }

    const paymentType = metadata.type || (session.mode === 'subscription' ? 'subscription' : 'payment');

    // Handle subscription payments
    if (paymentType === 'subscription' || session.mode === 'subscription') {
      // Call subscription verify-session logic inline
      const {
        activateSubscription,
        resetAllowanceForPeriod,
      } = require('../services/subscription.service');

      const planType = metadata.planType;
      if (!planType || !['starter', 'pro'].includes(planType)) {
        return res.status(400).json({
          message: 'Invalid plan type in payment session',
          code: 'VALIDATION_ERROR',
        });
      }

      const subscriptionId = session.subscription;
      const customerId = session.customer;

      if (!subscriptionId) {
        return res.status(400).json({
          message: 'Payment session does not contain a subscription',
          code: 'VALIDATION_ERROR',
        });
      }

      const stripe = require('../services/stripe.service').stripe;
      if (!stripe) {
        return res.status(503).json({
          message: 'Payment processing unavailable',
          code: 'STRIPE_NOT_CONFIGURED',
        });
      }

      let stripeSubscription = null;
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      } catch (err) {
        return res.status(400).json({
          message: 'Failed to retrieve subscription information',
          code: 'SUBSCRIPTION_RETRIEVAL_ERROR',
        });
      }

      const currentSubscription = await getSubscriptionStatus(req.user.id);
      if (currentSubscription.active && currentSubscription.stripeSubscriptionId === subscriptionId) {
        const result = await resetAllowanceForPeriod(req.user.id, planType, `sub_${subscriptionId}`, stripeSubscription);
        return res.json({
          ok: true,
          paymentType: 'subscription',
          subscription: {
            active: true,
            planType: currentSubscription.planType || planType,
            subscriptionId,
            customerId,
          },
          allowance: {
            reset: result.allocated,
            includedPerPeriod: result.includedSmsPerPeriod || 0,
            reason: result.reason || 'already_processed',
          },
          credits: {
            allocated: result.allocated,
            credits: result.includedSmsPerPeriod || 0,
            reason: result.reason || 'already_processed',
          },
        });
      }

      await activateSubscription(req.user.id, customerId, subscriptionId, planType);
      const result = await resetAllowanceForPeriod(req.user.id, planType, `sub_${subscriptionId}`, stripeSubscription);

      return res.json({
        ok: true,
        paymentType: 'subscription',
        subscription: {
          active: true,
          planType,
          subscriptionId,
          customerId,
        },
        allowance: {
          reset: result.allocated,
          includedPerPeriod: result.includedSmsPerPeriod || 0,
          reason: result.reason,
        },
        credits: {
          allocated: result.allocated,
          credits: result.includedSmsPerPeriod || 0,
          reason: result.reason,
        },
      });
    }

    // Handle credit top-up payments
    if (paymentType === 'credit_topup') {
      const credits = Number(metadata.credits);

      // Check if credits were already added (idempotency)
      const balance = await getBalance(req.user.id);

      // Check for transaction with this session ID
      const existingTxn = await prisma.creditTransaction.findFirst({
        where: {
          ownerId: req.user.id,
          reason: 'stripe:topup',
          meta: {
            path: ['sessionId'],
            equals: sessionId,
          },
        },
      });

      if (existingTxn) {
        return res.json({
          ok: true,
          paymentType: 'credit_topup',
          credits: {
            allocated: true,
            credits,
            reason: 'already_processed',
          },
          balance,
        });
      }

      // Credits should be added by webhook, but if not, we'll show processing
      return res.json({
        ok: true,
        paymentType: 'credit_topup',
        credits: {
          allocated: false,
          credits,
          reason: 'processing',
        },
        balance,
      });
    }

    // Handle credit pack purchases
    const packageId = Number(metadata.packageId);
    if (packageId) {
      const purchase = await prisma.purchase.findFirst({
        where: {
          stripeSessionId: sessionId,
          ownerId: req.user.id,
        },
        include: { package: true },
      });

      if (purchase) {
        return res.json({
          ok: true,
          paymentType: 'credit_pack',
          purchase: {
            id: purchase.id,
            status: purchase.status,
            units: purchase.package?.units || 0,
          },
        });
      }
    }

    // Unknown payment type
    return res.json({
      ok: true,
      paymentType: 'unknown',
      message: 'Payment received, processing...',
    });
  } catch (e) {
    if (e.message?.includes('Stripe is not configured')) {
      return res.status(503).json({
        message: 'Payment processing unavailable',
        code: 'STRIPE_NOT_CONFIGURED',
      });
    }
    next(e);
  }
});

/**
 * GET /api/billing/verify-sync
 * Verify data consistency between Stripe and local database
 * Checks for orphaned records and mismatched states
 */
r.get('/billing/verify-sync', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const issues = [];

    // Get user's subscription status
    const subscription = await getSubscriptionStatus(userId);

    // Check 1: User has active subscription but no stripeSubscriptionId
    if (subscription.active && !subscription.stripeSubscriptionId) {
      issues.push({
        type: 'missing_stripe_subscription_id',
        message: 'User has active subscription status but no Stripe subscription ID',
        severity: 'high',
      });
    }

    // Check 2: User has stripeSubscriptionId but subscription is not active
    if (subscription.stripeSubscriptionId && !subscription.active) {
      issues.push({
        type: 'inactive_with_stripe_id',
        message: 'User has Stripe subscription ID but subscription status is not active',
        severity: 'medium',
        note: 'This may be normal if subscription was cancelled',
      });
    }

    // Check 3: Verify credit transactions match subscription allocations
    if (subscription.active && subscription.planType) {
      // Count subscription credit allocations
      const subscriptionCredits = await prisma.creditTransaction.count({
        where: {
          ownerId: userId,
          reason: {
            startsWith: `subscription:${subscription.planType}:cycle`,
          },
          type: 'credit',
        },
      });

      // This is informational - we don't know how many billing cycles have occurred
      // But we can verify the pattern is correct
      if (subscriptionCredits === 0 && subscription.active) {
        issues.push({
          type: 'no_subscription_credits',
          message: `Active ${subscription.planType} subscription but no credit allocations found`,
          severity: 'medium',
          note: 'Credits may be allocated on next billing cycle',
        });
      }
    }

    res.json({
      ok: true,
      userId,
      subscription,
      issues,
      summary: {
        totalIssues: issues.length,
        highSeverity: issues.filter(i => i.severity === 'high').length,
        mediumSeverity: issues.filter(i => i.severity === 'medium').length,
      },
    });
  } catch (e) {
    next(e);
  }
});

module.exports = r;
