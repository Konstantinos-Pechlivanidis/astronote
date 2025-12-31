# Shopify Routes in astronote-web

Final route structure for Shopify UI inside `apps/astronote-web` using Next.js App Router.

**Target Directory:** `apps/astronote-web/app/shopify/`

---

## Route Structure

### Base Route Pattern
All Shopify routes are under `/app/shopify/` prefix.

**Layout:** `apps/astronote-web/app/shopify/layout.tsx`
- Wraps all Shopify pages
- Handles Shopify embedded app constraints (iframe, App Bridge)
- Provides ShopifyShell component (navigation, auth context)

---

## 1. Dashboard

**Route:** `/app/shopify/dashboard/page.tsx`

**Maps to:** Dashboard page from SHOPIFY_UI_PAGE_MAP.md

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/Dashboard.jsx`

**Evidence:**
- Reference route: `/shopify/app/dashboard` (from `apps/astronote-shopify-frontend/src/App.jsx:160-169`)

**Status:** ✅ Required

---

## 2. Campaigns List

**Route:** `/app/shopify/campaigns/page.tsx`

**Maps to:** Campaigns List page from SHOPIFY_UI_PAGE_MAP.md

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/Campaigns.jsx`

**Evidence:**
- Reference route: `/shopify/app/campaigns` (from `apps/astronote-shopify-frontend/src/App.jsx:170-179`)

**Status:** ✅ Required

---

## 3. Campaign Create

**Route:** `/app/shopify/campaigns/new/page.tsx`

**Maps to:** Campaign Create/Edit page from SHOPIFY_UI_PAGE_MAP.md (create mode)

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/CampaignCreate.jsx`

**Evidence:**
- Reference route: `/shopify/app/campaigns/new` (from `apps/astronote-shopify-frontend/src/App.jsx:180-189`)

**Status:** ✅ Required

---

## 4. Campaign Edit

**Route:** `/app/shopify/campaigns/[id]/edit/page.tsx`

**Maps to:** Campaign Create/Edit page from SHOPIFY_UI_PAGE_MAP.md (edit mode)

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/CampaignCreate.jsx`

**Evidence:**
- Reference route: `/shopify/app/campaigns/:id/edit` (from `apps/astronote-shopify-frontend/src/App.jsx:200-209`)

**Status:** ✅ Required

**Note:** Can reuse same component as `/campaigns/new` with `isEditMode` prop based on route.

---

## 5. Campaign Detail

**Route:** `/app/shopify/campaigns/[id]/page.tsx`

**Maps to:** Campaign Detail page from SHOPIFY_UI_PAGE_MAP.md

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/CampaignDetail.jsx`

**Evidence:**
- Reference route: `/shopify/app/campaigns/:id` (from `apps/astronote-shopify-frontend/src/App.jsx:190-199`)

**Status:** ✅ Required

---

## 6. Campaign Stats/Reports

**Route:** `/app/shopify/campaigns/[id]/stats/page.tsx`

**Maps to:** Campaign Stats/Reports page from SHOPIFY_UI_PAGE_MAP.md

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/CampaignReports.jsx`

**Evidence:**
- Reference route: `/shopify/app/reports/campaigns` (from `apps/astronote-shopify-frontend/src/App.jsx:300-309`)
- Also accessible from campaign detail page

**Status:** ✅ Required

**Alternative:** Could be `/app/shopify/reports/campaigns` but `/campaigns/[id]/stats` is more intuitive.

---

## 7. Contacts List

**Route:** `/app/shopify/contacts/page.tsx`

**Maps to:** Contacts List page from SHOPIFY_UI_PAGE_MAP.md

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/Contacts.jsx`

**Evidence:**
- Reference route: `/shopify/app/contacts` (from `apps/astronote-shopify-frontend/src/App.jsx:210-219`)

**Status:** ✅ Required

---

## 8. Contacts Import

**Route:** `/app/shopify/contacts/import/page.tsx`

**Maps to:** Contacts Import page from SHOPIFY_UI_PAGE_MAP.md

**Reference:** `apps/astronote-shopify-frontend/src/components/contacts/ImportContactsModal.jsx`

**Evidence:**
- Reference route: `/shopify/app/contacts/new` (from `apps/astronote-shopify-frontend/src/App.jsx:220-229`)
- But import is a modal in reference, so dedicated page makes sense

**Status:** ✅ Required

**Note:** Reference shows `/contacts/new` but it uses ContactDetail component. Import should be separate page.

---

## 9. Contact Detail (New)

**Route:** `/app/shopify/contacts/new/page.tsx`

**Maps to:** Contact Detail page from SHOPIFY_UI_PAGE_MAP.md (create mode)

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/ContactDetail.jsx`

**Evidence:**
- Reference route: `/shopify/app/contacts/new` (from `apps/astronote-shopify-frontend/src/App.jsx:220-229`)

**Status:** ✅ Required

---

## 10. Contact Detail (Edit)

**Route:** `/app/shopify/contacts/[id]/page.tsx`

**Maps to:** Contact Detail page from SHOPIFY_UI_PAGE_MAP.md (edit mode)

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/ContactDetail.jsx`

**Evidence:**
- Reference route: `/shopify/app/contacts/:id` (from `apps/astronote-shopify-frontend/src/App.jsx:230-239`)

**Status:** ✅ Required

**Note:** Can reuse same component as `/contacts/new` with `isEditMode` prop.

---

## 11. Contact Edit (Alternative)

**Route:** `/app/shopify/contacts/[id]/edit/page.tsx`

**Maps to:** Contact Detail page from SHOPIFY_UI_PAGE_MAP.md (edit mode)

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/ContactDetail.jsx`

**Evidence:**
- Reference route: `/shopify/app/contacts/:id/edit` (from `apps/astronote-shopify-frontend/src/App.jsx:240-249`)

**Status:** ⚠️ Optional (can redirect to `/contacts/[id]`)

**Note:** Reference has both `/contacts/:id` and `/contacts/:id/edit` but they use same component. We can use `/contacts/[id]` for both view and edit, or redirect `/edit` to `/[id]`.

---

## 12. Templates

**Route:** `/app/shopify/templates/page.tsx`

**Maps to:** Templates page from SHOPIFY_UI_PAGE_MAP.md

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/Templates.jsx`

**Evidence:**
- Reference route: `/shopify/app/templates` (from `apps/astronote-shopify-frontend/src/App.jsx:280-289`)

**Status:** ✅ Required

---

## 13. Automations

**Route:** `/app/shopify/automations/page.tsx`

**Maps to:** Automations page from SHOPIFY_UI_PAGE_MAP.md

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/Automations.jsx`

**Evidence:**
- Reference route: `/shopify/app/automations` (from `apps/astronote-shopify-frontend/src/App.jsx:250-259`)

**Status:** ✅ Required

---

## 14. Automation Create

**Route:** `/app/shopify/automations/new/page.tsx`

**Maps to:** Automation Form page from SHOPIFY_UI_PAGE_MAP.md (create mode)

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/AutomationForm.jsx`

**Evidence:**
- Reference route: `/shopify/app/automations/new` (from `apps/astronote-shopify-frontend/src/App.jsx:260-269`)

**Status:** ✅ Required

---

## 15. Automation Edit

**Route:** `/app/shopify/automations/[id]/page.tsx`

**Maps to:** Automation Form page from SHOPIFY_UI_PAGE_MAP.md (edit mode)

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/AutomationForm.jsx`

**Evidence:**
- Reference route: `/shopify/app/automations/:id` (from `apps/astronote-shopify-frontend/src/App.jsx:270-279`)

**Status:** ✅ Required

**Note:** Can reuse same component as `/automations/new` with `isEditMode` prop.

---

## 16. Billing

**Route:** `/app/shopify/billing/page.tsx`

**Maps to:** Billing page from SHOPIFY_UI_PAGE_MAP.md

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/Billing.jsx`

**Evidence:**
- Reference route: `/shopify/app/billing` (from `apps/astronote-shopify-frontend/src/App.jsx:310-319`)

**Status:** ✅ Required

---

## 17. Billing Success

**Route:** `/app/shopify/billing/success/page.tsx`

**Maps to:** Billing Success page from SHOPIFY_UI_PAGE_MAP.md

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/BillingSuccess.jsx`

**Evidence:**
- Reference route: `/shopify/app/billing/success` (from `apps/astronote-shopify-frontend/src/App.jsx:320-329`)

**Status:** ✅ Required

---

## 18. Billing Cancel

**Route:** `/app/shopify/billing/cancel/page.tsx`

**Maps to:** Billing Cancel page from SHOPIFY_UI_PAGE_MAP.md

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/BillingCancel.jsx`

**Evidence:**
- Reference route: `/shopify/app/billing/cancel` (from `apps/astronote-shopify-frontend/src/App.jsx:330-339`)

**Status:** ✅ Required

---

## 19. Settings

**Route:** `/app/shopify/settings/page.tsx`

**Maps to:** Settings page from SHOPIFY_UI_PAGE_MAP.md

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/Settings.jsx`

**Evidence:**
- Reference route: `/shopify/app/settings` (from `apps/astronote-shopify-frontend/src/App.jsx:340-349`)

**Status:** ✅ Required

---

## 20. Reports Overview

**Route:** `/app/shopify/reports/page.tsx`

**Maps to:** Reports Overview page from SHOPIFY_UI_PAGE_MAP.md

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/Reports.jsx`

**Evidence:**
- Reference route: `/shopify/app/reports` (from `apps/astronote-shopify-frontend/src/App.jsx:290-299`)

**Status:** ✅ Required

---

## Routes NOT in Reference (But May Be Needed)

### Auth Callback

**Route:** `/app/shopify/auth/callback/page.tsx`

**Maps to:** OAuth callback handler (not a Shopify app page, but required for auth)

**Reference:** `apps/astronote-shopify-frontend/src/pages/auth/AuthCallback.jsx`

**Evidence:**
- Reference route: `/shopify/auth/callback` (from `apps/astronote-shopify-frontend/src/App.jsx:154`)

**Status:** ✅ Required (but may be outside `/app/shopify/` if using Next.js auth)

**Note:** This is a public route (no auth required) that handles OAuth redirect from backend.

---

## Routes That Should NOT Exist

### Public Landing Pages
- `/shopify` (Landing page)
- `/shopify/features`
- `/shopify/pricing`
- `/shopify/how-it-works`
- `/shopify/contact`
- `/shopify/privacy`
- `/shopify/terms`
- `/shopify/gdpr`
- `/shopify/install`
- `/shopify/login`
- `/shopify/unsubscribe/:token`

**Reason:** These are public marketing/legal pages, not part of the embedded Shopify app. They should remain in the reference frontend or be separate public routes in astronote-web (outside `/app/shopify/`).

**Evidence:** Reference shows these as public routes (no `ProtectedRoute` wrapper) in `apps/astronote-shopify-frontend/src/App.jsx:140-151`.

---

## Route Summary

**Total Routes:** 20 routes

1. `/app/shopify/dashboard`
2. `/app/shopify/campaigns`
3. `/app/shopify/campaigns/new`
4. `/app/shopify/campaigns/[id]`
5. `/app/shopify/campaigns/[id]/edit`
6. `/app/shopify/campaigns/[id]/stats`
7. `/app/shopify/contacts`
8. `/app/shopify/contacts/new`
9. `/app/shopify/contacts/[id]`
10. `/app/shopify/contacts/[id]/edit` (optional, can redirect to `/[id]`)
11. `/app/shopify/contacts/import`
12. `/app/shopify/templates`
13. `/app/shopify/automations`
14. `/app/shopify/automations/new`
15. `/app/shopify/automations/[id]`
16. `/app/shopify/billing`
17. `/app/shopify/billing/success`
18. `/app/shopify/billing/cancel`
19. `/app/shopify/settings`
20. `/app/shopify/reports`

**Plus Auth Callback:**
- `/app/shopify/auth/callback` (or outside `/app/shopify/` if using Next.js auth)

---

## Route Grouping Strategy

### Option 1: Flat Structure (Recommended)
All routes directly under `/app/shopify/` with clear naming:
- `/app/shopify/dashboard`
- `/app/shopify/campaigns`
- `/app/shopify/campaigns/new`
- `/app/shopify/campaigns/[id]`
- etc.

**Pros:**
- Clear, predictable URLs
- Easy to navigate
- Matches reference structure

**Cons:**
- Longer URLs for nested resources

### Option 2: Grouped Structure
Use Next.js route groups for organization:
- `/app/shopify/(app)/dashboard`
- `/app/shopify/(app)/campaigns`
- `/app/shopify/(app)/campaigns/new`
- etc.

**Pros:**
- Better code organization
- Can share layout per group

**Cons:**
- More complex routing
- Doesn't match reference structure

**Recommendation:** Use Option 1 (flat structure) to match reference and keep URLs simple.

---

## Layout Structure

### Root Layout
`apps/astronote-web/app/shopify/layout.tsx`
- Wraps all Shopify pages
- Provides ShopifyShell (navigation, auth context)
- Handles embedded app constraints

### Nested Layouts (Optional)
- `apps/astronote-web/app/shopify/campaigns/layout.tsx` - Campaign-specific layout (breadcrumbs, etc.)
- `apps/astronote-web/app/shopify/contacts/layout.tsx` - Contact-specific layout

**Recommendation:** Start with single root layout, add nested layouts only if needed.

---

## Route Protection

All routes under `/app/shopify/` should be protected:
- Require valid JWT token
- Redirect to login if unauthenticated
- Handle token refresh if expired

**Implementation:** Use Next.js middleware or layout-level auth check.

---

## Route Mapping to Backend

Each route maps to specific backend endpoints (see SHOPIFY_UI_PAGE_MAP.md for details).

**Pattern:**
- List pages → `GET /api/{resource}`
- Detail pages → `GET /api/{resource}/:id`
- Create pages → `POST /api/{resource}`
- Edit pages → `PUT /api/{resource}/:id`
- Delete actions → `DELETE /api/{resource}/:id`

All requests require:
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

---

## Next Steps

1. Create `apps/astronote-web/app/shopify/layout.tsx`
2. Create route files for each page listed above
3. Implement ShopifyShell component (navigation, auth)
4. Add route protection middleware
5. Test each route with backend API

