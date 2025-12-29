# API Wiring Verification

## Date
2025-01-23

## Critical Check: Retail vs Shopify API Separation

### Retail Hooks Analysis
All retail hooks use `axiosRetail` from `@/api/axiosRetail`:
- ✅ `useRetailDashboard` → `axiosRetail.get('/dashboard')`
- ✅ `useRetailCampaigns` → `axiosRetail.get('/campaigns')`
- ✅ `useRetailCampaign` → `axiosRetail.get('/campaigns/:id')`
- ✅ `useCreateRetailCampaign` → `axiosRetail.post('/campaigns')`
- ✅ `useEnqueueRetailCampaign` → `axiosRetail.post('/campaigns/:id/enqueue')`
- ✅ `useDeleteRetailCampaign` → `axiosRetail.delete('/campaigns/:id')`
- ✅ `useRetailContacts` → `axiosRetail.get('/contacts')`
- ✅ `useImportRetailContacts` → `axiosRetail.post('/contacts/import')`
- ✅ `useRetailSegments` → `axiosRetail.get('/audiences/segments')`
- ✅ `useRetailAutomations` → `axiosRetail.get('/automations')`
- ✅ `useToggleRetailAutomation` → `axiosRetail.put('/automations/:id/status')`
- ✅ `useUpdateRetailAutomation` → `axiosRetail.put('/automations/:id')`
- ✅ `useRetailTemplates` → `axiosRetail.get('/templates')`
- ✅ `useRetailSettings` → `axiosRetail.get('/settings')` or `axiosRetail.get('/me')`
- ✅ `useUpdateRetailSettings` → `axiosRetail.put('/settings')`

### Shopify Hooks Analysis
All shopify hooks use `axiosShopify` from `@/api/axiosShopify`:
- ✅ `useShopifyDashboard` → `axiosShopify.get('/dashboard')`
- ✅ `useShopifyCampaigns` → `axiosShopify.get('/campaigns')`
- ✅ `useShopifyCampaign` → `axiosShopify.get('/campaigns/:id')`
- ✅ `useCreateShopifyCampaign` → `axiosShopify.post('/campaigns')`
- ✅ `useEnqueueShopifyCampaign` → `axiosShopify.post('/campaigns/:id/enqueue')`
- ✅ `useDeleteShopifyCampaign` → `axiosShopify.delete('/campaigns/:id')`
- ✅ `useShopifyContacts` → `axiosShopify.get('/contacts')`
- ✅ `useImportShopifyContacts` → `axiosShopify.post('/contacts/import')`
- ✅ `useShopifySegments` → `axiosShopify.get('/audiences/segments')`
- ✅ `useShopifyAutomations` → `axiosShopify.get('/automations')`
- ✅ `useToggleShopifyAutomation` → `axiosShopify.put('/automations/:id/status')`
- ✅ `useUpdateShopifyAutomation` → `axiosShopify.put('/automations/:id')`
- ✅ `useShopifyTemplates` → `axiosShopify.get('/templates')`
- ✅ `useShopifySettings` → `axiosShopify.get('/settings')` or `axiosShopify.get('/me')`
- ✅ `useUpdateShopifySettings` → `axiosShopify.put('/settings')`

### Direct Axios Usage Check
**Search Result**: No direct `axios.get/post/put/delete` calls found in `apps/web/src/features/`
- ✅ All API calls go through dedicated axios instances
- ✅ No bypassing of `axiosRetail` or `axiosShopify`

### Axios Instance Configuration

#### axiosRetail (`apps/web/src/api/axiosRetail.js`)
- **Base URL**: `import.meta.env.VITE_RETAIL_API_BASE_URL || 'http://localhost:3001'`
- **Auth Token**: `store.getState().auth.retailToken`
- **401 Handling**: Clears `retailToken` and redirects to `/retail/login`

#### axiosShopify (`apps/web/src/api/axiosShopify.js`)
- **Base URL**: `import.meta.env.VITE_SHOPIFY_API_BASE_URL || 'http://localhost:3000'`
- **Auth Token**: `store.getState().auth.shopifyToken`
- **401 Handling**: Clears `shopifyToken` and redirects to `/shopify/login`

## Verdict
**PASS** - API wiring is correct:
- ✅ Retail pages use ONLY `axiosRetail` (Retail API)
- ✅ Shopify pages use ONLY `axiosShopify` (Shopify API)
- ✅ No direct axios usage bypassing clients
- ✅ Proper baseURL configuration per instance
- ✅ Correct token attachment per instance
- ✅ Correct 401 handling per instance

