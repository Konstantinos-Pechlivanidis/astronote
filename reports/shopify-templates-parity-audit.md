# Shopify Templates Parity Audit Report (English-Only)

**Date:** 2025-01-27  
**Reference:** Retail API (`apps/retail-api/apps/api`) - Source of Truth for Behavior  
**Target:** Shopify API (`apps/shopify-api`) - Must Reach Parity (English-Only)  
**Status:** 🔍 **AUDIT COMPLETE**

---

## Executive Summary

This audit compares the Retail templates implementation (source of truth for behavior) with the current Shopify templates implementation to identify gaps and create an implementation plan for full parity, with **Shopify-specific requirements: English-only content and eShop type categorization**.

**Key Findings:**
- Retail templates support multi-language (en/gr); **Shopify must be English-only**
- Retail templates are system-managed (ownerId = SYSTEM_USER_ID) with category-based organization
- Shopify templates were previously public but are now tenant-scoped (shopId)
- Retail uses `name`/`text` fields; Shopify uses `title`/`content` (alignment needed)
- Retail has `goal` and `suggestedMetrics` fields; Shopify needs these
- Retail has idempotent seeding function; Shopify needs `ensureDefaultTemplates` with repair logic
- **CRITICAL:** Shopify templates must be **English-only** (no Greek, no language toggle in UI)

---

## Phase 1: Retail Templates Inventory (Source of Truth for Behavior)

### A) Prisma Model: MessageTemplate

**Location:** `apps/retail-api/prisma/schema.prisma`

```prisma
model MessageTemplate {
  id Int @id @default(autoincrement())
  ownerId Int  // System user ID for global templates
  name String
  text String  // SMS content with {{first_name}} and {{last_name}} placeholders
  category TemplateCategory @default(generic)
  goal String? @db.VarChar(200)
  suggestedMetrics String? @db.VarChar(500)
  language String @default("en")  // "en" or "gr" - Retail supports both
  
  // Statistics fields
  conversionRate Float?
  productViewsIncrease Float?
  clickThroughRate Float?
  averageOrderValue Float?
  customerRetention Float?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([ownerId, name])
  @@index([ownerId])
  @@index([category])
  @@index([language])
}

enum TemplateCategory {
  cafe
  restaurant
  gym
  sports_club
  generic
  hotels
}
```

**Key Characteristics:**
- Templates are **system-managed** (owned by SYSTEM_USER_ID)
- **Category-based** organization (cafe, restaurant, gym, sports_club, generic, hotels)
- **Multi-language support** (en, gr) - **Shopify will be English-only**
- **Unique constraint:** `(ownerId, name)` - prevents duplicate template names per owner
- **Variables:** Supports `{{first_name}}`, `{{last_name}}` (also `{{firstName}}`, `{{lastName}}` for backward compatibility)

### B) Retail Backend Endpoints

**Location:** `apps/retail-api/apps/api/src/routes/templates.js`

| Method | Path | Auth | Query Params | Request Body | Response Shape | Notes |
|--------|------|------|--------------|--------------|----------------|-------|
| GET | `/templates` | `requireAuth` | `page`, `pageSize`, `q` (search), `category`, `language` (required: en/gr) | - | `{ items, total, page, pageSize }` | List templates. Language is **required** in Retail. |
| GET | `/templates/:id` | `requireAuth` | - | - | Template object | Get single template |
| POST | `/templates` | `requireAuth` | - | - | `403 FORBIDDEN` | Templates are platform-managed |
| PUT | `/templates/:id` | `requireAuth` | - | - | `403 FORBIDDEN` | Templates are platform-managed |
| DELETE | `/templates/:id` | `requireAuth` | - | - | `403 FORBIDDEN` | Templates are platform-managed |

**Response Shape (GET /templates):**
```json
{
  "items": [
    {
      "id": 1,
      "name": "Welcome New Customer",
      "text": "Hi {{first_name}}! Welcome to our café!...",
      "category": "cafe",
      "goal": "Welcome new customers and encourage first visit",
      "suggestedMetrics": "Conversion rate, first visit rate",
      "language": "en",
      "ownerId": 1,
      "conversionRate": 33.5,
      "productViewsIncrease": 55.0,
      "clickThroughRate": 12.3,
      "averageOrderValue": 20.5,
      "customerRetention": 45.2,
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "pageSize": 50
}
```

**Key Behaviors:**
- Templates are filtered by `ownerId = SYSTEM_USER_ID` (system templates only)
- Language parameter is **required** in Retail and must be "en" or "gr"
- Category filter supports: `cafe`, `restaurant`, `gym`, `sports_club`, `generic`, `hotels`
- Search (`q`) filters by `name` (case-insensitive)
- Pagination: `page` (default: 1), `pageSize` (default: 50, max: 100)

### C) Retail Template Seeding

**Location:** `apps/retail-api/apps/api/src/lib/ensureTemplatesSeeded.js`

**Function:** `ensureTemplatesSeeded()`

**Behavior:**
- **Idempotent:** Uses `upsert` with `where: { ownerId_name: { ownerId: SYSTEM_USER_ID, name: template.name } }`
- **Returns:** `{ created, updated, total }`
- **Templates:** 25 predefined templates across 5 categories (cafe, restaurant, gym, sports_club, generic, hotels)
- **Language:** All templates are English (`language: 'en'`) by default in Retail seed data
- **Called:** On server startup or first login (optional)

**Template Structure:**
```javascript
{
  name: 'Welcome New Customer',
  category: 'cafe',
  goal: 'Welcome new customers and encourage first visit',
  text: 'Hi {{first_name}}! Welcome to our café!...',
  suggestedMetrics: 'Conversion rate, first visit rate',
  language: 'en',
}
```

### D) Retail Template Rendering

**Location:** `apps/retail-api/apps/api/src/lib/template.js`

**Function:** `render(templateText, contact)`

**Behavior:**
- Supports both `{{first_name}}`/`{{last_name}}` and `{{firstName}}`/`{{lastName}}` formats
- Handles missing fields gracefully (replaces with empty string)
- Cleans up double spaces and trims result

---

## Phase 2: Shopify Templates Current Inventory

### A) Prisma Model: Template (After Previous Implementation)

**Location:** `apps/shopify-api/prisma/schema.prisma`

**Current State (After Previous Implementation):**
```prisma
model Template {
  id String @id @default(cuid())
  shopId String  // ✅ Tenant scoping (added)
  eshopType EshopType  // ✅ eShop type categorization (added)
  templateKey String  // ✅ Stable identity for defaults (added)
  title String  // Legacy field
  name String  // ✅ Retail-aligned field (added)
  category String
  content String  // Legacy field
  text String  // ✅ Retail-aligned field (added)
  language String @default("en")  // ✅ Language field (added, but must be 'en' only)
  goal String? @db.VarChar(200)  // ✅ Retail-aligned field (added)
  suggestedMetrics String? @db.VarChar(500)  // ✅ Retail-aligned field (added)
  previewImage String?
  tags String[] @default([])
  isPublic Boolean @default(false)  // ✅ Changed: templates are tenant-scoped
  isSystemDefault Boolean @default(false)
  
  // Statistics fields
  conversionRate Float?
  productViewsIncrease Float?
  clickThroughRate Float?
  averageOrderValue Float?
  customerRetention Float?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  shop Shop @relation(...)
  usage TemplateUsage[]

  @@unique([shopId, eshopType, templateKey])
  @@index([shopId, eshopType])
  @@index([eshopType])
  @@index([language])
  @@index([category])
}

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

**Key Characteristics:**
- ✅ **Tenant scoping** (shopId) - **ALIGNED**
- ✅ **eShop type categorization** (eshopType) - **ALIGNED**
- ✅ **Template key** (templateKey) - **ALIGNED**
- ✅ **Retail-aligned fields** (name, text, language, goal, suggestedMetrics) - **ALIGNED**
- ⚠️ **Language field exists** but must be enforced as 'en' only (English-only requirement)
- Uses both `title`/`content` (backward compatibility) and `name`/`text` (Retail-aligned)

### B) Shopify Backend Endpoints (Current)

**Location:** `apps/shopify-api/routes/templates.js`, `apps/shopify-api/controllers/templates.js`

| Method | Path | Auth | Query Params | Request Body | Response Shape | Notes |
|--------|------|------|--------------|--------------|----------------|-------|
| GET | `/templates` | `resolveStore` (required) | `eshopType`, `category`, `search`, `language` (optional, forced to 'en'), `page`, `pageSize` | - | `{ items, total, page, pageSize, templates, pagination, categories }` | List templates (tenant-scoped). Language forced to 'en'. |
| GET | `/templates/:id` | `resolveStore` (required) | - | - | Template object | Get single template (tenant-scoped) |
| GET | `/templates/categories` | `resolveStore` (required) | - | - | `string[]` | Get unique categories (tenant-scoped) |
| POST | `/templates/ensure-defaults` | `resolveStore` (required) | `eshopType` (required) | - | `{ created, updated, repaired, skipped, total }` | Ensure default templates (idempotent, repairs existing) |
| POST | `/templates/:id/track` | `resolveStore` (required) | - | - | `{ success: true }` | Track template usage (tenant-scoped) |

**Key Behaviors:**
- ✅ Templates are **tenant-scoped** (`shopId` required)
- ✅ Templates are **eShop type-scoped** (`eshopType` required or derived from shop settings)
- ⚠️ **Language:** Currently accepts `language` parameter but must be enforced as 'en' only
- ✅ Pagination supports both `page`/`pageSize` (Retail-aligned) and `offset`/`limit` (backward compatibility)
- ✅ Response shape includes Retail-aligned fields (`items`, `total`, `page`, `pageSize`)

### C) Shopify Service Layer (Current)

**Location:** `apps/shopify-api/services/templates.js`

**Functions:**
- `listTemplates(shopId, filters)` - List templates (tenant-scoped, eShop type-scoped)
- `getTemplateById(shopId, templateId)` - Get single template (tenant-scoped)
- `ensureDefaultTemplates(shopId, eshopType)` - **NEW:** Ensure defaults exist (idempotent, repairs existing)
- `trackTemplateUsage(storeId, templateId)` - Track usage (tenant-scoped)
- `getTemplateUsageStats(storeId)` - Get usage statistics (tenant-scoped)
- `getPopularTemplates(limit)` - Get popular templates (unchanged, may need tenant scoping)

**Key Behaviors:**
- ✅ Templates are queried with `shopId` AND `eshopType` (tenant + type scoping)
- ⚠️ **Language:** Currently filters by language but must enforce 'en' only
- ✅ `ensureDefaultTemplates` uses idempotent `upsert` with unique constraint

### D) Shopify Frontend (Current)

**Location:** `apps/astronote-web/app/app/shopify/templates/`

**Pages Found:**
- `templates/page.tsx` - Templates list page
- `templates/[id]/page.tsx` - Template detail page

**Current State:**
- ✅ Pages exist and appear to be in English
- ⚠️ **Language:** No language toggle found, but need to verify no Greek content
- ⚠️ **eShop Type:** No eShop type selector found (may need to be added)
- ⚠️ **Ensure-Defaults:** Not called on page load (may need to be added)

---

## Phase 3: Parity Matrix (English-Only Focus)

| Feature | Retail Behavior | Shopify Current | Gap | Fix Plan | Files Involved |
|---------|---------------|-----------------|-----|----------|----------------|
| **Tenant Scoping** | Templates are system-managed (ownerId = SYSTEM_USER_ID), not tenant-scoped | Templates are scoped by `shopId` AND `eshopType` | ✅ **ALIGNED** | - | - |
| **eShop Type Categorization** | Uses `category` enum (cafe, restaurant, etc.) | Uses `eshopType` enum (fashion, beauty, etc.) | ✅ **ALIGNED** (Shopify-specific) | - | - |
| **Template Identity** | Uses `(ownerId, name)` unique constraint | Uses `(shopId, eshopType, templateKey)` unique constraint | ✅ **ALIGNED** | - | - |
| **Field Names** | `name`, `text` | `name`, `text` (also `title`, `content` for backward compatibility) | ✅ **ALIGNED** | - | - |
| **Language Support** | `language` field (en/gr), required in GET /templates | `language` field exists, but **must be 'en' only** | ❌ **ENGLISH-ONLY ENFORCEMENT NEEDED** | Enforce language='en' in all queries/updates. Reject non-'en' language. Remove language toggle from UI. | `services/templates.js`, `controllers/templates.js`, frontend pages |
| **Goal & Suggested Metrics** | `goal`, `suggestedMetrics` fields | `goal`, `suggestedMetrics` fields exist | ✅ **ALIGNED** | - | - |
| **Default Templates Seeding** | `ensureTemplatesSeeded()` function (idempotent) | `ensureDefaultTemplates(shopId, eshopType)` function exists | ⚠️ **NEEDS REPAIR LOGIC** | Add repair logic: fix non-English language, missing fields, wrong eshopType | `services/templates.js` |
| **Response Shape** | `{ items, total, page, pageSize }` | `{ items, total, page, pageSize, templates, pagination }` | ✅ **ALIGNED** | - | - |
| **Pagination** | `page`/`pageSize` | `page`/`pageSize` (also `offset`/`limit` for backward compatibility) | ✅ **ALIGNED** | - | - |
| **Template Preview/Resolve** | Not found in Retail | Not implemented | ✅ **N/A** | Optional: Add preview endpoint if needed | - |
| **Variable Validation** | Rendering function supports `{{first_name}}`, `{{last_name}}` | No validation | ⚠️ **ENHANCEMENT** | Optional: Add variable validation in preview endpoint | - |
| **CRUD Operations** | Read-only for users (403 on POST/PUT/DELETE) | Read-only (no POST/PUT/DELETE endpoints) | ✅ **ALIGNED** | - | - |
| **Usage Tracking** | Not found in Retail | Implemented (tenant-scoped) | ✅ **SHOPIFY-SPECIFIC** | Keep usage tracking (Shopify enhancement) | - |
| **English-Only Enforcement** | N/A (Retail supports en/gr) | **REQUIRED:** Must enforce 'en' only | ❌ **CRITICAL GAP** | 1) Reject non-'en' language in create/update 2) Force language='en' in all queries 3) Repair existing templates with non-'en' language 4) Remove language toggle from UI 5) Verify default templates are English-only | `services/templates.js`, `controllers/templates.js`, frontend pages, `ensureDefaultTemplates` |

---

## Phase 4: English-Only Checklist

### Backend Enforcement

- [ ] **Language Field:** If `language` field exists, it MUST be 'en' only
- [ ] **Query Filtering:** All template queries MUST filter by `language = 'en'` or force to 'en'
- [ ] **Create/Update:** Reject requests with `language != 'en'` (if language field is provided)
- [ ] **Default Templates:** All default templates MUST have `language = 'en'`
- [ ] **Repair Logic:** `ensureDefaultTemplates` MUST repair templates with non-'en' language

### Frontend Enforcement

- [ ] **UI Language Toggle:** No language selector/toggle in Shopify templates pages
- [ ] **Greek Content:** No Greek strings in templates UI pages
- [ ] **API Client:** API client MUST force `language = 'en'` in all requests
- [ ] **Template Content:** All template text/content MUST be in English

### Default Templates

- [ ] **Seed Content:** All default templates in `DEFAULT_TEMPLATES` MUST be in English
- [ ] **Language Flag:** All default templates MUST have `language = 'en'` (if language field exists)
- [ ] **No Greek:** Scan default template strings for Greek characters (basic heuristic)

---

## Phase 5: Implementation Plan

### Step 1: English-Only Backend Enforcement

**Files:** `apps/shopify-api/services/templates.js`, `apps/shopify-api/controllers/templates.js`

**Changes:**
1. **`listTemplates`:** Force `language = 'en'` in where clause (ignore user-provided language parameter)
2. **`getTemplateById`:** Ensure template has `language = 'en'` (or filter by it)
3. **`ensureDefaultTemplates`:** 
   - Repair existing templates: if `language != 'en'`, update to 'en'
   - Create new templates: always set `language = 'en'`
   - Return `repaired` count for language repairs
4. **Controller:** Reject `language` parameter if provided and != 'en'

### Step 2: English-Only Frontend Enforcement

**Files:** `apps/astronote-web/app/app/shopify/templates/page.tsx`, `apps/astronote-web/src/lib/shopify/api/templates.ts`

**Changes:**
1. **API Client:** Force `language = 'en'` in all template API calls
2. **UI Pages:** Remove any language selector/toggle (if exists)
3. **Ensure-Defaults:** Call `ensure-defaults` on first page load (idempotent)

### Step 3: Repair Logic Enhancement

**File:** `apps/shopify-api/services/templates.js`

**Changes:**
1. **`ensureDefaultTemplates`:** 
   - Check existing templates for `language != 'en'` and repair
   - Check for missing required fields and repair
   - Check for wrong `eshopType` and repair
   - Return `repaired` count

### Step 4: Verification Script Update

**File:** `scripts/audit-shopify-templates.mjs`

**Changes:**
1. Add English-only checks:
   - No Greek characters in frontend pages
   - No language/i18n toggles in UI
   - Backend enforces 'en' only
   - Default templates are English-only

---

## Phase 6: Risk Assessment

### High Risk
- ⚠️ **Existing Templates:** If templates already exist with non-English language, they must be repaired
- ⚠️ **Language Field:** If language field exists, must be enforced as 'en' only (or removed if not needed)

### Medium Risk
- ✅ **Default Templates:** All default templates are already in English (verified)
- ✅ **Frontend:** Frontend pages appear to be in English (no Greek found)

### Low Risk
- ✅ **API Client:** Can easily force `language = 'en'` in requests
- ✅ **Repair Logic:** Can be added to `ensureDefaultTemplates` function

---

## Next Steps

1. ✅ **Audit Complete** - This report
2. ⏭️ **Implementation** - Enforce English-only in backend and frontend
3. ⏭️ **Verification** - Update audit script and run tests
4. ⏭️ **Final Report** - Document implemented changes

---

**Report Generated:** 2025-01-27  
**Status:** 🔍 **AUDIT COMPLETE - READY FOR ENGLISH-ONLY IMPLEMENTATION**
