# Billing Implementation Final Report (Retail)

Date: 2025-01-08

## What Was Implemented / Fixed
- Fixed `Purchase` schema mismatch: uses `priceCents` + `units`, aligns webhook expected amount, and adds idempotency enforcement.
- Added Stripe customer repair flow to eliminate `dev_customer_*` placeholders and ensure valid customer IDs before portal use.
- Implemented `/api/billing/wallet` alias for legacy frontend calls.
- Corrected top-up flow in the retail UI to use `{ credits }` and pricing from `/api/billing/topup/calculate`.
- Added ETag handling for packages with correct 304 behavior only when data is non-empty and matches `If-None-Match`.
- Added DB migration to align billing tables with Prisma schema and seed default packages.
- Added billing audit script + docs.

## Endpoint Inventory (Retail API)

**GET /api/billing/balance**
- Response: `{ balance: number, subscription: { active, planType, status, stripeCustomerId, stripeSubscriptionId, lastFreeCreditsAllocatedAt } }`

**GET /api/billing/wallet**
- Alias for `/api/billing/balance`

**GET /api/billing/transactions**
- Response: `{ page, pageSize, total, items: CreditTransaction[] }`

**GET /api/billing/packages?currency=EUR**
- Response: `Package[]` (includes `priceCents`, `price`, `units`, `stripePriceId`, `available`, `currency`, `type`)
- Note: returns empty if subscription inactive

**POST /api/billing/purchase**
- Request: `{ packageId, currency? }` + `Idempotency-Key` header
- Response: `{ ok, checkoutUrl, sessionId, purchaseId, status?, idempotent? }`

**POST /api/billing/topup**
- Request: `{ credits }`
- Response: `{ ok, checkoutUrl, sessionId, credits, priceEur, priceBreakdown }`

**GET /api/billing/topup/calculate**
- Response: `{ credits, priceEur, vatAmount, priceEurWithVat }`

**GET /api/subscriptions/portal**
- Response: `{ ok, portalUrl }`
- Ensures valid Stripe customer mapping, creates customer if missing

**POST /api/subscriptions/subscribe | update | cancel**
- Stripe-backed subscription lifecycle

**POST /webhooks/stripe**
- Signature-verified webhook handling (subscriptions, purchases, topups, refunds)

## Prisma Migrations Added
- `apps/retail-api/prisma/migrations/20250108153000_billing_schema_alignment/migration.sql`
  - Adds missing Stripe fields and indexes for `Purchase`
  - Adds Stripe price fields + unique name to `Package`
  - Adds `idempotencyKey` unique constraint
  - Adds missing indexes for `CreditTransaction`
  - Seeds default packages

## Frontend Billing Surfaces Updated (Retail)
- `app/app/retail/billing/page.tsx`: top-up flow now uses credits + price calculation; purchase uses idempotency key.
- `src/lib/retail/api/billing.ts`: added `calculateTopup`, fixed `topup` payload, added purchase idempotency header.
- `src/lib/retail/api/endpoints.ts`: added `/api/billing/topup/calculate`.

## Audit Script
- `scripts/audit-billing.mjs`
- `npm run audit:billing` outputs `reports/billing-e2e-verification.md`

## Deployment Requirements (Non-Optional)
- Run Prisma migrations for retail-api.
- Set Stripe environment variables:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_ID_SUB_STARTER_EUR`
  - `STRIPE_PRICE_ID_SUB_PRO_EUR`
  - Optional package price IDs or DB fields (`stripePriceIdEur`).
- Configure `FRONTEND_URL` or `APP_URL` (must resolve to `/retail`).

