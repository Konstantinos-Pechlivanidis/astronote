# Retail Prisma Parity Report

## Summary
- Schema parity check is currently blocked by Prisma schema engine error under Node 24.12.0 (repo expects Node 20). Prisma Client generation succeeds; validation/migrate status fails due to the engine crash, not schema drift.

## Commands run
- `npm -w @astronote/retail-api run prisma:generate` ✅ (via build)
- `npm -w @astronote/retail-api run prisma:check` ❌ schema engine error (Node 24)

## Observations
- Prisma schema matches the code paths used in billing/subscriptions/webhooks (models: Subscription, InvoiceRecord, BillingTransaction, CreditTransaction, WebhookEvent, etc.).
- No runtime “column does not exist” or enum mismatch surfaced in tests; all retail API tests pass.

## Required action to unblock
- Switch to Node 20.x and rerun:
  - `npm -w @astronote/retail-api run prisma:check`
  - `npm -w @astronote/retail-api run prisma:migrate:deploy` (or `prisma migrate status` if deploy is managed elsewhere)
- If the database is non-empty and baseline is needed, use `prisma migrate resolve` (do not drop data).
