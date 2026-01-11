# Shopify Templates Seed Guide

## Overview

The Shopify backend includes **50 professional SMS templates** organized across **10 eShop types**, each with **5 templates** per type. All templates are categorized and ready for use.

## Template Inventory

**Total Templates:** 50  
**eShop Types:** 10  
**Templates per Type:** 5

### eShop Types & Templates

1. **fashion** (5 templates)
   - welcome_new_customer
   - new_collection_launch
   - sale_announcement
   - abandoned_cart_reminder
   - loyalty_reward

2. **beauty** (5 templates)
   - welcome_new_customer
   - new_product_launch
   - skincare_tips
   - restock_notification
   - birthday_special

3. **electronics** (5 templates)
   - welcome_new_customer
   - new_tech_launch
   - warranty_reminder
   - accessory_recommendation
   - trade_in_offer

4. **food** (5 templates)
   - welcome_new_customer
   - weekly_special
   - recipe_idea
   - subscription_reminder
   - fresh_arrival

5. **services** (5 templates)
   - welcome_new_customer
   - appointment_reminder
   - service_promotion
   - follow_up
   - loyalty_reward

6. **home** (5 templates)
   - welcome_new_customer
   - seasonal_collection
   - sale_announcement
   - restock_notification
   - decorating_tips

7. **sports** (5 templates)
   - welcome_new_customer
   - new_gear_launch
   - training_tips
   - event_announcement
   - loyalty_reward

8. **books** (5 templates)
   - welcome_new_customer
   - new_release
   - reading_recommendation
   - author_event
   - subscription_reminder

9. **toys** (5 templates)
   - welcome_new_customer
   - new_toy_launch
   - age_recommendation
   - birthday_special
   - educational_toy

10. **generic** (5 templates)
    - welcome_new_customer
    - special_offer
    - thank_you
    - newsletter_signup
    - feedback_request

### Categories

Templates are categorized as:
- `welcome` - Welcome new customers
- `promotion` - Promotional messages
- `reminder` - Reminder messages
- `loyalty` - Loyalty program messages
- `engagement` - Customer engagement
- `notification` - Product/event notifications
- `special` - Special occasions (birthdays, etc.)
- `upsell` - Upsell recommendations

## Source Data Location

**File:** `apps/shopify-api/services/templates.js`  
**Object:** `DEFAULT_TEMPLATES` (lines 341-762)

## Seed Function

**Function:** `ensureDefaultTemplates(shopId, eshopType)`  
**Location:** `apps/shopify-api/services/templates.js` (line 771)

**Features:**
- ✅ Idempotent (safe to run multiple times)
- ✅ Uses `prisma.template.upsert()` with unique constraint
- ✅ Repairs existing templates (fixes language, missing fields)
- ✅ Tenant-scoped (per shop)
- ✅ eShop type-specific (each shop gets templates for its type)

## Seed Scripts

### 1. Seed All Shops (Recommended)

**Script:** `apps/shopify-api/scripts/seed-templates-for-all-shops.js`

**What it does:**
- Finds all shops in the database
- Seeds templates for each shop based on its `eshopType`
- Defaults to `generic` if shop has no `eshopType`
- Provides detailed summary

**Command:**
```bash
node apps/shopify-api/scripts/seed-templates-for-all-shops.js
```

### 2. Seed Single Shop

**Script:** `apps/shopify-api/scripts/seed-templates.js`

**What it does:**
- Seeds templates for a specific shop
- Requires `SHOP_ID` and `ESHOP_TYPE` environment variables

**Command:**
```bash
SHOP_ID=your-shop-id ESHOP_TYPE=fashion node apps/shopify-api/scripts/seed-templates.js
```

## Prerequisites

### 1. Database Unique Constraint

**⚠️ IMPORTANT:** The database must have the unique constraint `Template_shopId_eshopType_templateKey_key` for seeding to work.

**Check if constraint exists:**
```bash
cd apps/shopify-api
npm run db:status
```

**If the unique constraint is missing**, run the fix script:
```bash
# From repo root
node apps/shopify-api/scripts/fix-template-unique-constraint.js
```

This script:
- ✅ Checks for duplicate templates (prevents constraint creation if duplicates exist)
- ✅ Drops the old partial unique index (if it exists)
- ✅ Creates the proper unique constraint
- ✅ Is idempotent (safe to run multiple times)

### 2. Environment Setup

**Required:** `apps/shopify-api/.env`

**Required variable:**
```bash
DATABASE_URL=postgresql://user:password@host:port/database
```

**Verify connection:**
```bash
cd apps/shopify-api
npm run db:status
```

## Step-by-Step Seeding Guide

### Option A: Seed All Shops (Recommended)

1. **Verify database connection:**
   ```bash
   cd apps/shopify-api
   npm run db:status
   ```

2. **Fix unique constraint (if needed):**
   ```bash
   # From repo root
   node apps/shopify-api/scripts/fix-template-unique-constraint.js
   ```
   
   **Expected output:**
   ```
   ✅ Unique constraint created successfully
   ✅ Template unique constraint is ready
   ```

3. **Run seed script:**
   ```bash
   # From repo root
   node apps/shopify-api/scripts/seed-templates-for-all-shops.js
   ```

4. **Expected output:**
   ```
   [INFO] Starting template seeding for all shops...
   [INFO] Found 2 shop(s) to process
   ✅ Shop demo-store.myshopify.com: 5 created, 0 updated, 0 skipped
   ✅ Shop sms-blossom-dev.myshopify.com: 5 created, 0 updated, 0 skipped
   
   ============================================================
   SEEDING SUMMARY
   ============================================================
   Total shops processed: 2
   Shops seeded: 2
   Shops skipped (already seeded): 0
   Shops with errors: 0
   Total templates across all shops: 10
   Templates created: 10
   Templates updated: 0
   ============================================================
   
   ✅ Template seeding completed successfully!
   ```

### Option B: Seed Single Shop

1. **Get shop ID:**
   ```bash
   # Via Prisma Studio
   cd apps/shopify-api
   npm run db:studio
   # Navigate to Shop table, copy an ID
   
   # Or via SQL
   psql $DATABASE_URL -c "SELECT id, \"shopDomain\", \"eshopType\" FROM \"Shop\" LIMIT 5;"
   ```

2. **Set environment variables:**
   ```bash
   export SHOP_ID=your-shop-id-here
   export ESHOP_TYPE=fashion  # or beauty, electronics, food, services, home, sports, books, toys, generic
   ```

3. **Run seed script:**
   ```bash
   # From repo root
   SHOP_ID=$SHOP_ID ESHOP_TYPE=$ESHOP_TYPE node apps/shopify-api/scripts/seed-templates.js
   ```

4. **Expected output:**
   ```
   ✅ Templates seeded successfully
      Created: 5
      Updated: 0
      Skipped: 0
      Total: 5
   ```

## Verification

### Method 1: Prisma Studio

```bash
cd apps/shopify-api
npm run db:studio
```

1. Navigate to `Template` table
2. Filter by `shopId` to see templates for a specific shop
3. Filter by `eshopType` to see templates by type
4. Verify count: Should have 5 templates per shop per eShop type

### Method 2: API Endpoint

```bash
# Get templates for a shop
GET /api/templates?eshopType=fashion
Headers: X-Shopify-Shop-Domain: your-shop.myshopify.com
```

**Expected response:**
```json
{
  "items": [
    {
      "id": "...",
      "name": "Welcome New Customer",
      "category": "welcome",
      "text": "Hi {{first_name}}! Welcome to our store!...",
      "templateKey": "welcome_new_customer",
      "eshopType": "fashion",
      ...
    },
    // ... 4 more templates
  ],
  "total": 5,
  "page": 1,
  "pageSize": 50
}
```

### Method 3: SQL Query

```bash
psql $DATABASE_URL -c "
SELECT 
  \"shopId\", 
  \"eshopType\", 
  COUNT(*) as template_count,
  STRING_AGG(\"name\", ', ') as template_names
FROM \"Template\"
WHERE \"shopId\" IS NOT NULL
GROUP BY \"shopId\", \"eshopType\"
ORDER BY \"shopId\", \"eshopType\";
"
```

**Expected output:**
```
shopId                              | eshopType | template_count | template_names
------------------------------------+-----------+----------------+----------------------------------
cmjqxvq4o0000i4n75dj0ht60          | generic   |              5 | Welcome New Customer, Special Offer, ...
cmjuahgyo0000fe2955oafk72          | generic   |              5 | Welcome New Customer, Special Offer, ...
```

## Idempotency

The seed is **fully idempotent**:
- ✅ Safe to run multiple times
- ✅ Uses `upsert` with unique constraint `shopId_eshopType_templateKey`
- ✅ Won't create duplicates
- ✅ Updates existing templates if content changed
- ✅ Skips templates that are already correct

**Unique Key:** `(shopId, eshopType, templateKey)`

## Troubleshooting

### Error: "there is no unique or exclusion constraint matching the ON CONFLICT specification"

**Cause:** Database is missing the unique constraint.

**Solution:**
1. Apply the fix migration:
   ```bash
   cd apps/shopify-api
   npm run db:migrate:dev
   ```

2. If migration doesn't exist, create it manually:
   ```sql
   ALTER TABLE "Template" 
   ADD CONSTRAINT "Template_shopId_eshopType_templateKey_key" 
   UNIQUE ("shopId", "eshopType", "templateKey");
   ```

### Error: "Shop with ID ... not found"

**Cause:** Invalid shop ID.

**Solution:**
1. Verify shop exists:
   ```bash
   psql $DATABASE_URL -c "SELECT id, \"shopDomain\" FROM \"Shop\" WHERE id = 'your-shop-id';"
   ```

2. Use correct shop ID from database.

### Error: "Invalid eshopType: ..."

**Cause:** Invalid eShop type provided.

**Solution:**
1. Use one of the valid types:
   - `fashion`, `beauty`, `electronics`, `food`, `services`, `home`, `sports`, `books`, `toys`, `generic`

2. Check shop's current type:
   ```bash
   psql $DATABASE_URL -c "SELECT id, \"shopDomain\", \"eshopType\" FROM \"Shop\" WHERE id = 'your-shop-id';"
   ```

### No Templates Created

**Possible causes:**
1. Migration not applied (unique constraint missing)
2. Shop has no `eshopType` set (defaults to `generic`)
3. Templates already exist (check with Prisma Studio)

**Solution:**
1. Check migration status: `npm run db:status`
2. Verify shop has `eshopType`: Check in Prisma Studio
3. Check existing templates: `SELECT COUNT(*) FROM "Template" WHERE "shopId" = 'your-shop-id';`

## Summary

✅ **50 templates** across **10 eShop types**  
✅ **Idempotent** seeding (safe to run multiple times)  
✅ **Tenant-scoped** (per shop)  
✅ **Categorized** (welcome, promotion, reminder, etc.)  
✅ **Ready to use** once database migration is applied

**Next Steps:**
1. Apply database migration (if needed)
2. Run seed script for all shops
3. Verify templates via Prisma Studio or API

