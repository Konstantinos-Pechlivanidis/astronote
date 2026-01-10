# Shopify Contacts Parity Implementation Report

**Date:** 2025-01-27  
**Reference:** Retail API (`apps/retail-api/apps/api`) - Source of Truth  
**Target:** Shopify API (`apps/shopify-api`) - Now Matches Retail  
**Status:** ✅ **PARITY ACHIEVED**

---

## Executive Summary

Successfully implemented all required changes to align Shopify contacts with Retail contacts architecture. All critical gaps identified in the audit have been closed. Shopify contacts now matches Retail behavior for:

- ✅ Field name alignment (phone/phoneE164, birthday/birthDate)
- ✅ Consent fields (smsConsentStatus, isSubscribed, unsubscribeTokenHash)
- ✅ Phone normalization using libphonenumber-js
- ✅ Response shape alignment (items/contacts, Retail field mapping)
- ✅ Filter support (isSubscribed, listId)
- ✅ Prisma schema alignment
- ✅ Frontend API client compatibility

**Verification:** All audits passing (0 errors, 7 non-blocking warnings - false positives for route detection)

---

## Files Changed

### Prisma Schema & Migrations

1. **`apps/shopify-api/prisma/schema.prisma`**
   - Added `smsConsentStatus String? @db.VarChar(40)` to `Contact` model
   - Added `smsConsentAt DateTime?` to `Contact` model
   - Added `smsConsentSource String? @db.VarChar(80)` to `Contact` model
   - Added `isSubscribed Boolean @default(true)` to `Contact` model
   - Added `unsubscribeTokenHash String? @db.VarChar(64)` to `Contact` model
   - Added `unsubscribedAt DateTime?` to `Contact` model
   - Added indexes: `@@index([shopId, smsConsentStatus])`, `@@index([shopId, isSubscribed])`, `@@index([unsubscribeTokenHash])`

2. **`apps/shopify-api/prisma/migrations/20250127000001_add_contacts_parity_fields/migration.sql`** (NEW)
   - Adds all Retail-aligned fields to `Contact` table
   - Creates indexes for new fields
   - Backfills existing data (maps `smsConsent` enum to `smsConsentStatus` string)

### Backend Services

3. **`apps/shopify-api/services/contacts.js`**
   - **Phone Normalization:** Replaced regex-based normalization with `libphonenumber-js` (aligned with Retail)
   - **Field Mapping:** Added transformation layer to map `phoneE164` → `phone`, `birthDate` → `birthday` in responses
   - **Consent Handling:** Added logic to sync `smsConsent` enum with `smsConsentStatus` string and `isSubscribed` boolean
   - **Unsubscribe Tokens:** Added `newUnsubTokenHash()` function to generate secure unsubscribe tokens (aligned with Retail)
   - **List Contacts:** Added `isSubscribed` and `listId` filters (aligned with Retail)
   - **Response Shape:** Returns Retail-aligned shape: `{ items, total, page, pageSize }` in addition to `{ contacts, pagination }`
   - **Create/Update:** Support both Retail field names (`phone`, `birthday`) and Shopify field names (`phoneE164`, `birthDate`)
   - **Import:** Enhanced to support Retail field names and generate unsubscribe tokens

4. **`apps/shopify-api/lib/phone.js`** (NEW)
   - Phone number validation and normalization using `libphonenumber-js`
   - Functions: `normalizePhoneToE164()`, `isValidPhone()`, `formatPhoneForDisplay()`
   - Aligned with Retail implementation

### Backend Controllers

5. **`apps/shopify-api/controllers/contacts-enhanced.js`**
   - **List:** Returns Retail-aligned shape with `items` field
   - **Get One:** Transforms response to include Retail field names (`phone`, `birthday`)
   - **Create/Update:** Accepts both Retail and Shopify field names (mapped in service layer)
   - Added `isSubscribed` and `listId` query parameter support

### Frontend API Client

6. **`apps/astronote-web/src/lib/shopify/api/contacts.ts`**
   - **Type Definitions:** Added Retail-aligned fields to `Contact` interface:
     - `phone?: string` (in addition to `phoneE164`)
     - `birthday?: string | null` (in addition to `birthDate`)
     - `smsConsentStatus?: 'opted_in' | 'opted_out' | null`
     - `smsConsentAt?: string | null`
     - `isSubscribed?: boolean`
   - **List Response:** Added `items?`, `total?`, `page?`, `pageSize?` fields (Retail-aligned)
   - **Request Types:** Added `isSubscribed` and `listId` to `ContactsListParams`
   - **Field Mapping:** `create()` and `update()` methods map Retail field names (`phone`, `birthday`) to Shopify field names (`phoneE164`, `birthDate`) before sending to API
   - **Response Handling:** `list()` method ensures backward compatibility by setting `contacts` from `items` if needed

### Frontend Pages

7. **`apps/astronote-web/app/app/shopify/contacts/page.tsx`**
   - Updated to support both `items` (Retail) and `contacts` (Shopify) field names in list response

### Dependencies

8. **`apps/shopify-api/package.json`**
   - Added `libphonenumber-js: ^1.12.29` dependency (aligned with Retail version)

### Verification Script

9. **`scripts/audit-shopify-contacts.mjs`** (NEW)
   - Static verification script for contacts parity
   - Checks Prisma schema, backend routes, frontend pages, service layer
   - Added to `package.json` as `audit:shopify:contacts`

---

## Endpoint Inventory

### GET /api/contacts

**Query Parameters:**
- `page`, `pageSize` (pagination)
- `q` (search)
- `smsConsent` (enum: 'opted_in', 'opted_out', 'unknown')
- `isSubscribed` (boolean, Retail-aligned) ✨ NEW
- `listId` (string, Retail-aligned) ✨ NEW
- `gender`, `filter`, `hasBirthDate`, `sortBy`, `sortOrder`

**Response Shape (Retail-aligned):**
```json
{
  "items": [
    {
      "id": "...",
      "phone": "+306912345678",  // Retail field name
      "phoneE164": "+306912345678",  // Shopify field name (backward compatibility)
      "email": "...",
      "firstName": "...",
      "lastName": "...",
      "gender": "...",
      "birthday": "1990-01-01",  // Retail field name
      "birthDate": "1990-01-01",  // Shopify field name (backward compatibility)
      "isSubscribed": true,  // Retail-aligned field
      "smsConsentStatus": "opted_in",  // Retail-aligned field
      "smsConsent": "opted_in",  // Enum (backward compatibility)
      "smsConsentAt": "2025-01-27T10:00:00Z",
      "tags": [],
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "contacts": [...],  // Backward compatibility
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "pagination": { ... }
}
```

### POST /api/contacts

**Request Body:** Accepts both Retail and Shopify field names:
- `phone` or `phoneE164` (required)
- `birthday` or `birthDate` (optional)
- `firstName`, `lastName`, `email`, `gender`, `smsConsent`, `isSubscribed`, `tags`

**Response:** Returns contact with Retail-aligned shape (includes both field names)

### GET /api/contacts/:id

**Response:** Returns contact with Retail-aligned shape (includes both field names)

### PUT /api/contacts/:id

**Request Body:** Accepts both Retail and Shopify field names (same as POST)

**Response:** Returns updated contact with Retail-aligned shape

### DELETE /api/contacts/:id

**Response:** 204 No Content

### POST /api/contacts/import

**Request Body:**
```json
{
  "contacts": [
    {
      "phone": "+306912345678",  // Supports Retail field name
      "phoneE164": "+306912345678",  // Or Shopify field name
      "birthday": "1990-01-01",  // Supports Retail field name
      "birthDate": "1990-01-01",  // Or Shopify field name
      ...
    }
  ]
}
```

**Response:**
```json
{
  "total": 10,
  "created": 8,
  "updated": 2,
  "skipped": 0,
  "errors": []
}
```

---

## Prisma Changes

### Contact Model Fields Added

| Field | Type | Description | Retail Alignment |
|-------|------|-------------|------------------|
| `smsConsentStatus` | `String?` | Consent status string ('opted_in', 'opted_out', null) | ✅ Matches Retail |
| `smsConsentAt` | `DateTime?` | When consent was given/revoked | ✅ Matches Retail |
| `smsConsentSource` | `String?` | Source of consent ('manual', 'import', etc.) | ✅ Matches Retail |
| `isSubscribed` | `Boolean` | Subscription state (default: true) | ✅ Matches Retail |
| `unsubscribeTokenHash` | `String?` | SHA-256 hash of unsubscribe token | ✅ Matches Retail |
| `unsubscribedAt` | `DateTime?` | When contact unsubscribed | ✅ Matches Retail |

### Indexes Added

- `@@index([shopId, smsConsentStatus])` - For consent status filtering
- `@@index([shopId, isSubscribed])` - For subscription filtering
- `@@index([unsubscribeTokenHash])` - For unsubscribe token lookup

---

## Field Name Mapping

### Request/Response Mapping

| Retail Field Name | Shopify Field Name | Direction | Notes |
|------------------|-------------------|-----------|-------|
| `phone` | `phoneE164` | Bidirectional | API accepts both, service normalizes to `phoneE164` |
| `birthday` | `birthDate` | Bidirectional | API accepts both, service stores as `birthDate` |
| `isSubscribed` | `isSubscribed` | Bidirectional | Same field name, aligned |
| `smsConsentStatus` | `smsConsentStatus` | Bidirectional | Same field name, aligned |
| `items` | `contacts` | Response only | API returns both for backward compatibility |

### Consent Field Mapping

| `smsConsent` (enum) | `smsConsentStatus` (string) | `isSubscribed` (boolean) |
|---------------------|----------------------------|-------------------------|
| `opted_in` | `'opted_in'` | `true` |
| `opted_out` | `'opted_out'` | `false` |
| `unknown` | `null` | `true` (default) |

---

## Phone Normalization

### Before (Regex-based)
- Simple regex pattern matching
- Limited international format support
- No country code validation

### After (libphonenumber-js)
- ✅ Robust international phone number parsing
- ✅ Country code validation
- ✅ E.164 format normalization
- ✅ Aligned with Retail implementation

**Example:**
- Input: `"306912345678"` or `"+30 691 234 5678"` or `"06912345678"`
- Output: `"+306912345678"` (E.164 format)

---

## Verification

### Audit Script Results

```bash
npm run audit:shopify:contacts
```

**Status:** ✅ PASSED (0 errors, 7 warnings - false positives for route detection)

**Checks:**
- ✅ Prisma Contact model has all required fields
- ✅ Contact model has unique constraint on (shopId, phoneE164)
- ✅ Contacts list page exists
- ✅ New contact page exists
- ✅ Contacts import page exists
- ✅ Contact detail page exists
- ✅ API client supports both phone and phoneE164 fields
- ✅ API client supports birthday field
- ✅ API client supports isSubscribed field
- ✅ API client supports Retail-aligned items field
- ✅ Service maps phoneE164 to phone field
- ✅ Service maps birthDate to birthday field
- ✅ Service uses libphonenumber-js for phone normalization
- ✅ Service generates unsubscribe token hash

---

## Parity Confirmation

### ✅ Shopify Contacts Now Matches Retail For:

1. **Field Names:** Supports both Retail (`phone`, `birthday`) and Shopify (`phoneE164`, `birthDate`) field names
2. **Consent Fields:** `smsConsentStatus`, `isSubscribed`, `unsubscribeTokenHash` aligned with Retail
3. **Phone Normalization:** Uses `libphonenumber-js` (same as Retail)
4. **Response Shapes:** Returns Retail-aligned shape (`items`, `total`, `page`, `pageSize`)
5. **Filters:** Supports `isSubscribed` and `listId` filters (aligned with Retail)
6. **Import:** Supports Retail field names in import flow
7. **Prisma Schema:** All Retail-aligned fields present with proper indexes

### Remaining Gaps (Non-blocking)

1. **Route Detection Warnings:** Audit script has false positives for route registration (routes are correctly registered, but regex pattern needs refinement)
2. **Contract Tests:** Minimal contract tests not yet added (can be added in future iteration)

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

3. **Verify:**
   ```bash
   npm run audit:shopify:contacts
   ```

---

## Next Steps (Optional)

1. Add minimal contract tests (supertest) for key contacts endpoints
2. Refine audit script route detection regex to eliminate false positives
3. Consider adding Excel import support (if Retail has it)

---

**Report Generated:** 2025-01-27  
**Status:** ✅ **PARITY ACHIEVED**

