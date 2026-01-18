# UAT DB Purge (Retail + Shopify)

Use only with explicit env overrides to the correct Neon instances. Default is **dry-run**; destructive requires `--yes`.

## Safety rules
- Prefer Node 20.x for Prisma stability.
- Export the exact DB URLs first (pooler for runtime, direct for scripts):
  - Retail: `DATABASE_URL="postgresql://neondb_owner:…@ep-young-dream-ag5u1znm-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"`
  - Retail direct: `DIRECT_DATABASE_URL="postgresql://neondb_owner:…@ep-young-dream-ag5u1znm.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"`
  - Shopify: `DATABASE_URL="postgresql://neondb_owner:…@ep-young-frog-a4prfxf0-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"`
  - Shopify direct: `DIRECT_URL="postgresql://neondb_owner:…@ep-young-frog-a4prfxf0.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"`
- Dry-run prints per-table counts and exits.
- `--yes` required to delete. Global definitions (templates/automations) stay untouched; only tenant-scoped rows are removed.

## Commands
Retail (from `apps/retail-api/apps/api`):
```bash
export DATABASE_URL="..."          # pooler
export DIRECT_DATABASE_URL="..."   # direct (preferred for scripts)
npm run purge:uat:user -- --email kostas.pechlivanidis.dev@gmail.com --dry-run
npm run purge:uat:user -- --email kostas.pechlivanidis.dev@gmail.com --yes
```

Shopify (from `apps/shopify-api`):
```bash
export DATABASE_URL="..."
export DIRECT_URL="..."
npm run purge:uat:shop -- --shop-domain sms-blossom-dev --dry-run
npm run purge:uat:shop -- --shop-domain sms-blossom-dev --yes
```

## Notes
- Scripts prefer direct URL > env direct > db URL > env db URL.
- Connection info is logged (host fragment, sslmode flag). If Prisma fails against pooler, rerun with direct URL.
- Templates/Automations that are global remain; shop- or owner-scoped instances/usages are deleted. User/shop rows are removed last.
