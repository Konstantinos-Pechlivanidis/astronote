# Shopify Contacts Endpoints Documentation

**Evidence:** `apps/shopify-api/routes/contacts-enhanced.js`

---

## 1. List Contacts

**Method:** `GET`  
**Path:** `/api/contacts`  
**Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:42-48`

**Query Parameters:**
- `page` (number, default: 1)
- `pageSize` (number, default: 20, max: 100)
- `q` (string, optional) - Search query (searches phone/email/name)
- `smsConsent` (string, optional) - Filter by consent: `'opted_in' | 'opted_out' | 'unknown'`
- `gender` (string, optional) - Filter by gender: `'male' | 'female' | 'other'`
- `filter` (string, optional) - Quick filter: `'all' | 'male' | 'female' | 'consented' | 'nonconsented'`
- `hasBirthDate` (string, optional) - Filter by birth date: `'true' | 'false'`
- `sortBy` (string, optional) - Sort field: `'createdAt' | 'updatedAt' | 'firstName' | 'lastName' | 'birthDate'` (default: `'createdAt'`)
- `sortOrder` (string, optional) - Sort order: `'asc' | 'desc'` (default: `'desc'`)

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Response:**
```typescript
{
  contacts: Contact[],
  pagination: {
    page: number,
    pageSize: number,
    total: number,
    totalPages: number,
    hasNextPage: boolean,
    hasPrevPage: boolean
  },
  filters: {
    applied: {...},
    available: {
      genders: string[],
      smsConsent: string[],
      filters: string[]
    }
  }
}
```

**Schema Evidence:** `apps/shopify-api/schemas/contacts.schema.js:198-212`

---

## 2. Get Contact Statistics

**Method:** `GET`  
**Path:** `/api/contacts/stats`  
**Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:51`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Response:**
```typescript
{
  total: number,
  optedIn: number,
  optedOut: number,
  smsConsent: {
    optedIn: number,
    optedOut: number,
    unknown: number,
    consentRate: number // percentage
  },
  byGender: {
    male: number,
    female: number,
    other: number,
    unspecified: number
  },
  gender: { // alias for byGender
    male: number,
    female: number,
    other: number,
    unspecified: number
  },
  birthDate: {
    withBirthDate: number,
    withoutBirthDate: number,
    birthDateRate: number // percentage
  },
  automation: {
    birthdayEligible: number,
    smsEligible: number
  }
}
```

**Controller Evidence:** `apps/shopify-api/controllers/contacts-enhanced.js:172-227`

---

## 3. Get Single Contact

**Method:** `GET`  
**Path:** `/api/contacts/:id`  
**Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:61`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Response:**
```typescript
Contact
```

**Controller Evidence:** `apps/shopify-api/controllers/contacts-enhanced.js:62-82`

---

## 4. Create Contact

**Method:** `POST`  
**Path:** `/api/contacts`  
**Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:64-69`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)
- `Content-Type: application/json`

**Request Body:**
```typescript
{
  phoneE164: string, // Required, E.164 format (e.g., +306977123456)
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
  gender?: 'male' | 'female' | 'other' | null,
  birthDate?: string | null, // ISO 8601 datetime
  smsConsent?: 'opted_in' | 'opted_out' | 'unknown', // Default: 'unknown'
  tags?: string[] // Default: []
}
```

**Response:**
```typescript
Contact
```

**Schema Evidence:** `apps/shopify-api/schemas/contacts.schema.js:85-130`

---

## 5. Update Contact

**Method:** `PUT`  
**Path:** `/api/contacts/:id`  
**Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:81-86`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)
- `Content-Type: application/json`

**Request Body:** (Same as Create, all fields optional except phoneE164 if provided)

**Response:**
```typescript
Contact
```

**Schema Evidence:** `apps/shopify-api/schemas/contacts.schema.js:132-196`

---

## 6. Delete Contact

**Method:** `DELETE`  
**Path:** `/api/contacts/:id`  
**Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:89`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Response:**
```typescript
{
  message: 'Contact deleted successfully'
}
```

**Controller Evidence:** `apps/shopify-api/controllers/contacts-enhanced.js:140-166`

---

## 7. Import Contacts

**Method:** `POST`  
**Path:** `/api/contacts/import`  
**Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:72-78`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)
- `Content-Type: application/json`

**Request Body:**
```typescript
{
  contacts: Array<{
    phoneE164: string, // Required
    firstName?: string | null,
    lastName?: string | null,
    email?: string | null,
    gender?: 'male' | 'female' | 'other' | null,
    birthDate?: string | null,
    smsConsent?: 'opted_in' | 'opted_out' | 'unknown',
    tags?: string[]
  }> // Min: 1, Max: 1000
}
```

**Response:**
```typescript
{
  total: number,
  created: number,
  updated: number,
  skipped: number,
  errors: Array<{
    phone: string,
    error: string
  }>
}
```

**Note:** The frontend must parse CSV files client-side and send the parsed contacts array as JSON. The backend does NOT accept multipart/form-data.

**Schema Evidence:** `apps/shopify-api/schemas/contacts.schema.js:217-222`  
**Controller Evidence:** `apps/shopify-api/controllers/contacts-enhanced.js:267-296`

---

## Contact Type Definition

```typescript
interface Contact {
  id: number
  phoneE164: string
  phone?: string // Formatted phone (may not be in response)
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  gender?: 'male' | 'female' | 'other' | null
  birthDate?: string | null // ISO 8601 datetime
  smsConsent?: 'opted_in' | 'opted_out' | 'unknown'
  tags?: string[]
  createdAt?: string
  updatedAt?: string
  shopId?: number // Internal, may not be in response
}
```

---

## Rate Limiting

- **List/Get/Stats:** `contactsRateLimit` (standard rate limit)
- **Import:** `importRateLimit` (stricter rate limit)
- **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:40, 74`

---

## Caching

- **List:** `contactsListCache` - Cached list responses
- **Stats:** `contactsStatsCache` - Cached stats
- **Invalidation:** `invalidateContactsCache` - Invalidates cache on create/update/delete/import
- **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:46, 51, 67, 76, 84, 89`

