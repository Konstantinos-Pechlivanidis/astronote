# Retail Backend Fix Pack

## Issues Addressed
- Prisma schema drift: `BillingProfile.isBusiness` missing in DB caused 500s on subscribe/topup.
- Stripe success_url placeholder encoded → success page saw `{CHECKOUT_SESSION_ID}` and failed verification.
- Campaign enqueue returned generic ENQUEUE_FAILED with no specific reason mapping.
- Added diagnostic script for Prisma columns.

## Changes (key files)
- Migration: `apps/retail-api/prisma/migrations/20250117120000_add_billingprofile_isbusiness/migration.sql` (adds `BillingProfile.isBusiness`).
- URL helpers: `apps/retail-api/apps/api/src/lib/frontendUrl.js` exposes explicit success/cancel builders and dev warning on encoded braces.
- Billing routes: success_url now uses literal placeholder builders; verify-payment/finalize guard rejects placeholder session_ids with `INVALID_SUCCESS_URL_PLACEHOLDER`.
- Campaign enqueue: `services/campaignEnqueue.service.js` returns `prisma_schema_drift` on column errors; route maps it to 500/PRISMA_SCHEMA_DRIFT (and keeps detailed reason codes).
- Diagnostic: `apps/retail-api/apps/api/scripts/verify-prisma-columns.js` to check BillingProfile fields.

## Verification Steps
1) Prisma generate & deploy migrations (Node current environment):
   - `npm -w @astronote/retail-api run prisma:generate`
   - `npx prisma migrate deploy` (with correct DATABASE_URL/DIRECT_DATABASE_URL)
2) Lint/build/tests:
   - `npm -w @astronote/retail-api run lint`
   - `npm -w @astronote/retail-api run build`
   - `npm -w @astronote/retail-api run test`
3) Diagnostics:
   - `node apps/retail-api/apps/api/scripts/verify-prisma-columns.js`
4) Manual smoke:
   - POST `/api/subscriptions/subscribe` returns checkoutUrl with real `{CHECKOUT_SESSION_ID}` placeholder (not encoded).
   - GET `/api/billing/topup/calculate` returns 200 quote (or clear config error, not 500).
   - POST `/api/campaigns/:id/enqueue` returns specific code (e.g., INVALID_STATUS / INSUFFICIENT_CREDITS / QUEUE_UNAVAILABLE / PRISMA_SCHEMA_DRIFT) instead of generic 500; enqueues once when valid.
   - Success page flow: if session_id placeholder is returned, API responds `INVALID_SUCCESS_URL_PLACEHOLDER`; real Stripe session_id verifies normally.

## Notes
- Node version left unchanged as requested.
- Global/system data untouched.
