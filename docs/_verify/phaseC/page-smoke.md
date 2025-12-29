# Page-Level Functional Smoke Tests

## Date
2025-01-23

## Note
**BLOCKER**: Cannot execute runtime tests in sandbox environment. This document outlines expected page behavior based on code analysis.

## Retail Pages - Expected API Calls

### Dashboard (`/retail/dashboard`)
- **Hook**: `useRetailDashboard()`
- **API Call**: `GET {VITE_RETAIL_API_BASE_URL}/dashboard`
- **Expected Response**: `{ data: { kpis, credits, reports } }`
- **Status**: ✅ Code verified

### Campaigns (`/retail/campaigns`)
- **Hook**: `useRetailCampaigns(params)`
- **API Call**: `GET {VITE_RETAIL_API_BASE_URL}/campaigns?page=&pageSize=&search=&status=`
- **Expected Response**: `{ campaigns: [], total: 0 }`
- **Status**: ✅ Code verified

### Create Campaign (`/retail/campaigns/new`)
- **Hook**: `useCreateRetailCampaign()`, `useEnqueueRetailCampaign()`
- **API Calls**: 
  - `POST {VITE_RETAIL_API_BASE_URL}/campaigns` (create)
  - `POST {VITE_RETAIL_API_BASE_URL}/campaigns/:id/enqueue` (send now, optional)
- **Expected Payload**: `{ name, message, audience, includeDiscount?, discountValue? }`
- **Status**: ✅ Code verified

### Contacts (`/retail/contacts`)
- **Hook**: `useRetailContacts(params)`
- **API Call**: `GET {VITE_RETAIL_API_BASE_URL}/contacts?page=&limit=&search=`
- **Expected Response**: `{ contacts: [], total: 0 }`
- **Status**: ✅ Code verified

### Lists/Segments (`/retail/lists`)
- **Hook**: `useRetailSegments()`
- **API Call**: `GET {VITE_RETAIL_API_BASE_URL}/audiences/segments`
- **Expected Response**: `{ segments: [] }`
- **Status**: ✅ Code verified

### Automations (`/retail/automations`)
- **Hook**: `useRetailAutomations()`, `useToggleRetailAutomation()`, `useUpdateRetailAutomation()`
- **API Calls**: 
  - `GET {VITE_RETAIL_API_BASE_URL}/automations`
  - `PUT {VITE_RETAIL_API_BASE_URL}/automations/:id/status` or `PUT /automations/:id`
- **Status**: ✅ Code verified

### Templates (`/retail/templates`)
- **Hook**: `useRetailTemplates()`
- **API Call**: `GET {VITE_RETAIL_API_BASE_URL}/templates`
- **Expected Response**: `{ templates: [] }`
- **Status**: ✅ Code verified

### Settings (`/retail/settings`)
- **Hook**: `useRetailSettings()`, `useUpdateRetailSettings()`
- **API Calls**: 
  - `GET {VITE_RETAIL_API_BASE_URL}/settings` or `GET /me` (fallback)
  - `PUT {VITE_RETAIL_API_BASE_URL}/settings`
- **Status**: ✅ Code verified

## Shopify Pages - Expected API Calls

All Shopify pages follow the same pattern as Retail pages but use `axiosShopify`:
- ✅ Dashboard → `GET /dashboard`
- ✅ Campaigns → `GET /campaigns`
- ✅ Create Campaign → `POST /campaigns`
- ✅ Contacts → `GET /contacts`
- ✅ Lists → `GET /audiences/segments`
- ✅ Automations → `GET /automations`
- ✅ Templates → `GET /templates`
- ✅ Settings → `GET /settings` or `GET /me`

## Shared UI Components
- ✅ `LoadingBlock` - Used for loading states
- ✅ `ErrorState` - Used for error states with retry
- ✅ `EmptyState` - Used for empty data states
- ✅ `DataTable` - Used for paginated lists
- ✅ `PageHeader` - Used for page titles
- ✅ `ConfirmDialog` - Used for confirmations
- ✅ Toast notifications via `sonner`

## React Query Integration
- ✅ All hooks use `@tanstack/react-query`
- ✅ Query keys are properly namespaced (`retail/*`, `shopify/*`)
- ✅ Mutations invalidate related queries
- ✅ Toast notifications on success/error

## Verdict
**PASS** - Code analysis confirms:
- ✅ All pages use correct hooks
- ✅ All hooks use correct axios instances
- ✅ Shared UI components are used consistently
- ✅ React Query is properly integrated
- ⚠️ Runtime verification required (manual)

