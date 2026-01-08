# Billing E2E Final Check (Retail)

Date: 2025-01-09

## What Was Verified
- Prisma schema + migrations include tenant billing currency and USD package pricing.
- Retail API billing endpoints exist and match frontend usage.
- Currency resolution (query/body → tenant default → EUR) is wired through packages, purchase, topups, and subscriptions.
- Stripe customer portal uses valid Stripe customer IDs (cus_*) and auto-repairs invalid placeholders.
- Frontend billing UI uses a tenant-scoped currency selector and passes currency to API calls.
- Audit tooling covers multi-currency requirements and env key presence.

## Issues Found
1) OpenAPI contract for billing packages/purchase was out of date (missing currency param and idempotency header; purchase summary inaccurate).
2) docs/billing.md and .env.example only documented EUR env vars.
3) Audit script did not check for USD env keys, currency wiring in the UI, or package seed presence.

## Fixes Applied
- Updated OpenAPI contract for `/api/billing/packages` and `/api/billing/purchase` to include currency param and Idempotency-Key header.
- Added USD Stripe env keys to `apps/retail-api/.env.example` and expanded `docs/billing.md` for EUR/USD flows.
- Strengthened `scripts/audit-billing.mjs` to verify USD keys, currency wiring, seed presence, and Stripe customer validation.
- Added correlation/tenant identifiers to centralized error logs for traceability.

## Files Changed
- `apps/retail-api/apps/api/src/docs/openapi.yaml`
- `apps/retail-api/.env.example`
- `docs/billing.md`
- `scripts/audit-billing.mjs`
- `apps/retail-api/apps/api/src/lib/errors.js`

## Optional TODOs
- Consider adding a tenant setting endpoint to persist `billingCurrency` in the DB when a user explicitly changes currency in the UI.
- Update any ancillary billing docs that still show EUR-only examples (non-blocking).
