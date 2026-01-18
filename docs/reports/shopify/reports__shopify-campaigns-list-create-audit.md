# Shopify Campaigns List & Create Audit Report

**Date:** 2025-01-27  
**Scope:** Shopify campaigns list page (`/app/shopify/campaigns`) and create page (`/app/shopify/campaigns/new`)

## Executive Summary

This audit examines the Shopify campaigns list and create pages for:
1. **Backend contract compliance** - Endpoint usage, headers, response parsing
2. **Prisma schema alignment** - Field access, tenant scoping
3. **Frontend architecture** - API client usage, error handling
4. **UI/UX parity** - Comparison with Retail campaigns pages

**Status:** ✅ **Mostly compliant** with minor gaps in UI parity and metrics display

---

## A) Backend Contract Inventory

### GET /campaigns (List Campaigns)

**Route:** `GET /api/campaigns`  
**Controller:** `apps/shopify-api/controllers/campaigns.js::list`  
**Service:** `apps/shopify-api/services/campaigns.js::listCampaigns`

**Query Parameters:**
- `page` (number, default: 1)
- `pageSize` (number, default: 20, max: 100)
- `status` (optional: "draft", "scheduled", "sending", "sent", "failed", "cancelled")
- `sortBy` (optional: "createdAt", "updatedAt", "name", "scheduleAt")
- `sortOrder` (optional: "asc", "desc")
- `search` (optional: string) - **NOT CURRENTLY SUPPORTED BY BACKEND**

**Auth Requirements:**
- `Authorization: Bearer <token>` (JWT from `shopify_token` localStorage)
- `X-Shopify-Shop-Domain: <shop-domain>` (from `shopify_store` localStorage)

**Response Shape:**
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "id": "campaign123",
        "name": "Summer Sale",
        "status": "sent",
        "createdAt": "2025-01-20T10:00:00Z",
        "updatedAt": "2025-01-20T10:00:00Z",
        "scheduleAt": null,
        "scheduleType": "immediate",
        "startedAt": null,
        "finishedAt": null,
        "audience": "all",
        "discountId": null,
        "recipientCount": 200,
        "totalRecipients": 200,
        "sentCount": 200,
        "deliveredCount": 195,
        "failedCount": 5,
        "priority": "normal",
        "recurringDays": null
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

**Error Codes:**
- `INVALID_FILTER` (400) - Invalid status filter value
- `INVALID_SHOP_DOMAIN` (401) - Missing or invalid shop domain
- `401` - Missing or invalid JWT token
- `SUBSCRIPTION_REQUIRED` (403) - Active subscription required (if gating enabled)

**Notes:**
- Backend calculates `recipientCount`, `sentCount`, `deliveredCount`, `failedCount` dynamically
- For sent campaigns, counts come from `CampaignRecipient` records
- For draft/scheduled campaigns, counts are calculated from audience queries
- Response includes `metrics` relation but stats are flattened in response

---

### GET /campaigns/stats/summary (Campaign Statistics)

**Route:** `GET /api/campaigns/stats/summary`  
**Controller:** `apps/shopify-api/controllers/campaigns.js::stats`

**Auth Requirements:** Same as list endpoint

**Response Shape:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 25,
      "byStatus": {
        "draft": 5,
        "scheduled": 3,
        "sending": 2,
        "sent": 10,
        "failed": 3,
        "cancelled": 2
      }
    }
  }
}
```

**Notes:**
- Used by Shopify campaigns list page for stats cards
- Returns counts by status for all campaigns in shop

---

### POST /campaigns (Create Campaign)

**Route:** `POST /api/campaigns`  
**Controller:** `apps/shopify-api/controllers/campaigns.js::create`  
**Service:** `apps/shopify-api/services/campaigns.js::createCampaign`

**Auth Requirements:** Same as list endpoint

**Request Body:**
```json
{
  "name": "Campaign Name",
  "message": "Hello {{firstName}}, use code {{discount}}!",
  "audience": "all" | "segment:ID" | { "type": "all" } | { "type": "segment", "segmentId": "segment123" },
  "discountId": "discount123" | null,
  "scheduleType": "immediate" | "scheduled" | "recurring",
  "scheduleAt": "2025-01-25T10:00:00Z" | null,  // Required if scheduleType === "scheduled"
  "recurringDays": 7 | null,  // Required if scheduleType === "recurring"
  "priority": "low" | "normal" | "high" | "urgent"  // Optional, default: "normal"
}
```

**Response Shape:** Created campaign object (same structure as list item)

**Error Codes:**
- `VALIDATION_ERROR` (400) - Invalid request body
- `INVALID_AUDIENCE` (400) - Invalid audience type or segment ID
- `INVALID_SCHEDULE` (400) - Invalid schedule date/time
- `SUBSCRIPTION_REQUIRED` (403) - Active subscription required (if gating enabled)
- `INSUFFICIENT_CREDITS` (403) - Insufficient credits for campaign
- `INVALID_SHOP_DOMAIN` (401) - Missing or invalid shop domain
- `401` - Missing or invalid JWT token

**Notes:**
- Backend validates audience and calculates recipient count
- Creates campaign with `status: "draft"` by default
- If `scheduleType === "scheduled"` and `scheduleAt` is provided, sets `status: "scheduled"`

---

## B) Prisma Alignment Quick Scan

### Campaign Model Fields

**Schema:** `apps/shopify-api/prisma/schema.prisma`

```prisma
model Campaign {
  id                 String              @id @default(cuid())
  shopId             String
  name               String
  message            String
  audience           String  // JSON string or "all" or "segment:ID"
  discountId         String?
  scheduleAt         DateTime?
  recurringDays      Int?
  meta               Json?   // Additional data (discountValue, includeDiscount, etc.)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  scheduleType       ScheduleType
  status             CampaignStatus @default(draft)
  priority           CampaignPriority @default(normal)
  startedAt          DateTime?
  finishedAt         DateTime?
  // Relations
  shop               Shop @relation(...)
  metrics            CampaignMetrics?
  recipients         CampaignRecipient[]
  // ...
}
```

**Frontend Usage:**
- ✅ All core fields accessed correctly (`id`, `name`, `status`, `createdAt`, `scheduleAt`, etc.)
- ✅ `recipientCount`, `sentCount`, `deliveredCount`, `failedCount` are calculated by backend and included in response
- ✅ `totalRecipients` is an alias for `recipientCount` (backward compatibility)
- ✅ `audience` is stored as string but can be parsed as JSON object
- ⚠️ **Gap:** Frontend doesn't access `metrics` relation directly (stats are flattened)

**Tenant Scoping:**
- ✅ All backend queries correctly scoped by `shopId: storeId`
- ✅ Frontend uses centralized API client with tenant headers

---

## C) Shopify Frontend Audit

### Current Implementation

**List Page:** `apps/astronote-web/app/app/shopify/campaigns/page.tsx`
- ✅ Uses `useCampaigns` hook (React Query)
- ✅ Uses `campaignsApi.list()` from `@/src/lib/shopify/api/campaigns`
- ✅ API client (`shopifyApi`) correctly injects tenant headers
- ✅ Handles loading, error, and empty states
- ✅ Displays stats cards using `useCampaignStats` hook
- ✅ Table columns: Name, Status, Messages, Scheduled, Created, Actions
- ✅ Mobile card view with key metrics
- ✅ Pagination controls
- ✅ Status filter dropdown
- ⚠️ **Gap:** Search functionality exists in UI but backend doesn't support `search` query param

**Create Page:** `apps/astronote-web/app/app/shopify/campaigns/new/page.tsx`
- ✅ Uses `useCreateCampaign` hook (React Query)
- ✅ Uses `campaignsApi.create()` from `@/src/lib/shopify/api/campaigns`
- ✅ API client correctly injects tenant headers
- ✅ Form validation (name, message, schedule)
- ✅ Message preview with `SmsInPhonePreview` component
- ✅ Audience selection (uses `useAudiences` hook)
- ✅ Discount selection (uses `useDiscounts` hook)
- ✅ Schedule options (draft, scheduled)
- ✅ Subscription gating (disables send if inactive)
- ⚠️ **Gap:** No step-by-step wizard like Retail (single form vs multi-step)

**API Client:** `apps/astronote-web/src/lib/shopify/api/campaigns.ts`
- ✅ Centralized API wrapper using `shopifyApi` axios instance
- ✅ All functions use `shopifyApi.get/post/put/delete` with correct paths
- ✅ TypeScript types defined for all request/response shapes
- ✅ Error handling via axios interceptors

**Hooks:**
- ✅ `useCampaigns` - List campaigns with React Query
- ✅ `useCampaignStats` - Get stats summary
- ✅ `useCreateCampaign` - Create campaign mutation
- ✅ All hooks use centralized `campaignsApi` wrapper

**Tenant Headers:**
- ✅ `shopifyApi` axios instance injects `Authorization: Bearer <token>`
- ✅ `shopifyApi` axios instance injects `X-Shopify-Shop-Domain: <shop-domain>`
- ✅ Headers injected via request interceptor
- ✅ Public endpoints (unsubscribe, webhooks) skip tenant headers

---

## D) Retail UI Reference Extraction

### Retail Campaigns List Page

**File:** `apps/astronote-web/app/app/retail/campaigns/page.tsx`

**Structure:**
1. **PageHeader** - Title, description, "New Campaign" button
2. **Toolbar** - Search input, status filter dropdown
3. **Table/Cards** - Desktop table, mobile cards
   - Columns: Name, Status, Messages, Scheduled, Created
   - Status badge with color coding
   - Messages: `sent / total` format with failed count
   - Clickable rows/cards navigate to detail page
4. **Empty State** - Icon, title, description, "Create Campaign" button
5. **Loading State** - Skeleton cards
6. **Error State** - Error message with retry button
7. **Pagination** - Previous/Next buttons with count display

**Key Components:**
- `RetailPageLayout` - Wrapper with consistent spacing
- `RetailPageHeader` - Header with title, description, actions
- `RetailCard` - Card container
- `RetailDataTable` - Responsive table component
- `StatusBadge` - Status pill with color coding
- `EmptyState` - Empty state component

**Metrics Display:**
- Retail does NOT show stats cards on list page (only on detail page)
- Messages column shows: `sent / total` with failed count below if > 0

---

### Retail Campaigns Create Page

**File:** `apps/astronote-web/app/app/retail/campaigns/new/page.tsx`

**Structure:**
1. **Step Indicator** - 4-step wizard (Basics, Audience, Schedule, Review)
2. **Step 1: Basics** - Campaign name, message text, preview sidebar
3. **Step 2: Audience** - Gender filter, age group filter, audience preview panel
4. **Step 3: Schedule** - Draft vs scheduled, date/time picker
5. **Step 4: Review** - Summary of all fields, create button
6. **Navigation** - Back/Next buttons, final "Create Campaign" button

**Key Components:**
- `RetailCard` - Form container
- `SmsInPhonePreview` - Message preview
- `AudiencePreviewPanel` - Audience count preview
- Form validation with error messages
- Step-by-step navigation

**Differences from Shopify:**
- Retail uses multi-step wizard (4 steps)
- Shopify uses single form with sections
- Retail has audience preview panel with count
- Retail has gender/age group filters (not applicable to Shopify)

---

## E) UI Parity Matrix

| Feature | Retail | Shopify | Status |
|---------|--------|---------|--------|
| **List Page** |
| PageHeader with "New Campaign" button | ✅ | ✅ | ✅ Match |
| Stats cards (Total, Draft, Scheduled, etc.) | ❌ | ✅ | ⚠️ Shopify has extra feature |
| Search input | ✅ | ✅ | ✅ Match |
| Status filter dropdown | ✅ | ✅ | ✅ Match |
| Desktop table view | ✅ | ✅ | ✅ Match |
| Mobile card view | ✅ | ✅ | ✅ Match |
| Status badge | ✅ | ✅ | ✅ Match |
| Messages column (sent/total) | ✅ | ✅ | ✅ Match |
| Failed count display | ✅ | ✅ | ✅ Match |
| Empty state | ✅ | ✅ | ✅ Match |
| Loading skeleton | ✅ | ✅ | ✅ Match |
| Error state with retry | ✅ | ✅ | ✅ Match |
| Pagination | ✅ | ✅ | ✅ Match |
| **Create Page** |
| PageHeader | ✅ | ✅ | ✅ Match |
| Campaign name input | ✅ | ✅ | ✅ Match |
| Message textarea | ✅ | ✅ | ✅ Match |
| Message preview sidebar | ✅ | ✅ | ✅ Match |
| Audience selection | ✅ | ✅ | ✅ Match |
| Schedule options | ✅ | ✅ | ✅ Match |
| Form validation | ✅ | ✅ | ✅ Match |
| Multi-step wizard | ✅ | ❌ | ⚠️ Shopify uses single form |
| Audience preview panel | ✅ | ❌ | ⚠️ Shopify doesn't show count |
| **Shared Components** |
| RetailPageLayout | ✅ | ✅ | ✅ Match |
| RetailPageHeader | ✅ | ✅ | ✅ Match |
| RetailCard | ✅ | ✅ | ✅ Match |
| StatusBadge | ✅ | ✅ | ✅ Match |
| SmsInPhonePreview | ✅ | ✅ | ✅ Match |

**Summary:**
- ✅ **List page:** Fully matches Retail UI/UX
- ⚠️ **Create page:** Minor differences (single form vs wizard, no audience preview)
- ✅ **Components:** All shared components used correctly

---

## F) Fix Plan (Ordered by Severity and Risk)

### Priority 1: Low-Risk UI Enhancements

1. **Add audience count preview to create page** (if backend supports it)
   - **Risk:** Low
   - **Impact:** Better UX parity with Retail
   - **Files:** `apps/astronote-web/app/app/shopify/campaigns/new/page.tsx`
   - **Note:** May require backend endpoint for audience count estimation

2. **Remove or disable search input** (backend doesn't support it)
   - **Risk:** Low
   - **Impact:** Prevents user confusion
   - **Files:** `apps/astronote-web/app/app/shopify/campaigns/page.tsx`
   - **Alternative:** Add backend support for search (higher risk)

### Priority 2: Code Quality Improvements

3. **Ensure consistent error handling**
   - **Risk:** Low
   - **Impact:** Better error messages
   - **Files:** Hooks already handle errors correctly

4. **Add loading states to create page**
   - **Risk:** Low
   - **Impact:** Better UX
   - **Files:** `apps/astronote-web/app/app/shopify/campaigns/new/page.tsx`
   - **Status:** Already has `createCampaign.isPending` check

### Priority 3: Backend Enhancements (Optional)

5. **Add search support to backend** (if needed)
   - **Risk:** Medium
   - **Impact:** Enables search functionality
   - **Files:** `apps/shopify-api/services/campaigns.js`, `apps/shopify-api/controllers/campaigns.js`
   - **Note:** Requires Prisma query updates

---

## G) Critical Rules Validation

### ✅ Tenant Safety
- All API calls use centralized `shopifyApi` client
- Tenant headers (`Authorization`, `X-Shopify-Shop-Domain`) injected automatically
- Backend queries scoped by `shopId: storeId`
- No direct fetch/axios calls bypassing tenant headers

### ✅ Prisma Alignment
- All fields accessed exist in schema
- Stats fields (`sentCount`, `deliveredCount`, `failedCount`) calculated by backend
- No direct Prisma client usage in frontend

### ✅ Error Handling
- Centralized error handling via axios interceptors
- React Query hooks handle errors with toast notifications
- Error codes properly mapped to user-friendly messages

### ✅ UI/UX Parity
- Shared components used (`RetailPageLayout`, `RetailPageHeader`, `RetailCard`, `StatusBadge`)
- English-only strings (no Greek)
- Responsive design (desktop table, mobile cards)
- Loading, empty, and error states handled

---

## H) Recommendations

1. **Keep current architecture** - Centralized API client with tenant headers is correct
2. **Minor UI enhancements** - Add audience count preview if backend supports it
3. **Search functionality** - Either remove UI or add backend support
4. **Documentation** - Update API contract docs if search is added

---

## Conclusion

**Overall Status:** ✅ **READY FOR IMPLEMENTATION**

The Shopify campaigns list and create pages are well-architected with:
- ✅ Correct endpoint usage via centralized API client
- ✅ Proper tenant header injection
- ✅ Good UI/UX parity with Retail (minor differences acceptable)
- ✅ Proper error handling and loading states
- ✅ Prisma schema alignment

**Minor gaps identified:**
- Search UI exists but backend doesn't support it
- Create page uses single form vs Retail's multi-step wizard (acceptable difference)
- No audience count preview on create page (nice-to-have)

**Next Steps:**
1. Create verification gate scripts
2. Implement minor UI enhancements (if desired)
3. Write final implementation report
