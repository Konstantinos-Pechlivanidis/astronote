# Shopify Settings Endpoints Documentation

**Evidence:** `apps/shopify-api/routes/settings.js`

---

## 1. Get Settings

**Method:** `GET`  
**Path:** `/api/settings`  
**Evidence:** `apps/shopify-api/routes/settings.js:7`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Response:**
```typescript
{
  shopId: string;
  shopDomain: string;
  shopName: string;
  credits: number;
  createdAt: string;
  updatedAt: string;
  senderId: string; // senderNumber or senderName
  senderNumber?: string | null;
  senderName?: string | null;
  timezone: string; // Default: 'UTC'
  currency: string; // Default: 'EUR'
  recentTransactions?: Array<{
    id: string;
    creditsAdded: number;
    amount: number;
    currency: string;
    packageType: string;
    status: string;
    createdAt: string;
  }>;
  usageGuide?: {
    title: string;
    sections: Array<{
      title: string;
      content: string;
    }>;
  };
}
```

**Controller Evidence:** `apps/shopify-api/controllers/settings.js:11-100`

---

## 2. Get Account Info

**Method:** `GET`  
**Path:** `/api/settings/account`  
**Evidence:** `apps/shopify-api/routes/settings.js:8`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Response:**
```typescript
{
  shopId: string;
  shopDomain: string;
  shopName: string;
  credits: number;
  createdAt: string;
  updatedAt: string;
  settings: {
    senderId: string;
    timezone: string;
    currency: string;
  };
  usage: {
    totalContacts: number;
    totalCampaigns: number;
    totalAutomations: number;
    totalMessages: number;
  };
}
```

**Controller Evidence:** `apps/shopify-api/controllers/settings.js:169-250`

---

## 3. Update Settings

**Method:** `PUT`  
**Path:** `/api/settings`  
**Evidence:** `apps/shopify-api/routes/settings.js:10`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)
- `Content-Type: application/json`

**Request Body:**
```typescript
{
  senderId?: string; // E.164 phone or 3-11 alphanumeric
  senderNumber?: string; // Alternative to senderId
  senderName?: string; // Alternative to senderId
  timezone?: string; // Timezone string (e.g., 'UTC', 'Europe/Athens')
  currency?: string; // Currency code (e.g., 'EUR', 'USD')
}
```

**Response:**
```typescript
{
  senderId: string;
  senderNumber?: string | null;
  senderName?: string | null;
  timezone: string;
  currency: string;
  updatedAt: string;
}
```

**Controller Evidence:** `apps/shopify-api/controllers/settings.js:252-350`

**Validation:**
- `senderId` must be either:
  - E.164 format phone number: `^\+[1-9]\d{1,14}$`
  - OR 3-11 alphanumeric characters: `^[a-zA-Z0-9]{3,11}$`

---

## 4. Update Sender Number (Legacy)

**Method:** `PUT`  
**Path:** `/api/settings/sender`  
**Evidence:** `apps/shopify-api/routes/settings.js:9`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)
- `Content-Type: application/json`

**Request Body:**
```typescript
{
  senderNumber: string; // E.164 phone or 3-11 alphanumeric
}
```

**Response:**
```typescript
{
  senderNumber: string;
  updatedAt: string;
}
```

**Controller Evidence:** `apps/shopify-api/controllers/settings.js:105-164`

**Note:** This is a legacy endpoint kept for backward compatibility. Use `PUT /api/settings` instead.

---

## Type Definitions

### Settings
```typescript
interface Settings {
  shopId: string;
  shopDomain: string;
  shopName: string;
  credits: number;
  createdAt: string;
  updatedAt: string;
  senderId: string; // senderNumber or senderName
  senderNumber?: string | null;
  senderName?: string | null;
  timezone: string;
  currency: string;
  recentTransactions?: Transaction[];
  usageGuide?: UsageGuide;
}
```

### Account Info
```typescript
interface AccountInfo {
  shopId: string;
  shopDomain: string;
  shopName: string;
  credits: number;
  createdAt: string;
  updatedAt: string;
  settings: {
    senderId: string;
    timezone: string;
    currency: string;
  };
  usage: {
    totalContacts: number;
    totalCampaigns: number;
    totalAutomations: number;
    totalMessages: number;
  };
}
```

### Update Settings Request
```typescript
interface UpdateSettingsRequest {
  senderId?: string;
  senderNumber?: string;
  senderName?: string;
  timezone?: string;
  currency?: string;
}
```

---

## Notes

1. **Sender ID Format:**
   - Can be E.164 phone number: `+1234567890`
   - OR alphanumeric sender name: `3-11 characters` (e.g., "Astronote", "MyShop")
   - Frontend uses `senderId` which can be either format

2. **Timezone:**
   - Default: 'UTC'
   - Should be a valid IANA timezone string (e.g., 'Europe/Athens', 'America/New_York')

3. **Currency:**
   - Default: 'EUR'
   - Supported: 'EUR', 'USD' (check backend for full list)

4. **Settings Structure:**
   - Backend returns flat structure for easier frontend access
   - `senderId` is the primary field (can be phone or name)
   - `senderNumber` and `senderName` are separate fields for backward compatibility

5. **Account Info:**
   - Includes usage statistics (contacts, campaigns, automations, messages)
   - Includes shop information and settings

---

## Schema Evidence

**Validation:** `apps/shopify-api/controllers/settings.js` contains validation logic for sender ID format.

