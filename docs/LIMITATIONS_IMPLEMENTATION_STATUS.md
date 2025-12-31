# Known Limitations Implementation Status

**Date:** 2024-12-31  
**Goal:** Implement all known limitations from Phases 3, 4, and 5

---

## Campaigns Limitations

### ✅ 1. Audience Selection UI
**Status:** ✅ Implemented  
**Files:**
- `apps/astronote-web/src/lib/shopify/api/audiences.ts` - API module
- `apps/astronote-web/src/features/shopify/audiences/hooks/useAudiences.ts` - React Query hook
- `apps/astronote-web/app/shopify/campaigns/new/page.tsx` - Added audience dropdown

**Details:**
- Fetches audiences from `/api/audiences`
- Shows audience name and contact count
- Filters to show only available audiences
- Displays audience description

### ✅ 2. Discount Selection UI
**Status:** ✅ Implemented  
**Files:**
- `apps/astronote-web/src/lib/shopify/api/discounts.ts` - API module
- `apps/astronote-web/src/features/shopify/discounts/hooks/useDiscounts.ts` - React Query hook
- `apps/astronote-web/app/shopify/campaigns/new/page.tsx` - Added discount dropdown

**Details:**
- Fetches discounts from `/api/shopify/discounts`
- Shows discount code and title
- Filters to show only active, non-expired discounts
- Optional field (can be left empty)

### ✅ 3. Template Pre-fill
**Status:** ✅ Already Implemented (Phase 5)
**Files:**
- `apps/astronote-web/app/shopify/templates/page.tsx` - Stores template in localStorage
- `apps/astronote-web/app/shopify/campaigns/new/page.tsx` - Reads from localStorage

**Details:**
- Template data stored in localStorage when "Use Template" is clicked
- Campaign create page reads and pre-fills form on mount
- localStorage cleared after use

### ⏳ 4. Edit Page
**Status:** ⏳ In Progress  
**Files to Create:**
- `apps/astronote-web/app/shopify/campaigns/[id]/edit/page.tsx`

**Details:**
- Similar to create page but pre-fills with existing campaign data
- Only editable if campaign status is 'draft' or 'scheduled'
- Uses `useUpdateCampaign` mutation

### ⏳ 5. Failed Recipients Table and Retry
**Status:** ⏳ Pending  
**Files to Create/Update:**
- Add to `apps/astronote-web/app/shopify/campaigns/[id]/page.tsx`
- Use `GET /api/campaigns/:id/failed-recipients`
- Use `POST /api/campaigns/:id/retry-failed`

**Details:**
- Show failed recipients in a table
- Display error messages
- "Retry Failed" button to retry sending

### ⏳ 6. Preview Modal
**Status:** ⏳ Pending  
**Files to Create/Update:**
- Add preview modal component
- Use `GET /api/campaigns/:id/preview`

**Details:**
- Modal showing campaign preview
- Recipient count, estimated cost
- Message preview with personalization

---

## Contacts Limitations

### ⏳ 1. Create/Edit Contact Forms
**Status:** ⏳ Pending  
**Files to Create:**
- `apps/astronote-web/app/shopify/contacts/new/page.tsx`
- `apps/astronote-web/app/shopify/contacts/[id]/edit/page.tsx`
- Contact form component (reusable)

**Details:**
- Form with: phoneE164, firstName, lastName, email, gender, birthDate, smsConsent, tags
- Validation (E.164 phone format, email format)
- Uses `useCreateContact` and `useUpdateContact` mutations

### ⏳ 2. Contact Detail Page
**Status:** ⏳ Pending  
**Files to Create:**
- `apps/astronote-web/app/shopify/contacts/[id]/page.tsx`

**Details:**
- Display all contact information
- Edit button (links to edit page)
- Delete button
- Show contact history/activity if available

### ⏳ 3. Bulk Actions
**Status:** ⏳ Pending  
**Files to Update:**
- `apps/astronote-web/app/shopify/contacts/page.tsx`

**Details:**
- Checkbox selection for multiple contacts
- Bulk delete action
- Bulk update (e.g., change consent status)
- Selection counter

### ⏳ 4. Export Contacts
**Status:** ⏳ Pending  
**Files to Create/Update:**
- Add export button to `apps/astronote-web/app/shopify/contacts/page.tsx`
- Create export API function

**Details:**
- Export to CSV
- Include current filters/search
- Download file

---

## Templates Limitations

### ⏳ 1. Template Detail Page
**Status:** ⏳ Pending  
**Files to Create:**
- `apps/astronote-web/app/shopify/templates/[id]/page.tsx`

**Details:**
- Full template information
- Statistics display
- "Use Template" button
- Back to templates list

### ⏳ 2. Template Preview Modal
**Status:** ⏳ Pending  
**Files to Create/Update:**
- Add preview modal to `apps/astronote-web/app/shopify/templates/page.tsx`

**Details:**
- Modal showing full template content
- Statistics if available
- "Use Template" button in modal

### ⏳ 3. Template Statistics Display
**Status:** ⏳ Pending  
**Files to Update:**
- `apps/astronote-web/app/shopify/templates/page.tsx`

**Details:**
- Show conversionRate, productViewsIncrease, clickThroughRate, etc.
- Display in template cards or detail page

### ⏳ 4. Template Favorites
**Status:** ⏳ Pending  
**Files to Create/Update:**
- Add favorites functionality (localStorage or backend)
- Filter by favorites

**Details:**
- Star/favorite button on template cards
- Filter to show only favorites
- Persist favorites (localStorage for now)

---

## Implementation Order

1. ✅ Campaigns: Audience selection
2. ✅ Campaigns: Discount selection
3. ✅ Campaigns: Template pre-fill (already done)
4. ⏳ Campaigns: Edit page
5. ⏳ Campaigns: Failed recipients
6. ⏳ Campaigns: Preview modal
7. ⏳ Contacts: Create/Edit forms
8. ⏳ Contacts: Detail page
9. ⏳ Contacts: Bulk actions
10. ⏳ Contacts: Export
11. ⏳ Templates: Detail page
12. ⏳ Templates: Preview modal
13. ⏳ Templates: Statistics display
14. ⏳ Templates: Favorites

---

## Next Steps

Continue implementing remaining limitations in order.

