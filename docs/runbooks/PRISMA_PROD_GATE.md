## Prisma Production Readiness Gate (Shopify + Retail)

**Scope**: `apps/shopify-api` and `apps/retail-api` (Postgres on Neon/Render).

**Goals**
- Eliminate runtime errors like **“column does not exist”** by ensuring migrations are applied before app starts.
- Provide a safe, repeatable path to fix **P3005** (“database schema is not empty”) for existing DBs.
- Ensure Prisma client generation + builds/lints succeed.

---

## Quick start (recommended)

From repo root:

```bash
npm run prisma:gate
```

This runs:
- `apps/shopify-api/scripts/gate-prisma.sh`
- `apps/retail-api/apps/api/scripts/gate-prisma.sh`

Each gate does:
- prints Node + Prisma versions
- `prisma generate`
- `prisma migrate status`
- `prisma migrate deploy`
- sanity query (`SELECT 1` + check key tables)

---

## Fixing “column does not exist” (production-safe)

### Root cause
This happens when **Prisma Client expects schema fields** that are not present in the DB because:
- migrations were never deployed (common when deploy blocked by P3005), or
- deploy runs did not include `prisma migrate deploy`, or
- app was started against the wrong `DATABASE_URL`.

### Shopify drift-fix migrations already present
Shopify includes **non-destructive, additive** migrations that directly address the known missing columns/types:
- `apps/shopify-api/prisma/migrations/20260114001000_add_shop_shopName/` (adds `Shop.shopName`)
- `apps/shopify-api/prisma/migrations/20260114003000_add_contact_birthdate_and_customer_fields/` (adds `Contact.birthDate` + indexes)
- `apps/shopify-api/prisma/migrations/20260115020000_add_campaignmetrics_totalProcessed/` (adds `CampaignMetrics.totalProcessed`)
- `apps/shopify-api/prisma/migrations/20260115021000_add_campaignrecipient_bulkid/` (adds `CampaignRecipient.bulkId`)
- `apps/shopify-api/prisma/migrations/20260115000000_add_billingtransaction_packagetype/` (adds `BillingTransaction.packageType`)
- `apps/shopify-api/prisma/migrations/20260115001000_fix_messagelog_direction_enum/` (fixes TEXT vs enum `"MessageDirection"` mismatch)

If these migrations are deployed, the “missing column” runtime errors should stop.

### Commands to run on Render/Neon (Shopify)
In the Shopify service environment (with correct `DATABASE_URL`):

```bash
cd apps/shopify-api
npx prisma generate
npx prisma migrate deploy
```

### Commands to run on Render/Neon (Retail)

```bash
cd apps/retail-api
npx prisma generate
npx prisma migrate deploy
```

---

## Fixing P3005 (baseline existing DBs safely)

### What P3005 means
Prisma Migrate refuses to apply migrations to a database that:
- already has tables (non-empty schema), and
- **does not have** the `_prisma_migrations` table (meaning it was created outside Prisma Migrate).

### Two safe strategies

#### Strategy A — **Dev/Staging reset** (DB can be dropped)
Use when you can wipe the DB:

```bash
cd apps/shopify-api
npx prisma migrate reset --force
```

#### Strategy B — **Production baseline** (DB must be preserved)
Use when you must keep data.

**Step 1 — Verify drift**
Generate the SQL needed to make the live DB match the migration history:

```bash
cd apps/shopify-api
npx prisma migrate diff --from-url "$DATABASE_URL" --to-migrations prisma/migrations --script > prisma_drift.sql
```

- If `prisma_drift.sql` is **empty / no statements**, the DB is consistent with migrations and you can safely baseline.
- If it contains changes, STOP and reconcile drift first (apply missing migrations / correct schema mismatch).

**Step 2 — Mark migrations as applied**
This creates `_prisma_migrations` and records history **without executing SQL**:

```bash
cd apps/shopify-api
for d in prisma/migrations/*; do
  npx prisma migrate resolve --applied "$(basename "$d")"
done
```

**Step 3 — Deploy**

```bash
cd apps/shopify-api
npx prisma migrate deploy
```

Repeat the same process for Retail under `apps/retail-api`.

---

## Enum/operator mismatch: `text = "MessageDirection"`

### Symptom
Postgres errors like:
- `operator does not exist: text = "MessageDirection"`

### Root cause
The DB column is `TEXT`, but Prisma (and queries) treat it as a Postgres enum type.

### Fix
Deploy Shopify migration:
- `20260115001000_fix_messagelog_direction_enum`

It:
- creates enum type `"MessageDirection"` if missing
- validates existing column values
- alters `"MessageLog"."direction"` to enum using a safe cast

---

## Operational checklist (Neon / Render)

- **Confirm DATABASE_URL points at the intended DB** (Shopify vs Retail).
- Run **`prisma migrate deploy`** as part of deploy/release.
- Ensure Prisma Client is generated:
  - Shopify: `npm -w @astronote/shopify-api run prisma:generate`
  - Retail: `npm -w @astronote/retail-api run prisma:generate`
- Run the repo gate: `npm run prisma:gate`

---

## Files added/changed (by this gate work)

- Added: `apps/shopify-api/scripts/gate-prisma.sh`
- Added: `apps/retail-api/apps/api/scripts/gate-prisma.sh`
- Updated: `package.json` (added `prisma:gate`)

