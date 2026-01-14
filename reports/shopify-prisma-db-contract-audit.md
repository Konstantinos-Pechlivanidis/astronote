# Shopify Prisma/DB Contract Audit (Report-only)

Repo: `astronote-shopify-backend`  
Workspace: `apps/shopify-api` (+ FE scan in `apps/astronote-web`)  
Mode: **NO COMMIT, REPORT-ONLY** (no migrations applied in this audit phase)

## Executive summary

- **Runtime offender confirmed**: the production DB schema (as introspected) is **missing `Contact.birthDate`**, while the Shopify backend + Shopify frontend both **read/write `birthDate`**. This can cause runtime errors on contact reads/writes and contact screens.
- `Shop.shopName` is present in current Prisma schema and is referenced in multiple sign-in/store-resolution code paths. (It was a historical runtime offender; see fix plan below.)
- `prisma migrate status` reports “up to date”, but `prisma migrate diff` reports **non-empty drift**. That combination typically indicates the DB is **not strictly aligned** with the current Prisma datamodel (often due to “baseline/resolve” history vs actual physical schema).

## Phase A — Baseline checks

### Environment / target DB (masked)

From `npx prisma migrate status --schema prisma/schema.prisma`:

- **DB**: `neondb`
- **Schema**: `public`
- **Host**: `ep-young-frog-a4prfxf0.us-east-1.aws.neon.tech`

Note: running `node -e new URL(process.env.DATABASE_URL)` in this shell shows `DATABASE_URL` is **not present** in the Node process environment; Prisma CLI still loads env from `.env` internally (so this is an env-loading difference between Prisma CLI and Node shell, not necessarily a deployment problem).

### Prisma versions

From `npx prisma -v`:
- `prisma`: 6.17.1
- `@prisma/client`: 6.17.1

### Migration status / migration table

From `npx prisma migrate status --schema prisma/schema.prisma`:
- **28 migrations found**
- **Database schema is up to date**

This implies `_prisma_migrations` exists and Prisma believes the migration history is reconciled.

### Introspected DB schema snapshot

We captured a DB introspection snapshot to:
- `/tmp/shopify-db-pull.prisma.txt` (873 lines)

## Phase B — DB vs Prisma schema (key models)

### DB-pulled `Shop` vs Prisma `Shop`

DB-pulled `Shop` snippet (from `/tmp/shopify-db-pull.prisma.txt`):

```text
model Shop {
  id                         String                @id @default(cuid())
  shopDomain                 String                @unique
  createdAt                  DateTime              @default(now())
  updatedAt                  DateTime              @updatedAt
  ...
  shopName                   String?
  accessToken                String?
  status                     String                @default("active")
  country                    String?
  currency                   String                @default("EUR")
  credits                    Int                   @default(0)
  ...
  @@index([currentPeriodEnd])
  @@index([currentPeriodStart])
  @@index([subscriptionInterval])
}
```

Prisma `schema.prisma` `Shop` snippet (current datamodel):

```text
model Shop {
  id                    String   @id @default(cuid())
  shopDomain            String   @unique
  shopName              String?
  accessToken           String?
  status                String   @default("active")
  country               String?
  currency              String   @default("EUR")
  credits               Int      @default(0)
  ...
  // Subscription fields
  stripeCustomerId      String?  @unique @db.VarChar(255)
  stripeSubscriptionId  String?  @unique @db.VarChar(255)
  ...
}
```

**Observation**
- `Shop.shopName` exists in both DB-pulled schema and Prisma schema.
- DB has a few extra indexes (`currentPeriodEnd/currentPeriodStart/subscriptionInterval`) that Prisma schema doesn’t currently declare. This is typically **non-breaking**.

### DB-pulled `Contact` vs Prisma `Contact` (runtime offender)

DB-pulled `Contact` snippet (from `/tmp/shopify-db-pull.prisma.txt`):

```text
model Contact {
  id                   String   @id @default(cuid())
  shopId               String
  firstName            String?
  lastName             String?
  phoneE164            String
  email                String?
  gender               String?
  smsConsent           SmsConsent @default(unknown)
  ...
}
```

Prisma `schema.prisma` `Contact` snippet (current datamodel):

```text
model Contact {
  ...
  gender             String?
  birthDate          DateTime?
  ...
}
```

**Mismatch (high risk)**
- Prisma schema expects `Contact.birthDate`, but DB-pulled schema **does not include** it.

## Phase B — DB vs Prisma schema (global drift signal)

From:
- `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code`

Exit code was **2** (non-empty diff). Drift highlights include:
- **`Contact`**: “Added column `birthDate` …” (missing in DB)
- **`Shop`**: DB missing some indexes Prisma expects / or Prisma would remove some (usually non-breaking)
- **Added tables**: `AutomationLog` (DB missing)
- Many other changes that are **not safe to auto-apply** in production (drops/recreates/type changes)

## Phase C — Code contract audit (Backend)

### `shopName` usage (sign-in/store resolution + billing)

Backend references (examples):
- `apps/shopify-api/middlewares/store-resolution.js`: sets `shopName` on auto-created store
- `apps/shopify-api/routes/auth.js`: sets `shopName` on OAuth-created store
- `apps/shopify-api/services/billing.js`: selects `{ shopName: true }` and passes `shopName` to Stripe customer creation
- `apps/shopify-api/controllers/subscriptions.js`: selects `{ shopName: true }` for Stripe customer name fallback

### `birthDate` usage (contacts)

Backend references include:
- `apps/shopify-api/utils/dto-mappers.js`: formats `contact.birthDate` → DTO fields `birthday`/`birthDate`
- `apps/shopify-api/services/contacts.js`: filters/selects `birthDate` and writes `birthDate` during create/update
- `apps/shopify-api/controllers/contacts-enhanced.js`: maps `contact.birthDate` to DTO

**Risk**: if DB lacks the column, Prisma reads/writes can throw at runtime.

## Phase C — Frontend contract audit (apps/astronote-web)

Shopify contacts UI uses `birthDate`:
- `apps/astronote-web/app/app/shopify/contacts/new/page.tsx` (form field + validation + submit payload)
- `apps/astronote-web/app/app/shopify/contacts/[id]/page.tsx` (display/edit birthDate)
- `apps/astronote-web/app/app/shopify/contacts/import/page.tsx` (CSV header includes `birthDate`)

So FE **expects** BE to support `birthDate`.

## Phase D — Migrations folder mapping (which migration “should” add offenders)

- `Shop.shopName`: present in a new additive migration:
  - `prisma/migrations/20260114001000_add_shop_shopName/migration.sql`
- `Contact.birthDate`: **no migration contains `birthDate`** in the current migrations folder scan (high confidence from grep).

This strongly suggests the DB was created/modified outside the migrations history (or migrations were not deployed in order), leaving the schema inconsistent.

## Root-cause classification

The observed state is consistent with:
- **(c) Partially migrated / baselined DB**: `_prisma_migrations` exists and Prisma says “up to date”, but physical schema still differs from current datamodel.

## Recommended fix strategy (no drops, production-safe)

### Must-fix (restore runtime safety)
- Create a new **additive migration** to add missing columns required by runtime code:
  - `Contact.birthDate` (+ any other Contact columns used in code if missing)
  - indexes as needed (optional, but safe)

### Should-fix (reduce future drift)
- Create additive migrations for “missing tables” that are safe to create (e.g. `AutomationLog`) **only if the app expects them at runtime**.

### Avoid (unsafe in prod without downtime/data migration plan)
Do **not** attempt to apply drift items that require:
- dropping/recreating columns or changing enum types
- removing columns/tables
- major relational rewrites

## Actionable checklist

1) Implement additive migration for `Contact.birthDate` (and validate on staging DB first).
2) Deploy with `prisma migrate deploy`.
3) Re-run:
   - `npx prisma migrate status`
   - `npx prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --exit-code`
4) Retest: Shopify Contacts create/edit/import screens.


