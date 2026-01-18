# UAT DB Purge Report (Not Executed)

Status: Scripts created and wired; no destructive run performed in this session. Use Node 20.x and the provided Neon URLs with `--dry-run` first, then `--yes` explicitly.

## Scripts
- Retail: `apps/retail-api/apps/api/scripts/purge-uat-user.js`  
  - Args: `--email` (required), `--dry-run` (default), `--yes`, `--db-url`, `--direct-db-url`.  
  - Prefers direct URL > env direct > db URL > env db URL. Skips global `MessageTemplate`/`Automation`, deletes user last.
- Shopify: `apps/shopify-api/scripts/purge-uat-shop.js`  
  - Args: `--shop-domain` (required; auto-appends `.myshopify.com`), `--dry-run` (default), `--yes`, `--db-url`, `--direct-url`.  
  - Deletes shop-scoped usages/templates, then shop; global automations/templates remain.

## How to run (dry-run then execute)
- Retail (from `apps/retail-api/apps/api`):  
  `npm run purge:uat:user -- --email kostas.pechlivanidis.dev@gmail.com --dry-run`  
  then `--yes` after verifying counts.
- Shopify (from `apps/shopify-api`):  
  `npm run purge:uat:shop -- --shop-domain sms-blossom-dev --dry-run`  
  then `--yes` after verifying counts.

## Env used for overrides (provided by operator)
- Retail DATABASE_URL / DIRECT_DATABASE_URL (Neon, sslmode=require, channel_binding=require).
- Shopify DATABASE_URL / DIRECT_URL (Neon, sslmode=require, channel_binding=require).

## Notes / Risks
- Prisma migrate status previously failed on Node 24; use Node 20.x for these scripts if Prisma fails to connect.
- Dry-run shows counts per table; execution requires `--yes`. No data was deleted here.
