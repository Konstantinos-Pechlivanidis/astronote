# Billing Data Purge Script - Summary

## Script Created

**File**: `apps/shopify-api/scripts/purge-billing-for-shop.js`

A safe, production-guarded script to purge all billing data for a specific dev shop (`sms-blossom-dev.myshopify.com`).

---

## Safety Guards

The script includes multiple safety guards to prevent accidental data loss:

1. **Explicit shop domain check**: Only accepts `sms-blossom-dev.myshopify.com` (exact match required)
2. **Confirmation flag required**: Must include `--confirm` flag
3. **Production protection**: Refuses to run in production unless `ALLOW_PROD_PURGE=true` is set
4. **Shop verification**: Verifies shop exists before proceeding
5. **Transaction safety**: Database operations wrapped in Prisma transaction

---

## What Gets Purged

### Stripe (Test/Dev Only)
- ✅ All subscriptions for the customer (cancelled immediately)
- ⚠️ Stripe customer is **NOT deleted** (kept for future testing; can be manually deleted in Stripe Dashboard if needed)

### Database
The following tables/records are purged for the shop:

1. **Subscription** - Subscription record
2. **ShopBillingProfile** - Billing profile (VAT, address, etc.)
3. **InvoiceRecord** - Stripe invoice records
4. **TaxEvidence** - Tax evidence records (cascade from InvoiceRecord, but also deleted directly)
5. **BillingTransaction** - Billing transaction records
6. **Purchase** - Purchase records (Stripe checkout sessions)
7. **WebhookEvent** - Stripe webhook events for this shop only

### Shop Record Fields Cleared
The Shop record itself is **NOT deleted**, but all billing-related fields are cleared:
- `stripeCustomerId` → `null`
- `stripeSubscriptionId` → `null`
- `planType` → `null`
- `subscriptionStatus` → `'inactive'`
- `subscriptionInterval` → `null`
- `currentPeriodStart` → `null`
- `currentPeriodEnd` → `null`
- `cancelAtPeriodEnd` → `false`
- `includedSmsPerPeriod` → `null`
- `usedSmsThisPeriod` → `0`
- `lastPeriodResetAt` → `null`
- `lastFreeCreditsAllocatedAt` → `null`
- `lastBillingError` → `null`

### What is NOT Purged
- ✅ Shop record (kept)
- ✅ CreditTransaction (operational, not billing)
- ✅ CreditReservation (operational)
- ✅ Wallet (operational)
- ✅ Campaigns, Contacts, Templates, etc. (operational data)

---

## Usage

### Local/Dev Environment

```bash
# From repo root
node apps/shopify-api/scripts/purge-billing-for-shop.js --shopDomain sms-blossom-dev.myshopify.com --confirm
```

### Render/Production (NOT RECOMMENDED)

**⚠️ WARNING**: This script is designed for dev/test environments. Running in production requires explicit override.

If you absolutely must run in production:

1. Set environment variable: `ALLOW_PROD_PURGE=true`
2. Run the script with `--confirm` flag

```bash
# On Render (via SSH or one-off command)
ALLOW_PROD_PURGE=true node apps/shopify-api/scripts/purge-billing-for-shop.js --shopDomain sms-blossom-dev.myshopify.com --confirm
```

**⚠️ DO NOT run in production unless you are absolutely certain this is what you want.**

---

## Output

The script provides detailed output:

1. **Shop verification**: Confirms shop found and displays IDs
2. **Stripe purge progress**: Shows subscription cancellations
3. **Database purge progress**: Shows deletions per table
4. **Verification**: Confirms all billing data is cleared
5. **Summary**: Complete deletion summary with counts

Example output:
```
🔍 Finding shop...
✅ Found shop: sms-blossom-dev.myshopify.com (ID: abc123)
   Stripe Customer ID: cus_xxx
   Stripe Subscription ID: sub_xxx

🗑️  Purging Stripe data...
   ✅ Cancelled subscription: sub_xxx
   ℹ️  Stripe customer cus_xxx kept (can be manually deleted if needed)

🗑️  Purging database billing data...
   ✅ Deleted 1 Subscription record(s)
   ✅ Deleted 1 ShopBillingProfile record(s)
   ✅ Deleted 3 InvoiceRecord record(s)
   ✅ Deleted 2 TaxEvidence record(s)
   ✅ Deleted 5 BillingTransaction record(s)
   ✅ Deleted 1 Purchase record(s)
   ✅ Deleted 12 Stripe WebhookEvent record(s)
   ✅ Cleared all billing fields on Shop record
   ✅ Database purge completed successfully

🔍 Verifying deletion...
   ✅ All billing data successfully purged

📊 DELETION SUMMARY
═══════════════════════════════════════════════════════════
Shop: sms-blossom-dev.myshopify.com (ID: abc123)

Stripe:
  - Subscriptions cancelled: 1
  - Customer deleted: No (kept for future use)

Database:
  - Subscription: 1 record(s)
  - ShopBillingProfile: 1 record(s)
  - InvoiceRecord: 3 record(s)
  - TaxEvidence: 2 record(s)
  - BillingTransaction: 5 record(s)
  - Purchase: 1 record(s)
  - WebhookEvent (Stripe): 12 record(s)
  - Shop billing fields cleared: Yes

✅ Purge completed successfully!
═══════════════════════════════════════════════════════════
```

---

## Verification

After running the script, you can verify the purge by:

1. **Check Shop record**:
   ```sql
   SELECT id, shopDomain, stripeCustomerId, stripeSubscriptionId, planType, subscriptionStatus
   FROM "Shop"
   WHERE shopDomain = 'sms-blossom-dev.myshopify.com';
   ```
   Should show: `stripeCustomerId = NULL`, `stripeSubscriptionId = NULL`, `planType = NULL`, `subscriptionStatus = 'inactive'`

2. **Check billing tables**:
   ```sql
   SELECT COUNT(*) FROM "Subscription" WHERE "shopId" = '<shop-id>';
   SELECT COUNT(*) FROM "ShopBillingProfile" WHERE "shopId" = '<shop-id>';
   SELECT COUNT(*) FROM "InvoiceRecord" WHERE "shopId" = '<shop-id>';
   ```
   All should return `0`.

---

## Error Handling

The script handles errors gracefully:

- **Missing shop**: Exits with error message
- **Stripe errors**: Logs errors but continues with DB purge
- **Database errors**: Wrapped in transaction (rollback on failure)
- **Verification failures**: Warns about remaining data

---

## Gates Status

✅ **Lint**: Pass (no errors)
✅ **Build**: Pass

---

## Files Changed

1. **New**: `apps/shopify-api/scripts/purge-billing-for-shop.js` - Purge script
2. **New**: `PURGE_BILLING_SCRIPT_SUMMARY.md` - This documentation

---

## Important Notes

1. **Shop record is preserved**: Only billing data is purged. The shop itself remains for operational data.
2. **Stripe customer kept**: The Stripe customer is not deleted to allow future testing. If you need a complete reset, manually delete the customer in Stripe Dashboard.
3. **Operational data preserved**: Campaigns, contacts, templates, and other operational data are NOT affected.
4. **Idempotent**: Safe to run multiple times (will report 0 deletions if already purged).

---

## Next Steps After Purge

After purging billing data, you can:

1. **Re-subscribe**: Start fresh subscription flow
2. **Test checkout**: Test the complete billing flow from scratch
3. **Verify webhooks**: Test webhook processing with new subscription

The shop is now ready for fresh billing testing! 🚀

