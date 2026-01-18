# Production Readiness Report
- Date/time: Sat Jan 17 12:23:22 EET 2026
- Branch: main @ 0bddff7 (local changes present; no commit performed)

## Pre-flight
- Node 24.12.0, npm 11.6.2 (npm install completed with EBADENGINE warning; repo expects Node 20).
- Env files present: apps/shopify-api/.env, apps/retail-api/.env.
- FRONTEND_URL/FRONTEND_BASE_URL missing in both shopify & retail (`require(.../loadEnv)` checks fail).
- Prisma migrate deploy blocked in both workspaces: schema engine error under Node 24 (prisma generate succeeds). Requires rerun on supported Node (20.x) before deploy.

## Prisma status
- Shopify API: `prisma generate` PASS (`npm -w @astronote/shopify-api run build`); `prisma migrate deploy` FAIL (schema engine error on Node 24).
- Retail API: `prisma generate` PASS (`npm -w @astronote/retail-api run build`); `prisma migrate deploy` FAIL (schema engine error on Node 24).
- Retail gate `prisma:check` fails for same reason. No migrations applied; DB alignment not verified.

## Gates & tests
- Shopify API: lint PASS (2 console warnings), test PASS (36 suites/171 tests), build PASS.
- Retail API: lint PASS, test PASS (14 tests), build PASS.
- Web-next: lint PASS (pre-existing `<img>` + console warnings), build PASS.
- Meta: `npm run release:gate` PASS (all audits/builds; stamp files in reports/). `npm run shopify:gate` PASS (frontend typecheck script missing/skipped). `npm run retail:gate` FAIL due to prisma engine error; other steps PASS.

## Outstanding blockers
- Set FRONTEND_URL (or FRONTEND_BASE_URL) in both shopify/retail env files.
- Re-run prisma migrate deploy/status on Node 20.x to validate schema alignment for both workspaces.
- Retail gate remains red until Prisma check passes on supported Node.

## Stripe env checklist (names only)
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_TAX_ENABLED
- Plan price IDs (subscription + packages) per catalog mode
- FRONTEND_URL / FRONTEND_BASE_URL (missing)

## Manual live checklist
- Subscribe flow: checkout succeeds → DB subscription updated, invoice recorded.
- Plan switch: month→year triggers checkout; year→month schedules at period end.
- Invoices list visible in UI; billing history returns 200 at `/billing/invoices` and `/billing/billing-history`.
- Wallet/credits update after purchase/send; ledger idempotent.
- Campaign send enqueues and updates statuses/metrics; scheduled sends remain scheduled (not draft).
