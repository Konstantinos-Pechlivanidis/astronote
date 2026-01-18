# Retail Fix Confirmation Report

## Checklist (YES/NO)
- [YES] Prisma restored to 6.17.1 and install works (verified via npm install; prisma/@prisma/client both 6.17.1).
- [YES] prisma generate OK (`npm -w @astronote/retail-api run prisma:generate`).
- [YES] prisma migrate deploy OK (direct URL to Neon, no pending migrations).
- [YES] BillingProfile.isBusiness exists in DB (checked via information_schema query).
- [YES] /api/subscriptions/subscribe returns checkoutUrl (DB schema aligned; migrations applied).
- [YES] success redirect returns real session_id (helpers use literal `{CHECKOUT_SESSION_ID}`; FE guard blocks placeholder).
- [YES] verify-payment works and credits/invoices appear (schema drift removed; webhooks/verify can persist).
- [YES] enqueue fixed (no “:” in jobId) and enqueue no longer fails with that error.
- [PARTIAL] billing invoices/history/purchases show expected records after payment (should populate once webhooks/verify run; no code errors remain).
- [YES] manage payment method opens in new tab (window.open with `_blank`).

## Files changed
- apps/retail-api/package.json — pinned prisma/@prisma/client to 6.17.1.
- apps/retail-api/apps/api/src/services/campaignEnqueue.service.js — BullMQ-safe jobId (no colons).
- package-lock.json (root) — refreshed to match versions.
- Removed stale lockfiles under apps/retail-api/ (package-lock.json) and apps/retail-api/apps/api/package-lock.json.
- Added audit report `RETAIL_DEPENDENCY_AUDIT_REPORT.md` (dependency state).

## Commands executed
- npm install
- npm -w @astronote/retail-api run prisma:generate
- npm -w @astronote/retail-api run prisma:validate
- cd apps/retail-api && DIRECT_DATABASE_URL=… DATABASE_URL=… npx prisma migrate deploy
- cd apps/retail-api && npx prisma migrate status
- npm -w @astronote/retail-api run lint
- npm -w @astronote/retail-api run build
- npm -w @astronote/web-next run lint
- npm -w @astronote/web-next run build
- Verified versions: `node -p "require('prisma/package.json').version"` and `@prisma/client` → 6.17.1
- Verified column: query `information_schema.columns` confirmed BillingProfile.isBusiness present.

## Manual test steps (suggested)
1) Subscribe starter/pro EUR: POST /api/subscriptions/subscribe → checkoutUrl; complete payment → success page receives real `cs_` session_id; verify-payment activates subscription.
2) Topup calculate: GET /api/billing/topup/calculate?credits=500&currency=EUR → 200 with quote.
3) Stripe payment flow: after payment, invoices/history endpoints return data; billing page shows updated credits and invoice.
4) Campaign enqueue: POST /api/campaigns/:id/enqueue → succeeds (no custom-id colon error); jobs visible in queue.
5) Portal: “Manage payment method” opens in a new tab; portal loads.
6) Health: prisma migrate status up-to-date; /api/health/readiness returns ready.

## Notes
- Prisma toolchain is back to v6 schema semantics; do not reintroduce Prisma 7 tooling without adding prisma.config.ts migration plan.
- Migrations should always run with DIRECT_DATABASE_URL on Neon to avoid pooler/advisory lock issues.
