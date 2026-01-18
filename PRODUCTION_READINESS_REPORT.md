# Production Readiness Report (Monorepo)

## Environment & Versions
- Node: v24.12.0 (repo engines expect >=20 <21; prisma migrate status fails under Node 24).  
- npm: 11.6.2  
- Install: `npm install` (engine warning only).

## Commands Executed
- Web (`@astronote/web-next`):  
  - `npm -w @astronote/web-next run lint` (warnings only on `<img>` and one `console`).  
  - `npm -w @astronote/web-next run build`.  
  - `npm -w @astronote/web-next run gate` (lint + build).
- Shopify API (`@astronote/shopify-api`):  
  - `npm -w @astronote/shopify-api run lint` (warnings: console in loadEnv.js, worker-lock.js).  
  - `npm -w @astronote/shopify-api run test` (all suites pass; logs from logger expected).  
  - `npm -w @astronote/shopify-api run prisma:validate` (pass).  
  - `npm -w @astronote/shopify-api run build` (prisma generate).  
  - `npm -w @astronote/shopify-api run db:status` → **fail** (Prisma schema engine error against `ep-young-frog-a4prfxf0.us-east-1.aws.neon.tech`, likely Node 24 / remote DB).  
  - `npm -w @astronote/shopify-api run gate` (lint+test+prisma:validate+build) pass.
- Retail API (`@astronote/retail-api`):  
  - `npm -w @astronote/retail-api run lint` pass.  
  - `npm -w @astronote/retail-api run test` pass (Stripe key missing logged).  
  - `npm -w @astronote/retail-api run build` (prisma generate).  
  - `npm -w @astronote/retail-api run prisma:check` → **fail** at `prisma migrate status` (schema engine error against `ep-young-dream-ag5u1znm.c-2.eu-central-1.aws.neon.tech`, likely Node 24 / remote DB).  
  - `npm -w @astronote/retail-api run gate` (prisma validate + lint + test + build) pass.
- Root: `npm run gate` (runs workspace gates) pass.

## Prisma Status
- Schema validation: **pass** for both Shopify and Retail (`prisma validate`).  
- Prisma Client generation: **pass** both.  
- Migration status: **failed** for both APIs due to Prisma schema engine error when hitting Neon DB (on Node 24). Recommendation: rerun `prisma migrate status` with Node 20.x and valid DATABASE_URL/DIRECT_DATABASE_URL; do **not** reset DB.

## Scripts Audit (stale vs canonical)
- Added canonical gates:
  - Root `gate`: runs web, shopify-api, retail-api gates.  
  - Web: `gate` (lint + build).  
  - Shopify API: `gate` (lint + test + prisma:validate + build).  
  - Retail API: `gate` (prisma:validate + lint + test + build).
- Observed legacy/stale scripts (not run): many `audit:*` entries in root `package.json` (e.g., `audit:shopify:*`, `audit:retail:*`, duplicated `audit:shopify:billing`, `shopify:gate`, `retail:gate`, `release:gate`). Status: **Stale/duplicated**—superseded by new `gate` scripts; review/remove as follow-up to avoid confusion.

## Remaining Risks / Follow-ups
- Node version mismatch with engines; use Node 20.x for Prisma migrate status and production parity.  
- Prisma migrate status unresolved (schema engine error) due to environment/Node; rerun with Node 20 and ensure DB access.  
- ESLint warnings remain (legacy `<img>` usage, one `console` in retail campaign detail); non-blocking but can be cleaned.  
- Shopify API lint warnings for console statements (loadEnv.js, worker-lock.js) are existing behavior.

## Deploy-ready Checklist
- Use Node 20.x runtime for Prisma operations/deploys.  
- Ensure DATABASE_URL (and DIRECT_DATABASE_URL if needed) valid for Shopify/Retail.  
- Ensure Stripe envs present: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, plan price IDs, FRONTEND_URL.  
- Run gates prior to deploy:  
  - `npm -w @astronote/web-next run gate`  
  - `npm -w @astronote/shopify-api run gate`  
  - `npm -w @astronote/retail-api run gate`  
  - Optionally `npm run gate` (root aggregator).
