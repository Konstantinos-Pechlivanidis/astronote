# Shopify App — Production Readiness Audit

**Date:** 2025-01-27  
**Scope:** Frontend `apps/astronote-web` (Shopify section), Backend `apps/shopify-api` (read-only unless critical fix), Reference `apps/astronote-shopify-frontend` (functionality only)  
**Status:** In Progress

---

## A) Route Map

### All `/app/shopify/*` Routes

| Route | File Path | Status | Functionality |
|-------|-----------|--------|---------------|
| `/app/shopify/dashboard` | `app/shopify/dashboard/page.tsx` | ✅ Implemented | KPI cards (Credits, Campaigns, Contacts, Messages, Automations) |
| `/app/shopify/campaigns` | `app/shopify/campaigns/page.tsx` | ✅ Implemented | List campaigns with filters, stats, pagination |
| `/app/shopify/campaigns/new` | `app/shopify/campaigns/new/page.tsx` | ✅ Implemented | Create campaign form (name, message, audience, discount, schedule) |
| `/app/shopify/campaigns/[id]` | `app/shopify/campaigns/[id]/page.tsx` | ✅ Implemented | Campaign detail (info, message, metrics, actions, preview, failed recipients) |
| `/app/shopify/campaigns/[id]/edit` | `app/shopify/campaigns/[id]/edit/page.tsx` | ✅ Implemented | Edit campaign form |
| `/app/shopify/campaigns/[id]/stats` | `app/shopify/campaigns/[id]/stats/page.tsx` | ✅ Implemented | Detailed campaign statistics |
| `/app/shopify/campaigns/[id]/status` | `app/shopify/campaigns/[id]/status/page.tsx` | ✅ Implemented | Real-time status with polling (queued, processed, sent, failed) |
| `/app/shopify/contacts` | `app/shopify/contacts/page.tsx` | ✅ Implemented | List contacts with search, filters, bulk actions, export |
| `/app/shopify/contacts/new` | `app/shopify/contacts/new/page.tsx` | ✅ Implemented | Create contact form |
| `/app/shopify/contacts/[id]` | `app/shopify/contacts/[id]/page.tsx` | ✅ Implemented | Contact detail with inline edit |
| `/app/shopify/contacts/import` | `app/shopify/contacts/import/page.tsx` | ✅ Implemented | CSV import with preview |
| `/app/shopify/templates` | `app/shopify/templates/page.tsx` | ✅ Implemented | List templates with search, filter, preview, favorites |
| `/app/shopify/templates/[id]` | `app/shopify/templates/[id]/page.tsx` | ✅ Implemented | Template detail with statistics |
| `/app/shopify/automations` | `app/shopify/automations/page.tsx` | ✅ Implemented | List automations with stats, toggle, delete |
| `/app/shopify/automations/new` | `app/shopify/automations/new/page.tsx` | ✅ Implemented | Create automation form |
| `/app/shopify/automations/[id]` | `app/shopify/automations/[id]/page.tsx` | ✅ Implemented | Edit automation form |
| `/app/shopify/billing` | `app/shopify/billing/page.tsx` | ✅ Implemented | Balance, subscription, top-up, packages, history |
| `/app/shopify/billing/success` | `app/shopify/billing/success/page.tsx` | ✅ Implemented | Payment success page with auto-redirect |
| `/app/shopify/billing/cancel` | `app/shopify/billing/cancel/page.tsx` | ✅ Implemented | Payment cancel page |
| `/app/shopify/settings` | `app/shopify/settings/page.tsx` | ✅ Implemented | Settings tabs (General, SMS, Integrations, Account) |
| `/app/shopify/auth/login` | `app/shopify/auth/login/page.tsx` | ✅ Implemented | Login page (embedded auto-auth, standalone OAuth) |
| `/app/shopify/auth/callback` | `app/shopify/auth/callback/page.tsx` | ✅ Implemented | OAuth callback handler |
| `/app/shopify/reports` | `app/shopify/reports/page.tsx` | ⚠️ Placeholder | **DEFERRED — DO NOT IMPLEMENT** (explicitly out of scope) |

**Total Routes:** 23 (22 implemented + 1 deferred placeholder)

---

## B) Auth & Redirect Matrix (Embedded Correctness)

### Session Token Exchange

| Flow | Trigger | Code Location | Expected Behavior (Embedded) | Expected Behavior (Production) | Status |
|------|---------|---------------|------------------------------|--------------------------------|--------|
| **Embedded Auto-Auth** | Page load in iframe with `window.shopify.sessionToken` | `app/shopify/layout.tsx:46-76` | Auto-exchange session token → store JWT → proceed | Same | ✅ |
| **Standalone OAuth** | User enters shop domain → clicks "Log in" | `app/shopify/auth/login/page.tsx:51-67` | Top-level redirect to backend OAuth endpoint | Same | ✅ |
| **OAuth Callback** | Backend redirects with `?token=...` | `app/shopify/auth/callback/page.tsx:19-123` | Store token → verify → redirect to dashboard | Same | ✅ |

**Evidence:**
- Session token utility: `src/lib/shopify/auth/session-token.ts`
- Token exchange API: `src/lib/shopify/api/auth.ts:26-40`
- Backend endpoint: `apps/shopify-api/routes/auth.js:21-49` (POST `/auth/shopify-token`)

### Auth Verification on First Load

| Flow | Trigger | Code Location | Expected Behavior | Status |
|------|---------|---------------|-------------------|--------|
| **Token Verification** | Layout loads with stored token | `app/shopify/layout.tsx:79-101` | Call `verifyToken()` → if valid, proceed; if invalid, clear token → redirect to login | ✅ |
| **Token Refresh** | Not implemented | N/A | Token refresh endpoint exists but not used in layout | 🟡 Partial |

**Evidence:**
- Verify endpoint: `src/lib/shopify/api/auth.ts:46-66` (GET `/auth/verify`)
- Refresh endpoint: `src/lib/shopify/api/auth.ts:72-82` (POST `/auth/refresh`) — **Not used in layout**

### 401 Handling / Re-Auth Strategy

| Flow | Trigger | Code Location | Expected Behavior | Status |
|------|---------|---------------|-------------------|--------|
| **401 Response Interceptor** | Any API call returns 401 | `src/lib/shopify/api/axios.ts:73-87` | Clear token → redirect to `/app/shopify/auth/login` | ✅ |
| **Layout Auth Guard** | Token verification fails | `app/shopify/layout.tsx:88-100` | Clear token → set error → redirect to login | ✅ |
| **Re-Auth in Embedded** | After 401, if session token exists | `app/shopify/layout.tsx:46-76` | Auto-exchange session token again | ✅ |

**Evidence:**
- Axios interceptor: `src/lib/shopify/api/axios.ts:64-91`
- Layout guard: `app/shopify/layout.tsx:30-137`

### Redirect Rules

| Redirect Type | When to Use | Code Location | Expected Behavior | Status |
|---------------|-------------|--------------|-------------------|--------|
| **Top-Level Redirect** | OAuth, logout, external URLs | `src/lib/shopify/auth/redirect.ts:11-19` | `window.top.location.href = url` (breaks iframe) | ✅ |
| **Internal Navigation** | Same-origin page navigation | `src/lib/shopify/auth/redirect.ts:27-29` | `router.push(path)` (stays in iframe) | ✅ |
| **OAuth Redirect** | Standalone login | `app/shopify/auth/login/page.tsx:66` | Uses `topLevelRedirect()` | ✅ |
| **Post-Auth Redirect** | After token exchange/callback | `app/shopify/auth/callback/page.tsx:110`, `app/shopify/auth/login/page.tsx:41` | Uses `router.push('/app/shopify/dashboard')` | ✅ |

**Issues Found:**
- ❌ **Issue 1:** In `app/shopify/auth/callback/page.tsx:117`, redirect path is `/shopify/auth/login` (missing `/app` prefix) — should be `/app/shopify/auth/login`
- ✅ All other redirects use correct paths

**Evidence:**
- Redirect utility: `src/lib/shopify/auth/redirect.ts`
- Usage in login: `app/shopify/auth/login/page.tsx:41,66`
- Usage in callback: `app/shopify/auth/callback/page.tsx:30,40,97,110,117`

### Callback Handling

| Flow | Trigger | Code Location | Expected Behavior | Status |
|------|---------|---------------|-------------------|--------|
| **Token from Query** | `?token=...` in callback URL | `app/shopify/auth/callback/page.tsx:22` | Extract token → store → verify → redirect | ✅ |
| **Error from Query** | `?error=...` in callback URL | `app/shopify/auth/callback/page.tsx:23-33` | Show error → redirect to login after 3s | ✅ |
| **Token Decode** | Extract store info from JWT | `app/shopify/auth/callback/page.tsx:49-66` | Decode JWT payload → extract `storeId`, `shopDomain` → store | ✅ |
| **Token Verify** | Verify token with backend | `app/shopify/auth/callback/page.tsx:69-103` | Call `/auth/verify` → get full store info → store | ✅ |

**Evidence:**
- Callback page: `app/shopify/auth/callback/page.tsx`

### Shop Tenancy

| Mechanism | Code Location | Expected Behavior | Status |
|-----------|---------------|-------------------|--------|
| **JWT Token** | `src/lib/shopify/api/axios.ts:22-25` | `Authorization: Bearer <token>` header on all requests | ✅ |
| **X-Shopify-Shop-Domain Header** | `src/lib/shopify/api/axios.ts:27-53` | Fallback header from localStorage or JWT payload | ✅ |
| **Backend Store Resolution** | `apps/shopify-api/middlewares/store-resolution.js` | JWT token (priority) → headers → query params | ✅ |

**Evidence:**
- Axios interceptor: `src/lib/shopify/api/axios.ts:18-61`
- Backend middleware: `apps/shopify-api/middlewares/store-resolution.js:23-410`

---

## C) UX/UI Consistency Checklist (Must Match Retail)

### UI Kit Component Usage

| Component | Retail Usage | Shopify Usage | Status | Notes |
|-----------|-------------|---------------|--------|-------|
| **PageHeader** | `RetailPageHeader` | `RetailPageHeader` | ✅ | Same component |
| **Card** | `RetailCard` | `RetailCard` | ✅ | Same component |
| **DataTable** | `RetailDataTable` | `RetailDataTable` | ✅ | Same component |
| **FormField** | `RetailFormField` | Not used (direct Input/Textarea) | 🟡 Partial | Shopify uses direct shadcn components |
| **Buttons** | `Button` (shadcn) | `Button` (shadcn) | ✅ | Same component |
| **Skeletons** | Custom skeletons | Custom skeletons | ✅ | Same pattern |
| **Alerts** | `RetailCard variant="danger"` | `RetailCard variant="danger"` | ✅ | Same pattern |

**Evidence:**
- Retail components: `src/components/retail/`
- Shopify usage: All pages in `app/shopify/`

### Spacing / Typography / Radius Consistency

| Aspect | Retail Pattern | Shopify Pattern | Status | Notes |
|--------|---------------|----------------|--------|-------|
| **Page Padding** | `p-6 lg:p-8` | `p-6 lg:p-8` (in ShopifyShell) | ✅ | Consistent |
| **Card Padding** | `p-6` | `p-6` | ✅ | Consistent |
| **Gap Between Cards** | `gap-4 sm:gap-6` | `gap-4 sm:gap-6` | ✅ | Consistent |
| **Typography Scale** | `text-3xl` (h1), `text-sm` (secondary) | `text-3xl` (h1), `text-sm` (secondary) | ✅ | Consistent |
| **Border Radius** | `rounded-xl` (cards), `rounded-lg` (buttons) | `rounded-xl` (cards), `rounded-lg` (buttons) | ✅ | Consistent |
| **Minimum Hit Targets** | `min-h-[44px]` | `min-h-[44px]` | ✅ | Consistent |

**Evidence:**
- Retail dashboard: `app/(retail)/app/retail/dashboard/page.tsx`
- Shopify dashboard: `app/shopify/dashboard/page.tsx`

### Light Mode Contrast

| Element | Retail | Shopify | Status | Notes |
|---------|--------|---------|--------|-------|
| **Background** | `bg-background` | `bg-background` | ✅ | Same |
| **Card Surface** | `glass` (glass-card) | `glass` (glass-card) | ✅ | Same |
| **Text Primary** | `text-text-primary` | `text-text-primary` | ✅ | Same |
| **Text Secondary** | `text-text-secondary` | `text-text-secondary` | ✅ | Same |
| **Border** | `border-border` | `border-border` | ✅ | Same |
| **Surface Separation** | `bg-surface-light` (skeletons) | `bg-surface-light` (skeletons) | ✅ | Same |

**Evidence:**
- Both use same Tailwind classes and design tokens

### Tiffany Accent Usage (#0ABAB5)

| Usage | Retail | Shopify | Status | Notes |
|-------|--------|---------|--------|-------|
| **Primary Buttons** | `bg-accent` | `bg-accent` | ✅ | Same |
| **Focus Rings** | `focus:ring-accent` | `focus:ring-accent` | ✅ | Same |
| **Active Nav** | `bg-accent-light text-accent` | `bg-accent-light text-accent` | ✅ | Same |
| **Icons** | `text-accent` | `text-accent` | ✅ | Same |

**Evidence:**
- Both use `accent` token (defined in Tailwind config)

### Responsive Behavior

| Breakpoint | Retail | Shopify | Status | Notes |
|------------|--------|---------|--------|-------|
| **Mobile (default)** | 1 column | 1 column | ✅ | Consistent |
| **Tablet (sm:)** | 2 columns | 2 columns | ✅ | Consistent |
| **Desktop (lg:)** | 4 columns | 4 columns | ✅ | Consistent |
| **Navigation** | Sidebar (desktop), horizontal (mobile) | Sidebar (desktop), horizontal (mobile) | ✅ | Consistent |

**Evidence:**
- Grid patterns: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (both)

---

## D) Production Bugs/Edge Cases Checklist

### Double-Click Send Protections / Idempotency-Key

| Feature | Implementation | Status | Evidence |
|---------|----------------|--------|----------|
| **Campaign Enqueue** | `Idempotency-Key` header generated per request | ✅ | `src/lib/shopify/api/campaigns.ts:222-235` |
| **Campaign Schedule** | `Idempotency-Key` header generated per request | ✅ | `src/lib/shopify/api/campaigns.ts:334-346` |
| **Button Disabled State** | `disabled={enqueueCampaign.isPending}` | ✅ | `app/shopify/campaigns/[id]/page.tsx:194` |
| **Idempotency Key Generation** | `crypto.randomUUID()` with fallback | ✅ | `src/lib/shopify/api/campaigns.ts:225-228` |

**Issues Found:**
- ✅ All mutations use `isPending` to disable buttons
- ✅ Idempotency keys are generated correctly

**Evidence:**
- Campaign mutations: `src/lib/shopify/api/campaigns.ts:enqueueCampaign`, `scheduleCampaign`
- Button states: All mutation buttons check `isPending`

### Polling Start/Stop Correctness

| Feature | Implementation | Status | Evidence |
|---------|----------------|--------|----------|
| **Campaign Status Polling** | `refetchInterval: isActive ? 30 * 1000 : false` | ✅ | `app/shopify/campaigns/[id]/status/page.tsx:27-30` |
| **Polling Cleanup** | React Query handles cleanup automatically | ✅ | N/A (React Query feature) |
| **Conditional Polling** | Only polls when `isActive` (sending/scheduled) | ✅ | `app/shopify/campaigns/[id]/status/page.tsx:26-30` |

**Issues Found:**
- ✅ Polling stops correctly when campaign is not active
- ✅ No memory leaks (React Query handles cleanup)

**Evidence:**
- Status page: `app/shopify/campaigns/[id]/status/page.tsx:26-30`

### Global Overlays Not Blocking Navigation

| Feature | Implementation | Status | Evidence |
|---------|----------------|--------|----------|
| **Error States** | Inline alerts in cards, not full-screen overlays | ✅ | `app/shopify/dashboard/page.tsx:95-151` |
| **Loading States** | Skeletons, not blocking overlays | ✅ | All pages use skeletons |
| **Navigation Always Accessible** | Sidebar always visible, no blocking modals | ✅ | `src/components/shopify/ShopifyShell.tsx` |

**Issues Found:**
- ✅ No blocking overlays found
- ✅ Navigation remains accessible during errors/loading

**Evidence:**
- Dashboard error: `app/shopify/dashboard/page.tsx:95-151`
- All pages use inline error states

### Error Handling (Inline + Retry; No Silent Failures)

| Feature | Implementation | Status | Evidence |
|---------|----------------|--------|----------|
| **Inline Errors** | Error cards with retry buttons | ✅ | `app/shopify/dashboard/page.tsx:104-121` |
| **Toast Notifications** | Not implemented (could be added) | 🟡 Partial | N/A |
| **Retry Buttons** | `onClick={() => refetch()}` | ✅ | All error states have retry |
| **Silent Failures** | All errors are displayed | ✅ | No silent failures found |

**Issues Found:**
- ✅ All errors are displayed inline
- 🟡 Toast notifications not implemented (optional enhancement)

**Evidence:**
- Dashboard error: `app/shopify/dashboard/page.tsx:104-121`
- All pages show errors inline

### No Hardcoded Localhost URLs

| Location | Search Pattern | Status | Evidence |
|----------|---------------|--------|----------|
| **All Shopify Pages** | `localhost`, `127.0.0.1` | ✅ | No hardcoded localhost found |
| **API Base URL** | Uses `NEXT_PUBLIC_SHOPIFY_API_BASE_URL` | ✅ | `src/lib/shopify/config.ts` |
| **Webhook URL** | Uses `window.location.origin` | ✅ | `app/shopify/settings/page.tsx:120` |

**Issues Found:**
- ✅ No hardcoded localhost URLs
- ✅ All URLs use environment variables or `window.location.origin`

**Evidence:**
- Config: `src/lib/shopify/config.ts`
- Webhook URL: `app/shopify/settings/page.tsx:120`

### No Debug Logs in Production

| Location | Search Pattern | Status | Evidence |
|----------|---------------|--------|----------|
| **Shopify Pages** | `console.log`, `console.error`, `console.warn` | ⚠️ Found | 8 instances found |
| **API Modules** | `console.log`, `console.error` | ✅ | No debug logs in API modules |
| **Hooks** | `console.log`, `console.error` | ✅ | No debug logs in hooks |

**Issues Found:**
- ❌ **Issue 2:** 8 console statements found in Shopify pages:
  - `app/shopify/layout.tsx:69,89,109` (3 errors)
  - `app/shopify/auth/callback/page.tsx:65,89,102` (1 warn, 2 errors)
  - `app/shopify/settings/page.tsx:127` (1 error)
  - `app/shopify/contacts/import/page.tsx:161` (1 error)

**Action Required:**
- Remove or guard console statements for production

**Evidence:**
- Grep results: Found 8 console statements

---

## E) Issues Summary

### Critical Issues (Must Fix)

1. ✅ **FIXED: Redirect Path Error** (`app/shopify/auth/callback/page.tsx:117`, `src/lib/shopify/api/axios.ts:83-84`)
   - **Issue:** Redirect paths were `/shopify/auth/login` (missing `/app` prefix)
   - **Fix:** Changed to `/app/shopify/auth/login` in both locations
   - **Status:** Fixed

2. ✅ **FIXED: Debug Logs in Production** (8 instances)
   - **Issue:** Console statements in production code
   - **Fix:** Guarded with `if (process.env.NODE_ENV === 'development')` in all 8 locations
   - **Status:** Fixed

### Minor Issues (Should Fix)

3. 🟡 **Token Refresh Not Used**
   - **Issue:** Refresh endpoint exists but not used in layout
   - **Fix:** Implement token refresh on 401 (optional enhancement)
   - **Priority:** Low

4. 🟡 **Toast Notifications Not Implemented**
   - **Issue:** No toast notifications for success/error feedback
   - **Fix:** Add toast notifications (optional enhancement)
   - **Priority:** Low

---

## F) Manual Smoke Tests (Must Pass)

### Test 1: Login/Auth
1. Open `/app/shopify/auth/login` in embedded iframe
2. If session token exists, should auto-exchange and redirect to dashboard
3. If no session token, enter shop domain → click "Log in" → should redirect to OAuth
4. After OAuth callback, should store token and redirect to dashboard
5. **Expected:** Seamless auth flow, no errors

### Test 2: Dashboard
1. Navigate to `/app/shopify/dashboard`
2. Should load KPI cards (Credits, Campaigns, Contacts, Messages)
3. If error, should show inline error card with retry button
4. Navigation should remain accessible
5. **Expected:** KPIs load, errors are inline, navigation works

### Test 3: Campaign Create/Send/Schedule
1. Navigate to `/app/shopify/campaigns/new`
2. Fill form (name, message, audience, discount)
3. Click "Send Now" → should create and redirect to detail page
4. On detail page, click "Send Campaign" → should enqueue with idempotency key
5. Button should disable during request
6. **Expected:** Campaign created, sent, button disabled during request

### Test 4: Campaign Status Polling
1. Navigate to `/app/shopify/campaigns/[id]/status`
2. If campaign is active (sending/scheduled), should poll every 30s
3. If campaign is not active, should not poll
4. Navigate away → polling should stop (React Query cleanup)
5. **Expected:** Polling works correctly, stops when inactive or on navigation

### Test 5: Templates
1. Navigate to `/app/shopify/templates`
2. Search/filter templates
3. Click "Use Template" → should prefill campaign form
4. **Expected:** Template prefill works, navigation to campaign create

### Test 6: Automations
1. Navigate to `/app/shopify/automations`
2. Toggle automation status (Activate/Pause)
3. Refresh page → status should persist
4. **Expected:** Status toggle works, persists after refresh

### Test 7: Billing
1. Navigate to `/app/shopify/billing`
2. Click "Manage Subscription" → should redirect to Stripe portal
3. Click "Buy Credits" → should redirect to Stripe checkout
4. After payment, should redirect to success page
5. **Expected:** Stripe redirects work, success page shows

### Test 8: Settings
1. Navigate to `/app/shopify/settings`
2. Update Sender ID → click "Save"
3. Button should disable during request
4. After save, should show success (or error if invalid)
5. **Expected:** Settings update works, button disabled during request

---

## G) Deferred Features

### Reports Page
- **Status:** DEFERRED — DO NOT IMPLEMENT
- **Location:** `app/shopify/reports/page.tsx` (placeholder)
- **Navigation:** Not accessible (removed from `ShopifyShell.tsx`)
- **Reason:** Explicitly out of scope per requirements

---

## H) Next Steps

1. ✅ Fix redirect path error in callback page and axios interceptor
2. ✅ Remove/guard console statements (8 instances)
3. ⏳ Run build and lint (pending - sandbox restrictions)
4. ⏳ Verify all smoke tests pass (pending - manual testing required)
5. ✅ Update this document with final status

---

**Last Updated:** 2025-01-27  
**Status:** Critical fixes completed — Build/lint pending (sandbox restrictions)

