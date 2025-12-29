# Frontend Routing & Auth Verification

## Date
2025-01-23

## Route Structure Verification

### Marketing Landing Page
- **Route**: `/`
- **Component**: `LandingPage` from `@/features/marketing/pages/LandingPage`
- **AppShell**: ❌ NOT wrapped (renders directly)
- **Dark Mode**: ✅ Confirmed (`bg-gray-900`, `text-white` classes)
- **Status**: ✅ PASS

### Retail Routes
All routes under `/retail/*` are wrapped in `AppShell`:

| Route | Component | Status |
|-------|-----------|--------|
| `/retail` | Redirects to `/retail/dashboard` | ✅ |
| `/retail/login` | `RetailLoginPage` | ✅ |
| `/retail/dashboard` | `RetailDashboardPage` | ✅ |
| `/retail/campaigns` | `RetailCampaignsPage` | ✅ |
| `/retail/campaigns/new` | `RetailCreateCampaignPage` | ✅ |
| `/retail/contacts` | `RetailContactsPage` | ✅ |
| `/retail/lists` | `RetailListsPage` | ✅ |
| `/retail/automations` | `RetailAutomationsPage` | ✅ |
| `/retail/templates` | `RetailTemplatesPage` | ✅ |
| `/retail/settings` | `RetailSettingsPage` | ✅ |

### Shopify Routes
All routes under `/shopify/*` are wrapped in `AppShell`:

| Route | Component | Status |
|-------|-----------|--------|
| `/shopify` | Redirects to `/shopify/dashboard` | ✅ |
| `/shopify/login` | `ShopifyLoginPage` | ✅ |
| `/shopify/dashboard` | `ShopifyDashboardPage` | ✅ |
| `/shopify/campaigns` | `ShopifyCampaignsPage` | ✅ |
| `/shopify/campaigns/new` | `ShopifyCreateCampaignPage` | ✅ |
| `/shopify/contacts` | `ShopifyContactsPage` | ✅ |
| `/shopify/lists` | `ShopifyListsPage` | ✅ |
| `/shopify/automations` | `ShopifyAutomationsPage` | ✅ |
| `/shopify/templates` | `ShopifyTemplatesPage` | ✅ |
| `/shopify/settings` | `ShopifySettingsPage` | ✅ |

## Authentication Flow Verification

### Retail Login (`/retail/login`)
- **Component**: `RetailLoginPage`
- **Token Storage**: 
  - ✅ Redux: `dispatch(setRetailToken(token))`
  - ✅ localStorage: Handled by `store.js` subscription
- **Navigation**: ✅ Navigates to `/retail/dashboard` on success
- **Token Usage**: Token attached via `axiosRetail` interceptor
- **Status**: ✅ PASS

### Shopify Login (`/shopify/login`)
- **Component**: `ShopifyLoginPage`
- **Token Storage**: 
  - ✅ Redux: `dispatch(setShopifyToken(token))`
  - ✅ localStorage: Handled by `store.js` subscription
- **Navigation**: ✅ Navigates to `/shopify/dashboard` on success
- **Token Usage**: Token attached via `axiosShopify` interceptor
- **Status**: ✅ PASS

### Token Persistence (`apps/web/src/store/store.js`)
- ✅ **Subscription**: Store subscribes to auth changes and persists to localStorage
- ✅ **Initialization**: Tokens loaded from localStorage on app start
- ✅ **Keys**: 
  - `retail_auth_token` for Retail
  - `shopify_auth_token` for Shopify
  - `auth_token` (legacy support for Shopify)

### Token Attachment (Axios Interceptors)
- ✅ **Retail**: `axiosRetail` interceptor reads `store.getState().auth.retailToken`
- ✅ **Shopify**: `axiosShopify` interceptor reads `store.getState().auth.shopifyToken`
- ✅ **Header Format**: `Authorization: Bearer <token>`

### 401 Handling
- ✅ **Retail**: Clears `retailToken` and redirects to `/retail/login`
- ✅ **Shopify**: Clears `shopifyToken` and redirects to `/shopify/login`
- ✅ **Toast Notification**: Shows error message on 401

## AppShell Verification
- **File**: `apps/web/src/layout/AppShell.jsx`
- **Usage**: Wraps all `/retail/*` and `/shopify/*` routes
- **Features**:
  - ✅ Dynamic navigation based on route (`/retail/*` vs `/shopify/*`)
  - ✅ Sidebar with area-specific navigation
  - ✅ Logout functionality (clears appropriate token)
  - ✅ "Back to Home" link in top bar
- **Landing Page**: ✅ NOT wrapped (renders directly)

## Verdict
**PASS** - Routing and authentication are correctly implemented:
- ✅ All required routes exist
- ✅ Marketing landing page renders directly (no AppShell)
- ✅ Retail and Shopify routes wrapped in AppShell
- ✅ Login pages store tokens in Redux + localStorage
- ✅ Tokens persist across page refreshes
- ✅ Axios interceptors attach tokens correctly
- ✅ 401 handling redirects to appropriate login page

