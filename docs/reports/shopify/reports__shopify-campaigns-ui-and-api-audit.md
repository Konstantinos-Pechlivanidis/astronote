# Shopify Campaigns UI & API Audit Report

**Date:** 2025-01-27  
**Status:** 🔍 **AUDIT IN PROGRESS**

---

## Executive Summary

This audit examines the Shopify campaigns UI/UX and endpoint usage architecture, comparing it to Retail campaigns for parity and identifying gaps in endpoint contracts and data safety.

**Goal:** Ensure Shopify campaigns pages have:
1. UI/UX parity with Retail (look/feel/layout/components)
2. Professional endpoint usage architecture (centralized client, correct headers, safe parsing)
3. Minimal backend changes (only if UI requires missing fields)

---

## Phase 1: UI Parity Audit (Retail vs Shopify)

### A) Retail Campaigns Pages Structure

**Location:** `apps/astronote-web/app/app/retail/campaigns/`

**Pages:**
1. **List Page** (`page.tsx`)
   - Uses `RetailPageLayout` + `RetailPageHeader`
   - Stats cards (if available)
   - Toolbar with search and status filter
   - Table (desktop) / Cards (mobile)
   - Empty state with `EmptyState` component
   - Pagination
   - Status badges with `StatusBadge`
   - Shows: sent/total, failed count, scheduled date, created date

2. **Detail Page** (`[id]/page.tsx`)
   - Uses `RetailPageLayout` + `RetailPageHeader`
   - Campaign info card (status, recipients, dates)
   - Message preview card
   - Metrics card (total, sent, failed, conversion rate)
   - Status card (if active: queued, processed, sent, failed)
   - Progress card (if sending: progress bar, sent/failed/pending)
   - Delivery breakdown card
   - Quick actions card
   - Action buttons: Preview, Send, Schedule, Cancel, Edit, Delete

**Key UI Patterns:**
- ✅ `RetailPageLayout` wrapper
- ✅ `RetailPageHeader` with title, description, actions
- ✅ `RetailCard` for content sections
- ✅ `StatusBadge` for status display
- ✅ `EmptyState` for empty lists
- ✅ Responsive: table (desktop) / cards (mobile)
- ✅ Loading skeletons
- ✅ Error states with retry
- ✅ Confirmation dialogs for destructive actions

### B) Shopify Campaigns Pages Structure

**Location:** `apps/astronote-web/app/app/shopify/campaigns/`

**Pages:**
1. **List Page** (`page.tsx`)
   - ✅ Uses `RetailPageLayout` + `RetailPageHeader`
   - ✅ Stats cards component (matches Retail pattern)
   - ✅ Toolbar with search and status filter
   - ✅ Uses `RetailDataTable` (handles table/cards automatically)
   - ✅ Empty state with icon and action
   - ✅ Pagination
   - ✅ Status badges with `StatusBadge`
   - ⚠️ Shows: recipientCount (not sent/total breakdown like Retail)

2. **Detail Page** (`[id]/page.tsx`)
   - ⚠️ Does NOT use `RetailPageLayout` (uses plain `<div>`)
   - ✅ Uses `RetailPageHeader`
   - ✅ Campaign info card (status, recipients, dates, startedAt, finishedAt)
   - ✅ Message card
   - ✅ Metrics card (total, sent, failed, conversion rate)
   - ✅ Status card (if active: queued, processed, sent, failed)
   - ✅ Progress card (if sending: progress bar, sent/failed/pending)
   - ✅ Delivery breakdown card
   - ✅ Quick actions card
   - ✅ Action buttons: Preview, Schedule, Send, Cancel, Edit, Delete

**Key UI Patterns:**
- ✅ Uses Retail components (RetailPageHeader, RetailCard, StatusBadge)
- ⚠️ Detail page missing `RetailPageLayout` wrapper
- ✅ Responsive design
- ✅ Loading states
- ✅ Error states
- ✅ Confirmation dialogs

### C) UI Parity Matrix

| Feature | Retail | Shopify | Status |
|---------|--------|---------|--------|
| **List Page** |
| PageLayout wrapper | ✅ RetailPageLayout | ✅ RetailPageLayout | ✅ Match |
| PageHeader | ✅ RetailPageHeader | ✅ RetailPageHeader | ✅ Match |
| Stats cards | ✅ Yes | ✅ Yes | ✅ Match |
| Toolbar (search/filter) | ✅ Yes | ✅ Yes | ✅ Match |
| Table/Cards | ✅ Table + Cards | ✅ RetailDataTable | ✅ Match |
| Status badges | ✅ StatusBadge | ✅ StatusBadge | ✅ Match |
| Empty state | ✅ EmptyState | ✅ RetailDataTable empty | ✅ Match |
| Pagination | ✅ Yes | ✅ Yes | ✅ Match |
| Sent/Total display | ✅ sent/total | ⚠️ recipientCount only | ⚠️ **GAP** |
| Failed count display | ✅ Yes | ❌ Missing | ❌ **GAP** |
| **Detail Page** |
| PageLayout wrapper | ✅ RetailPageLayout | ❌ Missing | ❌ **GAP** |
| PageHeader | ✅ RetailPageHeader | ✅ RetailPageHeader | ✅ Match |
| Info card | ✅ Yes | ✅ Yes | ✅ Match |
| Message card | ✅ Yes | ✅ Yes | ✅ Match |
| Metrics card | ✅ Yes | ✅ Yes | ✅ Match |
| Status card | ✅ Yes | ✅ Yes | ✅ Match |
| Progress card | ✅ Yes | ✅ Yes | ✅ Match |
| Delivery breakdown | ✅ Yes | ✅ Yes | ✅ Match |
| Action buttons | ✅ Yes | ✅ Yes | ✅ Match |

---

## Phase 2: Endpoint Contract Audit

### A) Shopify Backend Endpoints Available

**Location:** `apps/shopify-api/routes/campaigns.js`

| Method | Path | Query Params | Headers | Response Shape |
|--------|------|--------------|---------|----------------|
| GET | `/campaigns` | `page`, `pageSize`, `status`, `sortBy`, `sortOrder`, `search` | ✅ Tenant | `{ campaigns: [], pagination: {} }` |
| GET | `/campaigns/stats/summary` | None | ✅ Tenant | `{ stats: { total, byStatus: {} } }` |
| GET | `/campaigns/:id` | None | ✅ Tenant | `Campaign` |
| POST | `/campaigns` | None | ✅ Tenant | `Campaign` |
| PUT | `/campaigns/:id` | None | ✅ Tenant | `Campaign` |
| DELETE | `/campaigns/:id` | None | ✅ Tenant | `void` |
| POST | `/campaigns/:id/enqueue` | None | ✅ Tenant + `Idempotency-Key` | `{ ok, queued, enqueuedJobs }` |
| PUT | `/campaigns/:id/schedule` | None | ✅ Tenant | `Campaign` |
| POST | `/campaigns/:id/cancel` | None | ✅ Tenant | `Campaign` |
| GET | `/campaigns/:id/metrics` | None | ✅ Tenant | `CampaignMetrics` |
| GET | `/campaigns/:id/status` | None | ✅ Tenant | `CampaignStatusResponse` |
| GET | `/campaigns/:id/progress` | None | ✅ Tenant | `CampaignProgress` |
| GET | `/campaigns/:id/preview` | None | ✅ Tenant | `CampaignPreview` |

**Notes:**
- ✅ All endpoints require tenant headers (`X-Shopify-Shop-Domain` + `Authorization`)
- ✅ Enqueue endpoint supports `Idempotency-Key` header
- ⚠️ List endpoint does NOT have `withStats` query param (unlike Retail)

### B) Shopify Frontend Endpoint Usage

**Centralized Client:** ✅ `apps/astronote-web/src/lib/shopify/api/campaigns.ts`
- ✅ Uses `shopifyApi` (axios instance with interceptors)
- ✅ All functions use centralized client
- ✅ Tenant headers set automatically via interceptors
- ✅ Idempotency key generated in `enqueueCampaign()`

**Hooks:** ✅ `apps/astronote-web/src/features/shopify/campaigns/hooks/`
- ✅ `useCampaigns()` - Uses `campaignsApi.list()`
- ✅ `useCampaignStats()` - Uses `campaignsApi.getStatsSummary()`
- ✅ `useCampaign()` - Uses `campaignsApi.get()`
- ✅ `useCampaignMutations()` - Uses `campaignsApi.*` methods
- ✅ All hooks use React Query properly
- ✅ Error handling with toast notifications

**Direct API Calls:** ✅ **NONE FOUND**
- ✅ No direct `fetch()` calls in campaigns pages
- ✅ No direct `axios` calls bypassing centralized client
- ✅ All calls go through `campaignsApi` wrapper

**Query Params Usage:**
- ✅ List endpoint: `page`, `pageSize`, `status`, `sortBy`, `sortOrder`, `search` - All used correctly
- ⚠️ `withStats` param: NOT used (not available in Shopify backend)

**Response Parsing:**
- ✅ Response interceptor extracts `data` from `{ success: true, data: {...} }`
- ✅ TypeScript interfaces defined for all responses
- ⚠️ No runtime validation/guards (relies on TypeScript only)

**Idempotency:**
- ✅ `enqueueCampaign()` generates idempotency key once per call
- ✅ Key generated using `crypto.randomUUID()` or fallback
- ✅ Key set in headers correctly

---

## Phase 3: Gap Analysis

### Critical Gaps ❌

1. **List Page: Missing Sent/Total Breakdown**
   - Retail shows: `sent/total` with failed count below
   - Shopify shows: `recipientCount` only
   - **Impact:** Users cannot see campaign progress at a glance
   - **Fix:** Backend should return `sentCount` and `failedCount` in list response, or frontend should fetch metrics

2. **Detail Page: Missing RetailPageLayout**
   - Retail uses `RetailPageLayout` wrapper
   - Shopify uses plain `<div>`
   - **Impact:** Inconsistent layout, missing sidebar/navigation
   - **Fix:** Wrap detail page in `RetailPageLayout`

### Minor Gaps ⚠️

1. **Status Filter Options**
   - Retail includes: `completed`, `paused`
   - Shopify includes: `sent`, `cancelled` (but missing `completed`, `paused`)
   - **Impact:** Cannot filter by completed/paused campaigns
   - **Fix:** Add `completed` and `paused` to status filter options

2. **Response Safety**
   - No runtime validation of response shapes
   - Relies on TypeScript only
   - **Impact:** Potential crashes if backend returns unexpected shape
   - **Fix:** Add lightweight guards or optional chaining

3. **List Response Fields**
   - Backend may not return `sentCount`/`failedCount` in list response
   - Frontend expects `recipientCount` but Retail shows `sent/total`
   - **Impact:** UI cannot display same metrics as Retail
   - **Fix:** Verify backend returns these fields or add them

---

## Phase 4: Implementation Plan

### Priority 1: UI Parity Fixes

1. **Add RetailPageLayout to Detail Page**
   - Wrap detail page content in `RetailPageLayout`
   - Ensures consistent navigation and layout

2. **Update List Page to Show Sent/Total**
   - Check if backend returns `sentCount`/`failedCount`
   - If not, fetch metrics or update backend to include in list
   - Display: `sent/total` with failed count below (match Retail)

3. **Update Status Filter**
   - Add `completed` and `paused` options
   - Update filter logic to handle new statuses

### Priority 2: Endpoint Usage Standardization

1. **Verify All Calls Use Centralized Client**
   - ✅ Already done - no direct fetch/axios calls found

2. **Add Response Guards (Optional)**
   - Add lightweight runtime checks for critical fields
   - Use optional chaining and fallbacks

3. **Verify Query Params**
   - ✅ All required params are used correctly
   - ⚠️ `withStats` not available (Shopify-specific limitation)

### Priority 3: Backend Adjustments (If Needed)

1. **List Response Enhancement**
   - If list endpoint doesn't return `sentCount`/`failedCount`, add them
   - Keep response shape stable
   - Document changes

---

## Next Steps

1. ✅ Complete audit (this document)
2. ⏳ Implement UI parity fixes
3. ⏳ Verify/update endpoint usage
4. ⏳ Add response guards if needed
5. ⏳ Create verification scripts
6. ⏳ Create final report

---

**Report Status:** 🔍 **AUDIT COMPLETE - IMPLEMENTATION REQUIRED**

