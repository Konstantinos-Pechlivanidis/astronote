# Shopify Dashboard Endpoints

Confirmed dashboard KPI endpoints from `apps/shopify-api`.

---

## 1. Main Dashboard Endpoint

**Method:** `GET`  
**Path:** `/api/dashboard`  
**Evidence:** `apps/shopify-api/routes/dashboard.js:4`  
**Controller:** `apps/shopify-api/controllers/dashboard.js:10-27`  
**Service:** `apps/shopify-api/services/dashboard.js:14-114`

### Required Headers
- `Authorization: Bearer <jwt_token>` (required)
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback, but JWT contains shopDomain)

**Evidence:** `apps/shopify-api/middlewares/store-resolution.js:29-127` - Store resolution uses JWT token primarily

### Query Params
None

### Response Shape

**Success (200):**
```json
{
  "success": true,
  "data": {
    "credits": 100,
    "totalCampaigns": 5,
    "totalContacts": 150,
    "totalMessagesSent": 500,
    "activeAutomations": 2,
    "reports": {
      "last7Days": {
        "sent": 100,
        "delivered": 95,
        "failed": 5,
        "unsubscribes": 2
      },
      "topCampaigns": [...],
      "deliveryRateTrend": [...],
      "creditsUsage": [...]
    }
  },
  "message": "Dashboard data retrieved successfully"
}
```

**Error (401/500):**
```json
{
  "success": false,
  "error": "ErrorCode",
  "message": "Error message"
}
```

### Response Fields

- `credits` (number) - Credit balance (fallback, use billing/balance for source of truth)
- `totalCampaigns` (number) - Total number of campaigns
- `totalContacts` (number) - Total number of contacts
- `totalMessagesSent` (number) - Total messages sent (all time)
- `activeAutomations` (number) - Number of active automations
- `reports` (object) - Embedded reports data (last 7 days)

**Note:** Credits should be fetched from `/api/billing/balance` as source of truth (see below).

---

## 2. Billing Balance Endpoint (Source of Truth for Credits)

**Method:** `GET`  
**Path:** `/api/billing/balance`  
**Evidence:** `apps/shopify-api/routes/billing.js:24`  
**Controller:** `apps/shopify-api/controllers/billing.js` (getBalance function)

### Required Headers
- `Authorization: Bearer <jwt_token>` (required)
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

### Query Params
None

### Response Shape

**Success (200):**
```json
{
  "success": true,
  "data": {
    "credits": 100,
    "currency": "EUR"
  },
  "message": "Balance retrieved successfully"
}
```

**Evidence:** Reference frontend uses this as source of truth:
- `apps/astronote-shopify-frontend/src/pages/app/Dashboard.jsx:28-36`
- `apps/astronote-shopify-frontend/src/services/queries.js:293-303`

---

## 3. Dashboard Overview Endpoint (Optional)

**Method:** `GET`  
**Path:** `/api/dashboard/overview`  
**Evidence:** `apps/shopify-api/routes/dashboard.js:5`  
**Service:** `apps/shopify-api/services/dashboard.js:318-417`

### Response Shape
Extended dashboard data with SMS stats, contact stats, wallet, recent messages, recent transactions.

**Note:** Not needed for Phase 2 (KPIs only). Can be used in future phases.

---

## 4. Dashboard Quick Stats Endpoint (Optional)

**Method:** `GET`  
**Path:** `/api/dashboard/quick-stats`  
**Evidence:** `apps/shopify-api/routes/dashboard.js:6`  
**Service:** `apps/shopify-api/services/dashboard.js:424-475`

### Response Shape
```json
{
  "success": true,
  "data": {
    "smsSent": 500,
    "walletBalance": 100
  }
}
```

**Note:** Not needed for Phase 2. Main dashboard endpoint provides all required KPIs.

---

## Implementation Notes

### For Phase 2 Dashboard KPIs

**Required Endpoints:**
1. `GET /api/dashboard` - Main dashboard data (totalCampaigns, totalContacts, totalMessagesSent)
2. `GET /api/billing/balance` - Credits (source of truth)

**KPI Cards to Display:**
1. **SMS Credits** - From `/api/billing/balance` (credits)
2. **Total Campaigns** - From `/api/dashboard` (totalCampaigns)
3. **Total Contacts** - From `/api/dashboard` (totalContacts)
4. **Messages Sent** - From `/api/dashboard` (totalMessagesSent)

**Optional (if backend provides):**
5. **Active Automations** - From `/api/dashboard` (activeAutomations)
6. Additional KPIs from reports data

### Data Normalization

The backend returns data in this format:
```json
{
  "success": true,
  "data": { ... }
}
```

The axios interceptor in `apps/astronote-web/src/lib/shopify/api/axios.ts` already extracts the `data` field, so the hook will receive:
```typescript
{
  credits: number,
  totalCampaigns: number,
  totalContacts: number,
  totalMessagesSent: number,
  activeAutomations?: number,
  reports?: object
}
```

---

## Summary

**Primary Endpoint for Phase 2:**
- `GET /api/dashboard` - Provides 4 main KPIs (campaigns, contacts, messages, automations)
- `GET /api/billing/balance` - Provides credits (source of truth)

**All endpoints require:**
- `Authorization: Bearer <jwt_token>` header
- Store context resolved via JWT token (contains storeId and shopDomain)

**Response format:**
- Backend wraps in `{ success: true, data: {...} }`
- Axios interceptor extracts `data` automatically

