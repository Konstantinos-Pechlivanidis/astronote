# Global Templates Implementation Guide

**Date:** 2025-01-30  
**Status:** ✅ **COMPLETE - All Templates Are Now Global/Public**

## Overview

All 50 Shopify templates are now **global/public** and visible to **ALL shops** immediately after signup. Templates are no longer tenant-scoped per shop - they're shared across all shops.

## What Changed

### Schema Changes
- **`shopId` is now nullable** - Global templates have `shopId = NULL`
- **`isPublic` default changed to `true`** - Templates are public by default
- **Unique constraints updated** - Supports both global (shopId = NULL) and shop-specific templates

### Query Changes
- **Template queries now include global templates** - All shops see:
  - Global templates (`shopId = NULL, isPublic = true`)
  - Shop-specific templates (`shopId = currentShopId`)
- **eShop type filtering** - Shows templates for shop's eShop type OR generic templates

### Seed Changes
- **New global seed script** - Creates templates with `shopId = NULL`
- **Old per-shop seed still works** - For shop-specific custom templates

## Template Inventory

✅ **Total Templates:** 50  
✅ **eShop Types:** 10  
✅ **Templates per Type:** 5  
✅ **Visibility:** Global (visible to ALL shops)

### eShop Types
- fashion (5 templates)
- beauty (5 templates)
- electronics (5 templates)
- food (5 templates)
- services (5 templates)
- home (5 templates)
- sports (5 templates)
- books (5 templates)
- toys (5 templates)
- generic (5 templates)

## Files Changed

### Schema & Migrations
1. **`apps/shopify-api/prisma/schema.prisma`**
   - `shopId` changed from `String` to `String?` (nullable)
   - `isPublic` default changed from `false` to `true`
   - `shop` relation changed to optional (`Shop?`)

2. **`apps/shopify-api/prisma/migrations/20250130000002_make_templates_global/migration.sql`**
   - Makes `shopId` nullable
   - Updates foreign key to allow NULL
   - Creates partial unique index for global templates
   - Creates unique constraint for shop-specific templates

### Service Changes
3. **`apps/shopify-api/services/templates.js`**
   - `listTemplates()` now includes global templates in query
   - `getTemplateById()` now includes global templates
   - `DEFAULT_TEMPLATES` exported for use in seed scripts

### Seed Scripts
4. **`apps/shopify-api/scripts/seed-global-templates.js`** (NEW)
   - Seeds all 50 templates as global (shopId = NULL)
   - Idempotent (safe to run multiple times)
   - Uses findFirst + create/update pattern (can't use upsert with NULL)

## Quick Start

### 1. Apply Database Migration

**Option A: Using Prisma Migrate (Recommended)**
```bash
cd apps/shopify-api
npm run db:migrate:dev
```

**Option B: Manual SQL (if migrate fails)**
```bash
# Make shopId nullable
ALTER TABLE "Template" ALTER COLUMN "shopId" DROP NOT NULL;

# Update foreign key
ALTER TABLE "Template" DROP CONSTRAINT IF EXISTS "Template_shopId_fkey";
ALTER TABLE "Template" 
ADD CONSTRAINT "Template_shopId_fkey" 
FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL;

# Create partial unique index for global templates
CREATE UNIQUE INDEX IF NOT EXISTS "Template_global_eshopType_templateKey_key" 
ON "Template"("eshopType", "templateKey") 
WHERE "shopId" IS NULL;

# Regenerate Prisma client
npm run prisma:generate
```

### 2. Seed Global Templates

```bash
# From repo root
node apps/shopify-api/scripts/seed-global-templates.js
```

**Expected Output:**
```
✅ fashion: 5 created, 0 updated, 0 skipped
✅ beauty: 5 created, 0 updated, 0 skipped
...
✅ generic: 5 created, 0 updated, 0 skipped

============================================================
GLOBAL TEMPLATES SEEDING SUMMARY
============================================================
Total eShop types processed: 10
Templates created: 50
Templates updated: 0
Templates skipped (errors): 0
Total global templates in database: 50
============================================================

✅ Global template seeding completed successfully!
   All 50 global templates are now visible to all shops.
```

### 3. Verify Templates Are Visible

**Via API:**
```bash
GET /api/templates?eshopType=generic
Headers: X-Shopify-Shop-Domain: any-shop.myshopify.com
```

**Expected:** Should return all global templates (50 total across all eShop types)

**Via Prisma Studio:**
```bash
cd apps/shopify-api
npm run db:studio
```

Navigate to `Template` table, filter by `shopId IS NULL` - should see 50 templates.

## How It Works

### Template Visibility Logic

When a shop queries templates, the system returns:

1. **Global Templates** (`shopId = NULL, isPublic = true`)
   - Visible to ALL shops
   - Filtered by eShop type (shop's type OR generic)

2. **Shop-Specific Templates** (`shopId = currentShopId`)
   - Only visible to that shop
   - Can be public or private

### Query Example

```javascript
// In listTemplates(shopId, filters)
const where = {
  AND: [
    {
      OR: [
        { shopId: null, isPublic: true },  // Global templates
        { shopId },                         // Shop-specific templates
      ],
    },
    {
      OR: [
        { eshopType: shopEshopType },
        { eshopType: 'generic' },          // Always include generic
      ],
    },
    { language: 'en' },
    // ... other filters
  ],
};
```

## New Shop Signup

**No action required!** New shops automatically see all global templates:

1. Shop is created via OAuth callback
2. Shop queries templates via API
3. Query includes global templates (`shopId = NULL`)
4. Shop sees all 50 templates immediately

**No per-shop template copying needed.**

## Idempotency

✅ **Global seed is idempotent:**
- Uses `findFirst` to check if template exists
- Updates existing templates if found
- Creates new templates if not found
- Safe to run multiple times

✅ **Shop-specific seed still works:**
- `seed-templates-for-all-shops.js` creates shop-specific templates
- Can coexist with global templates
- Shop sees both global + shop-specific templates

## Frontend Compatibility

✅ **Frontend requires no changes:**
- API returns templates in same format
- Frontend displays all returned templates
- No filtering needed (backend handles it)

✅ **SelectItem values are safe:**
- Frontend uses `UI_ALL = '__all__'` sentinel value
- No empty `value=""` props
- Radix Select constraints satisfied

## Troubleshooting

### Templates Not Visible

**Check:**
1. Global templates exist: `SELECT COUNT(*) FROM "Template" WHERE "shopId" IS NULL;`
2. Migration applied: `shopId` column is nullable
3. Query includes global templates: Check `listTemplates()` where clause

### Migration Fails

**If `db:migrate:dev` fails:**
1. Apply migration manually (see Quick Start, Option B)
2. Regenerate Prisma client: `npm run prisma:generate`
3. Verify schema matches database

### Duplicate Templates

**If you see duplicates:**
1. Check unique constraints are applied
2. Run seed again (it's idempotent, will update existing)

## Summary

✅ **50 templates** are now global/public  
✅ **All shops** see templates immediately after signup  
✅ **No per-shop copying** required  
✅ **Idempotent seeding** (safe to re-run)  
✅ **Backward compatible** (shop-specific templates still work)  
✅ **Frontend unchanged** (works automatically)

**Next Steps:**
- Templates are ready for use
- New shops automatically see all templates
- No additional configuration needed

