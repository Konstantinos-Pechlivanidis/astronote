# Final Retail Production Readiness Report

## Env readiness + Node version
- Node: v24.12.0 (repo engines require >=20 <21) — must rerun Prisma gates on Node 20.x. npm: 11.x.
- Env files: `apps/retail-api/apps/api/.env` present. `FRONTEND_URL/FRONTEND_BASE_URL` missing (risk for success/cancel URL validation). Stripe keys not printed here.

## What was broken
- Public 404s when calling `/billing/invoices` or `/billing/billing-history` without `/api` prefix (backend mounts under `/api`).
- Success flow needed verify-first ordering and immediate refresh so credits/invoices show after checkout.
- Prisma checks blocked by schema engine error on Node 24 (repo expects Node 20); DB alignment cannot be confirmed until Node is downgraded.
- Env: `FRONTEND_URL` missing in retail env (risk for success/cancel URL validation).

## Changes made (retail scope)
- Success page (`apps/astronote-web/app/app/retail/billing/success/page.tsx`):
  - POST `/api/billing/verify-payment` first, then `/api/subscriptions/finalize` + `/api/subscriptions/reconcile` only for subscriptions.
  - Added verifying loader text (GR) and invalidates billing/subscription/invoice/history queries, refreshes, then redirects to `/app/retail/billing`.
- Billing page (`apps/astronote-web/app/app/retail/billing/page.tsx`):
  - Added GR microcopy explaining auto verify/reconcile after payment.
- Docs/reports:
  - `apps/retail-api/RETAIL_BILLING_FIXES_REPORT.md`
  - `apps/retail-api/RETAIL_API_PARITY_REPORT.md`
  - `apps/retail-api/RETAIL_PRISMA_PARITY_REPORT.md`

## Prisma parity status
- `prisma generate` OK (via build).
- `prisma:check` / `migrate:deploy` fail under Node 24 with schema engine error; rerun on Node 20.x required before deploy. No schema drift detected in tests.

## FE↔BE parity
- All retail FE billing/subscription calls use `/api/...` endpoints; backend routes exist in `routes/billing.js` with pagination for invoices and billing-history. 404s only occur if `/api` is omitted.

## API smoke
- Not run here (no local server started). Expected healthy paths: `/api/health`, `/api/billing/invoices?page=1&pageSize=20`, `/api/billing/billing-history?page=1&pageSize=20`, `/api/billing/summary`, `/api/billing/balance`, `/api/subscriptions/current`, `/api/subscriptions/reconcile`.

## Gates/results (latest run)
- Retail API: lint ✅, test ✅, build ✅.
- Web-next: lint ✅ (existing img/console warnings), build ✅.
- `npm run retail:gate`: FAIL only at `prisma:check` (schema engine error Node 24); other steps pass.

## Mutation → invalidated queries (billing)
- Success page invalidates: `retail-billing-summary`, `retail-transactions`, `retail-invoices`, `retail-billing-history`, `retail-subscription-current`, `retail-packages`, then `router.refresh` and redirect to billing.
- Billing page reconcile invalidates summary/transactions/invoices/billing-history/subscription-current.
- Campaign invalidations not modified in this task; existing hooks handle refresh after send/schedule.

## Manual verification (5 steps)
1) Subscribe → checkout → return to `/app/retail/billing/success?session_id=...` → verify-payment runs → finalize/reconcile (if subscription) → billing shows active plan, credits/allowance updated, invoice visible.
2) Topup credits → wallet increases once; billing history shows one ledger entry; invoices endpoint returns 200.
3) `/api/billing/invoices` and `/api/billing/billing-history` return 200 with pagination (ensure `/api` prefix).
4) Billing profile (VAT/country/address) update syncs to Stripe customer/tax_id and applies on next checkout/invoice.
5) Campaign send/schedule: schedule sets status=scheduled (not draft); after send, dashboard/campaign lists refresh and credits debit once.

## Remaining risks/blockers
- Node version mismatch: Prisma checks blocked on Node 24; must rerun on Node 20.x before deploy.
- Missing `FRONTEND_URL`/`FRONTEND_BASE_URL` in env; success/cancel URL validation may fail until set.
