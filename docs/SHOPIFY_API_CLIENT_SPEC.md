# Shopify API Client Spec

Frontend data layer structure for Shopify UI in `apps/astronote-web`.

**Target Directory:** `apps/astronote-web/src/lib/shopify/api/`

---

## File Structure

```
apps/astronote-web/src/lib/shopify/api/
├── axios.ts              # Axios instance with interceptors
├── dashboard.ts          # Dashboard endpoints
├── campaigns.ts          # Campaign endpoints
├── contacts.ts           # Contact endpoints
├── templates.ts          # Template endpoints
├── automations.ts        # Automation endpoints
├── billing.ts            # Billing endpoints
├── settings.ts           # Settings endpoints
├── reports.ts            # Reports endpoints
└── tracking.ts           # Tracking endpoints (if exists)
```

---

## A. Axios Instance

**File:** `apps/astronote-web/src/lib/shopify/api/axios.ts`

**Purpose:** Configured axios instance with auth interceptors.

**Implementation:**
```typescript
import axios from 'axios';
import { SHOPIFY_API_BASE_URL } from '@/lib/shopify/config';

const shopifyApi = axios.create({
  baseURL: SHOPIFY_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds
});

// Request interceptor - add auth token and shop domain
shopifyApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('shopify_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  const storeInfo = localStorage.getItem('shopify_store');
  if (storeInfo) {
    try {
      const store = JSON.parse(storeInfo);
      if (store.shopDomain) {
        config.headers['X-Shopify-Shop-Domain'] = store.shopDomain;
      }
    } catch (e) {
      // Silently fail
    }
  }
  
  return config;
});

// Response interceptor - handle errors
shopifyApi.interceptors.response.use(
  (response) => {
    // Backend returns { success: true, data: {...} }
    // Extract data for easier access
    if (response.data?.success && response.data.data !== undefined) {
      return response.data.data;
    }
    return response.data;
  },
  async (error) => {
    // Handle 401 - token expired
    if (error.response?.status === 401) {
      localStorage.removeItem('shopify_token');
      localStorage.removeItem('shopify_store');
      if (typeof window !== 'undefined') {
        window.location.href = '/shopify/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

export default shopifyApi;
```

**Evidence:** `apps/astronote-shopify-frontend/src/services/api.js:1-275`

---

## B. Dashboard API

**File:** `apps/astronote-web/src/lib/shopify/api/dashboard.ts`

### Endpoints

#### 1. GET Dashboard
- **Path:** `GET /api/dashboard`
- **Evidence:** `apps/shopify-api/routes/dashboard.js:4`
- **Query Params:** None
- **Response:**
```typescript
{
  totalCampaigns: number;
  totalContacts: number;
  totalMessagesSent: number;
  credits?: number; // Fallback, use billing/balance for source of truth
}
```

#### 2. GET Dashboard Overview
- **Path:** `GET /api/dashboard/overview`
- **Evidence:** `apps/shopify-api/routes/dashboard.js:5`
- **Query Params:** None
- **Response:** Extended dashboard data

#### 3. GET Dashboard Quick Stats
- **Path:** `GET /api/dashboard/quick-stats`
- **Evidence:** `apps/shopify-api/routes/dashboard.js:6`
- **Query Params:** None
- **Response:** Quick stats summary

### Implementation

```typescript
import shopifyApi from './axios';

export const dashboardApi = {
  getDashboard: () => shopifyApi.get('/dashboard'),
  getOverview: () => shopifyApi.get('/dashboard/overview'),
  getQuickStats: () => shopifyApi.get('/dashboard/quick-stats'),
};
```

**React Query Keys:**
- `['shopify', 'dashboard']`
- `['shopify', 'dashboard', 'overview']`
- `['shopify', 'dashboard', 'quick-stats']`

**Evidence:** `apps/astronote-shopify-frontend/src/services/queries.js:477-519`

---

## C. Campaigns API

**File:** `apps/astronote-web/src/lib/shopify/api/campaigns.ts`

### Endpoints

#### 1. GET List Campaigns
- **Path:** `GET /api/campaigns`
- **Evidence:** `apps/shopify-api/routes/campaigns.js:26-31`
- **Query Params:**
  - `page` (number, default: 1)
  - `pageSize` (number, default: 20)
  - `status` (string, optional: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'paused')
  - `search` (string, optional)
- **Response:**
```typescript
{
  campaigns: Campaign[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
```

#### 2. GET Campaign Stats Summary
- **Path:** `GET /api/campaigns/stats/summary`
- **Evidence:** `apps/shopify-api/routes/campaigns.js:34`
- **Response:**
```typescript
{
  stats: {
    byStatus: {
      draft: number;
      scheduled: number;
      sending: number;
      completed: number;
      failed: number;
      paused: number;
    };
  };
}
```

#### 3. GET Single Campaign
- **Path:** `GET /api/campaigns/:id`
- **Evidence:** `apps/shopify-api/routes/campaigns.js:40`
- **Response:** `Campaign`

#### 4. POST Create Campaign
- **Path:** `POST /api/campaigns`
- **Evidence:** `apps/shopify-api/routes/campaigns.js:42-48`
- **Body:**
```typescript
{
  name: string;
  message: string;
  audience: string; // 'all' | segmentId
  scheduleType: 'immediate' | 'scheduled';
  scheduleAt?: string; // ISO string (UTC)
  discountId?: string | null;
  senderId?: string;
}
```
- **Response:** `Campaign`

#### 5. PUT Update Campaign
- **Path:** `PUT /api/campaigns/:id`
- **Evidence:** `apps/shopify-api/routes/campaigns.js:50-56`
- **Body:** Same as create
- **Response:** `Campaign`

#### 6. DELETE Campaign
- **Path:** `DELETE /api/campaigns/:id`
- **Evidence:** `apps/shopify-api/routes/campaigns.js:59`
- **Response:** `{ success: true }`

#### 7. POST Enqueue Campaign
- **Path:** `POST /api/campaigns/:id/enqueue`
- **Evidence:** `apps/shopify-api/routes/campaigns.js:64-70`
- **Headers:** `Idempotency-Key: <uuid>` (generate per click)
- **Response:** `{ success: true, message: string }`

#### 8. PUT Schedule Campaign
- **Path:** `PUT /api/campaigns/:id/schedule`
- **Evidence:** `apps/shopify-api/routes/campaigns.js:83-89`
- **Body:**
```typescript
{
  scheduleType: 'scheduled';
  scheduleAt: string; // ISO string (UTC)
}
```
- **Response:** `Campaign`

#### 9. POST Cancel Campaign
- **Path:** `POST /api/campaigns/:id/cancel`
- **Evidence:** `apps/shopify-api/routes/campaigns.js:91-96`
- **Response:** `{ success: true }`

#### 10. GET Campaign Metrics
- **Path:** `GET /api/campaigns/:id/metrics`
- **Evidence:** `apps/shopify-api/routes/campaigns.js:99`
- **Response:** Campaign metrics object

#### 11. GET Campaign Status
- **Path:** `GET /api/campaigns/:id/status`
- **Evidence:** `apps/shopify-api/routes/campaigns.js:102`
- **Response:**
```typescript
{
  status: string;
  queued: number;
  processed: number;
  sent: number;
  failed: number;
}
```

#### 12. GET Campaign Progress
- **Path:** `GET /api/campaigns/:id/progress`
- **Evidence:** `apps/shopify-api/routes/campaigns.js:108`
- **Response:**
```typescript
{
  sent: number;
  failed: number;
  pending: number;
  percentage: number;
}
```

#### 13. GET Campaign Preview
- **Path:** `GET /api/campaigns/:id/preview`
- **Evidence:** `apps/shopify-api/routes/campaigns.js:105`
- **Response:**
```typescript
{
  recipientCount: number;
  estimatedCost: number;
}
```

#### 14. GET Failed Recipients
- **Path:** `GET /api/campaigns/:id/failed-recipients`
- **Evidence:** `apps/shopify-api/routes/campaigns.js:111`
- **Response:** Array of failed recipient objects

#### 15. POST Retry Failed
- **Path:** `POST /api/campaigns/:id/retry-failed`
- **Evidence:** `apps/shopify-api/routes/campaigns.js:114`
- **Response:** `{ success: true }`

### Implementation

```typescript
import shopifyApi from './axios';
import { v4 as uuidv4 } from 'uuid';

export const campaignsApi = {
  list: (params?: { page?: number; pageSize?: number; status?: string; search?: string }) =>
    shopifyApi.get('/campaigns', { params }),
  
  getStats: () => shopifyApi.get('/campaigns/stats/summary'),
  
  getOne: (id: string) => shopifyApi.get(`/campaigns/${id}`),
  
  create: (data: CreateCampaignData) => shopifyApi.post('/campaigns', data),
  
  update: (id: string, data: UpdateCampaignData) =>
    shopifyApi.put(`/campaigns/${id}`, data),
  
  delete: (id: string) => shopifyApi.delete(`/campaigns/${id}`),
  
  enqueue: (id: string) =>
    shopifyApi.post(`/campaigns/${id}/enqueue`, {}, {
      headers: { 'Idempotency-Key': uuidv4() },
    }),
  
  schedule: (id: string, data: { scheduleType: 'scheduled'; scheduleAt: string }) =>
    shopifyApi.put(`/campaigns/${id}/schedule`, data),
  
  cancel: (id: string) => shopifyApi.post(`/campaigns/${id}/cancel`),
  
  getMetrics: (id: string) => shopifyApi.get(`/campaigns/${id}/metrics`),
  
  getStatus: (id: string) => shopifyApi.get(`/campaigns/${id}/status`),
  
  getProgress: (id: string) => shopifyApi.get(`/campaigns/${id}/progress`),
  
  getPreview: (id: string) => shopifyApi.get(`/campaigns/${id}/preview`),
  
  getFailedRecipients: (id: string) =>
    shopifyApi.get(`/campaigns/${id}/failed-recipients`),
  
  retryFailed: (id: string) => shopifyApi.post(`/campaigns/${id}/retry-failed`),
};
```

**React Query Keys:**
- `['shopify', 'campaigns', params]` - List
- `['shopify', 'campaigns', 'stats']` - Stats
- `['shopify', 'campaigns', id]` - Single
- `['shopify', 'campaigns', id, 'metrics']` - Metrics
- `['shopify', 'campaigns', id, 'status']` - Status
- `['shopify', 'campaigns', id, 'progress']` - Progress

**Mutation Invalidation:**
- Create/Update/Delete → Invalidate `['shopify', 'campaigns']`
- Enqueue/Schedule/Cancel → Invalidate `['shopify', 'campaigns', id]` and `['shopify', 'campaigns']`
- All mutations → Invalidate `['shopify', 'dashboard']`

**Evidence:** `apps/astronote-shopify-frontend/src/services/queries.js:8-233`

---

## D. Contacts API

**File:** `apps/astronote-web/src/lib/shopify/api/contacts.ts`

### Endpoints

#### 1. GET List Contacts
- **Path:** `GET /api/contacts`
- **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:42-48`
- **Query Params:**
  - `page` (number, default: 1)
  - `pageSize` (number, default: 20)
  - `smsConsent` (string, optional: 'yes' | 'no' | 'pending')
  - `search` (string, optional)
- **Response:**
```typescript
{
  contacts: Contact[];
  pagination: Pagination;
}
```

#### 2. GET Contact Stats
- **Path:** `GET /api/contacts/stats`
- **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:51`
- **Response:**
```typescript
{
  total: number;
  withConsent: number;
  withoutConsent: number;
  pending: number;
}
```

#### 3. GET Single Contact
- **Path:** `GET /api/contacts/:id`
- **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:61`
- **Response:** `Contact`

#### 4. POST Create Contact
- **Path:** `POST /api/contacts`
- **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:63-69`
- **Body:**
```typescript
{
  firstName: string;
  lastName: string;
  phone: string; // E.164 format
  email?: string;
  smsConsent: 'yes' | 'no' | 'pending';
}
```
- **Response:** `Contact`

#### 5. PUT Update Contact
- **Path:** `PUT /api/contacts/:id`
- **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:80-86`
- **Body:** Same as create
- **Response:** `Contact`

#### 6. DELETE Contact
- **Path:** `DELETE /api/contacts/:id`
- **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:89`
- **Response:** `{ success: true }`

#### 7. POST Import Contacts
- **Path:** `POST /api/contacts/import`
- **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:71-78`
- **Body:** `FormData` with `file` (CSV) and `hasHeaders` (boolean)
- **Headers:** `Content-Type: multipart/form-data`
- **Response:**
```typescript
{
  jobId: string;
  total: number;
  processed: number;
  errors: Array<{ row: number; message: string }>;
}
```

### Implementation

```typescript
import shopifyApi from './axios';

export const contactsApi = {
  list: (params?: { page?: number; pageSize?: number; smsConsent?: string; search?: string }) =>
    shopifyApi.get('/contacts', { params }),
  
  getStats: () => shopifyApi.get('/contacts/stats'),
  
  getOne: (id: string) => shopifyApi.get(`/contacts/${id}`),
  
  create: (data: CreateContactData) => shopifyApi.post('/contacts', data),
  
  update: (id: string, data: UpdateContactData) =>
    shopifyApi.put(`/contacts/${id}`, data),
  
  delete: (id: string) => shopifyApi.delete(`/contacts/${id}`),
  
  import: (file: File, hasHeaders: boolean) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('hasHeaders', String(hasHeaders));
    return shopifyApi.post('/contacts/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
```

**React Query Keys:**
- `['shopify', 'contacts', params]` - List
- `['shopify', 'contacts', 'stats']` - Stats
- `['shopify', 'contacts', id]` - Single

**Mutation Invalidation:**
- Create/Update/Delete/Import → Invalidate `['shopify', 'contacts']` and `['shopify', 'dashboard']`

**Evidence:** `apps/astronote-shopify-frontend/src/services/queries.js:234-292`

---

## E. Templates API

**File:** `apps/astronote-web/src/lib/shopify/api/templates.ts`

### Endpoints

#### 1. GET List Templates
- **Path:** `GET /api/templates`
- **Evidence:** `apps/shopify-api/routes/templates.js:7`
- **Query Params:**
  - `limit` (number, default: 12)
  - `offset` (number, default: 0)
  - `category` (string, optional)
  - `search` (string, optional)
- **Response:**
```typescript
{
  templates: Template[];
  pagination: Pagination;
}
```

#### 2. GET Template Categories
- **Path:** `GET /api/templates/categories`
- **Evidence:** `apps/shopify-api/routes/templates.js:8`
- **Response:** `string[]` (category names)

#### 3. GET Single Template
- **Path:** `GET /api/templates/:id`
- **Evidence:** `apps/shopify-api/routes/templates.js:9`
- **Response:** `Template`

#### 4. POST Track Template Usage
- **Path:** `POST /api/templates/:id/track`
- **Evidence:** `apps/shopify-api/routes/templates.js:13`
- **Response:** `{ success: true }`

### Implementation

```typescript
import shopifyApi from './axios';

export const templatesApi = {
  list: (params?: { limit?: number; offset?: number; category?: string; search?: string }) =>
    shopifyApi.get('/templates', { params }),
  
  getCategories: () => shopifyApi.get('/templates/categories'),
  
  getOne: (id: string) => shopifyApi.get(`/templates/${id}`),
  
  trackUsage: (id: string) => shopifyApi.post(`/templates/${id}/track`),
};
```

**React Query Keys:**
- `['shopify', 'templates', params]` - List
- `['shopify', 'templates', 'categories']` - Categories
- `['shopify', 'templates', id]` - Single

**Mutation Invalidation:**
- Track usage → No invalidation needed (analytics only)

**Evidence:** `apps/astronote-shopify-frontend/src/services/queries.js:520-600`

---

## F. Automations API

**File:** `apps/astronote-web/src/lib/shopify/api/automations.ts`

### Endpoints

#### 1. GET List Automations
- **Path:** `GET /api/automations`
- **Evidence:** `apps/shopify-api/routes/automations.js:13`
- **Response:** `Automation[]`

#### 2. GET Automation Stats
- **Path:** `GET /api/automations/stats`
- **Evidence:** `apps/shopify-api/routes/automations.js:19`
- **Response:**
```typescript
{
  total: number;
  active: number;
  paused: number;
}
```

#### 3. POST Create Automation
- **Path:** `POST /api/automations`
- **Evidence:** `apps/shopify-api/routes/automations.js:14-18`
- **Body:**
```typescript
{
  name: string;
  triggerType: string;
  message: string;
  status: 'active' | 'paused';
  schedule?: object;
}
```
- **Response:** `Automation`

#### 4. PUT Update Automation
- **Path:** `PUT /api/automations/:id`
- **Evidence:** `apps/shopify-api/routes/automations.js:25-29`
- **Body:** Same as create
- **Response:** `Automation`

#### 5. DELETE Automation
- **Path:** `DELETE /api/automations/:id`
- **Evidence:** `apps/shopify-api/routes/automations.js:30`
- **Response:** `{ success: true }`

#### 6. GET Automation Variables
- **Path:** `GET /api/automations/variables/:triggerType`
- **Evidence:** `apps/shopify-api/routes/automations.js:20-24`
- **Response:** `Array<{ name: string; description: string }>`

### Implementation

```typescript
import shopifyApi from './axios';

export const automationsApi = {
  list: () => shopifyApi.get('/automations'),
  
  getStats: () => shopifyApi.get('/automations/stats'),
  
  create: (data: CreateAutomationData) => shopifyApi.post('/automations', data),
  
  update: (id: string, data: UpdateAutomationData) =>
    shopifyApi.put(`/automations/${id}`, data),
  
  delete: (id: string) => shopifyApi.delete(`/automations/${id}`),
  
  getVariables: (triggerType: string) =>
    shopifyApi.get(`/automations/variables/${triggerType}`),
};
```

**React Query Keys:**
- `['shopify', 'automations']` - List
- `['shopify', 'automations', 'stats']` - Stats
- `['shopify', 'automations', id]` - Single
- `['shopify', 'automations', 'variables', triggerType]` - Variables

**Mutation Invalidation:**
- Create/Update/Delete → Invalidate `['shopify', 'automations']` and `['shopify', 'dashboard']`

**Evidence:** `apps/astronote-shopify-frontend/src/services/queries.js:964-1100`

---

## G. Billing API

**File:** `apps/astronote-web/src/lib/shopify/api/billing.ts`

### Endpoints

#### 1. GET Balance
- **Path:** `GET /api/billing/balance`
- **Evidence:** `apps/shopify-api/routes/billing.js:24`
- **Response:**
```typescript
{
  credits: number;
  currency: string;
}
```

#### 2. GET Packages
- **Path:** `GET /api/billing/packages`
- **Evidence:** `apps/shopify-api/routes/billing.js:27`
- **Query Params:** `currency` (string, optional)
- **Response:** `Package[]`

#### 3. GET Calculate Top-up
- **Path:** `GET /api/billing/topup/calculate`
- **Evidence:** `apps/shopify-api/routes/billing.js:29-34`
- **Query Params:** `credits` (number)
- **Response:**
```typescript
{
  credits: number;
  price: number;
  currency: string;
}
```

#### 4. POST Create Top-up
- **Path:** `POST /api/billing/topup`
- **Evidence:** `apps/shopify-api/routes/billing.js:36-42`
- **Body:**
```typescript
{
  credits: number;
  currency: string;
}
```
- **Response:**
```typescript
{
  checkoutUrl: string; // Stripe checkout URL
}
```

#### 5. GET Transaction History
- **Path:** `GET /api/billing/history`
- **Evidence:** `apps/shopify-api/routes/billing.js:44-50`
- **Query Params:**
  - `page` (number, default: 1)
  - `pageSize` (number, default: 20)
- **Response:**
```typescript
{
  transactions: Transaction[];
  pagination: Pagination;
}
```

#### 6. GET Billing History (Stripe)
- **Path:** `GET /api/billing/billing-history`
- **Evidence:** `apps/shopify-api/routes/billing.js:52-58`
- **Query Params:** Same as transaction history
- **Response:** Stripe billing history

#### 7. POST Create Purchase
- **Path:** `POST /api/billing/purchase`
- **Evidence:** `apps/shopify-api/routes/billing.js:60-66`
- **Body:**
```typescript
{
  packageId: string;
  currency: string;
}
```
- **Response:**
```typescript
{
  checkoutUrl: string; // Stripe checkout URL
}
```

### Implementation

```typescript
import shopifyApi from './axios';

export const billingApi = {
  getBalance: () => shopifyApi.get('/billing/balance'),
  
  getPackages: (currency?: string) =>
    shopifyApi.get('/billing/packages', { params: { currency } }),
  
  calculateTopup: (credits: number) =>
    shopifyApi.get('/billing/topup/calculate', { params: { credits } }),
  
  createTopup: (data: { credits: number; currency: string }) =>
    shopifyApi.post('/billing/topup', data),
  
  getHistory: (params?: { page?: number; pageSize?: number }) =>
    shopifyApi.get('/billing/history', { params }),
  
  getBillingHistory: (params?: { page?: number; pageSize?: number }) =>
    shopifyApi.get('/billing/billing-history', { params }),
  
  createPurchase: (data: { packageId: string; currency: string }) =>
    shopifyApi.post('/billing/purchase', data),
};
```

**React Query Keys:**
- `['shopify', 'billing', 'balance']` - Balance
- `['shopify', 'billing', 'packages', currency]` - Packages
- `['shopify', 'billing', 'history', params]` - History
- `['shopify', 'billing', 'billing-history', params]` - Billing History

**Mutation Invalidation:**
- Create top-up/purchase → Invalidate `['shopify', 'billing', 'balance']` and `['shopify', 'dashboard']`

**Evidence:** `apps/astronote-shopify-frontend/src/services/queries.js:293-476`

---

## H. Settings API

**File:** `apps/astronote-web/src/lib/shopify/api/settings.ts`

### Endpoints

#### 1. GET Settings
- **Path:** `GET /api/settings`
- **Evidence:** `apps/shopify-api/routes/settings.js:7`
- **Response:**
```typescript
{
  senderId?: string;
  timezone: string;
  currency: string;
  shopDomain: string;
}
```

#### 2. PUT Update Settings
- **Path:** `PUT /api/settings`
- **Evidence:** `apps/shopify-api/routes/settings.js:10`
- **Body:**
```typescript
{
  senderId?: string;
  timezone?: string;
  currency?: string;
}
```
- **Response:** Updated settings

#### 3. GET Account Info
- **Path:** `GET /api/settings/account`
- **Evidence:** `apps/shopify-api/routes/settings.js:8`
- **Response:**
```typescript
{
  shopDomain: string;
  shopName: string;
  credits: number;
  createdAt: string;
}
```

### Implementation

```typescript
import shopifyApi from './axios';

export const settingsApi = {
  get: () => shopifyApi.get('/settings'),
  
  update: (data: UpdateSettingsData) => shopifyApi.put('/settings', data),
  
  getAccount: () => shopifyApi.get('/settings/account'),
};
```

**React Query Keys:**
- `['shopify', 'settings']` - Settings
- `['shopify', 'settings', 'account']` - Account

**Mutation Invalidation:**
- Update settings → Invalidate `['shopify', 'settings']`

**Evidence:** `apps/astronote-shopify-frontend/src/services/queries.js:1100-1200` (check if exists)

---

## I. Reports API

**File:** `apps/astronote-web/src/lib/shopify/api/reports.ts`

### Endpoints

#### 1. GET Reports Overview
- **Path:** `GET /api/reports/overview`
- **Evidence:** `apps/shopify-api/routes/reports.js:11`
- **Query Params:**
  - `startDate` (ISO string, optional)
  - `endDate` (ISO string, optional)
- **Response:** Reports overview object

#### 2. GET Reports KPIs
- **Path:** `GET /api/reports/kpis`
- **Evidence:** `apps/shopify-api/routes/reports.js:12`
- **Response:** KPI metrics

#### 3. GET Campaign Reports
- **Path:** `GET /api/reports/campaigns`
- **Evidence:** `apps/shopify-api/routes/reports.js:15`
- **Query Params:**
  - `campaignId` (number, optional)
  - `startDate` (ISO string, optional)
  - `endDate` (ISO string, optional)
- **Response:** Campaign reports

#### 4. GET Messaging Reports
- **Path:** `GET /api/reports/messaging`
- **Evidence:** `apps/shopify-api/routes/reports.js:18`
- **Query Params:** Date range
- **Response:** Messaging stats

#### 5. GET Credits Reports
- **Path:** `GET /api/reports/credits`
- **Evidence:** `apps/shopify-api/routes/reports.js:20`
- **Query Params:** Date range
- **Response:** Credit usage

#### 6. GET Contacts Reports
- **Path:** `GET /api/reports/contacts`
- **Evidence:** `apps/shopify-api/routes/reports.js:21`
- **Query Params:** Date range
- **Response:** Contact growth

#### 7. GET Automation Reports
- **Path:** `GET /api/reports/automations`
- **Evidence:** `apps/shopify-api/routes/reports.js:17`
- **Query Params:** Date range
- **Response:** Automation performance

### Implementation

```typescript
import shopifyApi from './axios';

export const reportsApi = {
  getOverview: (params?: { startDate?: string; endDate?: string }) =>
    shopifyApi.get('/reports/overview', { params }),
  
  getKPIs: () => shopifyApi.get('/reports/kpis'),
  
  getCampaigns: (params?: { campaignId?: number; startDate?: string; endDate?: string }) =>
    shopifyApi.get('/reports/campaigns', { params }),
  
  getMessaging: (params?: { startDate?: string; endDate?: string }) =>
    shopifyApi.get('/reports/messaging', { params }),
  
  getCredits: (params?: { startDate?: string; endDate?: string }) =>
    shopifyApi.get('/reports/credits', { params }),
  
  getContacts: (params?: { startDate?: string; endDate?: string }) =>
    shopifyApi.get('/reports/contacts', { params }),
  
  getAutomations: (params?: { startDate?: string; endDate?: string }) =>
    shopifyApi.get('/reports/automations', { params }),
};
```

**React Query Keys:**
- `['shopify', 'reports', 'overview', params]` - Overview
- `['shopify', 'reports', 'kpis']` - KPIs
- `['shopify', 'reports', 'campaigns', params]` - Campaigns
- `['shopify', 'reports', 'messaging', params]` - Messaging
- `['shopify', 'reports', 'credits', params]` - Credits
- `['shopify', 'reports', 'contacts', params]` - Contacts
- `['shopify', 'reports', 'automations', params]` - Automations

**Mutation Invalidation:**
- Reports are read-only, no mutations

**Evidence:** `apps/astronote-shopify-frontend/src/services/queries.js:1200-1400` (check if exists)

---

## J. React Query Configuration

### Default Options

```typescript
import { QueryClient } from '@tanstack/react-query';

export const shopifyQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Retry once for network/server errors
        return failureCount < 1;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      placeholderData: (previousData) => previousData,
    },
    mutations: {
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});
```

**Evidence:** `apps/astronote-shopify-frontend/src/App.jsx:45-75`

---

## K. Error Handling Standard

### Toast Notifications

**File:** `apps/astronote-web/src/lib/shopify/utils/errors.ts`

```typescript
import { toast } from 'sonner'; // or your toast library

export function handleApiError(error: any) {
  const message = error?.response?.data?.message || error?.message || 'An error occurred';
  toast.error(message);
}

export function handleApiSuccess(message: string) {
  toast.success(message);
}
```

### Inline Errors

Show inline errors for form validation:
- Field-level errors from backend `details` array
- Display below input fields
- Clear on field change

### Retry Button

For error states:
- Show retry button that refetches query
- Use React Query's `refetch()` function

**Evidence:** `apps/astronote-shopify-frontend/src/services/api.js:149-271` (error handling)

---

## Summary

1. **Axios Instance:** Configured with auth interceptors
2. **API Modules:** Separate files per resource (dashboard, campaigns, contacts, etc.)
3. **React Query Keys:** Consistent naming: `['shopify', resource, ...params]`
4. **Mutation Invalidation:** Invalidate related queries on mutations
5. **Error Handling:** Toast + inline errors + retry buttons
6. **All endpoints confirmed from backend routes**

