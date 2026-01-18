# Shopify Billing Audit (Backend + Frontend + Prisma)

## Scope
- Backend: `apps/shopify-api`
- Frontend: `apps/astronote-web/app/app/shopify/billing` + `apps/astronote-web/src/lib/shopifyBillingApi.ts`
- Prisma: `apps/shopify-api/prisma/schema.prisma`

## Current Flow (Observed)
### Subscriptions
- `POST /api/subscriptions/subscribe` creates Stripe Checkout session using price ID from env.
- `checkout.session.completed` webhook activates subscription via `activateSubscription` and allocates free credits.
- `invoice.payment_succeeded` resets allowance and allocates free credits for new cycle.
- `GET /api/subscriptions/portal` creates Stripe portal session.
- Subscription state stored on `Shop` (`stripeCustomerId`, `stripeSubscriptionId`, `planType`, `subscriptionStatus`, billing period fields, allowance fields).

### Credit Packs + Topups
- `GET /api/billing/packages` returns DB packages if subscription is active.
- `POST /api/billing/purchase` creates Stripe Checkout session and a `Purchase` record.
- `checkout.session.completed` for credit packs is handled in billing service and credits wallet.
- `POST /api/billing/topup` creates Stripe Checkout session for variable credit amount.
- `checkout.session.completed` for topups credits wallet directly (no `BillingTransaction` record).
- `GET /api/billing/topup/calculate` uses a flat VAT rate (24%) and EUR pricing.

### Webhooks / Idempotency
- Stripe webhook signature verified.
- Replay protection via `WebhookEvent` (`provider + eventId` unique + payload hash).
- No persisted invoice record table. No dedicated tax evidence table.

### Frontend Billing UI (Shopify)
- Uses `shopifyBillingApi` wrapper with `axios` client that injects auth + shop domain headers.
- Billing page shows subscription, allowance, balance, credit packs, topup calculator, and purchase history.
- Topup price breakdown assumes 24% VAT and EUR. No VAT ID / tax country handling.
- No invoice list UI discovered.

## Gaps / Missing vs Requirements
1) **VAT logic incomplete**
   - Flat VAT rate (24%) only, no EU B2B reverse charge / EU B2C / non-EU handling.
   - No VAT ID collection or validation; no tax evidence stored.
   - Stripe Tax not enabled in Checkout sessions.

2) **Data model is incomplete for enterprise billing**
   - No `ShopBillingProfile`, `Subscription` (separate from Shop), `InvoiceRecord`, or `TaxEvidence` models.
   - Webhook table lacks event type / payload hash field as requested (only `eventHash`).

3) **Invoice storage missing**
   - Stripe invoice data is not persisted (no PDF/hosted URL for future admin app).

4) **Stripe customer reuse**
   - Checkout sessions rely on `customer_email` and may create multiple Stripe customers.
   - No VAT ID stored on customer; portal flow is the only place creating a customer if missing.

5) **Top-up flow not fully auditable**
   - Top-up checkout success credits wallet but does not create a `BillingTransaction` or invoice record.

6) **Frontend does not surface VAT or invoice history**
   - Billing UI assumes EU VAT and shows fixed EUR text.
   - No invoice list or tax status visibility.

## Risk List (Production)
- VAT compliance risk (EU rules not applied or documented).
- Missing invoice persistence -> no audit trail for accounting or admin tooling.
- Duplicate Stripe customers -> tax data split across customer records.
- Top-up audit gap (no billing transaction / invoice record).
- Tax evidence missing -> audit exposure for VAT or reverse charge validation.

## Fix Plan (Minimal-risk)
- Add billing models: `ShopBillingProfile`, `Subscription`, `InvoiceRecord`, `TaxEvidence`.
- Add VAT / tax resolver (GR domestic, EU B2B reverse charge, EU B2C VAT, non-EU no VAT) + store evidence.
- Enable Stripe Tax + tax ID collection where available; otherwise use resolver as fallback.
- Ensure Checkout sessions use existing Stripe customer when available; create and store if missing.
- Persist invoice records on `invoice.*` webhooks and link to shop.
- Persist tax evidence on checkout/invoice events.
- Add billing endpoints for invoices (and billing profile if needed).
- Update Shopify billing UI to show invoice history + tax notes; update top-up calculation to reflect tax rules.
- Add unit/contract tests for tax resolver + subscription checkout contract + webhook idempotency coverage.
