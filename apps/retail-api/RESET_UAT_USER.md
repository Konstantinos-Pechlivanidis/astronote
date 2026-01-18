# Reset UAT User (Retail)

Script: `apps/retail-api/scripts/reset-uat-user.js`

Usage:
- Dry run (default):  
  `node scripts/reset-uat-user.js --email kostas.pehlivanidis.dev@gmail.com --dry-run`
- Execute deletion:  
  `node scripts/reset-uat-user.js --email kostas.pehlivanidis.dev@gmail.com --execute`

What it does:
- Loads env via `apps/api/src/config/loadEnv` (needs DATABASE_URL, STRIPE_SECRET_KEY if Stripe cleanup desired).
- Finds user by email, reports id + Stripe ids.
- Deletes (or counts in dry-run) all owner-scoped data: tokens, billing ledger, wallet/credits, purchases, invoices/tax evidence, subscription, billing profile, webhook events, campaigns/messages/templates/contacts/lists/automation assets, NFC/tracking/conversions, public links/branding assets, and the User row.
- Stripe cleanup (best-effort, non-blocking): cancel subscription, delete customer if present.

Notes:
- Default is DRY RUN unless `--execute` is passed.
- Runs deleteMany in Prisma; order is pre-defined for safety before deleting the User row.
