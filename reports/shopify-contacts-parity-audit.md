# Shopify Contacts Parity Audit Report

**Date:** 2025-01-27  
**Reference:** Retail API (`apps/retail-api/apps/api`) - Source of Truth  
**Target:** Shopify API (`apps/shopify-api`) - Must Match Retail  
**Status:** 🔍 Audit Complete - Gaps Identified

---

## Executive Summary

This audit compares Shopify contacts implementation against the Retail contacts architecture (canonical reference). The audit identifies gaps in Prisma models, backend endpoints, response shapes, import flows, and frontend UI that must be addressed to achieve parity.

**Key Findings:**
- ⚠️ **Field naming mismatch:** Retail uses `phone` + `isSubscribed` + `smsConsentStatus`, Shopify uses `phoneE164` + `smsConsent` (enum)
- ⚠️ **Missing fields:** Shopify Contact model missing `isSubscribed`, `unsubscribeTokenHash`, `smsConsentStatus` (uses enum instead)
- ⚠️ **Import flow:** Retail uses Excel (.xlsx) file upload with queue, Shopify uses CSV JSON array
- ⚠️ **Response shape:** Retail returns `{ items, total, page, pageSize }`, Shopify returns `{ contacts, pagination }`
- ⚠️ **Phone normalization:** Retail uses `libphonenumber-js`, Shopify uses basic regex
- ⚠️ **Missing filters:** Shopify missing `listId` and `isSubscribed` filters
- ✅ **CRUD operations:** Both have create/update/delete
- ✅ **Search:** Both support search (`q` parameter)
- ✅ **Pagination:** Both support pagination

---

## Retail Canonical Contract (Source of Truth)

### Prisma Model (Retail)

```prisma
model Contact {
  id Int @id @default(autoincrement())
  ownerId Int
  phone String // E.164 format (e.g., +306984303406)
  email String? @db.VarChar(320)
  firstName String? @db.VarChar(120)
  lastName String? @db.VarChar(120)
  gender Gender? // enum: male, female, other, prefer_not_to_say
  birthday DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Consent fields
  smsConsentStatus String? @db.VarChar(40) // "opted_in", "opted_out", null
  smsConsentAt DateTime?
  smsConsentSource String? @db.VarChar(80)
  
  // Subscription state
  isSubscribed Boolean @default(true)
  unsubscribeTokenHash String? @db.VarChar(64)
  unsubscribedAt DateTime?
  
  @@unique([ownerId, phone]) // unique per owner
  @@index([unsubscribeTokenHash])
  @@index([isSubscribed])
  @@index([gender])
  @@index([birthday])
}
```

**Key Points:**
- Field name: `phone` (not `phoneE164`)
- Subscription: `isSubscribed` (boolean)
- Consent: `smsConsentStatus` (string, nullable)
- Unsubscribe: `unsubscribeTokenHash` for secure unsubscribe links
- Unique constraint: `[ownerId, phone]`

### Backend Endpoints (Retail)

#### GET `/api/contacts`
- **Auth:** Required (`requireAuth`)
- **Query Params:**
  - `page` (default: 1)
  - `pageSize` (default: 20, max: 100)
  - `q` (search term - searches phone, email, firstName, lastName)
  - `listId` (filter by list membership)
  - `isSubscribed` (filter: 'true' | 'false')
- **Response:**
```json
{
  "items": [
    {
      "id": 1,
      "phone": "+306912345678",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "gender": "male",
      "birthday": "1990-01-01T00:00:00Z",
      "isSubscribed": true,
      "smsConsentStatus": "opted_in",
      "smsConsentAt": "2025-01-01T00:00:00Z",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

#### POST `/api/contacts`
- **Auth:** Required (`requireAuth`)
- **Body:**
```json
{
  "phone": "+306912345678",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "gender": "male",
  "birthday": "1990-01-01"
}
```
- **Validation:**
  - Phone: Required, normalized to E.164 using `libphonenumber-js`
  - Email: Optional, validated format
  - Gender: Optional, normalized to enum
  - Birthday: Optional, must be in past
- **Response:** `201` with created contact
- **Error Codes:**
  - `400 VALIDATION_ERROR` - Missing phone
  - `400 INVALID_PHONE` - Invalid phone format
  - `400 INVALID_EMAIL` - Invalid email format
  - `400 INVALID_GENDER` - Invalid gender value
  - `400 INVALID_BIRTHDAY` - Invalid birthday

#### PUT `/api/contacts/:id`
- **Auth:** Required (`requireAuth`)
- **Body:** Same as POST (all fields optional)
- **Validation:** Same as POST
- **Response:** Updated contact
- **Error Codes:** Same as POST + `404 RESOURCE_NOT_FOUND`

#### DELETE `/api/contacts/:id`
- **Auth:** Required (`requireAuth`)
- **Response:**
```json
{
  "ok": true
}
```
- **Error Codes:**
  - `400 VALIDATION_ERROR` - Invalid ID
  - `404 RESOURCE_NOT_FOUND` - Contact not found

#### POST `/api/contacts/import`
- **Auth:** Required (`requireAuth`)
- **Content-Type:** `multipart/form-data`
- **Body:** `file` (Excel .xlsx file, max 10MB)
- **Response:**
```json
{
  "jobId": "job_123",
  "status": "pending",
  "message": "Import job created successfully"
}
```
- **Process:**
  - Uploads Excel file
  - Creates import job in queue
  - Returns job ID for status polling
  - Uses `contactImportQueue` (BullMQ)
  - Always skips duplicates (`skipDuplicates: true`)

#### GET `/api/contacts/import/:jobId`
- **Auth:** Required (`requireAuth`)
- **Response:**
```json
{
  "jobId": "job_123",
  "status": "completed",
  "progress": {
    "processed": 100,
    "total": 100
  },
  "results": {
    "created": 95,
    "skipped": 5,
    "errors": []
  }
}
```

#### GET `/api/contacts/import/template`
- **Auth:** Required (`requireAuth`)
- **Response:** Excel file download (`.xlsx`)

### Phone Normalization (Retail)

**Library:** `libphonenumber-js`

**Function:** `normalizePhoneToE164(phone, defaultCountry = 'GR')`
- Uses `parsePhoneNumber` for validation
- Returns E.164 format (e.g., `+306984303406`)
- Handles various input formats
- Returns `null` if invalid

**Usage:**
```javascript
const { normalizePhoneToE164 } = require('../lib/phone');
const normalizedPhone = normalizePhoneToE164(phone);
if (!normalizedPhone) {
  return res.status(400).json({
    message: 'Invalid phone number format...',
    code: 'INVALID_PHONE',
  });
}
```

### Import Service (Retail)

**File:** `apps/retail-api/apps/api/src/services/contactImport.service.js`

**Features:**
- Parses Excel (.xlsx) files using `XLSX` library
- Case-insensitive column matching
- E.164 phone normalization
- Duplicate detection (by phone per owner)
- Error reporting per row
- Progress tracking via queue

**Column Mapping:**
- `firstname` / `first_name` → `firstName`
- `lastname` / `last_name` → `lastName`
- `phone` → `phone` (normalized to E.164)
- `email` → `email`
- `gender` → `gender` (normalized)
- `birthday` / `birthdate` / `dateofbirth` → `birthday`
- `subscribed` / `issubscribed` → `isSubscribed`

### Frontend UI (Retail)

**File:** `apps/astronote-web/app/app/retail/contacts/page.tsx`

**Features:**
- List view with search (`q` parameter)
- List filter dropdown (`listId`)
- Pagination controls
- Create/Edit contact modal
- Delete confirmation
- Empty states
- Loading states
- Error handling

**Components:**
- `ContactsToolbar` - Search + filters
- `ContactsTable` - Data table
- `ContactFormModal` - Create/edit form
- `ContactsSkeleton` - Loading state
- `EmptyState` - Empty state

**API Client:**
- Uses `contactsApi` from `@/src/lib/retail/api/contacts`
- React Query hooks: `useContacts`, `useCreateContact`, `useUpdateContact`, `useDeleteContact`

---

## Shopify Current Implementation

### Prisma Model (Shopify)

```prisma
model Contact {
  id String @id @default(cuid())
  shopId String
  firstName String?
  lastName String?
  phoneE164 String // ⚠️ Different field name
  email String?
  gender String? // "male", "female", "other" (not enum)
  birthDate DateTime? // ⚠️ Different field name (birthday vs birthDate)
  tags String[] @default([])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  smsConsent SmsConsent @default(unknown) // ⚠️ Enum, not string
  hasPurchased Boolean @default(false)
  firstPurchaseAt DateTime?
  lastOrderAt DateTime?
  
  // ❌ MISSING: isSubscribed (boolean)
  // ❌ MISSING: unsubscribeTokenHash
  // ❌ MISSING: smsConsentStatus (string)
  // ❌ MISSING: smsConsentAt, smsConsentSource
  
  @@unique([shopId, phoneE164])
  @@unique([shopId, email])
  @@index([shopId, phoneE164])
  @@index([shopId, smsConsent])
  @@index([shopId, birthDate])
}
```

**Gaps:**
- Field name: `phoneE164` vs Retail's `phone`
- Field name: `birthDate` vs Retail's `birthday`
- Missing: `isSubscribed` boolean field
- Missing: `unsubscribeTokenHash` for secure unsubscribe
- Missing: `smsConsentStatus` string field (uses enum instead)
- Missing: `smsConsentAt`, `smsConsentSource` fields
- Gender: String vs Retail's enum (acceptable but inconsistent)

### Backend Endpoints (Shopify)

#### GET `/api/contacts`
- **Auth:** ✅ Required (`resolveStore`, `requireStore`)
- **Query Params:**
  - `page`, `pageSize` ✅
  - `q` (search) ✅
  - `gender`, `smsConsent`, `hasBirthDate` ✅
  - `filter` (legacy: 'all', 'male', 'female', 'consented', 'nonconsented') ✅
  - ❌ **MISSING:** `listId` filter
  - ❌ **MISSING:** `isSubscribed` filter
- **Response:**
```json
{
  "contacts": [...], // ⚠️ Different key name
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```
- **Status:** ⚠️ **NEEDS RESPONSE SHAPE ALIGNMENT + MISSING FILTERS**

#### POST `/api/contacts`
- **Auth:** ✅ Required (`resolveStore`, `requireStore`)
- **Body:**
```json
{
  "phoneE164": "+306912345678", // ⚠️ Different field name
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "gender": "male",
  "birthDate": "1990-01-01", // ⚠️ Different field name
  "smsConsent": "opted_in" // ⚠️ Enum, not string
}
```
- **Validation:**
  - Phone: ✅ Required, but uses basic regex (not `libphonenumber-js`)
  - Email: ✅ Validated
  - Gender: ✅ Validated
  - Birthday: ✅ Validated (as `birthDate`)
- **Response:** ✅ Created contact
- **Status:** ⚠️ **NEEDS PHONE NORMALIZATION LIBRARY + FIELD NAME ALIGNMENT**

#### PUT `/api/contacts/:id`
- **Auth:** ✅ Required (`resolveStore`, `requireStore`)
- **Body:** Same as POST (all fields optional)
- **Validation:** ✅ Same as POST
- **Response:** ✅ Updated contact
- **Status:** ⚠️ **NEEDS FIELD NAME ALIGNMENT**

#### DELETE `/api/contacts/:id`
- **Auth:** ✅ Required (`resolveStore`, `requireStore`)
- **Response:** ✅ `{ ok: true }` equivalent
- **Status:** ✅ **PARITY**

#### POST `/api/contacts/import`
- **Auth:** ✅ Required (`resolveStore`, `requireStore`)
- **Content-Type:** `application/json`
- **Body:**
```json
{
  "contacts": [
    {
      "phoneE164": "+306912345678",
      "firstName": "John",
      // ... other fields
    }
  ]
}
```
- **Response:**
```json
{
  "total": 100,
  "created": 95,
  "updated": 0,
  "skipped": 5,
  "errors": []
}
```
- **Status:** ❌ **DIFFERENT FROM RETAIL** (JSON array vs Excel file upload)

#### GET `/api/contacts/stats`
- **Auth:** ✅ Required (`resolveStore`, `requireStore`)
- **Response:** Contact statistics
- **Status:** ✅ **PARITY** (Retail doesn't have this, but it's a nice addition)

### Phone Normalization (Shopify)

**Current:** Basic regex validation
```javascript
function isValidPhoneE164(phone) {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

function normalizePhone(phone) {
  let normalized = phone.replace(/[^\d+]/g, '');
  if (!normalized.startsWith('+')) {
    normalized = `+${normalized}`;
  }
  return normalized;
}
```

**Gap:** Does not use `libphonenumber-js` for proper international phone validation and normalization.

### Import Service (Shopify)

**Current:** Accepts JSON array of contacts (parsed client-side from CSV)

**Gap:** Retail uses Excel file upload with server-side parsing and queue processing.

### Frontend UI (Shopify)

**File:** `apps/astronote-web/app/app/shopify/contacts/page.tsx`

**Features:**
- ✅ List view with search
- ✅ Pagination
- ✅ Create/Edit (via mutations)
- ✅ Delete
- ✅ Empty states
- ✅ Loading states
- ❌ **MISSING:** List filter (`listId`)
- ❌ **MISSING:** `isSubscribed` filter
- ❌ **MISSING:** Import UI (Excel upload)

**API Client:**
- Uses `contactsApi` from `@/src/lib/shopify/api/contacts`
- React Query hooks exist

---

## Parity Matrix

| Feature | Retail Behavior | Shopify Current | Gap | Fix Plan | Files Involved |
|---------|---------------|----------------|-----|----------|----------------|
| **Prisma Model** |
| Phone field name | `phone` | `phoneE164` | Field name mismatch | Align to `phone` OR keep `phoneE164` but ensure consistency | `prisma/schema.prisma`, all backend code |
| Birthday field name | `birthday` | `birthDate` | Field name mismatch | Align to `birthday` OR keep `birthDate` but ensure consistency | `prisma/schema.prisma`, all backend code |
| isSubscribed field | ✅ Boolean | ❌ Missing | Missing field | Add `isSubscribed Boolean @default(true)` | `prisma/schema.prisma`, migration |
| unsubscribeTokenHash | ✅ String? | ❌ Missing | Missing field | Add `unsubscribeTokenHash String? @db.VarChar(64)` | `prisma/schema.prisma`, migration |
| smsConsentStatus | ✅ String? | ❌ Missing (uses enum) | Missing string field | Add `smsConsentStatus String? @db.VarChar(40)` | `prisma/schema.prisma`, migration |
| smsConsentAt/Source | ✅ DateTime? + String? | ❌ Missing | Missing fields | Add both fields | `prisma/schema.prisma`, migration |
| **Backend Endpoints** |
| List response shape | `{ items, total, page, pageSize }` | `{ contacts, pagination }` | Different shape | Align to Retail shape | `controllers/contacts-enhanced.js`, `services/contacts.js` |
| listId filter | ✅ Supported | ❌ Missing | Missing filter | Add `listId` query param support | `services/contacts.js`, `controllers/contacts-enhanced.js` |
| isSubscribed filter | ✅ Supported | ❌ Missing | Missing filter | Add `isSubscribed` query param support | `services/contacts.js`, `controllers/contacts-enhanced.js` |
| Phone normalization | ✅ `libphonenumber-js` | ⚠️ Basic regex | Less robust | Add `libphonenumber-js` dependency and use | `services/contacts.js`, new `lib/phone.js` |
| Create/Update field names | `phone`, `birthday` | `phoneE164`, `birthDate` | Field name mismatch | Align field names OR add mapping layer | `controllers/contacts-enhanced.js`, `services/contacts.js` |
| Import flow | ✅ Excel file upload + queue | ⚠️ JSON array | Different approach | Implement Excel upload + queue (or keep JSON if acceptable) | `controllers/contacts-enhanced.js`, new import service |
| Import template | ✅ Excel template download | ❌ Missing | Missing feature | Add template download endpoint | `controllers/contacts-enhanced.js` |
| Import status | ✅ GET `/import/:jobId` | ❌ Missing | Missing endpoint | Add import status endpoint | `controllers/contacts-enhanced.js`, `routes/contacts-enhanced.js` |
| **Frontend UI** |
| List filter (listId) | ✅ Dropdown | ❌ Missing | Missing filter | Add list filter dropdown | `contacts/page.tsx` |
| isSubscribed filter | ✅ Toggle/filter | ❌ Missing | Missing filter | Add subscribed filter | `contacts/page.tsx` |
| Import UI | ✅ Excel upload | ❌ Missing | Missing feature | Add import UI with file upload | `contacts/page.tsx` |
| Response shape handling | Expects `items` | Expects `contacts` | Mismatch | Update frontend to handle Retail shape OR align backend | `contacts/page.tsx`, hooks |

---

## Detailed Gap Analysis

### 1. Field Naming Mismatch (CRITICAL)

**Retail:**
- `phone` (E.164 format)
- `birthday` (DateTime)
- `isSubscribed` (boolean)
- `smsConsentStatus` (string)

**Shopify:**
- `phoneE164` (E.164 format)
- `birthDate` (DateTime)
- Missing `isSubscribed`
- `smsConsent` (enum, not string)

**Impact:** High - Frontend/backend mismatches, potential runtime errors

**Fix Options:**
1. **Option A (Preferred):** Align Shopify to Retail field names
   - Rename `phoneE164` → `phone`
   - Rename `birthDate` → `birthday`
   - Add `isSubscribed` field
   - Add `smsConsentStatus` string field (keep enum for backward compat)
   - Migration required

2. **Option B:** Keep Shopify field names, add mapping layer
   - Add transformation layer in controllers
   - More complex, less maintainable

**Recommendation:** Option A (align to Retail)

### 2. Missing isSubscribed Field (CRITICAL)

**Retail:** Uses `isSubscribed` boolean to track subscription state

**Shopify:** Uses `smsConsent` enum only

**Impact:** High - Cannot filter by subscription status, unsubscribe flow incomplete

**Fix Required:**
- Add `isSubscribed Boolean @default(true)` to Contact model
- Add index: `@@index([shopId, isSubscribed])`
- Update create/update logic to set `isSubscribed` based on `smsConsent`
- Add `isSubscribed` filter to list endpoint

### 3. Missing Unsubscribe Token Hash (IMPORTANT)

**Retail:** Generates `unsubscribeTokenHash` for secure unsubscribe links

**Shopify:** Missing this field

**Impact:** Medium - Unsubscribe links may not be as secure

**Fix Required:**
- Add `unsubscribeTokenHash String? @db.VarChar(64)` to Contact model
- Add index: `@@index([unsubscribeTokenHash])`
- Generate hash on contact creation
- Use for unsubscribe token verification

### 4. Phone Normalization Library (IMPORTANT)

**Retail:** Uses `libphonenumber-js` for robust phone validation

**Shopify:** Uses basic regex

**Impact:** Medium - May accept invalid phone numbers, less robust

**Fix Required:**
- Add `libphonenumber-js` dependency
- Create `lib/phone.js` with `normalizePhoneToE164` function
- Update `services/contacts.js` to use library

### 5. Import Flow Mismatch (IMPORTANT)

**Retail:**
- Excel (.xlsx) file upload
- Server-side parsing
- Queue-based processing
- Job status polling

**Shopify:**
- JSON array (client-side CSV parsing)
- Direct processing
- No job queue
- No status polling

**Impact:** Medium - Different UX, may be acceptable if JSON approach works

**Fix Options:**
1. **Option A:** Implement Excel upload + queue (full parity)
2. **Option B:** Keep JSON but add template download + status endpoint

**Recommendation:** Option A for full parity

### 6. Response Shape Mismatch (MINOR)

**Retail:** `{ items, total, page, pageSize }`

**Shopify:** `{ contacts, pagination: { page, pageSize, total, ... } }`

**Impact:** Low - Frontend can adapt, but alignment is cleaner

**Fix Required:**
- Update `listContacts` service to return Retail shape
- Update frontend to expect Retail shape

### 7. Missing Filters (MINOR)

**Retail:** Supports `listId` and `isSubscribed` filters

**Shopify:** Missing both

**Impact:** Medium - Less filtering capability

**Fix Required:**
- Add `listId` query param support (if lists exist in Shopify)
- Add `isSubscribed` query param support
- Update `listContacts` service

---

## Implementation Priority

### Phase 1: Critical (Must Fix)
1. ✅ Add `isSubscribed` field to Contact model
2. ✅ Align field names (`phoneE164` → `phone`, `birthDate` → `birthday`) OR add mapping
3. ✅ Add phone normalization library (`libphonenumber-js`)
4. ✅ Add `unsubscribeTokenHash` field

### Phase 2: Important (Should Fix)
5. ✅ Add `smsConsentStatus` string field (in addition to enum)
6. ✅ Add `listId` and `isSubscribed` filters
7. ✅ Align response shape to Retail
8. ✅ Implement Excel import + queue (or enhance JSON import)

### Phase 3: Nice to Have (Can Fix)
9. ✅ Add import template download
10. ✅ Add import status endpoint
11. ✅ Frontend UI enhancements (list filter, import UI)

---

## Files to Modify

### Prisma Schema & Migrations
- `apps/shopify-api/prisma/schema.prisma` - Add missing fields, align field names
- `apps/shopify-api/prisma/migrations/XXXXX_align_contacts_to_retail/migration.sql` - NEW

### Backend Services
- `apps/shopify-api/services/contacts.js` - Phone normalization, field mapping, filters
- `apps/shopify-api/lib/phone.js` - NEW (phone normalization utilities)
- `apps/shopify-api/services/contactImport.service.js` - NEW (Excel import service)
- `apps/shopify-api/queues/contactImport.queue.js` - NEW (import queue)

### Backend Controllers
- `apps/shopify-api/controllers/contacts-enhanced.js` - Response shape, field mapping, import endpoints

### Backend Routes
- `apps/shopify-api/routes/contacts-enhanced.js` - Add import status route

### Frontend
- `apps/astronote-web/app/app/shopify/contacts/page.tsx` - Add filters, import UI
- `apps/astronote-web/src/lib/shopify/api/contacts.ts` - Update types for Retail shape

---

## Next Steps

1. ✅ Create audit report (this document)
2. ⏳ Implement Phase 1 fixes (critical fields + phone normalization)
3. ⏳ Implement Phase 2 fixes (filters + response shape + import)
4. ⏳ Implement Phase 3 fixes (UI enhancements)
5. ⏳ Create verification script
6. ⏳ Create final parity report

---

**Report Status:** ✅ Complete  
**Ready for Implementation:** Yes

