# Shopify Frontend UI/UX Polish - Page Inventory

**Date**: 2025-01-27

## Pages Inventory

### Main Pages (List/Detail)
1. **Dashboard** - `/app/shopify/dashboard`
   - File: `app/app/shopify/dashboard/page.tsx`
   - Type: KPI cards grid
   - Status: ✅ Uses RetailPageLayout

2. **Campaigns List** - `/app/shopify/campaigns`
   - File: `app/app/shopify/campaigns/page.tsx`
   - Type: Data table with filters
   - Status: ✅ Uses RetailPageLayout

3. **Campaign Detail** - `/app/shopify/campaigns/[id]`
   - File: `app/app/shopify/campaigns/[id]/page.tsx`
   - Type: Detail view with metrics
   - Status: ⚠️ Need to check

4. **Campaign Edit** - `/app/shopify/campaigns/[id]/edit`
   - File: `app/app/shopify/campaigns/[id]/edit/page.tsx`
   - Type: Form
   - Status: ⚠️ Need to check

5. **Campaign Create** - `/app/shopify/campaigns/new`
   - File: `app/app/shopify/campaigns/new/page.tsx`
   - Type: Form
   - Status: ✅ Uses RetailPageLayout

6. **Campaign Stats** - `/app/shopify/campaigns/[id]/stats`
   - File: `app/app/shopify/campaigns/[id]/stats/page.tsx`
   - Type: Stats/metrics view
   - Status: ⚠️ Need to check

7. **Campaign Status** - `/app/shopify/campaigns/[id]/status`
   - File: `app/app/shopify/campaigns/[id]/status/page.tsx`
   - Type: Status view
   - Status: ⚠️ Need to check

8. **Templates List** - `/app/shopify/templates`
   - File: `app/app/shopify/templates/page.tsx`
   - Type: Grid with filters
   - Status: ✅ Uses RetailPageLayout

9. **Template Detail** - `/app/shopify/templates/[id]`
   - File: `app/app/shopify/templates/[id]/page.tsx`
   - Type: Detail view
   - Status: ⚠️ Need to check

10. **Contacts List** - `/app/shopify/contacts`
    - File: `app/app/shopify/contacts/page.tsx`
    - Type: Data table with filters
    - Status: ✅ Uses RetailPageLayout

11. **Contact Detail** - `/app/shopify/contacts/[id]`
    - File: `app/app/shopify/contacts/[id]/page.tsx`
    - Type: Detail view
    - Status: ⚠️ Need to check

12. **Contact Create** - `/app/shopify/contacts/new`
    - File: `app/app/shopify/contacts/new/page.tsx`
    - Type: Form
    - Status: ❌ Missing RetailPageLayout

13. **Contact Import** - `/app/shopify/contacts/import`
    - File: `app/app/shopify/contacts/import/page.tsx`
    - Type: File upload form
    - Status: ⚠️ Need to check

14. **Automations List** - `/app/shopify/automations`
    - File: `app/app/shopify/automations/page.tsx`
    - Type: List with cards
    - Status: ✅ Uses RetailPageLayout

15. **Automation Detail** - `/app/shopify/automations/[id]`
    - File: `app/app/shopify/automations/[id]/page.tsx`
    - Type: Detail view
    - Status: ⚠️ Need to check

16. **Automation Create** - `/app/shopify/automations/new`
    - File: `app/app/shopify/automations/new/page.tsx`
    - Type: Form
    - Status: ❌ Missing RetailPageLayout

17. **Billing** - `/app/shopify/billing`
    - File: `app/app/shopify/billing/page.tsx`
    - Type: Complex form with multiple sections
    - Status: ✅ Uses RetailPageLayout

18. **Billing Success** - `/app/shopify/billing/success`
    - File: `app/app/shopify/billing/success/page.tsx`
    - Type: Success page
    - Status: ⚠️ Need to check

19. **Billing Cancel** - `/app/shopify/billing/cancel`
    - File: `app/app/shopify/billing/cancel/page.tsx`
    - Type: Cancel page
    - Status: ⚠️ Need to check

20. **Settings** - `/app/shopify/settings`
    - File: `app/app/shopify/settings/page.tsx`
    - Type: Settings form with tabs
    - Status: ✅ Uses RetailPageLayout

21. **Reports** - `/app/shopify/reports`
    - File: `app/app/shopify/reports/page.tsx`
    - Type: Placeholder
    - Status: ✅ Uses RetailPageLayout

### Auth Pages
22. **Login** - `/app/shopify/auth/login`
    - File: `app/app/shopify/auth/login/page.tsx`
    - Type: Auth form
    - Status: ⚠️ Different layout (auth-specific)

23. **Callback** - `/app/shopify/auth/callback`
    - File: `app/app/shopify/auth/callback/page.tsx`
    - Type: Redirect handler
    - Status: ⚠️ Different layout (auth-specific)

## Issues Identified

### Missing RetailPageLayout
- Contact Create (`/app/shopify/contacts/new`)
- Automation Create (`/app/shopify/automations/new`)

### Form Layout Inconsistencies
- Forms have inconsistent spacing
- Some forms use 2-column grid, some don't
- Form validation error placement inconsistent

### Need to Check
- Campaign detail/edit/stats/status pages
- Template detail page
- Contact detail/import pages
- Automation detail page
- Billing success/cancel pages

