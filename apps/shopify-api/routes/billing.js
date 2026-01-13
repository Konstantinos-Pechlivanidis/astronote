import express from 'express';
import * as ctrl from '../controllers/billing.js';
import { validateBody, validateQuery } from '../middlewares/validation.js';
import {
  createPurchaseSchema,
  transactionHistoryQuerySchema,
  billingHistoryQuerySchema,
  topupCalculateQuerySchema,
  topupCreateSchema,
  billingProfileSchema,
  invoicesQuerySchema,
} from '../schemas/billing.schema.js';
import { billingRateLimit } from '../middlewares/rateLimits.js';
import {
  billingBalanceCache,
  billingHistoryCache,
  invalidateBillingCache,
} from '../middlewares/cache.js';

const r = express.Router();

// Apply rate limiting to all routes
r.use(billingRateLimit);

// GET /billing/balance - Get credit balance
r.get('/balance', billingBalanceCache, ctrl.getBalance);

// GET /billing/summary - Get billing summary (subscription + allowance + credits)
r.get('/summary', ctrl.getSummary);

// GET /billing/profile - Get billing profile
r.get('/profile', ctrl.getProfile);

// PUT /billing/profile - Update billing profile
r.put('/profile', validateBody(billingProfileSchema), ctrl.updateProfile);

// POST /billing/profile/sync-from-stripe - Sync billing profile from Stripe customer
r.post('/profile/sync-from-stripe', ctrl.syncProfileFromStripe);

// GET /billing/packages - Get available credit packages (only if subscription active)
r.get('/packages', ctrl.getPackages);

// GET /billing/topup/calculate - Calculate top-up price
r.get(
  '/topup/calculate',
  validateQuery(topupCalculateQuerySchema),
  ctrl.calculateTopup,
);

// POST /billing/topup - Create top-up checkout session
r.post(
  '/topup',
  validateBody(topupCreateSchema),
  invalidateBillingCache,
  ctrl.createTopup,
);

// GET /billing/history - Get transaction history
r.get(
  '/history',
  validateQuery(transactionHistoryQuerySchema),
  billingHistoryCache,
  ctrl.getHistory,
);

// GET /billing/billing-history - Get billing history (Stripe transactions)
r.get(
  '/billing-history',
  validateQuery(billingHistoryQuerySchema),
  billingHistoryCache,
  ctrl.getBillingHistory,
);

// GET /billing/invoices - Get Stripe invoices
r.get(
  '/invoices',
  validateQuery(invoicesQuerySchema),
  billingHistoryCache,
  ctrl.getInvoices,
);

// POST /billing/purchase - Create Stripe checkout session (credit packs - requires subscription)
r.post(
  '/purchase',
  validateBody(createPurchaseSchema),
  invalidateBillingCache,
  ctrl.createPurchase,
);

export default r;
