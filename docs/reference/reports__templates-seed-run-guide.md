# Templates Seed Script Run Guide

## Overview

Templates in the Shopify backend are **tenant-scoped** (per shop). Each shop must have templates seeded for its specific `eshopType` (e.g., 'fashion', 'beauty', 'electronics').

## Location

**Script:** `apps/shopify-api/scripts/seed-templates.js`

**Service Function:** `apps/shopify-api/services/templates.js` → `ensureDefaultTemplates(shopId, eshopType)`

## Recommended Method: Use `ensureDefaultTemplates`

The **recommended** way to seed templates is via the `ensureDefaultTemplates` service function, which is:
- ✅ Idempotent (safe to run multiple times)
- ✅ Tenant-scoped (per shop)
- ✅ Validates eShop type
- ✅ Uses transactions for safety
- ✅ Provides detailed logging

### Usage via Service Function

```javascript
// In your code or via a script
import { ensureDefaultTemplates } from '../services/templates.js';

const result = await ensureDefaultTemplates(shopId, 'fashion');
// Returns: { created, updated, skipped, total }
```

### Usage via API Endpoint

If the endpoint exists:
```bash
POST /api/templates/ensure-defaults
Headers: X-Shopify-Shop-Domain: your-shop.myshopify.com
Body: { "eshopType": "fashion" }
```

## Alternative: Direct Script Execution

**⚠️ WARNING:** Only use this for LOCAL/DEV databases. Never run against production.

### Prerequisites

1. **Environment Setup:**
   - Ensure `apps/shopify-api/.env` exists
   - Set `DATABASE_URL` to your LOCAL/DEV database
   - Verify you're NOT connected to production

2. **Required Environment Variables:**
   ```bash
   SHOP_ID=your-shop-id-here
   ESHOP_TYPE=fashion  # Optional, defaults to 'generic'
   ```

### Step 1: Verify Database Connection

```bash
cd apps/shopify-api
npm run db:status
```

### Step 2: Get Shop ID

You need a valid shop ID from your database:

```bash
# Option A: Via Prisma Studio
npm run db:studio
# Navigate to Shop table, copy an ID

# Option B: Via SQL
psql $DATABASE_URL -c "SELECT id, domain, eshopType FROM \"Shop\" LIMIT 5;"
```

### Step 3: Run Seed Script

From repository root:

```bash
SHOP_ID=clx1234567890abcdef ESHOP_TYPE=fashion node apps/shopify-api/scripts/seed-templates.js
```

Or set in `.env`:

```bash
# apps/shopify-api/.env
SHOP_ID=clx1234567890abcdef
ESHOP_TYPE=fashion
```

Then run:

```bash
node apps/shopify-api/scripts/seed-templates.js
```

### Step 4: Verify Success

**Expected Output:**
```
✅ Templates seeded successfully
   Created: 15
   Updated: 0
   Skipped: 0
   Total: 15
```

**Verify in Database:**
```bash
# Via Prisma Studio
npm run db:studio
# Navigate to Template table, filter by shopId

# Via SQL
psql $DATABASE_URL -c "SELECT id, name, category, \"eshopType\", \"shopId\" FROM \"Template\" WHERE \"shopId\" = 'your-shop-id';"
```

**Verify via API:**
```bash
GET /api/templates?eshopType=fashion
Headers: X-Shopify-Shop-Domain: your-shop.myshopify.com
```

## Idempotency

The script is **idempotent**:
- Running it multiple times with the same `shopId` and `eshopType` is safe
- Existing templates are updated (if content changed) or skipped (if unchanged)
- No duplicate templates are created (enforced by unique constraint: `shopId + eshopType + templateKey`)

## Supported eShop Types

- `fashion`
- `beauty`
- `electronics`
- `food`
- `home`
- `sports`
- `books`
- `toys`
- `generic` (default)

## Troubleshooting

### Error: "shopId is required"
- Ensure `SHOP_ID` environment variable is set
- Verify the shop ID exists in the database

### Error: "Shop with ID ... not found"
- Verify the shop exists: `SELECT * FROM "Shop" WHERE id = 'your-shop-id';`
- Check database connection

### Error: "Invalid eshopType"
- Use one of the supported eShop types (see list above)
- Check shop's `eshopType` in database: `SELECT eshopType FROM "Shop" WHERE id = 'your-shop-id';`

### No Templates Created
- Check logs for errors
- Verify `eshopType` matches shop's type
- Check Prisma schema for required fields

## Safety Notes

1. **Never run against production** without explicit approval
2. **Always verify `DATABASE_URL`** points to LOCAL/DEV
3. **Backup database** before seeding (if in doubt)
4. **Use transactions** (already handled by `ensureDefaultTemplates`)

## Script Details

The seed script:
- Validates `shopId` and `eshopType`
- Verifies shop exists in database
- Uses `ensureDefaultTemplates` (idempotent, safe)
- Provides detailed logging
- Returns structured results: `{ created, updated, skipped, total }`

## Related Files

- **Service:** `apps/shopify-api/services/templates.js` → `ensureDefaultTemplates()`
- **Default Templates:** Defined in `DEFAULT_TEMPLATES` object in `services/templates.js`
- **Schema:** `apps/shopify-api/prisma/schema.prisma` → `Template` model

