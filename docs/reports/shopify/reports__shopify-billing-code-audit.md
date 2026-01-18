# Shopify Billing Code Audit (Prisma -> Backend -> Frontend)

## Scope
- Backend: apps/shopify-api
- Frontend: apps/astronote-web (Shopify billing UI)
- Prisma: apps/shopify-api/prisma/schema.prisma

## Billing Data Flow Map
### Prisma models
- Shop: stripeCustomerId, stripeSubscriptionId, planType, subscriptionStatus, interval, periods, allowance fields, lastBillingError.
- ShopBillingProfile: legalName, vatNumber, vatCountry, billingEmail, billingAddress, currency, taxStatus, taxExempt.
- Subscription: stripeCustomerId, stripeSubscriptionId, planCode, status, period dates, cancelAtPeriodEnd.
- InvoiceRecord: stripeInvoiceId, totals, currency, PDF/hosted URLs, status, issuedAt.
- TaxEvidence: billing country, VAT ID, validation flag, tax rate, treatment.
- BillingTransaction: purchases/topups/subscription payments (idempotency by shopId + idempotencyKey).
- CreditTransaction + Wallet: credits ledger and balances.
- Purchase/Package: fixed credit packs + Stripe session ids.
- WebhookEvent: webhook idempotency (provider + eventId unique; payloadHash for replay).

### Backend endpoints (Shopify API)
- POST /api/subscriptions/subscribe -> Stripe checkout session { checkoutUrl, sessionId, planType, currency }.
- POST /api/subscriptions/update /switch /cancel -> plan or interval changes.
- GET /api/subscriptions/portal -> Stripe customer portal URL.
- POST /api/subscriptions/reconcile -> manual recovery sync against Stripe.
- GET /api/billing/summary -> subscription + allowance + credits.
- GET /api/billing/packages -> credit packs (subscription gated).
- POST /api/billing/purchase -> Stripe checkout session for packs.
- GET /api/billing/topup/calculate -> VAT-aware price breakdown.
- POST /api/billing/topup -> Stripe checkout for variable topup.
- GET /api/billing/profile, PUT /api/billing/profile -> billing profile VAT data.
- GET /api/billing/invoices -> invoice history.

### Webhook flow
- Stripe webhook signature verified.
- WebhookEvent replay protection prevents duplicates.
- checkout.session.completed:
  - subscription: activateSubscription + allowance initialization.
  - topup: credit wallet + BillingTransaction + tax evidence.
- invoice.payment_succeeded:
  - persist InvoiceRecord + TaxEvidence + BillingProfile sync.
  - allocate free credits for cycle (CreditTransaction idempotency).
  - record BillingTransaction for the invoice (idempotency).
- customer.subscription.updated/deleted: updates Shop + Subscription record.

### Frontend usage (Shopify)
- shopifyBillingApi.ts wraps all billing endpoints.
- Zod parsing with safe defaults (summary, profile, invoices).
- Billing page renders status, allowance, credits, invoices, VAT state.
- Subscription actions (subscribe/switch/cancel/portal) use centralized hooks.

## Gaps Found and Fixes
1) Missing BillingTransaction for subscription invoice paid.
- Fix: recordSubscriptionInvoiceTransaction on invoice.payment_succeeded.
- Files: apps/shopify-api/controllers/stripe-webhooks.js, apps/shopify-api/services/invoices.js.

2) No manual reconciliation for missed webhooks.
- Fix: reconcileSubscriptionFromStripe + POST /api/subscriptions/reconcile.
- Files: apps/shopify-api/services/subscription.js, apps/shopify-api/controllers/subscriptions.js, apps/shopify-api/routes/subscriptions.js.

3) Missing contract tests for invoice paid idempotency.
- Fix: new unit tests for subscription invoice transaction and free credits idempotency.
- Files: apps/shopify-api/tests/unit/subscription-invoice-transaction.test.js, apps/shopify-api/tests/unit/subscription-free-credits.test.js.

4) Frontend contract check for subscribe payload.
- Fix: lightweight static test (billing safety test) ensures subscribe payload + endpoint.
- File: apps/astronote-web/tests/shopify-billing-safety.test.mjs.

## Professional Readiness Checklist
- Stripe webhook signature verification: PASS (verifyWebhookSignature in services/stripe.js).
- Webhook idempotency (eventId + payload hash): PASS (WebhookEvent + replay guard).
- Stripe URL validation: PASS (buildFrontendUrl + isValidAbsoluteUrl).
- Tenant scoping: PASS (store-resolution middleware enforced on protected routes).
- Billing profile + VAT evidence: PASS (ShopBillingProfile + TaxEvidence).
- Invoice persistence: PASS (InvoiceRecord + endpoints).
- Subscription drift recovery: PASS (reconcile endpoint).
- Credit ledger idempotency: PASS (CreditTransaction + idempotency via invoiceId/sessionId).
- Billing transaction idempotency: PASS (BillingTransaction unique by shopId + idempotencyKey).

## Gate Commands and Results
Shopify API:
- lint: `npm run lint` -> PASS (2 existing warnings: console usage in config files).
- typecheck: not defined in apps/shopify-api.
- tests: `npm test -- --runTestsByPath tests/unit/subscription-checkout.test.js tests/unit/webhook-replay-stripe.test.js tests/unit/tax-resolver.test.js tests/unit/url-helpers.test.js tests/unit/stripe-subscription.test.js tests/unit/subscription-invoice-transaction.test.js tests/unit/subscription-free-credits.test.js` -> PASS (Jest ESM VM module warning; logger output during tests).
- build: `npm run build` -> PASS (prisma generate).

Astronote web:
- lint: `npm run lint` -> PASS (existing warnings in retail pages, unrelated).
- typecheck: not defined in apps/astronote-web.
- tests: `node --test apps/astronote-web/tests/shopify-billing-safety.test.mjs` -> PASS.
- build: `npm run build` -> PASS.

## Files Changed (Billing Scope)
Backend:
- apps/shopify-api/services/invoices.js (record subscription invoice transactions).
- apps/shopify-api/controllers/stripe-webhooks.js (invoice.paid -> BillingTransaction).
- apps/shopify-api/services/subscription.js (reconciliation helper).
- apps/shopify-api/controllers/subscriptions.js (reconcile endpoint).
- apps/shopify-api/routes/subscriptions.js (route wiring).
- apps/shopify-api/tests/unit/subscription-invoice-transaction.test.js (invoice billing transaction idempotency).
- apps/shopify-api/tests/unit/subscription-free-credits.test.js (invoice credit idempotency).
- apps/shopify-api/tests/unit/subscription-checkout.test.js (mock update).
- apps/shopify-api/utils/url-helpers.js (lint-safe domain pattern).

Frontend:
- apps/astronote-web/tests/shopify-billing-safety.test.mjs (subscribe payload check).

Reports:
- reports/shopify-billing-code-audit.md (this report).

