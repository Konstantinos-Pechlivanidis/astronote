# Shopify Settings Deep Audit Report

**Date:** 2025-01-27  
**Reference:** Retail API (`apps/retail-api/apps/api`) - Source of Truth for Patterns  
**Target:** Shopify API (`apps/shopify-api`) + Frontend (`apps/astronote-web/app/app/shopify`)  
**Status:** 🔍 **AUDIT IN PROGRESS**

---

## Executive Summary

This audit performs a deep analysis of the Shopify settings implementation to ensure correctness, alignment with Retail architecture patterns, and completeness. The audit covers tenant scoping, settings storage, endpoint contracts, frontend UI, and public route separation.

**Key Findings:**
- ✅ Shopify API has settings endpoints (`GET /api/settings`, `PUT /api/settings`) with tenant scoping
- ✅ `ShopSettings` model exists with fields: `senderNumber`, `senderName`, `timezone`, `currency`, `baseUrl`
- ✅ Settings page exists in frontend with tabs (General, SMS, Integrations, Account)
- ⚠️ **Gap:** `baseUrl` field exists but may not be exposed in settings UI
- ⚠️ **Gap:** Settings response shape may not match Retail patterns exactly
- ✅ Public routes (unsubscribe, short links) are correctly separated and do not require tenant headers

---

## Phase 1: Deep Shopify API Analysis

### A) Tenant Resolution

**Location:** `apps/shopify-api/middlewares/store-resolution.js`

**Current Implementation:**
- **Priority Order:**
  1. `X-Shopify-Shop-Domain` header (preferred)
  2. `Authorization: Bearer <JWT>` token (extracts shopId from token)
  3. `shop` query parameter (last resort, only for redirect/callback routes)
- **Validation:** Strict shop domain validation (must end with `.myshopify.com`)
- **Error Handling:** Returns `INVALID_SHOP_DOMAIN` with `X-Astronote-Tenant-Required: true` header
- **Middleware:** `resolveStore` and `requireStore` applied to protected routes

**Settings Routes:**
- **Location:** `apps/shopify-api/app.js` line 213
- **Registration:** `app.use('/settings', resolveStore, requireStore, settingsRoutes);`
- ✅ **Tenant scoping:** Settings routes require tenant context (correct)

### B) Settings Storage Model

**Location:** `apps/shopify-api/prisma/schema.prisma`

**Current Model:**
```prisma
model ShopSettings {
  id           String   @id @default(cuid())
  shopId       String   @unique
  senderNumber String?  // Custom sender number for SMS
  senderName   String?  // Custom sender name
  timezone     String   @default("UTC")
  currency     String   @default("EUR")
  baseUrl      String?  // Per-tenant base URL override for dynamic URL generation
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  shop         Shop     @relation(fields: [shopId], references: [id], onDelete: Cascade)
}
```

**Key Characteristics:**
- ✅ One settings record per shop (`@@unique([shopId])`)
- ✅ Fields: `senderNumber`, `senderName`, `timezone`, `currency`, `baseUrl`
- ✅ Defaults: `timezone = "UTC"`, `currency = "EUR"`
- ✅ Cascade delete when shop is deleted

**Shop Model Fields (Related):**
- `shopDomain` - Shopify store domain
- `shopName` - Store name (optional)
- `currency` - Default currency (synced with `ShopSettings.currency`)

### C) Settings Endpoints

**Location:** `apps/shopify-api/routes/settings.js`, `apps/shopify-api/controllers/settings.js`

**Current Endpoints:**

| Method | Path | Auth | Query Params | Request Body | Response Shape | Notes |
|--------|------|------|--------------|--------------|----------------|-------|
| GET | `/api/settings` | `resolveStore`, `requireStore` | - | - | `{ success: true, data: { shopId, shopDomain, shopName, credits, senderId, senderNumber, senderName, timezone, currency, recentTransactions, usageGuide } }` | Returns flat structure |
| PUT | `/api/settings` | `resolveStore`, `requireStore` | - | `{ senderId?, timezone?, currency? }` | `{ success: true, data: { senderId, senderNumber, senderName, timezone, currency, updatedAt }, message: "Settings updated successfully" }` | Updates settings |
| GET | `/api/settings/account` | `resolveStore`, `requireStore` | - | - | `{ success: true, data: { shopDomain, shopName, credits, account: {...}, usage: {...} } }` | Account info + usage stats |
| PUT | `/api/settings/sender` | `resolveStore`, `requireStore` | - | `{ senderNumber }` | `{ success: true, data: { senderNumber, updatedAt }, message: "Sender number updated successfully" }` | Legacy endpoint (backward compatibility) |

**Response Shape (GET /api/settings):**
```json
{
  "success": true,
  "data": {
    "shopId": "...",
    "shopDomain": "example.myshopify.com",
    "shopName": "Example Store",
    "credits": 1000,
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z",
    "senderId": "+1234567890",  // senderNumber || senderName || ''
    "senderNumber": "+1234567890",
    "senderName": null,
    "timezone": "UTC",
    "currency": "EUR",
    "recentTransactions": [...],
    "usageGuide": {
      "title": "How Astronote Works",
      "sections": [...]
    }
  }
}
```

**Key Behaviors:**
- ✅ Tenant scoping: All endpoints require `resolveStore` + `requireStore` middleware
- ✅ Validation: Sender ID validated (E.164 or 3-11 alphanumeric)
- ✅ Currency validation: Only EUR or USD allowed
- ✅ Currency sync: Updates `ShopSettings.currency` AND `Shop.currency` for billing compatibility
- ⚠️ **Gap:** `baseUrl` field exists in schema but is NOT returned in GET response
- ⚠️ **Gap:** `baseUrl` field is NOT updatable via PUT endpoint

### D) Settings Service Layer

**Location:** `apps/shopify-api/services/settings.js`

**Functions:**
- `getSettings(storeId)` - Get shop settings with recent transactions
- `updateSettings(storeId, settingsData)` - Update settings (validates, upserts)
- `getUsageGuide()` - Returns usage guide content
- `getSenderConfig(storeId)` - Get sender configuration (used by campaigns)
- `validateSenderConfig(storeId)` - Validate sender configuration

**Key Behaviors:**
- ✅ Tenant scoping: All functions require `storeId` parameter
- ✅ Validation: Sender number/name length validation (max 11 chars)
- ✅ Currency validation: Only EUR/USD allowed
- ✅ Currency sync: Updates both `ShopSettings.currency` and `Shop.currency`
- ✅ Upsert logic: Creates settings if missing, updates if exists
- ⚠️ **Gap:** `baseUrl` field is not handled in `updateSettings` function

### E) Public Routes Separation

**Location:** `apps/shopify-api/routes/unsubscribe.js`, `apps/shopify-api/routes/shortLinks.js`

**Public Routes (No Tenant Headers Required):**
- `POST /api/unsubscribe/:token` - Unsubscribe endpoint (token-based, no tenant headers)
- `GET /api/r/:token` - Short link resolver (token-based, no tenant headers)

**Verification:**
- ✅ Public routes do NOT use `resolveStore` or `requireStore` middleware
- ✅ Public routes use token-based authentication (HMAC verification)
- ✅ Settings endpoints are protected and require tenant headers
- ✅ No route collisions between settings and public routes

### F) Base URL Usage

**Location:** `apps/shopify-api/utils/baseUrl.js`

**Current Implementation:**
- **Priority Order:**
  1. Per-tenant override (`ShopSettings.baseUrl`) - if shopId provided
  2. Proxy headers (`X-Forwarded-Proto`, `X-Forwarded-Host`)
  3. `PUBLIC_BASE_URL` env var
  4. `HOST` env var (fallback)
- **Usage:** Used for generating unsubscribe links, short links, frontend URLs
- **Validation:** URL validation to prevent header injection

**Gap:** `baseUrl` is stored in `ShopSettings` but:
- ❌ Not returned in GET /api/settings response
- ❌ Not updatable via PUT /api/settings endpoint
- ❌ Not displayed in frontend Settings UI

---

## Phase 2: Retail Settings Reference

### A) Retail Settings Endpoints

**Location:** `apps/retail-api/apps/api/src/routes/auth.js`, `apps/retail-api/apps/api/src/routes/branding.js`

**Retail Settings Scope:**

1. **User Settings (`PUT /api/user`):**
   - `company` - Company name (max 160 chars)
   - `senderName` - SMS sender name (max 11 chars, alphanumeric)
   - `timezone` - IANA timezone (e.g., "Europe/Athens")

2. **Branding Settings (`GET/PUT /api/branding`):**
   - `storeName`, `storeDisplayName`
   - `logoUrl`, `primaryColor`, `accentColor`
   - `headline`, `subheadline`, `benefits`
   - `privacyUrl`, `termsUrl`
   - Used by public join pages

**Key Patterns:**
- ✅ Tenant scoping: All endpoints require `requireAuth` (user-based, not shop-based)
- ✅ Validation: Field length limits, format validation (hex colors, URLs)
- ✅ Response shape: Direct JSON response (no `success` wrapper in some endpoints)
- ✅ Error codes: `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`

### B) Retail Public Base URL

**Location:** `apps/retail-api/apps/api/src/routes/publicJoin.routes.js`

**Usage:**
- `publicBase()` function returns public base URL for join pages
- Used in public route responses
- Not stored per-tenant (env-based)

---

## Phase 3: Shopify Settings Scope Definition

### Required Settings (Based on Audit)

**Must Include:**

1. **Shop Branding (Read-only or Editable):**
   - `shopName` - Store name (from Shop model, read-only or editable)
   - `shopDomain` - Store domain (from Shop model, read-only)

2. **SMS Configuration:**
   - `senderId` - Sender ID (senderNumber OR senderName, unified field)
   - `senderNumber` - Phone number (E.164 format, optional)
   - `senderName` - Alphanumeric name (3-11 chars, optional)

3. **Regional Settings:**
   - `timezone` - IANA timezone (default: "UTC")
   - `currency` - Currency (EUR/USD, default: "EUR")

4. **Public Links Configuration:**
   - `baseUrl` - Per-tenant base URL override (optional, for unsubscribe/short links)
   - Display: Show current `baseUrl` value (from DB or env fallback)
   - Edit: Allow updating `baseUrl` (with validation)

5. **Account Information (Read-only):**
   - `credits` - Current credits balance
   - `createdAt` - Account creation date
   - Usage statistics (contacts, campaigns, automations, messages)

### Settings Storage Strategy

**Option 1: Store on ShopSettings Model (Preferred)**
- ✅ Already exists
- ✅ One record per shop (unique constraint)
- ✅ Fields already defined: `senderNumber`, `senderName`, `timezone`, `currency`, `baseUrl`
- ⚠️ **Gap:** `baseUrl` not exposed in API/frontend

**Option 2: Add to Shop Model**
- ❌ Not preferred (Shop model is for core shop data, not settings)
- ❌ Would require migration

**Decision:** Use `ShopSettings` model (Option 1), expose `baseUrl` in API and frontend.

---

## Phase 4: Current State Overview

### Backend (shopify-api)

**✅ Strengths:**
- Settings endpoints exist and are tenant-scoped
- Validation is robust (sender ID, currency)
- Currency sync between ShopSettings and Shop model
- Public routes correctly separated

**⚠️ Gaps:**
- `baseUrl` field exists but is not exposed in GET/PUT endpoints
- Settings response shape may not match Retail patterns exactly
- No explicit `baseUrl` validation in update endpoint

### Frontend (astronote-web/app/app/shopify)

**✅ Strengths:**
- Settings page exists with professional UI (tabs, cards, forms)
- Uses centralized Shopify API client
- Error handling and loading states
- English-only UI (no Greek found)

**⚠️ Gaps:**
- `baseUrl` field not displayed in UI
- Settings page may not show all available settings
- May need alignment with Retail UI patterns

### Prisma

**✅ Strengths:**
- `ShopSettings` model exists with required fields
- Unique constraint prevents duplicates
- Cascade delete when shop is deleted

**⚠️ Gaps:**
- `baseUrl` field exists but is not used in API/frontend

---

## Phase 5: Proposed Final Architecture

### Endpoint Contracts

#### GET /api/settings

**Response Shape (Aligned with Retail patterns):**
```json
{
  "success": true,
  "data": {
    "shopId": "...",
    "shopDomain": "example.myshopify.com",
    "shopName": "Example Store",
    "credits": 1000,
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z",
    "settings": {
      "senderId": "+1234567890",
      "senderNumber": "+1234567890",
      "senderName": null,
      "timezone": "UTC",
      "currency": "EUR",
      "baseUrl": "https://example.com"  // NEW: Expose baseUrl
    },
    "recentTransactions": [...],
    "usageGuide": {...}
  }
}
```

#### PUT /api/settings

**Request Body:**
```json
{
  "senderId": "+1234567890",  // Optional: senderNumber OR senderName
  "timezone": "Europe/Athens",  // Optional: IANA timezone
  "currency": "EUR",  // Optional: EUR or USD
  "baseUrl": "https://example.com"  // NEW: Optional, validated URL
}
```

**Response Shape:**
```json
{
  "success": true,
  "data": {
    "senderId": "+1234567890",
    "senderNumber": "+1234567890",
    "senderName": null,
    "timezone": "Europe/Athens",
    "currency": "EUR",
    "baseUrl": "https://example.com",  // NEW: Return updated baseUrl
    "updatedAt": "2025-01-27T00:00:00Z"
  },
  "message": "Settings updated successfully"
}
```

### Prisma Model (No Changes Needed)

**Current Model is Sufficient:**
```prisma
model ShopSettings {
  id           String   @id @default(cuid())
  shopId       String   @unique
  senderNumber String?
  senderName   String?
  timezone     String   @default("UTC")
  currency     String   @default("EUR")
  baseUrl      String?  // ✅ Already exists, just needs to be exposed
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  shop         Shop     @relation(...)
}
```

### UI Structure Plan

**Settings Page Sections:**

1. **General Tab:**
   - Sender Configuration (senderId field)
   - Regional Settings (timezone, currency)
   - Store Information (read-only: shopName, shopDomain)
   - **NEW:** Public Links Configuration (baseUrl field, read-only display of env fallback)

2. **SMS Settings Tab:**
   - Current Sender ID display
   - Sender configuration info

3. **Integrations Tab:**
   - Shopify Connection (read-only)
   - Webhook Configuration (read-only)

4. **Account Tab:**
   - Store Details (read-only)
   - Usage Statistics (read-only)

---

## Phase 6: Risks and Mitigations

### High Risk

1. **Tenant Scoping:**
   - **Risk:** Settings endpoints may not properly scope by shopId
   - **Mitigation:** ✅ Already scoped (verified: routes use `resolveStore` + `requireStore`)

2. **Public Routes:**
   - **Risk:** Settings changes may break public routes (unsubscribe/short links)
   - **Mitigation:** ✅ Public routes are correctly separated (no tenant headers required)

3. **Base URL Validation:**
   - **Risk:** Invalid `baseUrl` may break link generation
   - **Mitigation:** Add URL validation in update endpoint (reuse `baseUrl.js` validation logic)

### Medium Risk

1. **Response Shape Mismatch:**
   - **Risk:** Frontend expects different shape than backend returns
   - **Mitigation:** Align response shape with Retail patterns, ensure frontend handles both shapes

2. **Currency Sync:**
   - **Risk:** Currency mismatch between ShopSettings and Shop model
   - **Mitigation:** ✅ Already handled (updateSettings syncs both)

### Low Risk

1. **English-Only UI:**
   - **Risk:** Settings page may have Greek strings or i18n toggle
   - **Mitigation:** ✅ Verified: No Greek found, no i18n toggle

2. **Client-Side Crashes:**
   - **Risk:** Settings page may crash on API errors
   - **Mitigation:** Add error boundaries and defensive parsing

---

## Phase 7: Implementation Checklist

### Step 1: Backend API Enhancement
- [ ] Expose `baseUrl` in GET /api/settings response
- [ ] Add `baseUrl` to PUT /api/settings request/response
- [ ] Add `baseUrl` validation in `updateSettings` service (URL format, prevent injection)
- [ ] Ensure `baseUrl` is returned in same format as used by `getBaseUrl()` utility

### Step 2: Frontend UI Enhancement
- [ ] Add `baseUrl` field display in General tab (read-only or editable)
- [ ] Show current `baseUrl` value (from settings or env fallback)
- [ ] Add `baseUrl` input field with validation
- [ ] Ensure English-only UI (verify no Greek strings)

### Step 3: Alignment with Retail Patterns
- [ ] Ensure response shape matches Retail patterns (nested `settings` object)
- [ ] Ensure error codes match Retail (`VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`)
- [ ] Ensure validation messages are clear and actionable

### Step 4: Verification
- [ ] Create audit script (`scripts/audit-shopify-settings.mjs`)
- [ ] Add contract tests (supertest) for GET/PUT endpoints
- [ ] Verify tenant scoping (test without tenant headers)
- [ ] Verify public routes remain unaffected

---

## Phase 8: Endpoint Inventory Table

| Feature | Retail Implementation | Shopify Current | Gap | Fix Plan | Files Involved |
|---------|----------------------|-----------------|-----|----------|----------------|
| **GET Settings** | `GET /api/user` (user settings) | `GET /api/settings` (shop settings) | ⚠️ Response shape may differ | Align response shape, expose `baseUrl` | `controllers/settings.js`, `services/settings.js` |
| **PUT Settings** | `PUT /api/user` (validates, updates) | `PUT /api/settings` (validates, updates) | ⚠️ `baseUrl` not updatable | Add `baseUrl` to update endpoint | `controllers/settings.js`, `services/settings.js` |
| **Sender Configuration** | `senderName` (max 11 chars) | `senderId` (senderNumber OR senderName) | ✅ Aligned (Shopify has both) | - | - |
| **Timezone** | `timezone` (IANA format) | `timezone` (IANA format) | ✅ Aligned | - | - |
| **Currency** | Not in user settings (billing handles) | `currency` (EUR/USD) | ✅ Shopify-specific (needed for billing) | - | - |
| **Base URL** | Not in user settings (env-based) | `baseUrl` (per-tenant override) | ❌ **GAP:** Not exposed in API/frontend | Expose in GET/PUT endpoints, add to UI | `controllers/settings.js`, `services/settings.js`, `settings/page.tsx` |
| **Branding** | `GET/PUT /api/branding` (storeName, logo, colors) | Not in settings (Shop model has shopName) | ⚠️ Shopify may not need full branding | Consider adding shopName edit if needed | - |
| **Account Info** | Not in settings endpoint | `GET /api/settings/account` (usage stats) | ✅ Shopify-specific enhancement | - | - |
| **Tenant Scoping** | `requireAuth` (user-based) | `resolveStore` + `requireStore` (shop-based) | ✅ Aligned (Shopify uses shop-based) | - | - |
| **Public Routes** | Public routes don't require auth | Public routes don't require tenant headers | ✅ Aligned | - | - |

---

## Next Steps

1. ✅ **Audit Complete** - This report
2. ⏭️ **Implementation** - Expose `baseUrl`, align response shapes, enhance UI
3. ⏭️ **Verification** - Create audit script and contract tests
4. ⏭️ **Final Report** - Document implemented changes

---

**Report Generated:** 2025-01-27  
**Status:** 🔍 **AUDIT COMPLETE - READY FOR IMPLEMENTATION**

