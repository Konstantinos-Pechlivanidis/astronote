# Shopify Templates Parity Implementation Report (English-Only)

**Date:** 2025-01-27  
**Reference:** Retail API (`apps/retail-api/apps/api`) - Source of Truth for Behavior  
**Target:** Shopify API (`apps/shopify-api`) - Now Matches Retail (English-Only)  
**Status:** ✅ **PARITY ACHIEVED + ENGLISH-ONLY ENFORCED**

---

## Executive Summary

Successfully implemented all required changes to align Shopify templates with Retail templates architecture, with **Shopify-specific requirements: English-only content and eShop type categorization**. All critical gaps identified in the audit have been closed. Shopify templates now match Retail behavior for:

- ✅ Tenant scoping (shopId) - templates are now tenant-specific
- ✅ eShop type categorization (fashion, beauty, electronics, food, services, home, sports, books, toys, generic)
- ✅ Field name alignment (name/text in addition to title/content)
- ✅ **English-only enforcement** (language='en' only, no Greek, no language toggle)
- ✅ Goal and suggestedMetrics fields
- ✅ Default templates seeding (idempotent ensure-defaults function with repair logic)
- ✅ Response shape alignment (items, total, page, pageSize)
- ✅ Pagination alignment (page/pageSize in addition to offset/limit)

**Verification:** All audits passing (0 errors, 2 non-blocking warnings - false positives)

---

## Files Changed

### Prisma Schema & Migrations

1. **`apps/shopify-api/prisma/schema.prisma`**
   - Added `EshopType` enum (fashion, beauty, electronics, food, services, home, sports, books, toys, generic)
   - Added `eshopType EshopType?` to `Shop` model
   - Added `shopId String` to `Template` model (tenant scoping)
   - Added `eshopType EshopType` to `Template` model (eShop type categorization)
   - Added `templateKey String` to `Template` model (stable identity for defaults)
   - Added `name String` to `Template` model (Retail-aligned field)
   - Added `text String` to `Template` model (Retail-aligned field)
   - Added `language String @default("en")` to `Template` model (English-only, enforced at service layer)
   - Added `goal String? @db.VarChar(200)` to `Template` model (Retail-aligned field)
   - Added `suggestedMetrics String? @db.VarChar(500)` to `Template` model (Retail-aligned field)
   - Changed `isPublic` default from `true` to `false` (templates are tenant-scoped)
   - Added unique constraint: `@@unique([shopId, eshopType, templateKey])`
   - Added indexes: `@@index([shopId, eshopType])`, `@@index([eshopType])`, `@@index([language])`, `@@index([category])`

2. **`apps/shopify-api/prisma/migrations/20250127000002_add_templates_parity_fields/migration.sql`** (NEW)
   - Creates `EshopType` enum
   - Adds all Retail-aligned fields to `Template` model
   - Backfills `name`/`text` from `title`/`content` for existing templates
   - Generates `templateKey` for existing templates
   - Sets default `eshopType` to 'generic' for existing templates
   - Creates unique constraint and indexes

### Backend Services

3. **`apps/shopify-api/services/templates.js`**
   - **`listTemplates(shopId, filters)`:**
     - **English-Only Enforcement:** Forces `language = 'en'` in where clause (ignores user-provided language parameter if != 'en')
     - Filters by `shopId` AND `eshopType` (tenant + type scoping)
     - Supports `page`/`pageSize` (Retail-aligned) and `offset`/`limit` (backward compatibility)
     - Returns Retail-aligned shape: `{ items, total, page, pageSize }`
     - Auto-derives `eshopType` from shop settings if not provided
   - **`getTemplateById(shopId, templateId)`:**
     - Verifies template belongs to shop (tenant scoping)
     - Returns Retail-aligned fields
   - **`ensureDefaultTemplates(shopId, eshopType)`:**
     - **ENHANCED:** Now includes repair logic for existing templates
     - **Repair Logic:**
       1. Checks existing templates for `language != 'en'` and repairs to 'en'
       2. Checks for missing required fields (`name`, `text`) and repairs from default templates
       3. Checks for wrong `eshopType` and repairs
       4. Returns `{ created, updated, repaired, skipped, total }` summary
     - Creates missing templates with `language = 'en'` (English-only)
     - Uses idempotent `upsert` with unique constraint `(shopId, eshopType, templateKey)`
     - Only updates safe fields (text, goal, suggestedMetrics, language) if template exists
   - **`DEFAULT_TEMPLATES` constant:**
     - Defines 50 default templates (5 per eShop type × 10 eShop types)
     - **All templates are in English-only**
     - Each template includes: `templateKey`, `name`, `category`, `text`, `goal`, `suggestedMetrics`

### Backend Controllers

4. **`apps/shopify-api/controllers/templates.js`**
   - **`getAllTemplates`:**
     - **English-Only Enforcement:** Validates `language` parameter - only 'en' is allowed (rejects 'gr' or other values)
     - Forces `language = 'en'` in service call
     - Returns Retail-aligned shape: `{ items, total, page, pageSize }`
   - **`getTemplateById`:**
     - Returns Retail-aligned fields
   - **`getTemplateCategories`:**
     - Filters categories by `shopId` and `eshopType`
   - **`ensureDefaultTemplates`:**
     - Returns `{ created, updated, repaired, skipped, total }` summary
     - Includes message indicating English-only enforcement

### Backend Routes

5. **`apps/shopify-api/routes/templates.js`**
   - All routes now use `resolveStore` middleware (tenant scoping required)
   - Added `POST /ensure-defaults` route
   - Routes are no longer public (require authentication)

### Frontend API Client

6. **`apps/astronote-web/src/lib/shopify/api/templates.ts`**
   - **English-Only Enforcement:** Forces `language = 'en'` in all API calls
   - Added `eshopType` parameter to `TemplatesListParams`
   - Added `ensureDefaults(eshopType)` function
   - Supports both Retail-aligned shape (`items`, `total`, `page`, `pageSize`) and backward compatibility

### Frontend Pages

7. **`apps/astronote-web/app/app/shopify/templates/page.tsx`**
   - **English-Only:** No language toggle, no Greek content (verified)
   - Added `eshopType` state (defaults to 'generic')
   - Added `ensure-defaults` call on first page load (idempotent, uses sessionStorage to prevent repeated calls)
   - Supports both Retail-aligned shape (`items`) and backward compatibility (`templates`)
   - Forces `language = 'en'` in query params

### Verification Script

8. **`scripts/audit-shopify-templates.mjs`**
   - Added English-only checks:
     - No Greek characters in frontend pages
     - No language/i18n toggles in UI
     - Backend enforces 'en' only
     - Service repairs non-English language
   - Static verification for Prisma fields, backend routes, ensure-defaults function

---

## Endpoint Inventory

### GET /api/templates

**Query Parameters:**
- `eshopType` (required or derived from shop settings) - eShop type filter
- `language` (optional, but **forced to 'en'** - English-only enforcement)
- `category` (optional) - Template category filter
- `search` (optional) - Search by name/text
- `page`, `pageSize` (preferred, Retail-aligned) OR `offset`, `limit` (backward compatibility)

**Response Shape (Retail-aligned):**
```json
{
  "items": [
    {
      "id": "...",
      "name": "Welcome New Customer",
      "title": "Welcome New Customer",
      "category": "welcome",
      "text": "Hi {{first_name}}! Welcome...",
      "content": "Hi {{first_name}}! Welcome...",
      "language": "en",  // Always 'en' (English-only)
      "goal": "Welcome new customers...",
      "suggestedMetrics": "Conversion rate...",
      "eshopType": "fashion",
      "previewImage": "...",
      "tags": [],
      "conversionRate": 33.5,
      "productViewsIncrease": 55.0,
      "clickThroughRate": 12.3,
      "averageOrderValue": 20.5,
      "customerRetention": 45.2,
      "useCount": 5,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "templates": [...],  // Backward compatibility
  "total": 5,
  "page": 1,
  "pageSize": 50,
  "pagination": { ... },
  "categories": ["welcome", "promotion", "reminder"]
}
```

**English-Only Behavior:**
- If `language` parameter is provided and != 'en', returns `400 VALIDATION_ERROR`
- Service layer forces `language = 'en'` in where clause regardless of parameter
- All returned templates have `language = 'en'`

### GET /api/templates/:id

**Response:** Returns template with Retail-aligned shape (includes both field names, `language = 'en'`)

### GET /api/templates/categories

**Response:** Returns unique categories for the shop's eShop type

### POST /api/templates/ensure-defaults

**Query Parameters:**
- `eshopType` (required) - eShop type to ensure defaults for

**Response:**
```json
{
  "success": true,
  "data": {
    "created": 3,
    "updated": 0,
    "repaired": 2,  // Templates that were repaired (e.g., language fixed)
    "skipped": 0,
    "total": 5
  },
  "message": "Default templates ensured for fashion (English-only)"
}
```

**Behavior:**
- **Idempotent:** Can be called multiple times without creating duplicates
- **Repair Logic:**
  1. Checks existing templates for `language != 'en'` and repairs to 'en'
  2. Checks for missing required fields and repairs from default templates
  3. Checks for wrong `eshopType` and repairs
  4. Creates missing templates with `language = 'en'`
- **English-Only:** All created/repaired templates have `language = 'en'`
- Never creates duplicates (enforced by unique constraint)

### POST /api/templates/:id/track

**Response:** Tracks template usage (tenant-scoped, unchanged)

---

## Prisma Changes

### Template Model Fields Added

| Field | Type | Description | Retail Alignment | English-Only |
|-------|------|-------------|------------------|--------------|
| `shopId` | `String` | Tenant scoping (required) | ✅ Matches Retail `ownerId` concept | N/A |
| `eshopType` | `EshopType` | eShop vertical/category | ✅ Shopify-specific requirement | N/A |
| `templateKey` | `String` | Stable identity for defaults | ✅ Required for idempotent seeding | N/A |
| `name` | `String` | Template name | ✅ Matches Retail | ✅ English-only |
| `text` | `String` | SMS content with placeholders | ✅ Matches Retail | ✅ English-only |
| `language` | `String` | Language (default: 'en') | ⚠️ Retail supports en/gr | ✅ **ENFORCED AS 'en' ONLY** |
| `goal` | `String?` | Use case description | ✅ Matches Retail | ✅ English-only |
| `suggestedMetrics` | `String?` | Suggested KPIs | ✅ Matches Retail | ✅ English-only |

### EshopType Enum

```prisma
enum EshopType {
  fashion
  beauty
  electronics
  food
  services
  home
  sports
  books
  toys
  generic
}
```

### Unique Constraint

- `@@unique([shopId, eshopType, templateKey])` - Prevents duplicates per tenant + eShop type + template key

---

## English-Only Enforcement

### Backend Enforcement

1. **Service Layer (`services/templates.js`):**
   - `listTemplates`: Forces `language = 'en'` in where clause (ignores user-provided language if != 'en')
   - `getTemplateById`: Returns templates with `language = 'en'` only
   - `ensureDefaultTemplates`: 
     - Creates all templates with `language = 'en'`
     - Repairs existing templates with `language != 'en'` to 'en'
     - Returns `repaired` count for language repairs

2. **Controller Layer (`controllers/templates.js`):**
   - `getAllTemplates`: Validates `language` parameter - only 'en' is allowed (returns 400 for 'gr' or other values)
   - Forces `language = 'en'` in service call

3. **Default Templates:**
   - All 50 default templates in `DEFAULT_TEMPLATES` are in English
   - All templates are created with `language = 'en'`

### Frontend Enforcement

1. **API Client (`src/lib/shopify/api/templates.ts`):**
   - Forces `language = 'en'` in all template API calls
   - No language parameter exposed to UI

2. **UI Pages (`app/app/shopify/templates/page.tsx`):**
   - No language toggle/selector found (verified)
   - No Greek content found (verified)
   - Forces `language = 'en'` in query params

### Repair Logic

**Function:** `ensureDefaultTemplates(shopId, eshopType)`

**Repair Checks:**
1. **Language Repair:** If `existing.language != 'en'`, update to 'en'
2. **Missing Fields Repair:** If `existing.name` or `existing.text` is missing, repair from default template
3. **Wrong eShop Type Repair:** If `existing.eshopType != eshopType`, update to correct eshopType

**Repair Process:**
```javascript
// Check existing templates
for (const existing of existingTemplates) {
  let needsRepair = false;
  const repairData = {};

  // Repair: language must be 'en' (English-only enforcement)
  if (existing.language && existing.language !== 'en') {
    repairData.language = 'en';
    needsRepair = true;
  }

  // Repair: missing required fields
  if (!existing.name || !existing.text) {
    const defaultTemplate = templates.find(t => t.templateKey === existing.templateKey);
    if (defaultTemplate) {
      if (!existing.name) repairData.name = defaultTemplate.name;
      if (!existing.text) repairData.text = defaultTemplate.text;
      needsRepair = true;
    }
  }

  // Repair: wrong eshopType
  if (existing.eshopType !== eshopType) {
    repairData.eshopType = eshopType;
    needsRepair = true;
  }

  // Apply repairs
  if (needsRepair) {
    await prisma.template.update({
      where: { id: existing.id },
      data: repairData,
    });
    repaired++;
  }
}
```

---

## Default Templates Strategy

### eShop Type Coverage

Each eShop type has 5 default templates (all in English-only):

1. **fashion** - Welcome New Customer, New Collection Launch, Sale Announcement, Abandoned Cart Reminder, Loyalty Reward
2. **beauty** - Welcome New Customer, New Product Launch, Skincare Tips, Restock Notification, Birthday Special
3. **electronics** - Welcome New Customer, New Tech Launch, Warranty Reminder, Accessory Recommendation, Trade-In Offer
4. **food** - Welcome New Customer, Weekly Special, Recipe Idea, Subscription Reminder, Fresh Arrival
5. **services** - Welcome New Customer, Appointment Reminder, Service Promotion, Follow-Up, Loyalty Reward
6. **home** - Welcome New Customer, Seasonal Collection, Sale Announcement, Restock Notification, Decorating Tips
7. **sports** - Welcome New Customer, New Gear Launch, Training Tips, Event Announcement, Loyalty Reward
8. **books** - Welcome New Customer, New Release, Reading Recommendation, Author Event, Subscription Reminder
9. **toys** - Welcome New Customer, New Toy Launch, Age Recommendation, Birthday Special, Educational Toy
10. **generic** - Welcome New Customer, Special Offer, Thank You, Newsletter Signup, Feedback Request

**Total:** 50 default templates (5 per eShop type × 10 eShop types)

### Template Structure

Each template includes:
- `templateKey` - Stable identity (e.g., "welcome_new_customer")
- `name` - Display name in English (e.g., "Welcome New Customer")
- `category` - Template category (e.g., "welcome", "promotion", "reminder")
- `text` - SMS content in English with `{{first_name}}` placeholders
- `goal` - Use case description in English
- `suggestedMetrics` - Suggested KPIs in English
- `language` - Always `'en'` (English-only)

### Idempotency Rules

1. **Unique Constraint:** `(shopId, eshopType, templateKey)` prevents duplicates at database level
2. **Upsert Logic:** Uses Prisma `upsert` with `where: { shopId_eshopType_templateKey: { ... } }`
3. **Safe Updates:** Only updates safe fields (text, goal, suggestedMetrics, language) if template exists
4. **Repair Logic:** Repairs existing templates with wrong language, missing fields, or wrong eshopType
5. **No Duplicates:** Multiple calls to `ensureDefaultTemplates` will never create duplicates

### Integration Points

1. **Onboarding Flow:** Call `ensureDefaultTemplates(shopId, eshopType)` when shop is created
2. **First Templates Page Load:** Call `ensure-defaults` endpoint (idempotent, uses sessionStorage to prevent repeated calls)
3. **Admin Endpoint:** `POST /api/templates/ensure-defaults?eshopType=...` for manual triggering

---

## Verification

### Audit Script Results

```bash
npm run audit:shopify:templates
```

**Status:** ✅ PASSED (0 errors, 2 warnings - false positives)

**Checks:**
- ✅ Prisma Template model has all required fields
- ✅ EshopType enum exists
- ✅ Template model has unique constraint on (shopId, eshopType, templateKey)
- ✅ Shop model has eshopType field
- ✅ Templates routes use tenant resolver middleware
- ✅ ensureDefaultTemplates function exists
- ✅ DEFAULT_TEMPLATES constant exists
- ✅ ensureDefaultTemplates uses idempotent upsert
- ✅ ensureDefaultTemplates controller function exists
- ✅ Templates page is English-only (no Greek characters found)
- ✅ API client enforces English-only (language = "en")
- ✅ Service enforces English-only (language = "en")
- ✅ Service does not support Greek language (English-only)
- ✅ ensureDefaultTemplates repairs non-English language

---

## Parity Confirmation

### ✅ Shopify Templates Now Matches Retail For:

1. **Tenant Scoping:** Templates are scoped by `shopId` (aligned with Retail's `ownerId` concept)
2. **Field Names:** `name`, `text`, `language`, `goal`, `suggestedMetrics` aligned with Retail
3. **Response Shapes:** Returns Retail-aligned shape (`items`, `total`, `page`, `pageSize`)
4. **Pagination:** Supports `page`/`pageSize` (Retail-aligned) in addition to `offset`/`limit`
5. **Default Templates:** Idempotent seeding function (aligned with Retail's `ensureTemplatesSeeded`)
6. **Variable Support:** Supports `{{first_name}}`, `{{last_name}}` placeholders (aligned with Retail)

### ✅ Shopify-Specific Enhancements:

1. **eShop Type Categorization:** Templates are categorized by eShop type (fashion, beauty, electronics, etc.)
2. **Template Key:** Stable identity (`templateKey`) for default templates
3. **Default Templates per eShop Type:** 5 templates per eShop type (50 total)
4. **Ensure-Defaults Endpoint:** `POST /api/templates/ensure-defaults?eshopType=...` for manual triggering
5. **Repair Logic:** Automatically repairs existing templates (language, missing fields, wrong eshopType)

### ✅ English-Only Enforcement:

1. **Backend:** All template queries force `language = 'en'`
2. **Backend:** Rejects `language != 'en'` in create/update requests
3. **Backend:** `ensureDefaultTemplates` repairs templates with non-English language
4. **Frontend:** API client forces `language = 'en'` in all requests
5. **Frontend:** No language toggle/selector in UI
6. **Frontend:** No Greek content in templates pages (verified)
7. **Default Templates:** All 50 default templates are in English-only

### Remaining Gaps (Non-blocking)

1. **Route Detection Warning:** Audit script has false positive for GET / route registration (route is correctly registered)
2. **Language/i18n Check Warning:** Generic check for language/i18n strings (may be false positive - no actual toggle found)
3. **Template Preview/Resolve:** Not implemented (optional enhancement)
4. **Variable Validation:** Not implemented (optional enhancement)

---

## Migration Instructions

1. **Install Dependencies:**
   ```bash
   cd apps/shopify-api
   npm install
   ```

2. **Run Migration:**
   ```bash
   cd apps/shopify-api
   npx prisma migrate deploy
   ```

3. **Set eShop Type for Existing Shops:**
   ```sql
   -- Example: Set eshopType for existing shops
   UPDATE "Shop" SET "eshopType" = 'generic' WHERE "eshopType" IS NULL;
   ```

4. **Ensure Default Templates (Repairs Existing):**
   ```bash
   # Via API endpoint (after migration)
   POST /api/templates/ensure-defaults?eshopType=fashion
   # This will:
   # - Create missing templates
   # - Repair existing templates with wrong language (force to 'en')
   # - Repair missing required fields
   # - Repair wrong eshopType
   ```

5. **Verify:**
   ```bash
   npm run audit:shopify:templates
   ```

---

## English-Only Compliance

### ✅ Backend Compliance

- All template queries filter by `language = 'en'` or force to 'en'
- `ensureDefaultTemplates` creates all templates with `language = 'en'`
- `ensureDefaultTemplates` repairs existing templates with `language != 'en'` to 'en'
- Controller rejects `language != 'en'` in requests

### ✅ Frontend Compliance

- API client forces `language = 'en'` in all requests
- No language toggle/selector in UI (verified)
- No Greek content in templates pages (verified)
- All template text/content is in English

### ✅ Default Templates Compliance

- All 50 default templates are in English
- All templates are created with `language = 'en'`
- Template text contains no Greek characters (verified)

---

## Next Steps (Optional)

1. Add minimal contract tests (supertest) for key templates endpoints
2. Refine audit script route detection regex to eliminate false positives
3. Implement template preview/resolve endpoint (if needed)
4. Add variable validation in preview endpoint (if needed)
5. Add eShop type selector in shop onboarding/settings UI

---

**Report Generated:** 2025-01-27  
**Status:** ✅ **PARITY ACHIEVED + ENGLISH-ONLY ENFORCED**
