# Shopify Frontend Contract Mapping

**Date**: 2025-01-27  
**Purpose**: Complete contract mapping between Shopify frontend pages and backend API endpoints

---

## Overview

This document maps every Shopify frontend page to its backend endpoints, request/response DTOs, tenant scoping, and error handling.

**Tenant Resolution**: All Shopify endpoints use:
- `Authorization: Bearer <jwt_token>` header (from `localStorage.shopify_token`)
- `X-Shopify-Shop-Domain` header (from `localStorage.shopify_store` or resolved via `resolveShopDomain()`)
- Backend middleware `requireStore()` extracts `shopId` from JWT or shop domain lookup

---

## Pages & Endpoints

### 1. Dashboard (`/app/shopify/dashboard`)

**Frontend File**: `app/app/shopify/dashboard/page.tsx`  
**Hook**: `useDashboardKPIs()` from `src/features/shopify/dashboard/hooks/useDashboardKPIs.ts`

#### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/dashboard` | Get dashboard KPIs |
| GET | `/billing/balance` | Get credit balance (source of truth) |

#### Request
- **Headers**: `Authorization: Bearer <token>`, `X-Shopify-Shop-Domain: <domain>`
- **Query Params**: None

#### Response DTO

**GET /dashboard**:
```typescript
{
  credits?: number; // Deprecated, use /billing/balance
  totalCampaigns: number;
  totalContacts: number;
  totalMessagesSent: number;
  activeAutomations?: number;
  reports?: {
    last7Days: { sent, delivered, failed, unsubscribes };
    topCampaigns: Array<{ id, name, sent, delivered, failed, createdAt }>;
    deliveryRateTrend: Array<{ date, deliveredRate }>;
    creditsUsage: Array<{ date, creditsDebited }>;
  };
}
```

**GET /billing/balance**:
```typescript
{
  credits: number;
  currency: string;
}
```

#### Tenant Scoping
- ✅ Scoped by `shopId` (from JWT/shop domain)
- ✅ Backend: `requireStore()` middleware

#### Error States
- **401**: Redirects to `/app/shopify/auth/login`
- **403**: Shows error message
- **500**: Shows error card with retry button

---

### 2. Campaigns List (`/app/shopify/campaigns`)

**Frontend File**: `app/app/shopify/campaigns/page.tsx`  
**Hook**: `useCampaigns()` from `src/features/shopify/campaigns/hooks/useCampaigns.ts`

#### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/campaigns` | List campaigns (paginated, filtered) |
| GET | `/campaigns/stats` | Get campaign statistics |
| POST | `/campaigns/:id/enqueue` | Send campaign |
| DELETE | `/campaigns/:id` | Delete campaign |

#### Request

**GET /campaigns**:
- **Query Params**:
  - `page` (number, default: 1)
  - `pageSize` (number, default: 20, max: 100)
  - `status` (optional: "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled")
  - `sortBy` (optional: "createdAt" | "updatedAt" | "name" | "scheduleAt")
  - `sortOrder` (optional: "asc" | "desc")
  - `search` (optional: string)

#### Response DTO

**GET /campaigns**:
```typescript
{
  campaigns: Array<{
    id: string;
    name: string;
    message: string;
    status: CampaignStatus;
    scheduleType: ScheduleType;
    scheduleAt?: string | null;
    createdAt: string;
    updatedAt: string;
    startedAt?: string | null;
    finishedAt?: string | null;
    audience: string | { type: 'all' | 'segment'; segmentId?: string };
    discountId?: string | null;
    recipientCount?: number;
    totalRecipients?: number; // Alias
    sentCount?: number;
    failedCount?: number;
    deliveredCount?: number;
    priority?: CampaignPriority;
    recurringDays?: number | null;
  }>;
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

**GET /campaigns/stats**:
```typescript
{
  stats: {
    total: number;
    byStatus: {
      draft?: number;
      scheduled?: number;
      sending?: number;
      sent?: number;
      failed?: number;
      cancelled?: number;
    };
  };
}
```

#### Tenant Scoping
- ✅ All queries filtered by `shopId` (from `requireStore()`)

#### Error States
- **401**: Redirects to login
- **403**: Shows error message
- **500**: Shows error card with retry

---

### 3. Campaign Detail (`/app/shopify/campaigns/[id]`)

**Frontend File**: `app/app/shopify/campaigns/[id]/page.tsx`  
**Hook**: `useCampaign()` from `src/features/shopify/campaigns/hooks/useCampaign.ts`

#### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/campaigns/:id` | Get campaign details |
| GET | `/campaigns/:id/metrics` | Get campaign metrics |

#### Response DTO

**GET /campaigns/:id**:
```typescript
Campaign // Same as list item, but full details
```

**GET /campaigns/:id/metrics**:
```typescript
{
  total: number;
  sent: number;
  failed: number;
  delivered?: number;
  conversions?: number;
  unsubscribes?: number;
  conversionRate?: number;
}
```

#### Tenant Scoping
- ✅ Scoped by `shopId` + `campaignId` (campaign must belong to shop)

---

### 4. Campaign Create/Edit (`/app/shopify/campaigns/new`, `/app/shopify/campaigns/[id]/edit`)

**Frontend Files**: 
- `app/app/shopify/campaigns/new/page.tsx`
- `app/app/shopify/campaigns/[id]/edit/page.tsx`

**Hooks**: `useCampaignMutations()` from `src/features/shopify/campaigns/hooks/useCampaignMutations.ts`

#### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/campaigns` | Create campaign |
| PUT | `/campaigns/:id` | Update campaign |
| GET | `/audiences/segments` | Get segments for audience selection |

#### Request

**POST /campaigns**:
```typescript
{
  name: string;
  message: string;
  audience: "all" | { type: "all" } | { type: "segment"; segmentId: string };
  includeDiscount?: boolean;
  discountValue?: string;
  scheduleType: "immediate" | "scheduled" | "recurring";
  scheduleAt?: string; // Required if scheduleType === "scheduled"
  recurringDays?: number; // Required if scheduleType === "recurring"
  priority?: "low" | "normal" | "high" | "urgent";
}
```

**PUT /campaigns/:id**:
```typescript
// Same as POST, all fields optional
```

#### Response DTO
- Returns created/updated `Campaign` object

#### Tenant Scoping
- ✅ `shopId` from `requireStore()` middleware
- ✅ Campaign `shopId` must match authenticated shop

---

### 5. Templates List (`/app/shopify/templates`)

**Frontend File**: `app/app/shopify/templates/page.tsx`  
**Hook**: `useTemplates()` from `src/features/shopify/templates/hooks/useTemplates.ts`

#### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/templates` | List templates (paginated, filtered) |
| GET | `/templates/categories` | Get template categories |
| POST | `/templates/:id/track-usage` | Track template usage |

#### Request

**GET /templates**:
- **Query Params**:
  - `eshopType` (string, required) - eShop type filter
  - `page` (number, default: 1)
  - `pageSize` (number, default: 12)
  - `category` (optional: string)
  - `search` (optional: string)
  - `language` (optional, forced to 'en' for Shopify)

#### Response DTO

**GET /templates**:
```typescript
{
  items?: Template[]; // Retail-aligned field
  templates?: Template[]; // Backward compatibility
  total?: number;
  page?: number;
  pageSize?: number;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  categories?: string[];
}
```

**Template**:
```typescript
{
  id: string;
  name: string; // Primary field
  text: string; // Primary field (SMS content)
  title?: string; // Deprecated, use name
  content?: string; // Deprecated, use text
  category: string; // Store-type category name
  language?: string;
  goal?: string | null;
  suggestedMetrics?: string | null;
  eshopType?: string;
  previewImage?: string | null;
  tags?: string[];
  conversionRate?: number | null;
  productViewsIncrease?: number | null;
  clickThroughRate?: number | null;
  averageOrderValue?: number | null;
  customerRetention?: number | null;
  useCount?: number; // Usage count for current shop
  createdAt?: string;
  updatedAt?: string;
}
```

**GET /templates/categories**:
```typescript
string[] // Array of category names
```

#### Tenant Scoping
- ⚠️ Templates are **global** (not shop-scoped)
- ✅ `useCount` is shop-specific (if `shopId` available)
- ✅ `track-usage` endpoint is shop-scoped

---

### 6. Template Detail (`/app/shopify/templates/[id]`)

**Frontend File**: `app/app/shopify/templates/[id]/page.tsx`  
**Hook**: `useTemplate()` from `src/features/shopify/templates/hooks/useTemplate.ts`

#### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/templates/:id` | Get template details |

#### Response DTO
- Returns single `Template` object

---

### 7. Contacts List (`/app/shopify/contacts`)

**Frontend File**: `app/app/shopify/contacts/page.tsx`  
**Hook**: `useContacts()` from `src/features/shopify/contacts/hooks/useContacts.ts`

#### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/contacts` | List contacts (paginated, filtered) |
| GET | `/contacts/stats` | Get contact statistics |

#### Request

**GET /contacts**:
- **Query Params**:
  - `page` (number, default: 1)
  - `limit` (number, default: 20) - Legacy param
  - `pageSize` (number, default: 20) - Retail-aligned
  - `search` (optional: string) - Search by phone/email/name

#### Response DTO

**GET /contacts**:
```typescript
{
  contacts: Array<{
    id: string;
    phoneE164: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    smsConsent: "opted_in" | "opted_out" | "unknown";
    createdAt: string;
    updatedAt: string;
    // ... other fields
  }>;
  total: number;
  page: number;
  pageSize: number;
}
```

#### Tenant Scoping
- ✅ All queries filtered by `shopId`

---

### 8. Contact Detail (`/app/shopify/contacts/[id]`)

**Frontend File**: `app/app/shopify/contacts/[id]/page.tsx`  
**Hook**: `useContact()` from `src/features/shopify/contacts/hooks/useContact.ts`

#### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/contacts/:id` | Get contact details |

#### Response DTO
- Returns single `Contact` object

---

### 9. Automations List (`/app/shopify/automations`)

**Frontend File**: `app/app/shopify/automations/page.tsx`  
**Hook**: `useAutomations()` from `src/features/shopify/automations/hooks/useAutomations.ts`

#### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/automations` | List automations |
| PUT | `/automations/:id` | Update automation (toggle active, update message) |

#### Response DTO

**GET /automations**:
```typescript
{
  automations: Array<{
    id: string;
    name: string;
    triggerType: string;
    message: string;
    active: boolean;
    createdAt: string;
    // ... other fields
  }>;
}
```

#### Tenant Scoping
- ✅ All queries filtered by `shopId`

---

### 10. Billing (`/app/shopify/billing`)

**Frontend File**: `app/app/shopify/billing/page.tsx`  
**Hooks**: Multiple from `src/features/shopify/billing/hooks/`

#### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/billing/balance` | Get credit balance |
| GET | `/billing/summary` | Get billing summary |
| GET | `/billing/packages` | Get credit packages |
| GET | `/billing/invoices` | Get invoices |
| POST | `/billing/purchase` | Purchase credits |
| POST | `/billing/topup` | Top-up credits |
| GET | `/subscriptions/current` | Get subscription status |
| POST | `/subscriptions/subscribe` | Subscribe to plan |
| POST | `/subscriptions/portal` | Get Stripe portal URL |
| POST | `/subscriptions/switch` | Switch subscription plan |
| POST | `/subscriptions/cancel` | Cancel subscription |

#### Response DTOs

**GET /billing/balance**:
```typescript
{
  credits: number;
  currency: string;
}
```

**GET /billing/summary**:
```typescript
{
  credits: number;
  currency: string;
  // ... other fields
}
```

**GET /subscriptions/current**:
```typescript
{
  status: "active" | "inactive" | "cancelled" | "past_due";
  active: boolean; // Alias for status === "active"
  planType?: string;
  // ... other fields
}
```

#### Tenant Scoping
- ✅ All endpoints scoped by `shopId`

---

### 11. Settings (`/app/shopify/settings`)

**Frontend File**: `app/app/shopify/settings/page.tsx`  
**Hook**: `useSettings()` from `src/features/shopify/settings/hooks/useSettings.ts`

#### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/settings` | Get shop settings |
| PUT | `/settings` | Update shop settings |

#### Tenant Scoping
- ✅ Scoped by `shopId`

---

### 12. Reports (`/app/shopify/reports`)

**Frontend File**: `app/app/shopify/reports/page.tsx`

#### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/dashboard` | Get dashboard KPIs (includes reports) |

**Note**: Reports are embedded in dashboard response. No separate `/reports` endpoint exists.

---

## Common Patterns

### Pagination
- **Retail-aligned**: `page`, `pageSize`, `pagination` object
- **Legacy**: `limit`, `offset` (still supported for backward compatibility)

### Error Handling
- **401**: Clears token, redirects to `/app/shopify/auth/login`
- **403**: Shows error message
- **500**: Shows error card with retry button
- **Network errors**: Handled by axios interceptor

### Loading States
- All pages use `RetailLoadingSkeleton` or custom skeletons
- Loading state managed by React Query hooks

### Empty States
- All list pages use `EmptyState` component
- Consistent messaging and actions

---

## Data Flow

### Prisma → Backend DTO → Frontend Type → UI

1. **Backend**: Prisma model → Mapper function → DTO (stable shape)
2. **Frontend**: API response → Zod/TypeScript type → React Query cache
3. **UI**: React Query data → Component props → Rendered UI

### Critical Data Objects

1. **Campaign**: Full mapping from Prisma `Campaign` → DTO → Frontend `Campaign` type
2. **Template**: Prisma `Template` → DTO → Frontend `Template` type (with backward compatibility)
3. **Contact**: Prisma `Contact` → DTO → Frontend `Contact` type
4. **Billing**: Prisma `Wallet`, `Subscription`, `Invoice` → DTOs → Frontend types

---

## Known Issues & Gaps

1. **Templates**: Global (not shop-scoped), but `useCount` is shop-specific
2. **Pagination**: Dual support (Retail-aligned + legacy) for backward compatibility
3. **Template fields**: Dual field names (`name`/`title`, `text`/`content`) for backward compatibility
4. **Campaign fields**: `recipientCount` vs `totalRecipients` (aliases)

---

## Next Steps

1. ✅ Contract mapping complete
2. ⏳ Review backend DTO mappers for consistency
3. ⏳ Standardize frontend type definitions
4. ⏳ Add runtime validation (Zod schemas)
5. ⏳ Standardize UX/UI components
6. ⏳ Add tests

