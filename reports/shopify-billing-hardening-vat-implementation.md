# Shopify Billing Hardening + VAT Support (Implementation)

## Summary
- Added enterprise billing storage (billing profile, subscription record, invoice record, tax evidence) and webhook idempotency fields.
- Implemented VAT/tax resolver (GR domestic, EU B2B reverse charge, EU B2C VAT, non-EU), with Stripe Tax support and tax evidence capture.
- Added billing profile + invoice endpoints and UI, and synced Stripe customer data to local billing profile.
- Hardened Stripe checkout for subscriptions/topups with validated URLs, customer reuse, and automatic tax collection where enabled.

## Backend Changes (apps/shopify-api)
- Prisma: new models `ShopBillingProfile`, `Subscription`, `InvoiceRecord`, `TaxEvidence`; `WebhookEvent` fields `payloadHash`, `eventType`.
- Stripe integration:
  - `ensureStripeCustomer` + `syncStripeCustomerBillingProfile` ensure 1:1 customer mapping and VAT metadata.
  - Checkout sessions include `automatic_tax` and `tax_id_collection` when Stripe Tax is enabled.
  - Currency-aware plan + topup pricing (EUR/USD).
- Webhooks:
  - Idempotent event handling with payload hash + event type.
  - Persist Stripe invoices and tax evidence on invoice events.
  - Sync billing profile from Stripe customer/session/invoice data.
- Billing API:
  - `GET /billing/profile`, `PUT /billing/profile` for VAT/billing details.
  - `GET /billing/invoices` for stored Stripe invoices.
  - VAT-aware topup calculation.

## Frontend Changes (apps/astronote-web Shopify billing)
- Added billing profile + invoices API methods to `shopifyBillingApi`.
- Added hooks for billing profile + invoices.
- Updated Shopify billing page to show:
  - VAT/tax status and billing profile summary.
  - Invoice list with status/amounts and download links.
  - Updated topup breakdown with tax treatment + currency support.

## VAT / Tax Treatment Logic
- Greece (GR): domestic VAT default 24% (overridable via `VAT_RATE_GR`).
- EU B2B: reverse charge when VAT ID validated.
- EU B2C: VAT charged based on billing country.
- Non-EU: no EU VAT.
- Tax evidence stored per invoice with jurisdiction + treatment.

## Tests Added (shopify-api)
- `tests/unit/tax-resolver.test.js` (VAT treatment scenarios).
- `tests/unit/subscription-checkout.test.js` (checkout session contract).
- `tests/unit/webhook-replay-stripe.test.js` (idempotency replay guard).
- `tests/unit/url-helpers.test.js` (frontend URL normalization/validation).
- `tests/unit/stripe-subscription.test.js` (plan + currency price ID resolution).

## Tests Added (astronote-web)
- `apps/astronote-web/tests/shopify-billing-safety.test.mjs` (static safety checks for billing API parsing + UI fallbacks).

## Gate Commands + Results (Run Locally)
- Backend lint:
  - Command: `npm run lint` (in `apps/shopify-api`)
  - Result: PASS (2 existing warnings: console usage in config files).
- Backend tests:
  - Command: `npm test -- --runTestsByPath tests/unit/subscription-checkout.test.js tests/unit/webhook-replay-stripe.test.js tests/unit/tax-resolver.test.js tests/unit/url-helpers.test.js tests/unit/stripe-subscription.test.js`
  - Result: PASS 5 suites passed (Jest ESM experimental VM modules warning; logger output during webhook replay tests).
- Backend build:
  - Command: `npm run build` (in `apps/shopify-api`)
  - Result: PASS prisma generate succeeded.
- Frontend lint:
  - Command: `npm run lint` (in `apps/astronote-web`)
  - Result: PASS (existing warnings: unrelated <img> usage + console in retail pages).
- Frontend build:
  - Command: `npm run build` (in `apps/astronote-web`)
  - Result: PASS next build succeeded.
- Frontend tests:
  - Command: `node --test apps/astronote-web/tests/shopify-billing-safety.test.mjs`
  - Result: PASS 2 checks passed.
- Typecheck:
  - `apps/astronote-web` has no `typecheck` script; not run.

## Optional Follow-ups (Non-blocking)
- Add a lightweight frontend test runner (Node test or Vitest) if you want automated UI contract checks.
- Add Stripe Tax enablement checks to runtime config validation (optional).
