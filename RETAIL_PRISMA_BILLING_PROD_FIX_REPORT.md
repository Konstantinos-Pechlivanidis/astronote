# Retail Prisma Billing Prod Fix Report

## Root Cause
- Production 500s on `/api/subscriptions/subscribe` and `/api/billing/topup/calculate` traced to Prisma error P2022: column `BillingProfile.isBusiness` missing in the Neon database.
- Prisma schema already includes `isBusiness` (nullable), but DB lacked the column.

## Fix
- Added forward-only migration to align DB with schema:
  - `apps/retail-api/prisma/migrations/20250117120000_add_billingprofile_isbusiness/migration.sql`
  - SQL: `ALTER TABLE "BillingProfile" ADD COLUMN IF NOT EXISTS "isBusiness" BOOLEAN;`

## Commands to Run (with Node 20 + direct DB URL)
From repo root or `apps/retail-api`:
```bash
# Ensure Node 20.x
export DATABASE_URL="postgresql://neondb_owner:…@ep-young-dream-ag5u1znm-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
export DIRECT_DATABASE_URL="postgresql://neondb_owner:…@ep-young-dream-ag5u1znm.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

npx prisma migrate deploy
npx prisma migrate status
```

## Verification Checklist (after deploy)
- POST `/api/subscriptions/subscribe` with `{ planType:"starter", currency:"EUR" }` returns a Stripe checkout URL (or a clear Stripe config error), not a Prisma column error.
- GET `/api/billing/topup/calculate?credits=500&currency=EUR` returns a calculation response (or Stripe config error), not P2022.
- No additional missing-column errors in logs.

## Notes
- Prisma migrate status/DB access previously failed on this host due to Node 24 + Neon connectivity; rerun with Node 20.x.
- Use DIRECT_DATABASE_URL for migrations (non-pooler).
