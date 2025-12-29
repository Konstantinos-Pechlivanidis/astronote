# Frontend Unified Map

This document maps frontend routes to their corresponding backend services and endpoints.

## Route Structure

### Marketing Landing Page
- **Route**: `/`
- **Component**: `LandingPage`
- **Backend**: None (static marketing page)
- **Description**: Dark-mode marketing landing page with links to Retail and Shopify applications

### Retail Application Routes

All Retail routes are under `/retail/*` and use the Retail API (`VITE_RETAIL_API_BASE_URL`).

| Route | Component | Backend Endpoint | Method | Required Fields |
|-------|-----------|------------------|--------|----------------|
| `/retail/login` | `RetailLoginPage` | None (token storage only) | - | - |
| `/retail/dashboard` | `RetailDashboardPage` | `GET /dashboard` | GET | - |
| `/retail/campaigns` | `RetailCampaignsPage` | `GET /campaigns` | GET | `page`, `pageSize`, `search`, `status` (optional) |
| `/retail/campaigns/new` | `RetailCreateCampaignPage` | `POST /campaigns` | POST | `name`, `message`, `audience` |
| `/retail/campaigns/:id/enqueue` | (via CampaignsPage) | `POST /campaigns/:id/enqueue` | POST | `Idempotency-Key` header (optional) |
| `/retail/campaigns/:id/delete` | (via CampaignsPage) | `DELETE /campaigns/:id` | DELETE | - |
| `/retail/contacts` | `RetailContactsPage` | `GET /contacts` | GET | `page`, `limit`, `search` (optional) |
| `/retail/contacts/import` | (via ContactsPage) | `POST /contacts/import` | POST | `file` (multipart/form-data) |
| `/retail/lists` | `RetailListsPage` | `GET /audiences/segments` | GET | - |
| `/retail/automations` | `RetailAutomationsPage` | `GET /automations` | GET | - |
| `/retail/automations/:id` | (via AutomationsPage) | `PUT /automations/:id` | PUT | `message`, `active` (optional) |
| `/retail/automations/:id/status` | (via AutomationsPage) | `PUT /automations/:id/status` | PUT | `active` |
| `/retail/templates` | `RetailTemplatesPage` | `GET /templates` | GET | - |
| `/retail/settings` | `RetailSettingsPage` | `GET /settings` or `GET /me` | GET | - |
| `/retail/settings` | `RetailSettingsPage` | `PUT /settings` | PUT | Settings object |

### Shopify Application Routes

All Shopify routes are under `/shopify/*` and use the Shopify API (`VITE_SHOPIFY_API_BASE_URL`).

| Route | Component | Backend Endpoint | Method | Required Fields |
|-------|-----------|------------------|--------|----------------|
| `/shopify/login` | `ShopifyLoginPage` | None (token storage only) | - | - |
| `/shopify/dashboard` | `ShopifyDashboardPage` | `GET /dashboard` | GET | - |
| `/shopify/campaigns` | `ShopifyCampaignsPage` | `GET /campaigns` | GET | `page`, `pageSize`, `search`, `status` (optional) |
| `/shopify/campaigns/new` | `ShopifyCreateCampaignPage` | `POST /campaigns` | POST | `name`, `message`, `audience` |
| `/shopify/campaigns/:id/enqueue` | (via CampaignsPage) | `POST /campaigns/:id/enqueue` | POST | `Idempotency-Key` header (optional) |
| `/shopify/campaigns/:id/delete` | (via CampaignsPage) | `DELETE /campaigns/:id` | DELETE | - |
| `/shopify/contacts` | `ShopifyContactsPage` | `GET /contacts` | GET | `page`, `limit`, `search` (optional) |
| `/shopify/contacts/import` | (via ContactsPage) | `POST /contacts/import` | POST | `file` (multipart/form-data) |
| `/shopify/lists` | `ShopifyListsPage` | `GET /audiences/segments` | GET | - |
| `/shopify/automations` | `ShopifyAutomationsPage` | `GET /automations` | GET | - |
| `/shopify/automations/:id` | (via AutomationsPage) | `PUT /automations/:id` | PUT | `message`, `active` (optional) |
| `/shopify/automations/:id/status` | (via AutomationsPage) | `PUT /automations/:id/status` | PUT | `active` |
| `/shopify/templates` | `ShopifyTemplatesPage` | `GET /templates` | GET | - |
| `/shopify/settings` | `ShopifySettingsPage` | `GET /settings` or `GET /me` | GET | - |
| `/shopify/settings` | `ShopifySettingsPage` | `PUT /settings` | PUT | Settings object |

## API Clients

### Retail API Client
- **File**: `apps/web/src/api/axiosRetail.js`
- **Base URL**: `VITE_RETAIL_API_BASE_URL` (default: `http://localhost:3001`)
- **Auth**: Bearer token from Redux store (`auth.retailToken`)
- **401 Handling**: Clears token and redirects to `/retail/login`

### Shopify API Client
- **File**: `apps/web/src/api/axiosShopify.js`
- **Base URL**: `VITE_SHOPIFY_API_BASE_URL` (default: `http://localhost:3000`)
- **Auth**: Bearer token from Redux store (`auth.shopifyToken`)
- **401 Handling**: Clears token and redirects to `/shopify/login`

## React Query Hooks

### Retail Hooks
- `useRetailDashboard()` - Dashboard data
- `useRetailCampaigns(params)` - Campaigns list
- `useRetailCampaign(id)` - Single campaign
- `useCreateRetailCampaign()` - Create campaign mutation
- `useEnqueueRetailCampaign()` - Enqueue campaign mutation
- `useDeleteRetailCampaign()` - Delete campaign mutation
- `useRetailContacts(params)` - Contacts list
- `useImportRetailContacts()` - Import contacts mutation
- `useRetailSegments()` - Segments list
- `useRetailAutomations()` - Automations list
- `useToggleRetailAutomation()` - Toggle automation mutation
- `useUpdateRetailAutomation()` - Update automation mutation
- `useRetailTemplates()` - Templates list
- `useRetailSettings()` - Settings data
- `useUpdateRetailSettings()` - Update settings mutation

### Shopify Hooks
- `useShopifyDashboard()` - Dashboard data
- `useShopifyCampaigns(params)` - Campaigns list
- `useShopifyCampaign(id)` - Single campaign
- `useCreateShopifyCampaign()` - Create campaign mutation
- `useEnqueueShopifyCampaign()` - Enqueue campaign mutation
- `useDeleteShopifyCampaign()` - Delete campaign mutation
- `useShopifyContacts(params)` - Contacts list
- `useImportShopifyContacts()` - Import contacts mutation
- `useShopifySegments()` - Segments list
- `useShopifyAutomations()` - Automations list
- `useToggleShopifyAutomation()` - Toggle automation mutation
- `useUpdateShopifyAutomation()` - Update automation mutation
- `useShopifyTemplates()` - Templates list
- `useShopifySettings()` - Settings data
- `useUpdateShopifySettings()` - Update settings mutation

## Authentication

### Token Storage
- **Retail Token**: Stored in Redux (`auth.retailToken`) and localStorage (`retail_auth_token`)
- **Shopify Token**: Stored in Redux (`auth.shopifyToken`) and localStorage (`shopify_auth_token`)
- **Login Pages**: Temporary token input pages at `/retail/login` and `/shopify/login`

### Token Management
- Tokens are automatically added to API requests via Axios interceptors
- On 401 responses, tokens are cleared and users are redirected to the respective login page
- Tokens persist across page refreshes via localStorage

## Layout Structure

### AppShell
- **File**: `apps/web/src/layout/AppShell.jsx`
- **Usage**: Wraps all Retail and Shopify routes (not the marketing landing page)
- **Features**:
  - Dynamic navigation based on current route (`/retail/*` vs `/shopify/*`)
  - Sidebar with area-specific navigation
  - Logout functionality (clears appropriate token)
  - "Back to Home" link in top bar

### Marketing Landing Page
- **File**: `apps/web/src/features/marketing/pages/LandingPage.jsx`
- **Usage**: Renders directly at `/` (not wrapped in AppShell)
- **Features**:
  - Dark-mode design
  - Product comparison (Retail vs Shopify)
  - Feature highlights
  - CTAs to both application areas

## Environment Variables

### Frontend (`apps/web/.env`)
- `VITE_APP_URL` - Public URL of the frontend (e.g., `https://astronote.onrender.com`)
- `VITE_RETAIL_API_BASE_URL` - Retail API base URL (e.g., `https://astronote-retail.onrender.com`)
- `VITE_SHOPIFY_API_BASE_URL` - Shopify API base URL (e.g., `https://astronote-shopify.onrender.com`)

## Notes

- All Retail pages use `axiosRetail` client and Retail-specific hooks
- All Shopify pages use `axiosShopify` client and Shopify-specific hooks
- Dashboard pages embed "Reports widgets" (no separate `/reports` page)
- Campaign creation supports "Create & Send Now" with idempotency keys
- All mutations show toast notifications on success/error
- Loading and error states are handled consistently across all pages
