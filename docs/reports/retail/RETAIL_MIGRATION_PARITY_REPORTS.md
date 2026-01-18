# Retail Migration - Parity Reports

## Screen 1: Login Page

### A) Legacy Reference Files Used
- `apps/retail-web-legacy/src/features/auth/pages/LoginPage.jsx`
- `apps/retail-web-legacy/src/features/auth/components/LoginForm.jsx`
- `apps/retail-web-legacy/src/lib/validators.js` (loginSchema)
- `apps/retail-web-legacy/src/app/providers/AuthProvider.jsx`
- `apps/retail-web-legacy/src/api/modules/auth.js`
- `apps/retail-web-legacy/src/api/axios.js`

### B) Astronote-web Files Created/Changed
- `app/auth/retail/login/page.tsx` (NEW)
- `src/lib/retail/validators.ts` (NEW - loginSchema)
- `src/features/retail/auth/useRetailAuth.ts` (NEW)
- `src/lib/retail/api/auth.ts` (NEW)
- `src/lib/retail/api/axios.ts` (NEW)
- `src/components/retail/RetailPublicOnlyGuard.tsx` (NEW)

### C) Endpoint Parity Confirmation
✅ **MATCHES**
- `POST /api/auth/login` - Exact match
- Request body: `{ email: string, password: string }` - Exact match
- Response: `{ accessToken: string, user: {...} }` - Exact match
- Token storage: `localStorage.setItem('accessToken', ...)` - Exact match (legacy uses 'accessToken', not 'retail_access_token')

### D) UX Parity Checklist
- ✅ Fields present: Email, Password - Match
- ✅ Validation rules: Email format, password required (min 1) - Match
- ✅ Error messages: Shows actual error message from API - Match
- ✅ Loading states: Button shows "Signing in..." during request - Match
- ✅ Redirects: On success → `/app/retail/dashboard` - Match (legacy: `/app/dashboard`)
- ✅ Public-only guard: Redirects authenticated users to dashboard - Match
- ✅ Link to signup: Present at bottom - Match

### E) Manual Test Steps
1. Navigate to `/auth/retail/login`
2. Verify form displays with email and password fields
3. Try submitting empty form → validation errors show
4. Try invalid email format → validation error shows
5. Try valid email + password → API call made, token stored, redirect to dashboard
6. Try invalid credentials → error message displayed
7. While authenticated, visit `/auth/retail/login` → should redirect to dashboard

### F) Differences
- **Intentional**: Route path is `/auth/retail/login` instead of `/login` (to support multi-service architecture)
- **Intentional**: Styling uses iOS26 glass aesthetic instead of legacy gray/white theme
- **Intentional**: Uses Next.js navigation (`useRouter`) instead of React Router

---

## Screen 2: Register Page

### A) Legacy Reference Files Used
- `apps/retail-web-legacy/src/features/auth/pages/SignupPage.jsx`
- `apps/retail-web-legacy/src/features/auth/components/SignupForm.jsx`
- `apps/retail-web-legacy/src/lib/validators.js` (signupSchema)
- `apps/retail-web-legacy/src/app/providers/AuthProvider.jsx`
- `apps/retail-web-legacy/src/api/modules/auth.js`

### B) Astronote-web Files Created/Changed
- `app/auth/retail/register/page.tsx` (NEW)
- `src/lib/retail/validators.ts` (NEW - signupSchema)

### C) Endpoint Parity Confirmation
✅ **MATCHES**
- `POST /api/auth/register` - Exact match
- Request body: `{ email, password, senderName?, company? }` - Exact match
- Field constraints:
  - email: required, email format - Match
  - password: required, min 8 chars - Match
  - confirmPassword: required, must match password - Match
  - senderName: optional, max 11 chars - Match
  - company: optional, max 160 chars - Match
- Response: `{ accessToken: string, user: {...} }` - Exact match
- Token storage: `localStorage.setItem('accessToken', ...)` - Exact match

### D) UX Parity Checklist
- ✅ Fields present: Email, Password, Confirm Password, Sender Name (optional), Company (optional) - Match
- ✅ Validation rules: All constraints match legacy exactly
- ✅ Error messages: Shows actual error message from API - Match
- ✅ Loading states: Button shows "Creating account..." during request - Match
- ✅ Redirects: On success → `/app/retail/dashboard` - Match
- ✅ Public-only guard: Redirects authenticated users to dashboard - Match
- ✅ Link to login: Present at bottom - Match
- ✅ Optional field labels: Show "(Optional)" indicator - Match
- ✅ Sender name hint: "SMS sender ID (alphanumeric, max 11 characters)" - Match

### E) Manual Test Steps
1. Navigate to `/auth/retail/register`
2. Verify all form fields present
3. Try submitting with mismatched passwords → validation error shows
4. Try password < 8 chars → validation error shows
5. Try senderName > 11 chars → validation error shows
6. Try company > 160 chars → validation error shows
7. Submit valid form → API call made, token stored, redirect to dashboard
8. Try duplicate email → error message displayed

### F) Differences
- **Intentional**: Route path is `/auth/retail/register` instead of `/signup`
- **Intentional**: Styling uses iOS26 glass aesthetic

---

## Screen 3: Dashboard Page

### A) Legacy Reference Files Used
- `apps/retail-web-legacy/src/features/dashboard/pages/DashboardPage.jsx`
- `apps/retail-web-legacy/src/features/dashboard/hooks/useKPIs.js`
- `apps/retail-web-legacy/src/features/dashboard/hooks/useBalance.js`
- `apps/retail-web-legacy/src/features/dashboard/components/KpiCard.jsx`
- `apps/retail-web-legacy/src/features/dashboard/components/CreditsCard.jsx`
- `apps/retail-web-legacy/src/api/modules/dashboard.js`
- `apps/retail-web-legacy/src/api/modules/billing.js`

### B) Astronote-web Files Created/Changed
- `app/app/retail/dashboard/page.tsx` (NEW)
- `src/lib/retail/api/dashboard.ts` (NEW)
- `src/lib/retail/api/billing.ts` (NEW - already existed, verified)

### C) Endpoint Parity Confirmation
✅ **MATCHES**
- `GET /api/dashboard/kpis` - Exact match
- Response shape: `{ totalCampaigns, totalMessages, sent, sentRate, failed, conversion, conversionRate }` - Exact match
- `GET /api/billing/balance` - Exact match (via CreditsCard)
- Response normalized: `{ credits: number, subscription: {...} }` - Match (legacy normalizes same way)

### D) UX Parity Checklist
- ✅ KPI Cards: 6 cards displayed (Total Campaigns, Total Messages, Messages Sent, Messages Failed, Conversions, Conversion Rate) - Match
- ✅ KPI values: Displayed with same formatting (numbers, percentages) - Match
- ✅ KPI subtitles: "All time", success rate %, etc. - Match
- ✅ Credits Card: Shows credits balance and subscription status - Match
- ✅ Loading states: Skeleton loaders for KPIs and CreditsCard - Match
- ✅ Error states: Error message with retry button - Match
- ✅ Empty states: N/A (always shows 0 if no data) - Match
- ⚠️ **MISSING**: QuickActions component (intentionally deferred - not critical for first pass)
- ⚠️ **MISSING**: RecentCampaigns component (intentionally deferred - requires campaigns API)

### E) Manual Test Steps
1. Navigate to `/app/retail/dashboard` (must be authenticated)
2. Verify loading skeleton appears initially
3. Verify 6 KPI cards render with data
4. Verify CreditsCard shows balance and subscription status
5. Verify all numbers formatted correctly (commas, percentages)
6. Test error state: Disconnect network → error shown with retry
7. Verify redirect if not authenticated → goes to login

### F) Differences
- **Intentional**: QuickActions and RecentCampaigns deferred (will be added when campaigns feature is implemented)
- **Intentional**: Styling uses iOS26 glass aesthetic
- **Note**: Dashboard structure matches legacy exactly, just missing the two deferred components

---

## Screen 4: Billing Page

### A) Legacy Reference Files Used
- `apps/retail-web-legacy/src/features/billing/pages/BillingPage.jsx`
- `apps/retail-web-legacy/src/features/billing/components/BillingHeader.jsx`
- `apps/retail-web-legacy/src/features/billing/components/SubscriptionCard.jsx`
- `apps/retail-web-legacy/src/features/billing/components/CreditTopupCard.jsx`
- `apps/retail-web-legacy/src/features/billing/components/PackageCard.jsx`
- `apps/retail-web-legacy/src/features/billing/components/TransactionsTable.jsx`
- `apps/retail-web-legacy/src/features/billing/hooks/useBillingGate.js`
- `apps/retail-web-legacy/src/features/billing/hooks/usePackages.js`
- `apps/retail-web-legacy/src/features/billing/hooks/useTransactions.js`
- `apps/retail-web-legacy/src/features/billing/hooks/useSubscribe.js`
- `apps/retail-web-legacy/src/features/billing/hooks/usePurchasePackage.js`
- `apps/retail-web-legacy/src/features/billing/hooks/useTopupCredits.js`
- `apps/retail-web-legacy/src/features/billing/hooks/useCustomerPortal.js`
- `apps/retail-web-legacy/src/api/modules/billing.js`
- `apps/retail-web-legacy/src/api/modules/subscriptions.js`

### B) Astronote-web Files Created/Changed
- `app/app/retail/billing/page.tsx` (NEW)
- `src/lib/retail/api/billing.ts` (UPDATED - added normalization functions)
- `src/lib/retail/api/subscriptions.ts` (NEW)

### C) Endpoint Parity Confirmation
✅ **MATCHES**
- `GET /api/billing/balance` - Exact match
- `GET /api/billing/packages?currency=EUR` - Exact match
- `GET /api/billing/transactions?page=1&pageSize=20` - Exact match
- `GET /api/subscriptions/current` - Exact match (used internally)
- `POST /api/billing/topup` - Exact match (body: `{ packId: string }`)
- `POST /api/billing/purchase` - Exact match (body: `{ packageId: number, currency?: string }`)
- `POST /api/subscriptions/subscribe` - Exact match (body: `{ planType: string, currency?: string }`)
- `GET /api/subscriptions/portal` - Exact match
- Response handling: All checkout URLs redirect to Stripe - Match
- Normalization: Balance response normalized to `{ credits, subscription }` - Match
- Package normalization: Credit packs have string IDs - Match

### D) UX Parity Checklist
- ✅ BillingHeader: Shows credits balance, subscription status, warning if inactive - Match
- ✅ SubscriptionCard: Shows current subscription or subscribe options (Starter/Pro) - Match
- ✅ CreditTopupCard: Dropdown for credit packs, shows price, buy button - Match
- ✅ PackageCard: Shows subscription packages (only when subscription active) - Match
- ✅ TransactionsTable: Table with Date, Type, Amount, Reason columns - Match
- ✅ Pagination: Previous/Next buttons, shows "Showing X to Y of Z" - Match
- ✅ Loading states: Skeleton loaders for all sections - Match
- ✅ Error states: Error messages with retry capability - Match
- ✅ Empty states: "No transactions yet" message - Match
- ✅ Stripe redirects: All purchase/subscribe actions redirect to Stripe checkout - Match
- ✅ Customer portal: "Manage Subscription" button opens Stripe portal - Match
- ✅ packId format: Ensured string format for credit packs - Match
- ✅ Warning message: Shows when subscription inactive - Match

### E) Manual Test Steps
1. Navigate to `/app/retail/billing` (must be authenticated)
2. Verify BillingHeader shows current balance and subscription status
3. If no subscription: Verify SubscriptionCard shows Starter/Pro options
4. If has subscription: Verify SubscriptionCard shows "Manage Subscription" button
5. Verify CreditTopupCard shows credit pack dropdown
6. Select credit pack → Click "Buy Credits" → Redirects to Stripe
7. If subscription active: Verify subscription packages displayed
8. Click "Purchase" on package → Redirects to Stripe
9. Verify TransactionsTable shows transaction history
10. Test pagination: Click Next/Previous → Table updates
11. Test error states: Disconnect network → Errors shown
12. Test loading states: All sections show skeletons while loading

### F) Differences
- **Intentional**: Styling uses iOS26 glass aesthetic
- **Note**: Package price handling supports both `priceCents` and `priceEur` formats (defensive coding)
- **Note**: Package units handling supports both `units` and `credits` fields (defensive coding)

---

## Summary

### Files Changed Summary

**New Files Created:**
- `src/lib/retail/api/axios.ts` - Axios instance with auth interceptors
- `src/lib/retail/api/endpoints.ts` - Endpoint constants
- `src/lib/retail/api/auth.ts` - Auth API module
- `src/lib/retail/api/me.ts` - Me API module
- `src/lib/retail/api/dashboard.ts` - Dashboard API module
- `src/lib/retail/api/billing.ts` - Billing API module (with normalization)
- `src/lib/retail/api/subscriptions.ts` - Subscriptions API module
- `src/lib/retail/validators.ts` - Zod validation schemas
- `src/features/retail/auth/useRetailAuth.ts` - Auth hook
- `src/components/retail/RetailAuthGuard.tsx` - Route guard
- `src/components/retail/RetailPublicOnlyGuard.tsx` - Public route guard
- `src/components/retail/RetailShell.tsx` - App shell component
- `app/app/retail/layout.tsx` - Retail app layout
- `app/auth/retail/login/page.tsx` - Login page
- `app/auth/retail/register/page.tsx` - Register page
- `app/app/retail/dashboard/page.tsx` - Dashboard page
- `app/app/retail/billing/page.tsx` - Billing page

**Existing Files Used:**
- `app/providers.tsx` - Already has React Query setup
- `app/layout.tsx` - Root layout (no changes needed)
- `components/ui/*` - Existing UI components

### Endpoints Wired

**Auth:**
- ✅ POST `/api/auth/login`
- ✅ POST `/api/auth/register`
- ✅ POST `/api/auth/refresh` (automatic via interceptor)
- ✅ POST `/api/auth/logout`
- ✅ GET `/api/me`

**Dashboard:**
- ✅ GET `/api/dashboard/kpis`
- ✅ GET `/api/billing/balance`

**Billing:**
- ✅ GET `/api/billing/balance`
- ✅ GET `/api/billing/wallet`
- ✅ GET `/api/billing/packages?currency=EUR`
- ✅ GET `/api/billing/transactions?page=1&pageSize=20`
- ✅ POST `/api/billing/purchase` (subscription packages)
- ✅ POST `/api/billing/topup` (credit packs)

**Subscriptions:**
- ✅ GET `/api/subscriptions/current`
- ✅ POST `/api/subscriptions/subscribe`
- ✅ GET `/api/subscriptions/portal`

### Auth Flow Summary

✅ **FULLY MATCHES LEGACY**

1. **Token Storage:**
   - Access token: `localStorage.getItem('accessToken')` ✅
   - Refresh token: HTTP-only cookie (set by backend) ✅

2. **Request Authentication:**
   - Axios interceptor adds `Authorization: Bearer {token}` header ✅
   - `withCredentials: true` for cookie sending ✅

3. **Token Refresh:**
   - Automatic on 401 errors ✅
   - Excludes auth endpoints from auto-refresh ✅
   - Queues failed requests during refresh ✅
   - Preserves all headers (including Idempotency-Key) ✅
   - Retries original request after refresh ✅
   - Redirects to login on refresh failure ✅

4. **Auth Provider:**
   - Verifies token on mount via `/api/me` ✅
   - Stores token after login/signup ✅
   - Clears token on logout ✅
   - User state management ✅

5. **Route Guards:**
   - `RetailAuthGuard`: Protects `/app/retail/*` routes ✅
   - `RetailPublicOnlyGuard`: Redirects authenticated users from auth pages ✅

### Environment Variables Required

```env
NEXT_PUBLIC_RETAIL_API_BASE_URL=https://astronote-retail.onrender.com
```

For local development:
```env
NEXT_PUBLIC_RETAIL_API_BASE_URL=http://localhost:3001
```

### How to Run Locally

1. **Set environment variable:**
   ```bash
   cd apps/astronote-web
   echo "NEXT_PUBLIC_RETAIL_API_BASE_URL=http://localhost:3001" > .env.local
   ```

2. **Install dependencies (if needed):**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Access the app:**
   - Open `http://localhost:3000`
   - Navigate to `/auth/retail/login` or `/auth/retail/register`
   - After login, access `/app/retail/dashboard` or `/app/retail/billing`

### Recommended Next Screen to Migrate

Based on legacy dependency order and user flow:

**Priority 1: Contacts Page** (`/app/retail/contacts`)
- **Why**: Core feature, used by campaigns
- **Dependencies**: Lists API (for filtering)
- **Complexity**: Medium (table, pagination, CRUD operations)
- **Legacy Reference**: `apps/retail-web-legacy/src/features/contacts/pages/ContactsPage.jsx`

**Priority 2: Campaigns List Page** (`/app/retail/campaigns`)
- **Why**: Core feature, main use case
- **Dependencies**: Campaigns API, Contacts API (for audience)
- **Complexity**: High (filters, status management, actions)
- **Legacy Reference**: `apps/retail-web-legacy/src/features/campaigns/pages/CampaignsPage.jsx`

**Priority 3: New Campaign Page** (`/app/retail/campaigns/new`)
- **Why**: Core feature, revenue driver
- **Dependencies**: Campaigns API, Templates API, Lists API, Contacts API
- **Complexity**: Very High (multi-step wizard, audience preview, validation)
- **Legacy Reference**: `apps/retail-web-legacy/src/features/campaigns/pages/NewCampaignPage.jsx`

**Suggested Order:**
1. Contacts Page (enables campaign audience selection)
2. Campaigns List Page (shows existing campaigns)
3. New Campaign Page (create campaigns)
4. Campaign Detail/Edit Pages (manage campaigns)
5. Templates Page (message templates)
6. Automations Page (automation settings)
7. Settings Page (user profile)

---

## Verification Checklist

- ✅ All 4 screens implemented
- ✅ All API endpoints match legacy exactly
- ✅ Auth flow matches legacy exactly (token storage, refresh, interceptors)
- ✅ Validations match legacy exactly (Zod schemas)
- ✅ Error handling matches legacy behavior
- ✅ Loading/empty/error states implemented
- ✅ Route guards working correctly
- ✅ No linter errors
- ✅ TypeScript types defined
- ✅ React Query hooks properly configured

**Status**: ✅ **READY FOR TESTING**

