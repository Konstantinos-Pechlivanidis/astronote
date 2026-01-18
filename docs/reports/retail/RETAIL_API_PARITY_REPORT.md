# Retail API Parity Report (FE ↔ BE)

## Mount prefix
- Retail backend routes are mounted under `/api` (`src/server.js`: `app.use('/api', require('./routes/billing'))`, etc.). Any call without `/api` returns 404.

## FE call map (Retail)
- Billing page (`app/app/retail/billing/page.tsx`):
  - GET `/api/billing/summary` (credits + subscription + allowance)
  - GET `/api/subscriptions/current`
  - GET `/api/billing/packages?currency=...`
  - GET `/api/billing/transactions?page&pageSize`
  - GET `/api/billing/invoices?page&pageSize`
  - GET `/api/billing/billing-history?page&pageSize`
  - POST `/api/subscriptions/reconcile` (manual refresh)
- Success page (`app/app/retail/billing/success/page.tsx`):
  - POST `/api/billing/verify-payment` (always)
  - POST `/api/subscriptions/finalize` (subscriptions only)
  - POST `/api/subscriptions/reconcile` (subscriptions only)
- Billing APIs (`src/lib/retail/api/billing.ts`, `subscriptions.ts`, `endpoints.ts`):
  - Balance/wallet: GET `/api/billing/balance` and `/api/billing/summary`
  - Packages: GET `/api/billing/packages`
  - Topup purchase: POST `/api/billing/topup`, purchase: POST `/api/billing/purchase`
  - Subscriptions: POST `/api/subscriptions/subscribe` / `update` / `switch` / `cancel` / `portal` / `reconcile` / `finalize`

## Backend coverage
- Routes exist in `apps/retail-api/apps/api/src/routes/billing.js` for all above paths, with pagination on invoices and billing-history.
- Prefix alignment: FE uses `/api/...` consistently; no remaining `/billing/...` (without prefix) usages in retail FE.

## Gaps/Mismatches
- None found for retail billing/subscription endpoints. The known 404s occur only if `/api` prefix is omitted (documented in reports).
