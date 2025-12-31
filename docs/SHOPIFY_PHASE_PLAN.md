# Shopify Phase Plan

Strict implementation plan for Shopify UI in `apps/astronote-web`.

**Target:** Complete Shopify UI implementation with zero mistakes.

---

## Phase 1: Foundation

**Goal:** Set up routing, auth, API client, and ShopifyShell. No business pages yet.

### Pages Included
- None (foundation only)

### Components to Create

1. **Shopify Layout**
   - File: `apps/astronote-web/app/shopify/layout.tsx`
   - Purpose: Root layout for all Shopify pages
   - Features:
     - Auth guard (check JWT token)
     - ShopifyShell wrapper
     - Error boundary

2. **ShopifyShell**
   - File: `apps/astronote-web/src/components/shopify/ShopifyShell.tsx`
   - Purpose: Navigation, header, sidebar (if needed)
   - Features:
     - Navigation menu
     - Store info display
     - Logout button

3. **Auth Utilities**
   - File: `apps/astronote-web/src/lib/shopify/auth/session-token.ts`
   - File: `apps/astronote-web/src/lib/shopify/auth/redirect.ts`
   - Purpose: Handle Shopify session token and redirects

4. **API Client**
   - File: `apps/astronote-web/src/lib/shopify/api/axios.ts`
   - Purpose: Configured axios instance with interceptors
   - Features:
     - Auth token injection
     - Shop domain header
     - 401 error handling

5. **Config**
   - File: `apps/astronote-web/src/lib/shopify/config.ts`
   - Purpose: Environment variables and constants

### Endpoints Included
- `POST /api/auth/shopify-token` - Token exchange
- `GET /api/auth/verify` - Token verification

### Risks/Edge Cases
- **Session token not available** (standalone web app) → Fallback to OAuth flow
- **Token expired** → Redirect to login
- **Network error** → Show error state
- **Iframe constraints** → Handle top-level redirects correctly

### Definition of Done
- [ ] Shopify layout created and wraps all routes
- [ ] Auth guard checks JWT token on every page load
- [ ] ShopifyShell component renders navigation
- [ ] API client configured with interceptors
- [ ] Token exchange works (session token → JWT)
- [ ] Token verification works
- [ ] 401 errors redirect to login
- [ ] Environment variables configured
- [ ] No console errors
- [ ] Build passes: `npm -w @astronote/web-next run build`

### Proof of Work
```bash
# Git diff
git diff --stat

# Build check
npm -w @astronote/web-next run build
```

**Expected Output:**
- New files: `app/shopify/layout.tsx`, `src/lib/shopify/**/*.ts`, `src/components/shopify/ShopifyShell.tsx`
- Build passes with no errors

---

## Phase 2: Dashboard

**Goal:** Implement dashboard page with KPI cards and quick actions.

### Pages Included
- `/app/shopify/dashboard/page.tsx`

### Components to Create
- Dashboard page component
- KPI card component (reuse RetailCard)
- Quick action card component (reuse RetailCard)

### Endpoints Included
- `GET /api/dashboard` - Dashboard data
- `GET /api/billing/balance` - Credit balance (source of truth)

### API Client Files
- `apps/astronote-web/src/lib/shopify/api/dashboard.ts`
- `apps/astronote-web/src/lib/shopify/api/billing.ts` (partial)

### React Query Hooks
- `useShopifyDashboard()` - Dashboard data
- `useShopifyBillingBalance()` - Credit balance

### Risks/Edge Cases
- **Credits mismatch** → Use `/billing/balance` as source of truth, not dashboard
- **Empty data** → Show 0 values, not error
- **Network error** → Show error state with retry

### Definition of Done
- [ ] Dashboard page renders
- [ ] 4 KPI cards display: Credits, Campaigns, Contacts, Messages Sent
- [ ] Credits value matches `/billing/balance` response
- [ ] 3 quick action cards: Create Campaign, Manage Contacts, Automations
- [ ] Clicking action cards navigates to correct routes
- [ ] Loading skeletons show during initial load
- [ ] Error state shows with retry button
- [ ] Responsive: mobile (stacked), tablet (2x2 grid), desktop (4 columns)
- [ ] No console errors
- [ ] Build passes

### Proof of Work
```bash
git diff --stat
npm -w @astronote/web-next run build
```

**Test Steps:**
1. Navigate to `/app/shopify/dashboard`
2. Verify 4 KPI cards load with data
3. Verify credits value matches billing balance
4. Click "Create Campaign" → should navigate to `/app/shopify/campaigns/new`
5. Click "Manage Contacts" → should navigate to `/app/shopify/contacts`
6. Click "Automations" → should navigate to `/app/shopify/automations`
7. Disconnect network → verify error state appears
8. Reconnect → verify retry button works

---

## Phase 3: Campaigns

**Goal:** Implement campaigns list, create/edit, detail, and stats pages.

### Pages Included
- `/app/shopify/campaigns/page.tsx` - List
- `/app/shopify/campaigns/new/page.tsx` - Create
- `/app/shopify/campaigns/[id]/page.tsx` - Detail
- `/app/shopify/campaigns/[id]/edit/page.tsx` - Edit
- `/app/shopify/campaigns/[id]/stats/page.tsx` - Stats

### Components to Create
- CampaignsList page
- CampaignCreate page (reusable for create/edit)
- CampaignDetail page
- CampaignStats page
- CampaignForm component (reusable)
- CampaignPreview component (iPhone preview)

### Endpoints Included
- `GET /api/campaigns` - List
- `GET /api/campaigns/stats/summary` - Stats
- `GET /api/campaigns/:id` - Single
- `POST /api/campaigns` - Create
- `PUT /api/campaigns/:id` - Update
- `DELETE /api/campaigns/:id` - Delete
- `POST /api/campaigns/:id/enqueue` - Send
- `PUT /api/campaigns/:id/schedule` - Schedule
- `POST /api/campaigns/:id/cancel` - Cancel
- `GET /api/campaigns/:id/metrics` - Metrics
- `GET /api/campaigns/:id/status` - Status
- `GET /api/campaigns/:id/progress` - Progress
- `GET /api/campaigns/:id/preview` - Preview
- `GET /api/campaigns/:id/failed-recipients` - Failed recipients
- `POST /api/campaigns/:id/retry-failed` - Retry failed
- `GET /api/audiences` - Audiences (for form)
- `GET /api/discounts` - Discounts (for form)
- `GET /api/settings` - Settings (for timezone)

### API Client Files
- `apps/astronote-web/src/lib/shopify/api/campaigns.ts`

### React Query Hooks
- `useShopifyCampaigns()` - List
- `useShopifyCampaign()` - Single
- `useShopifyCampaignStats()` - Stats
- `useCreateShopifyCampaign()` - Create mutation
- `useUpdateShopifyCampaign()` - Update mutation
- `useDeleteShopifyCampaign()` - Delete mutation
- `useEnqueueShopifyCampaign()` - Send mutation
- `useScheduleShopifyCampaign()` - Schedule mutation
- `useCancelShopifyCampaign()` - Cancel mutation
- `useShopifyCampaignMetrics()` - Metrics
- `useShopifyCampaignStatus()` - Status (with auto-refetch)
- `useShopifyCampaignProgress()` - Progress (with auto-refetch)
- `useShopifyCampaignPreview()` - Preview
- `useShopifyCampaignFailedRecipients()` - Failed recipients
- `useRetryFailedShopifyCampaign()` - Retry mutation

### Risks/Edge Cases
- **SMS character counter** → Calculate parts correctly (160 chars = 1 part, 306 = 2 parts)
- **Timezone conversion** → Convert shop timezone to UTC for backend
- **Schedule validation** → Ensure scheduled time is in future
- **Idempotency** → Generate UUID for enqueue requests
- **Auto-refetch** → Only refetch status/progress if campaign is sending/scheduled
- **Optimistic updates** → Update UI immediately on send/delete
- **Form validation** → Name and message required

### Definition of Done
- [ ] Campaigns list page renders with table
- [ ] Status filter works
- [ ] Search input debounced and filters campaigns
- [ ] Pagination controls work
- [ ] Send button only enabled for valid statuses
- [ ] Delete shows confirmation dialog
- [ ] Create page renders with form
- [ ] SMS character counter updates in real-time
- [ ] iPhone preview shows message with discount
- [ ] Placeholder menu inserts variables
- [ ] Schedule date/time picker works (converts to UTC)
- [ ] Save as draft works
- [ ] Send now works (creates + enqueues)
- [ ] Schedule later works (creates + schedules)
- [ ] Detail page shows campaign info, metrics, status, progress
- [ ] Auto-refetch status every 30s if sending
- [ ] Preview modal shows sample messages
- [ ] Retry failed button works
- [ ] Stats page shows campaign reports
- [ ] Edit page loads existing campaign data
- [ ] Edit page only allows draft/scheduled campaigns
- [ ] Responsive: mobile (cards), desktop (table)
- [ ] No console errors
- [ ] Build passes

### Proof of Work
```bash
git diff --stat
npm -w @astronote/web-next run build
```

**Test Steps:**
1. Navigate to `/app/shopify/campaigns`
2. Verify table loads with campaigns
3. Filter by status "Draft" → verify only draft campaigns show
4. Type in search box → verify debounced filtering works
5. Click "Send" on draft campaign → verify confirmation → verify campaign status updates
6. Click "Delete" → verify confirmation → verify campaign removed
7. Click "Create Campaign" → verify form loads
8. Fill form → verify character counter updates
9. Click "Send Now" → verify campaign created and enqueued
10. Navigate to campaign detail → verify metrics and status load
11. Verify status auto-refreshes every 30s if sending

---

## Phase 4: Contacts

**Goal:** Implement contacts list, import, and detail pages.

### Pages Included
- `/app/shopify/contacts/page.tsx` - List
- `/app/shopify/contacts/new/page.tsx` - Create
- `/app/shopify/contacts/[id]/page.tsx` - Detail/Edit
- `/app/shopify/contacts/import/page.tsx` - Import

### Components to Create
- ContactsList page
- ContactDetail page (reusable for create/edit)
- ContactImport page
- ContactForm component (reusable)
- ImportContactsModal component (if modal approach)

### Endpoints Included
- `GET /api/contacts` - List
- `GET /api/contacts/stats` - Stats
- `GET /api/contacts/:id` - Single
- `POST /api/contacts` - Create
- `PUT /api/contacts/:id` - Update
- `DELETE /api/contacts/:id` - Delete
- `POST /api/contacts/import` - Import CSV

### API Client Files
- `apps/astronote-web/src/lib/shopify/api/contacts.ts`

### React Query Hooks
- `useShopifyContacts()` - List
- `useShopifyContactStats()` - Stats
- `useShopifyContact()` - Single
- `useCreateShopifyContact()` - Create mutation
- `useUpdateShopifyContact()` - Update mutation
- `useDeleteShopifyContact()` - Delete mutation
- `useImportShopifyContacts()` - Import mutation

### Risks/Edge Cases
- **CSV import** → Handle large files, show progress
- **Phone validation** → E.164 format
- **Email validation** → Standard email format
- **Consent filter** → Map frontend param to backend `smsConsent`
- **Search** → Debounced, searches phone/email/name

### Definition of Done
- [ ] Contacts list page renders with table
- [ ] Consent filter works
- [ ] Search input debounced and filters contacts
- [ ] Pagination controls work
- [ ] Stats cards show summary above table
- [ ] Import button opens import page/modal
- [ ] CSV upload works
- [ ] Import progress indicator shows
- [ ] Import summary shows (total, processed, errors)
- [ ] Delete shows confirmation dialog
- [ ] Create page renders with form
- [ ] Form validation works (phone, email)
- [ ] Save button creates/updates contact
- [ ] Detail page loads existing contact data
- [ ] Responsive: mobile (cards), desktop (table)
- [ ] No console errors
- [ ] Build passes

### Proof of Work
```bash
git diff --stat
npm -w @astronote/web-next run build
```

**Test Steps:**
1. Navigate to `/app/shopify/contacts`
2. Verify table loads with contacts
3. Filter by consent "Yes" → verify only consented contacts show
4. Type in search box → verify debounced filtering works
5. Click "Import Contacts" → verify import page/modal opens
6. Upload CSV → verify import works → verify progress indicator
7. Click "Delete" → verify confirmation → verify contact removed
8. Click "Create Contact" → verify form loads
9. Fill form → verify validation works
10. Click "Save" → verify contact created

---

## Phase 5: Templates

**Goal:** Implement templates page with category filter, search, and template usage.

### Pages Included
- `/app/shopify/templates/page.tsx`

### Components to Create
- TemplatesList page
- TemplateCard component
- TemplatePreview component (optional)

### Endpoints Included
- `GET /api/templates` - List
- `GET /api/templates/categories` - Categories
- `GET /api/templates/:id` - Single
- `POST /api/templates/:id/track` - Track usage

### API Client Files
- `apps/astronote-web/src/lib/shopify/api/templates.ts`

### React Query Hooks
- `useShopifyTemplates()` - List
- `useShopifyTemplateCategories()` - Categories
- `useShopifyTemplate()` - Single
- `useTrackShopifyTemplateUsage()` - Track mutation

### Risks/Edge Cases
- **Template pre-fill** → Pass template data via Next.js router state
- **Category filter** → Reset to page 1 when filter changes
- **Search** → Debounced, resets to page 1
- **Template usage tracking** → Track on click, don't block navigation

### Definition of Done
- [ ] Templates page renders with grid
- [ ] Category filter works
- [ ] Search input debounced and filters templates
- [ ] Template card shows: Title, Category, Preview
- [ ] "Use Template" button navigates to campaign create
- [ ] Template content pre-fills in campaign form
- [ ] Template usage tracked on click
- [ ] Pagination controls work
- [ ] Empty state shows when no templates
- [ ] Responsive: mobile (1 col), tablet (2 cols), desktop (3 cols)
- [ ] No console errors
- [ ] Build passes

### Proof of Work
```bash
git diff --stat
npm -w @astronote/web-next run build
```

**Test Steps:**
1. Navigate to `/app/shopify/templates`
2. Verify grid loads with templates
3. Filter by category → verify filtered results
4. Type in search box → verify debounced filtering works
5. Click "Use Template" → verify navigation to campaign create
6. Verify template content pre-filled in campaign form

---

## Phase 6: Automations

**Goal:** Implement automations list and form pages with toggle active/inactive.

### Pages Included
- `/app/shopify/automations/page.tsx` - List
- `/app/shopify/automations/new/page.tsx` - Create
- `/app/shopify/automations/[id]/page.tsx` - Edit

### Components to Create
- AutomationsList page
- AutomationForm page (reusable for create/edit)
- AutomationCard component

### Endpoints Included
- `GET /api/automations` - List
- `GET /api/automations/stats` - Stats
- `POST /api/automations` - Create
- `PUT /api/automations/:id` - Update (toggle status, edit)
- `DELETE /api/automations/:id` - Delete
- `GET /api/automations/variables/:triggerType` - Variables

### API Client Files
- `apps/astronote-web/src/lib/shopify/api/automations.ts`

### React Query Hooks
- `useShopifyAutomations()` - List
- `useShopifyAutomationStats()` - Stats
- `useCreateShopifyAutomation()` - Create mutation
- `useUpdateShopifyAutomation()` - Update mutation (toggle status)
- `useDeleteShopifyAutomation()` - Delete mutation
- `useShopifyAutomationVariables()` - Variables by trigger type

### Risks/Edge Cases
- **Toggle status** → Optimistic update, show loading state
- **Coming soon triggers** → Show badge, disable toggle
- **Variable insertion** → Update variables dropdown based on trigger type
- **Form validation** → Name, trigger, message required

### Definition of Done
- [ ] Automations list page renders with cards/grid
- [ ] Status filter works
- [ ] Stats cards show summary
- [ ] Toggle switch activates/pauses automation
- [ ] Delete shows confirmation dialog
- [ ] "Coming Soon" badge shows for unsupported triggers
- [ ] Click automation → navigates to edit form
- [ ] Create page renders with form
- [ ] Trigger dropdown shows available triggers
- [ ] Variables dropdown updates based on trigger
- [ ] Variable insertion works in message
- [ ] Save button creates/updates automation
- [ ] Empty state shows when no automations
- [ ] Responsive: mobile (cards), desktop (grid)
- [ ] No console errors
- [ ] Build passes

### Proof of Work
```bash
git diff --stat
npm -w @astronote/web-next run build
```

**Test Steps:**
1. Navigate to `/app/shopify/automations`
2. Verify automations load
3. Filter by status "Active" → verify only active automations show
4. Toggle automation status → verify status updates
5. Click automation → verify navigation to edit form
6. Click "Delete" → verify confirmation → verify automation removed
7. Click "Create Automation" → verify form loads
8. Select trigger type → verify variables update
9. Insert variable into message → verify variable inserted
10. Click "Save" → verify automation created

---

## Phase 7: Billing

**Goal:** Implement billing page with credit balance, packages, top-up, subscription, and transaction history.

### Pages Included
- `/app/shopify/billing/page.tsx`
- `/app/shopify/billing/success/page.tsx`
- `/app/shopify/billing/cancel/page.tsx`

### Components to Create
- Billing page
- BillingSuccess page
- BillingCancel page
- CreditBalanceCard component
- SubscriptionCard component
- PackagesGrid component
- TopupCalculator component
- TransactionHistoryTable component

### Endpoints Included
- `GET /api/billing/balance` - Balance
- `GET /api/billing/packages` - Packages
- `GET /api/billing/topup/calculate` - Calculate top-up
- `POST /api/billing/topup` - Create top-up checkout
- `GET /api/billing/history` - Transaction history
- `GET /api/billing/billing-history` - Stripe billing history
- `POST /api/billing/purchase` - Create purchase checkout
- `GET /api/subscriptions/current` - Subscription status (if exists)
- `POST /api/subscriptions/subscribe` - Subscribe (if exists)
- `PUT /api/subscriptions/update` - Update subscription (if exists)
- `POST /api/subscriptions/cancel` - Cancel subscription (if exists)
- `GET /api/subscriptions/portal` - Stripe portal (if exists)

### API Client Files
- `apps/astronote-web/src/lib/shopify/api/billing.ts` (complete)
- `apps/astronote-web/src/lib/shopify/api/subscriptions.ts` (if needed)

### React Query Hooks
- `useShopifyBillingBalance()` - Balance
- `useShopifyBillingPackages()` - Packages
- `useCalculateShopifyTopup()` - Calculate top-up
- `useCreateShopifyTopup()` - Create top-up mutation
- `useShopifyBillingHistory()` - Transaction history
- `useShopifyBillingHistoryStripe()` - Stripe billing history
- `useCreateShopifyPurchase()` - Create purchase mutation
- `useShopifySubscriptionStatus()` - Subscription status
- `useSubscribeShopify()` - Subscribe mutation
- `useUpdateShopifySubscription()` - Update mutation
- `useCancelShopifySubscription()` - Cancel mutation
- `useGetShopifyPortal()` - Get portal URL

### Risks/Edge Cases
- **Stripe redirects** → Handle top-level redirect for checkout
- **Currency selection** → Update packages when currency changes
- **Top-up calculation** → Show price as user types credits
- **Subscription status** → Show active/inactive, plan type
- **Transaction history** → Pagination, date formatting

### Definition of Done
- [ ] Billing page renders
- [ ] Credit balance card shows current balance
- [ ] Subscription status card shows active/inactive
- [ ] Credit packages grid shows available packages (if subscription active)
- [ ] Top-up calculator works (credits → price)
- [ ] Transaction history table shows transactions
- [ ] Pagination works for transaction history
- [ ] "Buy Credits" button redirects to Stripe checkout
- [ ] "Top-up" button redirects to Stripe checkout
- [ ] Subscription actions work (subscribe, cancel, portal)
- [ ] Currency selector works
- [ ] Success page shows after successful checkout
- [ ] Cancel page shows after cancelled checkout
- [ ] Responsive: mobile (stacked cards), desktop (grid)
- [ ] No console errors
- [ ] Build passes

### Proof of Work
```bash
git diff --stat
npm -w @astronote/web-next run build
```

**Test Steps:**
1. Navigate to `/app/shopify/billing`
2. Verify credit balance displays
3. Verify subscription status displays
4. Select currency → verify packages update
5. Enter credits in top-up → verify price calculates
6. Click "Buy Credits" → verify Stripe checkout redirect
7. Verify transaction history loads
8. Test subscription actions → verify subscribe/cancel work

---

## Phase 8: Settings

**Goal:** Implement settings page with general settings and account info.

### Pages Included
- `/app/shopify/settings/page.tsx`

### Components to Create
- Settings page
- SettingsForm component
- AccountInfoCard component

### Endpoints Included
- `GET /api/settings` - Settings
- `PUT /api/settings` - Update settings
- `GET /api/settings/account` - Account info

### API Client Files
- `apps/astronote-web/src/lib/shopify/api/settings.ts`

### React Query Hooks
- `useShopifySettings()` - Settings
- `useUpdateShopifySettings()` - Update mutation
- `useShopifyAccountInfo()` - Account info

### Risks/Edge Cases
- **Sender ID validation** → E.164 phone or 3-11 alphanumeric
- **Timezone selection** → Use standard timezone list
- **Currency selection** → Use standard currency list
- **Form validation** → Show inline errors

### Definition of Done
- [ ] Settings page renders
- [ ] Tab navigation works (General, Account)
- [ ] General tab form: Sender ID, Timezone, Currency
- [ ] Account tab shows: Shop Domain, Credits, Created
- [ ] Form validation works (sender ID format)
- [ ] Save button updates settings
- [ ] Success toast appears
- [ ] Settings persist after save
- [ ] Responsive: form works on mobile and desktop
- [ ] No console errors
- [ ] Build passes

### Proof of Work
```bash
git diff --stat
npm -w @astronote/web-next run build
```

**Test Steps:**
1. Navigate to `/app/shopify/settings`
2. Verify General tab loads with current settings
3. Edit sender ID → verify validation
4. Change timezone → verify dropdown works
5. Click "Save" → verify settings updated → verify toast
6. Switch to Account tab → verify account info displays

---

## Phase 9: Reports

**Goal:** Implement reports overview page with date range filtering and multiple report types.

### Pages Included
- `/app/shopify/reports/page.tsx`

### Components to Create
- Reports page
- ReportsOverview component
- ReportsKPIs component
- CampaignReportsTable component
- MessagingReportsChart component
- CreditsReportsChart component
- ContactsReportsChart component
- AutomationReportsTable component

### Endpoints Included
- `GET /api/reports/overview` - Overview
- `GET /api/reports/kpis` - KPIs
- `GET /api/reports/campaigns` - Campaign reports
- `GET /api/reports/messaging` - Messaging reports
- `GET /api/reports/credits` - Credits reports
- `GET /api/reports/contacts` - Contacts reports
- `GET /api/reports/automations` - Automation reports

### API Client Files
- `apps/astronote-web/src/lib/shopify/api/reports.ts`

### React Query Hooks
- `useShopifyReportsOverview()` - Overview
- `useShopifyReportsKPIs()` - KPIs
- `useShopifyCampaignReports()` - Campaign reports
- `useShopifyMessagingReports()` - Messaging reports
- `useShopifyCreditsReports()` - Credits reports
- `useShopifyContactsReports()` - Contacts reports
- `useShopifyAutomationReports()` - Automation reports

### Risks/Edge Cases
- **Date range picker** → Default to last 30 days
- **Chart rendering** → Use lightweight chart library (recharts or similar)
- **Large datasets** → Pagination or aggregation
- **Date formatting** → Use user's timezone

### Definition of Done
- [ ] Reports page renders
- [ ] Tab navigation works
- [ ] Date range picker works
- [ ] Overview tab shows summary charts
- [ ] Campaigns tab shows campaign performance table
- [ ] Messaging tab shows messaging stats
- [ ] Credits tab shows credit usage
- [ ] Contacts tab shows contact growth
- [ ] Automations tab shows automation performance
- [ ] Charts render correctly
- [ ] Tables display data
- [ ] Responsive: charts/tables adapt to screen size
- [ ] No console errors
- [ ] Build passes

### Proof of Work
```bash
git diff --stat
npm -w @astronote/web-next run build
```

**Test Steps:**
1. Navigate to `/app/shopify/reports`
2. Verify Overview tab loads with charts
3. Change date range → verify data updates
4. Switch to Campaigns tab → verify campaign table loads
5. Switch to Messaging tab → verify messaging stats
6. Test other tabs → verify each loads correctly

---

## Implementation Order Summary

1. **Phase 1:** Foundation (routing + auth + API client + ShopifyShell)
2. **Phase 2:** Dashboard
3. **Phase 3:** Campaigns (list/new/detail/stats/edit)
4. **Phase 4:** Contacts (list/import/detail)
5. **Phase 5:** Templates
6. **Phase 6:** Automations (list/form/toggle)
7. **Phase 7:** Billing (balance/packages/top-up/subscription/history)
8. **Phase 8:** Settings
9. **Phase 9:** Reports

**Total Phases:** 9 phases

**Estimated Timeline:** 
- Phase 1: 2-3 days
- Phase 2: 1-2 days
- Phase 3: 4-5 days (largest phase)
- Phase 4: 2-3 days
- Phase 5: 1-2 days
- Phase 6: 2-3 days
- Phase 7: 3-4 days
- Phase 8: 1-2 days
- Phase 9: 2-3 days

**Total:** ~18-27 days (3.5-5.5 weeks)

---

## Common Requirements Across All Phases

### Build Requirements
- `npm -w @astronote/web-next run build` must pass
- No TypeScript errors
- No ESLint errors
- No console errors in production build

### Testing Requirements
- Manual testing for each page
- Test all CRUD operations
- Test error states
- Test loading states
- Test empty states
- Test responsive design (mobile, tablet, desktop)

### Code Quality
- TypeScript strict mode
- Consistent code style
- Reusable components
- Proper error handling
- Proper loading states
- Proper empty states

### Documentation
- Update README if needed
- Document any new patterns
- Document any deviations from plan

---

## Success Criteria

**Phase 0 (Documentation) - COMPLETE ✅**
- [x] SHOPIFY_UI_PAGE_MAP.md created
- [x] SHOPIFY_ROUTES_IN_ASTRONOTE_WEB.md created
- [x] SHOPIFY_AUTH_AND_TENANCY.md created
- [x] SHOPIFY_API_CLIENT_SPEC.md created
- [x] SHOPIFY_UI_STYLE_REUSE.md created
- [x] SHOPIFY_PHASE_PLAN.md created

**All Phases Complete When:**
- All 20 routes implemented
- All endpoints integrated
- All UI states handled (loading, error, empty, success)
- All responsive breakpoints working
- Build passes
- No console errors
- Manual testing complete
- Ready for production deployment

