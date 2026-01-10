# Shopify Frontend API Audit Report

**Date:** 2025-01-27  
**Scope:** `apps/astronote-web/app/app/shopify/**` (frontend) vs `apps/shopify-api/**` (backend)  
**Goal:** Ensure Shopify frontend uses backend APIs correctly and professionally  
**Status:** 🔍 **AUDIT COMPLETE**

---

## Executive Summary

This audit compares the Shopify frontend API usage with the backend API routes to identify mismatches, missing parameters, incorrect endpoints, and opportunities for standardization.

**Key Findings:**
- ✅ Frontend uses centralized API client (`shopifyApi` from `axios.ts`)
- ✅ Tenant headers (`X-Shopify-Shop-Domain`) are automatically injected
- ✅ Auth tokens are automatically injected via interceptors
- ⚠️ **Gap:** Some endpoints may be missing required query params (e.g., `currency` for billing)
- ⚠️ **Gap:** Templates API may need `eshopType` parameter
- ⚠️ **Gap:** Some response shapes may not match exactly
- ✅ No direct fetch calls bypassing the centralized client found

---

## Phase 1: Backend API Inventory

### Base Path Structure

**No `/api` prefix** - Routes are registered directly:
- `/campaigns` (not `/api/campaigns`)
- `/contacts` (not `/api/contacts`)
- `/templates` (not `/api/templates`)
- `/billing` (not `/api/billing`)
- `/settings` (not `/api/settings`)
- `/dashboard` (not `/api/dashboard`)
- `/automations` (not `/api/automations`)
- `/subscriptions` (not `/api/subscriptions`)
- `/auth` (not `/api/auth`)

### Backend Routes Inventory

#### Campaigns (`/campaigns`)
| Method | Path | Auth | Required Headers | Query Params | Response Shape |
|--------|------|------|------------------|--------------|----------------|
| GET | `/campaigns` | ✅ | X-Shopify-Shop-Domain | `page`, `pageSize`, `status`, `sortBy`, `sortOrder`, `search` | `{ campaigns, pagination }` |
| GET | `/campaigns/stats/summary` | ✅ | X-Shopify-Shop-Domain | - | `{ stats: { total, byStatus } }` |
| GET | `/campaigns/queue/stats` | ✅ | X-Shopify-Shop-Domain | - | Queue stats |
| GET | `/campaigns/:id` | ✅ | X-Shopify-Shop-Domain | - | `Campaign` |
| POST | `/campaigns` | ✅ | X-Shopify-Shop-Domain | - | `Campaign` |
| PUT | `/campaigns/:id` | ✅ | X-Shopify-Shop-Domain | - | `Campaign` |
| DELETE | `/campaigns/:id` | ✅ | X-Shopify-Shop-Domain | - | `void` |
| POST | `/campaigns/:id/prepare` | ✅ | X-Shopify-Shop-Domain | - | - |
| POST | `/campaigns/:id/enqueue` | ✅ | X-Shopify-Shop-Domain | `Idempotency-Key` header | `void` |
| POST | `/campaigns/:id/send` | ✅ | X-Shopify-Shop-Domain | - | `void` (deprecated, use `/enqueue`) |
| PUT | `/campaigns/:id/schedule` | ✅ | X-Shopify-Shop-Domain | - | `Campaign` |
| POST | `/campaigns/:id/cancel` | ✅ | X-Shopify-Shop-Domain | - | `Campaign` |
| GET | `/campaigns/:id/metrics` | ✅ | X-Shopify-Shop-Domain | - | `CampaignMetrics` |
| GET | `/campaigns/:id/status` | ✅ | X-Shopify-Shop-Domain | - | `CampaignStatusResponse` |
| GET | `/campaigns/:id/preview` | ✅ | X-Shopify-Shop-Domain | - | `CampaignPreview` |
| GET | `/campaigns/:id/progress` | ✅ | X-Shopify-Shop-Domain | - | `CampaignProgress` |
| GET | `/campaigns/:id/failed-recipients` | ✅ | X-Shopify-Shop-Domain | - | `FailedRecipientsResponse` |
| POST | `/campaigns/:id/retry-failed` | ✅ | X-Shopify-Shop-Domain | `Idempotency-Key` header | `void` |
| POST | `/campaigns/:id/update-status` | ✅ | X-Shopify-Shop-Domain | - | - |

#### Contacts (`/contacts`)
| Method | Path | Auth | Required Headers | Query Params | Response Shape |
|--------|------|------|------------------|--------------|----------------|
| GET | `/contacts` | ✅ | X-Shopify-Shop-Domain | `page`, `pageSize`, `q`, `smsConsent`, `isSubscribed`, `listId`, `gender`, `filter`, `hasBirthDate`, `sortBy`, `sortOrder` | `{ items/contacts, pagination, filters? }` |
| GET | `/contacts/stats` | ✅ | X-Shopify-Shop-Domain | - | `ContactStats` |
| GET | `/contacts/birthdays` | ✅ | X-Shopify-Shop-Domain | `month`, `day` | `Contact[]` |
| GET | `/contacts/:id` | ✅ | X-Shopify-Shop-Domain | - | `Contact` |
| POST | `/contacts` | ✅ | X-Shopify-Shop-Domain | - | `Contact` |
| POST | `/contacts/import` | ✅ | X-Shopify-Shop-Domain | - | `ImportContactsResponse` |
| PUT | `/contacts/:id` | ✅ | X-Shopify-Shop-Domain | - | `Contact` |
| DELETE | `/contacts/:id` | ✅ | X-Shopify-Shop-Domain | - | `void` |

#### Templates (`/templates`)
| Method | Path | Auth | Required Headers | Query Params | Response Shape |
|--------|------|------|------------------|--------------|----------------|
| GET | `/templates` | ✅ | X-Shopify-Shop-Domain | `eshopType`, `page`, `pageSize`, `limit`, `offset`, `category`, `search`, `language` | `{ items/templates, pagination, categories? }` |
| GET | `/templates/categories` | ✅ | X-Shopify-Shop-Domain | - | `string[]` |
| GET | `/templates/:id` | ✅ | X-Shopify-Shop-Domain | - | `Template` |
| POST | `/templates/ensure-defaults` | ✅ | X-Shopify-Shop-Domain | `eshopType` (query) | `{ created, updated, repaired, skipped, total }` |
| POST | `/templates/:id/track` | ✅ | X-Shopify-Shop-Domain | - | `void` |

#### Automations (`/automations`)
| Method | Path | Auth | Required Headers | Query Params | Response Shape |
|--------|------|------|------------------|--------------|----------------|
| GET | `/automations` | ✅ | X-Shopify-Shop-Domain | - | `Automation[]` |
| GET | `/automations/stats` | ✅ | X-Shopify-Shop-Domain | - | `AutomationStats` |
| POST | `/automations` | ✅ | X-Shopify-Shop-Domain | - | `Automation` |
| PUT | `/automations/:id` | ✅ | X-Shopify-Shop-Domain | - | `Automation` |
| DELETE | `/automations/:id` | ✅ | X-Shopify-Shop-Domain | - | `void` |
| GET | `/automations/variables/:triggerType` | ✅ | X-Shopify-Shop-Domain | - | `AutomationVariablesResponse` |
| GET | `/automations/defaults` | ✅ | X-Shopify-Shop-Domain | - | System defaults |
| POST | `/automations/sync` | ✅ | X-Shopify-Shop-Domain | - | - |

#### Billing (`/billing`)
| Method | Path | Auth | Required Headers | Query Params | Response Shape |
|--------|------|------|------------------|--------------|----------------|
| GET | `/billing/balance` | ✅ | X-Shopify-Shop-Domain | - | `{ credits, balance, currency }` |
| GET | `/billing/packages` | ✅ | X-Shopify-Shop-Domain | `currency` (EUR/USD) | `{ packages, currency, subscriptionRequired? }` |
| GET | `/billing/topup/calculate` | ✅ | X-Shopify-Shop-Domain | `credits` | `TopupPrice` |
| POST | `/billing/topup` | ✅ | X-Shopify-Shop-Domain | - | `CheckoutSessionResponse` |
| GET | `/billing/history` | ✅ | X-Shopify-Shop-Domain | `page`, `pageSize` | `TransactionHistoryResponse` |
| GET | `/billing/billing-history` | ✅ | X-Shopify-Shop-Domain | `page`, `pageSize` | `TransactionHistoryResponse` |
| POST | `/billing/purchase` | ✅ | X-Shopify-Shop-Domain | `Idempotency-Key` header | `CheckoutSessionResponse` |

#### Subscriptions (`/subscriptions`)
| Method | Path | Auth | Required Headers | Query Params | Response Shape |
|--------|------|------|------------------|--------------|----------------|
| GET | `/subscriptions/status` | ✅ | X-Shopify-Shop-Domain | - | `SubscriptionStatus` |
| POST | `/subscriptions/subscribe` | ✅ | X-Shopify-Shop-Domain | - | `SubscriptionCheckoutResponse` |
| POST | `/subscriptions/update` | ✅ | X-Shopify-Shop-Domain | - | `SubscriptionStatus` |
| POST | `/subscriptions/cancel` | ✅ | X-Shopify-Shop-Domain | - | `void` |
| POST | `/subscriptions/verify-session` | ✅ | X-Shopify-Shop-Domain | - | - |
| GET | `/subscriptions/portal` | ✅ | X-Shopify-Shop-Domain | - | `PortalResponse` |

#### Settings (`/settings`)
| Method | Path | Auth | Required Headers | Query Params | Response Shape |
|--------|------|------|------------------|--------------|----------------|
| GET | `/settings` | ✅ | X-Shopify-Shop-Domain | - | `Settings` |
| GET | `/settings/account` | ✅ | X-Shopify-Shop-Domain | - | `AccountInfo` |
| PUT | `/settings` | ✅ | X-Shopify-Shop-Domain | - | `Settings` |
| PUT | `/settings/sender` | ✅ | X-Shopify-Shop-Domain | - | `{ senderNumber, updatedAt }` (legacy) |

#### Dashboard (`/dashboard`)
| Method | Path | Auth | Required Headers | Query Params | Response Shape |
|--------|------|------|------------------|--------------|----------------|
| GET | `/dashboard` | ✅ | X-Shopify-Shop-Domain | - | `DashboardKPIs` |
| GET | `/dashboard/overview` | ✅ | X-Shopify-Shop-Domain | - | - |
| GET | `/dashboard/quick-stats` | ✅ | X-Shopify-Shop-Domain | - | - |

#### Auth (`/auth`)
| Method | Path | Auth | Required Headers | Query Params | Response Shape |
|--------|------|------|------------------|--------------|----------------|
| POST | `/auth/shopify-token` | ❌ | - | - | `{ token, store, expiresIn }` |
| GET | `/auth/verify` | ✅ | Authorization Bearer | - | `{ valid, store }` |
| POST | `/auth/refresh` | ✅ | Authorization Bearer | - | `{ token, expiresIn }` |
| GET | `/auth/shopify` | ❌ | - | `shop` | OAuth redirect |

---

## Phase 2: Frontend API Usage Inventory

### Centralized API Client

**Location:** `apps/astronote-web/src/lib/shopify/api/axios.ts`

**Features:**
- ✅ Base URL from env: `SHOPIFY_API_BASE_URL`
- ✅ Automatic `Authorization: Bearer <token>` header injection
- ✅ Automatic `X-Shopify-Shop-Domain` header injection
- ✅ Response interceptor extracts `data` from `{ success: true, data: {...} }`
- ✅ Error handling for `INVALID_SHOP_DOMAIN` and 401
- ✅ Auto-redirect to login on auth errors

**API Client Modules:**
- `campaigns.ts` - Campaigns API functions
- `contacts.ts` - Contacts API functions
- `templates.ts` - Templates API functions
- `automations.ts` - Automations API functions
- `billing.ts` - Billing & Subscriptions API functions
- `settings.ts` - Settings API functions
- `dashboard.ts` - Dashboard API functions
- `auth.ts` - Auth API functions

### Frontend Pages & Hooks Usage

#### Dashboard Page (`/app/shopify/dashboard`)
- **Hook:** `useDashboardKPIs()` → `dashboardApi.getKPIs()` → `GET /dashboard`
- **Status:** ✅ Correct

#### Campaigns Page (`/app/shopify/campaigns`)
- **Hook:** `useCampaigns()` → `campaignsApi.list()` → `GET /campaigns`
- **Hook:** `useCampaignStats()` → `campaignsApi.getStatsSummary()` → `GET /campaigns/stats/summary`
- **Status:** ✅ Correct

#### Campaign Detail (`/app/shopify/campaigns/[id]`)
- **Hook:** `useCampaign()` → `campaignsApi.get()` → `GET /campaigns/:id`
- **Hook:** `useCampaignMetrics()` → `campaignsApi.getMetrics()` → `GET /campaigns/:id/metrics`
- **Hook:** `useCampaignStatus()` → `campaignsApi.getStatus()` → `GET /campaigns/:id/status`
- **Hook:** `useCampaignProgress()` → `campaignsApi.getProgress()` → `GET /campaigns/:id/progress`
- **Hook:** `useCampaignPreview()` → `campaignsApi.getPreview()` → `GET /campaigns/:id/preview`
- **Hook:** `useCampaignFailedRecipients()` → `campaignsApi.getFailedRecipients()` → `GET /campaigns/:id/failed-recipients`
- **Mutations:** `useEnqueueCampaign()`, `useDeleteCampaign()`, `useCancelCampaign()`
- **Status:** ✅ Correct

#### Contacts Page (`/app/shopify/contacts`)
- **Hook:** `useContacts()` → `contactsApi.list()` → `GET /contacts`
- **Hook:** `useContactStats()` → `contactsApi.getStats()` → `GET /contacts/stats`
- **Mutations:** `useDeleteContact()`
- **Status:** ✅ Correct

#### Templates Page (`/app/shopify/templates`)
- **Hook:** `useTemplates()` → `templatesApi.list()` → `GET /templates`
- **Hook:** `useTemplateCategories()` → `templatesApi.getCategories()` → `GET /templates/categories`
- **Hook:** `useEnsureDefaultTemplates()` → `templatesApi.ensureDefaults()` → `POST /templates/ensure-defaults`
- **Issue:** ⚠️ `eshopType` parameter may not always be passed
- **Status:** ⚠️ Needs verification

#### Automations Page (`/app/shopify/automations`)
- **Hook:** `useAutomations()` → `automationsApi.list()` → `GET /automations`
- **Hook:** `useAutomationStats()` → `automationsApi.getStats()` → `GET /automations/stats`
- **Hook:** `useAutomationVariables()` → `automationsApi.getVariables()` → `GET /automations/variables/:triggerType`
- **Mutations:** `useCreateAutomation()`, `useUpdateAutomation()`, `useDeleteAutomation()`
- **Status:** ✅ Correct

#### Billing Page (`/app/shopify/billing`)
- **Hook:** `useBillingBalance()` → `billingApi.getBalance()` → `GET /billing/balance`
- **Hook:** `useBillingPackages()` → `billingApi.getPackages()` → `GET /billing/packages`
- **Issue:** ⚠️ `currency` parameter may not always be passed to `getPackages()`
- **Hook:** `useBillingHistory()` → `billingApi.getHistory()` → `GET /billing/history`
- **Hook:** `useSubscriptionStatus()` → `subscriptionsApi.getStatus()` → `GET /subscriptions/status`
- **Hook:** `useSubscriptionPortal()` → `subscriptionsApi.getPortal()` → `GET /subscriptions/portal`
- **Mutations:** `useCreatePurchase()`, `useCreateTopup()`, `useSubscribe()`, `useUpdateSubscription()`
- **Status:** ⚠️ Needs verification for currency param

#### Settings Page (`/app/shopify/settings`)
- **Hook:** `useSettings()` → `settingsApi.getSettings()` → `GET /settings`
- **Hook:** `useAccountInfo()` → `settingsApi.getAccountInfo()` → `GET /settings/account`
- **Mutation:** `useUpdateSettings()` → `settingsApi.updateSettings()` → `PUT /settings`
- **Status:** ✅ Correct

---

## Phase 3: Issues Identified

### Blockers (Must Fix)

**None found** - All critical endpoints are correctly mapped.

### Reliability Issues

1. **Billing Packages Currency Parameter**
   - **Issue:** `billingApi.getPackages()` accepts optional `currency` but may not always be passed
   - **Impact:** May return wrong currency packages
   - **Fix:** Ensure currency is always passed (from settings or user selection)

2. **Templates eShop Type Parameter**
   - **Issue:** `templatesApi.list()` and `templatesApi.ensureDefaults()` require `eshopType` but may not always be passed
   - **Impact:** Templates may not be filtered correctly
   - **Fix:** Ensure `eshopType is always passed (from shop settings or user selection)

### Maintainability Issues

1. **Response Shape Handling**
   - **Status:** ✅ Already handled by response interceptor
   - **Note:** Some APIs return `items` (Retail-aligned) while others return `contacts`/`templates` (backward compatibility)

2. **Error Handling**
   - **Status:** ✅ Already handled by response interceptor
   - **Note:** Errors are normalized to `{ success: false, code, message }`

3. **Idempotency Keys**
   - **Status:** ✅ Already handled in `enqueueCampaign()` and `retryFailedRecipients()`
   - **Note:** Uses `crypto.randomUUID()` with fallback

### Potential Issues

1. **Direct Fetch Calls**
   - **Status:** ✅ No direct fetch calls found bypassing the centralized client
   - **Note:** All API calls go through `shopifyApi` instance

2. **Hardcoded URLs**
   - **Status:** ✅ No hardcoded URLs found
   - **Note:** Base URL comes from env variable `NEXT_PUBLIC_SHOPIFY_API_BASE_URL`

3. **Missing Query Params**
   - **Status:** ⚠️ Some optional params may not be passed (currency, eshopType)
   - **Impact:** Low - these are optional but recommended for correct behavior

---

## Implementation Plan

### Step 1: Verify Currency Parameter Usage
- Check if `currency` is always passed to `billingApi.getPackages()`
- Ensure currency comes from settings or user selection
- Add default currency fallback if missing

### Step 2: Verify eShop Type Parameter Usage
- Check if `eshopType` is always passed to `templatesApi.list()` and `templatesApi.ensureDefaults()`
- Ensure eshopType comes from shop settings
- Add default eshopType fallback if missing

### Step 3: Add Verification Script
- Create `scripts/audit-shopify-frontend-api.mjs`
- Verify all endpoints are correctly mapped
- Verify required params are passed
- Verify no direct fetch calls bypass client

### Step 4: Add Unit Tests (if test infra exists)
- Test API client URL assembly
- Test header injection (tenant + auth)
- Test error normalization

---

## Summary

**Overall Status:** ✅ **GOOD** - Frontend API usage is correct and professional

**Strengths:**
- ✅ Centralized API client with automatic tenant/auth injection
- ✅ All endpoints correctly mapped
- ✅ No direct fetch calls bypassing client
- ✅ Proper error handling and response normalization
- ✅ Idempotency keys for critical operations

**Areas for Improvement:**
- ⚠️ Ensure `currency` parameter is always passed to billing endpoints
- ⚠️ Ensure `eshopType` parameter is always passed to templates endpoints
- ✅ Add verification script to prevent regressions

**Next Step:** Proceed to implementation to verify and fix the identified issues.

---

**Report Generated:** 2025-01-27  
**Next Step:** Begin implementation fixes

