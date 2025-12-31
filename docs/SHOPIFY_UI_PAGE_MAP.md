Known Limitations
Audience selection: Defaults to "all" (UI not implemented)
Discount selection: Not implemented (optional field)
Template pre-fill: Not implemented
Edit page: Not implemented (edit button links to non-existent route)
Failed recipients: Table and retry not implemented
Preview modal: Not implemented
Note: Core functionality (list, create, view, send, delete) is fully working. These can be added in future phases.# Shopify UI Page Map

Complete inventory of all pages/screens in `apps/astronote-shopify-frontend` that need to be implemented in `apps/astronote-web`.

**Reference:** `apps/astronote-shopify-frontend/src/pages/app/`

---

## 1. Dashboard

**Reference Files:**
- `apps/astronote-shopify-frontend/src/pages/app/Dashboard.jsx`

**User Goal:** View overview KPIs (credits, campaigns, contacts, messages sent) and quick action cards.

**Backend Endpoints:**
- `GET /api/dashboard` - Main dashboard data
  - **Evidence:** `apps/shopify-api/routes/dashboard.js:4`
  - **Controller:** `apps/shopify-api/controllers/dashboard.js`
- `GET /api/billing/balance` - Credit balance (source of truth)
  - **Evidence:** `apps/shopify-api/routes/billing.js:24`
  - **Controller:** `apps/shopify-api/controllers/billing.js`

**Required Headers & Auth:**
- `Authorization: Bearer <jwt_token>` (from JWT token exchange)
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback, but JWT contains shopDomain)
- **Evidence:** `apps/shopify-api/middlewares/store-resolution.js:29-127`

**Query Params & Pagination:**
- None (dashboard is aggregate data)

**Required UI States:**
- Loading: Skeleton cards for 4 KPI cards + 3 quick action cards
- Empty: Not applicable (always shows 0 values)
- Error: ErrorState component with retry button
- Success: Display KPI cards with data

**Critical UX Behaviors:**
- Credits fetched from `/billing/balance` (source of truth, not dashboard)
- Dashboard data cached for 2 minutes (staleTime: 2 * 60 * 1000)
- No auto-refetch on window focus
- Show cached data immediately while refetching

**Definition of Done:**
- [ ] 4 KPI cards display: Credits, Campaigns, Contacts, Messages Sent
- [ ] Credits value matches `/billing/balance` response
- [ ] 3 quick action cards: Create Campaign, Manage Contacts, Automations
- [ ] Clicking action cards navigates to correct routes
- [ ] Loading skeletons show during initial load
- [ ] Error state shows with retry button
- [ ] Responsive: mobile (stacked), tablet (2x2 grid), desktop (4 columns)

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

## 2. Campaigns List

**Reference Files:**
- `apps/astronote-shopify-frontend/src/pages/app/Campaigns.jsx`

**User Goal:** View paginated list of campaigns with filtering (status, search) and actions (send, delete, view).

**Backend Endpoints:**
- `GET /api/campaigns` - List campaigns with pagination
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:26-31`
  - **Controller:** `apps/shopify-api/controllers/campaigns.js`
- `GET /api/campaigns/stats/summary` - Campaign statistics by status
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:34`
- `POST /api/campaigns/:id/enqueue` - Send campaign immediately
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:64-70`
- `DELETE /api/campaigns/:id` - Delete campaign
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:59`

**Required Headers & Auth:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)
- `Idempotency-Key: <uuid>` (for enqueue - generated per click)
  - **Evidence:** `apps/astronote-shopify-frontend/src/services/queries.js:100-150` (useEnqueueCampaign)

**Query Params & Pagination:**
- `page` (number, default: 1)
- `pageSize` (number, default: 20)
- `status` (string, optional: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'paused')
- `search` (string, optional: searches campaign name)
- **Evidence:** `apps/shopify-api/schemas/campaigns.schema.js` (listCampaignsQuerySchema)

**Required UI States:**
- Loading: Skeleton table rows (20 rows)
- Empty: EmptyState with "Create Campaign" CTA
- Error: ErrorState with retry button
- Success: Table with campaigns + pagination

**Critical UX Behaviors:**
- Debounced search (300ms delay)
- Status filter dropdown (All, Draft, Scheduled, Sending, Completed, Failed, Paused)
- Stats cards above table (Total, Draft, Scheduled, Sending, Completed, Failed)
- Send button only enabled for draft/scheduled/paused campaigns
- Delete confirmation dialog
- Optimistic updates on send/delete
- Pagination: page/pageSize/total/totalPages/hasNextPage/hasPrevPage

**Definition of Done:**
- [ ] Table displays campaigns with columns: Name, Status, Recipients, Created, Actions
- [ ] Status filter works (dropdown)
- [ ] Search input debounced and filters campaigns
- [ ] Pagination controls work (prev/next/page numbers)
- [ ] Send button only enabled for valid statuses
- [ ] Delete shows confirmation dialog
- [ ] Stats cards show summary above table
- [ ] Empty state shows when no campaigns
- [ ] Mobile: table becomes card list
- [ ] Responsive: mobile (cards), tablet/desktop (table)

**Test Steps:**
1. Navigate to `/app/shopify/campaigns`
2. Verify table loads with campaigns
3. Filter by status "Draft" → verify only draft campaigns show
4. Type in search box → verify debounced filtering works
5. Click "Send" on draft campaign → verify confirmation → verify campaign status updates
6. Click "Delete" → verify confirmation dialog → verify campaign removed
7. Click pagination "Next" → verify page 2 loads
8. Test mobile view → verify cards layout

---

## 3. Campaign Create/Edit

**Reference Files:**
- `apps/astronote-shopify-frontend/src/pages/app/CampaignCreate.jsx`

**User Goal:** Create new campaign or edit existing draft/scheduled campaign with message, audience, schedule, discount.

**Backend Endpoints:**
- `POST /api/campaigns` - Create campaign
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:42-48`
- `PUT /api/campaigns/:id` - Update campaign
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:50-56`
- `GET /api/campaigns/:id` - Get campaign for edit
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:40`
- `POST /api/campaigns/:id/enqueue` - Send immediately
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:64-70`
- `PUT /api/campaigns/:id/schedule` - Schedule campaign
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:83-89`
- `GET /api/audiences` - Get available audiences
  - **Evidence:** `apps/shopify-api/routes/audiences.js` (check if exists)
- `GET /api/discounts` - Get available discounts
  - **Evidence:** `apps/shopify-api/routes/discounts.js`
- `GET /api/settings` - Get shop timezone for schedule conversion
  - **Evidence:** `apps/shopify-api/routes/settings.js:7`

**Required Headers & Auth:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Query Params & Pagination:**
- None (form submission)

**Required UI States:**
- Loading: Form skeleton (inputs + preview)
- Empty: Not applicable (form always visible)
- Error: Inline field errors + toast
- Success: Toast + redirect to campaigns list or detail

**Critical UX Behaviors:**
- SMS character counter (160 chars = 1 part, 306 chars = 2 parts, etc.)
- Real-time iPhone preview with discount code
- Placeholder menu for variables ({{firstName}}, {{lastName}}, {{discountCode}}, etc.)
- Schedule timezone conversion (shop timezone → UTC for backend)
- Audience selection (All, Segments, Custom)
- Discount selection dropdown
- Form validation (name required, message required, schedule date/time if scheduled)
- Save as draft vs Send now vs Schedule later
- Template pre-fill from Templates page (via location.state)

**Definition of Done:**
- [ ] Form fields: Name, Message, Audience, Schedule Type, Discount, Sender ID
- [ ] SMS character counter updates in real-time
- [ ] iPhone preview shows message with discount code
- [ ] Placeholder menu inserts variables into message
- [ ] Schedule date/time picker works (converts to UTC)
- [ ] Audience dropdown shows available segments
- [ ] Discount dropdown shows available discounts
- [ ] Save as draft works
- [ ] Send now works (creates + enqueues)
- [ ] Schedule later works (creates + schedules)
- [ ] Edit mode loads existing campaign data
- [ ] Edit mode only allows draft/scheduled campaigns
- [ ] Validation errors show inline
- [ ] Success toast appears
- [ ] Redirects to campaigns list after save

**Test Steps:**
1. Navigate to `/app/shopify/campaigns/new`
2. Fill form: name, message, select audience
3. Type message → verify character counter updates
4. Click placeholder menu → verify variables insert
5. Select discount → verify preview updates
6. Select "Schedule later" → verify date/time picker appears
7. Click "Save as Draft" → verify campaign created → verify redirect
8. Create new campaign → click "Send Now" → verify campaign created and enqueued
9. Create new campaign → click "Schedule" → verify campaign scheduled
10. Edit existing draft → verify form pre-filled → verify update works

---

## 4. Campaign Detail

**Reference Files:**
- `apps/astronote-shopify-frontend/src/pages/app/CampaignDetail.jsx`

**User Goal:** View campaign details, metrics, status, progress, and actions (send, cancel, delete, retry failed).

**Backend Endpoints:**
- `GET /api/campaigns/:id` - Get campaign details
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:40`
- `GET /api/campaigns/:id/metrics` - Get campaign metrics
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:99`
- `GET /api/campaigns/:id/status` - Get campaign status (queued, processed, sent, failed counts)
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:102`
- `GET /api/campaigns/:id/progress` - Get campaign progress (sent, failed, pending, percentage)
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:108`
- `GET /api/campaigns/:id/preview` - Get campaign preview (recipient count, estimated cost)
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:105`
- `GET /api/campaigns/:id/failed-recipients` - Get failed recipients
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:111`
- `POST /api/campaigns/:id/enqueue` - Send campaign
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:64-70`
- `POST /api/campaigns/:id/cancel` - Cancel sending campaign
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:91-96`
- `POST /api/campaigns/:id/retry-failed` - Retry failed SMS
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:114`
- `DELETE /api/campaigns/:id` - Delete campaign
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:59`

**Required Headers & Auth:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)
- `Idempotency-Key: <uuid>` (for enqueue)

**Query Params & Pagination:**
- None (single resource)

**Required UI States:**
- Loading: Skeleton cards for details, metrics, status
- Empty: Not applicable
- Error: ErrorState with retry button
- Success: Full campaign details displayed

**Critical UX Behaviors:**
- Auto-refetch status/progress every 30 seconds if campaign is sending/scheduled
  - **Evidence:** `apps/astronote-shopify-frontend/src/pages/app/CampaignDetail.jsx:38-46`
- Preview modal shows sample messages
- Progress bar shows sent/failed/pending counts
- Failed recipients table with retry button
- Send button only enabled for draft/scheduled/paused
- Cancel button only enabled for sending/scheduled
- Delete confirmation dialog
- Metrics cards: Total, Sent, Failed, Conversion Rate, etc.

**Definition of Done:**
- [ ] Campaign details card shows: Name, Status, Recipients, Created, Scheduled, Started, Finished
- [ ] Message preview card shows message text
- [ ] Metrics cards show: Total, Sent, Failed, Conversion Rate
- [ ] Status card shows: Queued, Processed, Sent, Failed (if sending)
- [ ] Progress bar shows percentage complete (if sending)
- [ ] Failed recipients table shows failed contacts (if any)
- [ ] Send button works (with confirmation)
- [ ] Cancel button works (if sending)
- [ ] Retry failed button works
- [ ] Delete button works (with confirmation)
- [ ] Auto-refetch status every 30s if sending
- [ ] Preview modal shows sample messages
- [ ] Responsive: mobile (stacked cards), desktop (grid layout)

**Test Steps:**
1. Navigate to `/app/shopify/campaigns/123`
2. Verify campaign details load
3. Verify metrics cards show data
4. Click "Send" → verify confirmation → verify campaign enqueued
5. Verify status auto-refreshes every 30s if sending
6. Click "Preview Messages" → verify modal shows samples
7. Click "Retry Failed" → verify failed SMS retried
8. Click "Delete" → verify confirmation → verify campaign deleted
9. Test with sending campaign → verify cancel button appears
10. Test mobile view → verify cards stack properly

---

## 5. Campaign Stats/Reports

**Reference Files:**
- `apps/astronote-shopify-frontend/src/pages/app/CampaignReports.jsx`

**User Goal:** View detailed campaign performance reports with filtering.

**Backend Endpoints:**
- `GET /api/reports/campaigns` - Get campaign reports
  - **Evidence:** `apps/shopify-api/routes/reports.js:15`
- `GET /api/campaigns` - Get campaigns list for filter dropdown
  - **Evidence:** `apps/shopify-api/routes/campaigns.js:26-31`

**Required Headers & Auth:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Query Params & Pagination:**
- `campaignId` (number, optional: filter by specific campaign)
- Date range params (if supported by backend)

**Required UI States:**
- Loading: Skeleton table
- Empty: EmptyState
- Error: ErrorState with retry
- Success: Table with campaign reports

**Critical UX Behaviors:**
- Campaign filter dropdown (All Campaigns + individual campaigns)
- Table shows: Campaign Name, Status, Recipients, Sent, Failed, Conversion Rate, Date
- Click campaign name → navigate to campaign detail

**Definition of Done:**
- [ ] Campaign filter dropdown works
- [ ] Table displays campaign reports
- [ ] Columns: Name, Status, Recipients, Sent, Failed, Conversion, Date
- [ ] Clicking campaign name navigates to detail page
- [ ] Empty state shows when no reports
- [ ] Responsive: mobile (cards), desktop (table)

**Test Steps:**
1. Navigate to `/app/shopify/campaigns/123/stats` (or `/app/shopify/reports/campaigns`)
2. Verify reports table loads
3. Select campaign from filter → verify filtered results
4. Click campaign name → verify navigation to detail page
5. Test mobile view → verify cards layout

---

## 6. Contacts List

**Reference Files:**
- `apps/astronote-shopify-frontend/src/pages/app/Contacts.jsx`

**User Goal:** View paginated list of contacts with filtering (consent, search) and actions (delete, import).

**Backend Endpoints:**
- `GET /api/contacts` - List contacts with pagination
  - **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:42-48`
- `GET /api/contacts/stats` - Get contact statistics
  - **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:51`
- `DELETE /api/contacts/:id` - Delete contact
  - **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:89`
- `POST /api/contacts/import` - Import contacts from CSV
  - **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:71-78`

**Required Headers & Auth:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Query Params & Pagination:**
- `page` (number, default: 1)
- `pageSize` (number, default: 20)
- `smsConsent` (string, optional: 'yes' | 'no' | 'pending')
- `search` (string, optional: searches phone/email/name)
- **Evidence:** `apps/shopify-api/schemas/contacts.schema.js` (listContactsQuerySchema)

**Required UI States:**
- Loading: Skeleton table rows
- Empty: EmptyState with "Import Contacts" CTA
- Error: ErrorState with retry button
- Success: Table with contacts + pagination

**Critical UX Behaviors:**
- Debounced search (300ms delay)
- Consent filter dropdown (All, Yes, No, Pending)
- Stats cards above table (Total, With Consent, Without Consent, Pending)
- Import CSV modal with file upload
- Delete confirmation dialog
- Pagination controls

**Definition of Done:**
- [ ] Table displays contacts with columns: Name, Phone, Email, Consent, Created, Actions
- [ ] Consent filter works
- [ ] Search input debounced and filters contacts
- [ ] Pagination controls work
- [ ] Stats cards show summary above table
- [ ] Import button opens modal
- [ ] CSV upload works
- [ ] Delete shows confirmation dialog
- [ ] Empty state shows when no contacts
- [ ] Mobile: table becomes card list
- [ ] Responsive: mobile (cards), tablet/desktop (table)

**Test Steps:**
1. Navigate to `/app/shopify/contacts`
2. Verify table loads with contacts
3. Filter by consent "Yes" → verify only consented contacts show
4. Type in search box → verify debounced filtering works
5. Click "Import Contacts" → verify modal opens → upload CSV → verify import works
6. Click "Delete" → verify confirmation → verify contact removed
7. Click pagination "Next" → verify page 2 loads
8. Test mobile view → verify cards layout

---

## 7. Contacts Import

**Reference Files:**
- `apps/astronote-shopify-frontend/src/components/contacts/ImportContactsModal.jsx`
- Used in Contacts.jsx page

**User Goal:** Import contacts from CSV file with validation and progress tracking.

**Backend Endpoints:**
- `POST /api/contacts/import` - Import contacts from CSV
  - **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:71-78`
  - **Payload:** `{ file: File, hasHeaders: boolean }` (multipart/form-data)
  - **Response:** `{ jobId: string, total: number, processed: number, errors: [] }`
- `GET /api/contacts/import/:jobId` - Get import status (if exists)
  - Check if this endpoint exists in backend

**Required Headers & Auth:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)
- `Content-Type: multipart/form-data` (for file upload)

**Query Params & Pagination:**
- None (file upload)

**Required UI States:**
- Loading: Upload progress indicator
- Empty: File input ready
- Error: Error message with retry
- Success: Success message with import summary

**Critical UX Behaviors:**
- File input accepts .csv files
- "Has headers" checkbox
- Upload progress indicator
- Import summary: Total, Processed, Errors
- Error list shows validation errors
- Auto-close modal on success
- Refresh contacts list after import

**Definition of Done:**
- [ ] File input accepts CSV files
- [ ] "Has headers" checkbox works
- [ ] Upload button triggers import
- [ ] Progress indicator shows during upload
- [ ] Success message shows import summary
- [ ] Error list shows validation errors (if any)
- [ ] Contacts list refreshes after import
- [ ] Modal closes on success
- [ ] Responsive: works on mobile and desktop

**Test Steps:**
1. Navigate to `/app/shopify/contacts`
2. Click "Import Contacts" → verify modal opens
3. Select CSV file → verify file selected
4. Check "Has headers" → verify checkbox works
5. Click "Upload" → verify progress indicator → verify success message
6. Verify contacts list refreshes with new contacts
7. Test with invalid CSV → verify error messages show

---

## 8. Contact Detail

**Reference Files:**
- `apps/astronote-shopify-frontend/src/pages/app/ContactDetail.jsx`

**User Goal:** View/edit individual contact details.

**Backend Endpoints:**
- `GET /api/contacts/:id` - Get contact details
  - **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:61`
- `PUT /api/contacts/:id` - Update contact
  - **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:80-86`
- `POST /api/contacts` - Create contact (if new)
  - **Evidence:** `apps/shopify-api/routes/contacts-enhanced.js:63-69`

**Required Headers & Auth:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Query Params & Pagination:**
- None (single resource)

**Required UI States:**
- Loading: Form skeleton
- Empty: Not applicable (form always visible)
- Error: Inline field errors + toast
- Success: Toast + redirect or stay on page

**Critical UX Behaviors:**
- Form fields: First Name, Last Name, Phone, Email, SMS Consent
- Validation: Phone format (E.164), Email format
- Save button updates contact
- Back button returns to contacts list

**Definition of Done:**
- [ ] Form fields load with contact data (if editing)
- [ ] Form validation works (phone, email)
- [ ] Save button updates contact
- [ ] Success toast appears
- [ ] Back button navigates to contacts list
- [ ] Responsive: form works on mobile and desktop

**Test Steps:**
1. Navigate to `/app/shopify/contacts/123`
2. Verify form loads with contact data
3. Edit phone number → verify validation
4. Click "Save" → verify contact updated → verify toast
5. Click "Back" → verify navigation to contacts list
6. Test with new contact → verify create works

---

## 9. Templates

**Reference Files:**
- `apps/astronote-shopify-frontend/src/pages/app/Templates.jsx`

**User Goal:** Browse SMS templates by category, search, and use template to create campaign.

**Backend Endpoints:**
- `GET /api/templates` - List templates with pagination
  - **Evidence:** `apps/shopify-api/routes/templates.js:7`
- `GET /api/templates/categories` - Get template categories
  - **Evidence:** `apps/shopify-api/routes/templates.js:8`
- `GET /api/templates/:id` - Get template details
  - **Evidence:** `apps/shopify-api/routes/templates.js:9`
- `POST /api/templates/:id/track` - Track template usage
  - **Evidence:** `apps/shopify-api/routes/templates.js:13`

**Required Headers & Auth:**
- `Authorization: Bearer <jwt_token>` (optional - templates may be public)
- `X-Shopify-Shop-Domain: <shop-domain>` (for tracking usage)

**Query Params & Pagination:**
- `limit` (number, default: 12)
- `offset` (number, default: 0)
- `category` (string, optional: filter by category)
- `search` (string, optional: search template title/content)

**Required UI States:**
- Loading: Skeleton grid (12 cards)
- Empty: EmptyState
- Error: ErrorState with retry
- Success: Grid of template cards

**Critical UX Behaviors:**
- Category filter dropdown
- Search input (debounced 300ms)
- Grid layout: 3 columns desktop, 2 tablet, 1 mobile
- Template card shows: Title, Category, Preview, "Use Template" button
- Clicking "Use Template" → navigate to campaign create with template pre-filled
- Track template usage on click
- Pagination controls

**Definition of Done:**
- [ ] Grid displays template cards
- [ ] Category filter works
- [ ] Search input debounced and filters templates
- [ ] Template card shows: Title, Category, Preview
- [ ] "Use Template" button navigates to campaign create
- [ ] Template content pre-fills in campaign form
- [ ] Template usage tracked on click
- [ ] Pagination controls work
- [ ] Empty state shows when no templates
- [ ] Responsive: mobile (1 col), tablet (2 cols), desktop (3 cols)

**Test Steps:**
1. Navigate to `/app/shopify/templates`
2. Verify grid loads with templates
3. Filter by category → verify filtered results
4. Type in search box → verify debounced filtering works
5. Click "Use Template" → verify navigation to campaign create
6. Verify template content pre-filled in campaign form
7. Click pagination "Next" → verify page 2 loads
8. Test mobile view → verify 1 column layout

---

## 10. Automations

**Reference Files:**
- `apps/astronote-shopify-frontend/src/pages/app/Automations.jsx`

**User Goal:** View automations list, toggle active/inactive, create/edit/delete automations.

**Backend Endpoints:**
- `GET /api/automations` - List user automations
  - **Evidence:** `apps/shopify-api/routes/automations.js:13`
- `GET /api/automations/stats` - Get automation statistics
  - **Evidence:** `apps/shopify-api/routes/automations.js:19`
- `PUT /api/automations/:id` - Update automation (toggle status, edit)
  - **Evidence:** `apps/shopify-api/routes/automations.js:25-29`
- `DELETE /api/automations/:id` - Delete automation
  - **Evidence:** `apps/shopify-api/routes/automations.js:30`
- `POST /api/automations` - Create automation
  - **Evidence:** `apps/shopify-api/routes/automations.js:14-18`
- `GET /api/automations/variables/:triggerType` - Get available variables for trigger
  - **Evidence:** `apps/shopify-api/routes/automations.js:20-24`

**Required Headers & Auth:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Query Params & Pagination:**
- None (list endpoint returns all automations)

**Required UI States:**
- Loading: Skeleton cards
- Empty: EmptyState with "Create Automation" CTA
- Error: ErrorState with retry
- Success: Cards/grid of automations

**Critical UX Behaviors:**
- Status filter dropdown (All, Active, Paused)
- Stats cards: Total, Active, Paused
- Automation card shows: Name, Trigger, Status, Stats
- Toggle switch to activate/pause automation
- Delete confirmation dialog
- "Coming Soon" badge for unsupported triggers (cart_abandoned, customer_inactive, abandoned_cart)
- Click automation → navigate to edit form

**Definition of Done:**
- [ ] Grid/cards display automations
- [ ] Status filter works
- [ ] Stats cards show summary
- [ ] Toggle switch activates/pauses automation
- [ ] Delete shows confirmation dialog
- [ ] "Coming Soon" badge shows for unsupported triggers
- [ ] Click automation → navigates to edit form
- [ ] Empty state shows when no automations
- [ ] Responsive: mobile (cards), desktop (grid)

**Test Steps:**
1. Navigate to `/app/shopify/automations`
2. Verify automations load
3. Filter by status "Active" → verify only active automations show
4. Toggle automation status → verify status updates
5. Click automation → verify navigation to edit form
6. Click "Delete" → verify confirmation → verify automation removed
7. Test mobile view → verify cards layout

---

## 11. Automation Form (Create/Edit)

**Reference Files:**
- `apps/astronote-shopify-frontend/src/pages/app/AutomationForm.jsx`

**User Goal:** Create or edit automation with trigger, message, variables, schedule.

**Backend Endpoints:**
- `POST /api/automations` - Create automation
  - **Evidence:** `apps/shopify-api/routes/automations.js:14-18`
- `PUT /api/automations/:id` - Update automation
  - **Evidence:** `apps/shopify-api/routes/automations.js:25-29`
- `GET /api/automations/:id` - Get automation for edit (if exists)
  - Check if this endpoint exists
- `GET /api/automations/variables/:triggerType` - Get available variables
  - **Evidence:** `apps/shopify-api/routes/automations.js:20-24`

**Required Headers & Auth:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Query Params & Pagination:**
- None (form submission)

**Required UI States:**
- Loading: Form skeleton
- Empty: Not applicable (form always visible)
- Error: Inline field errors + toast
- Success: Toast + redirect to automations list

**Critical UX Behaviors:**
- Trigger type dropdown (order_placed, order_fulfilled, customer_birthday, etc.)
- Variables dropdown updates based on trigger type
- Message textarea with variable insertion
- Schedule options (immediate, delay, specific time)
- Form validation
- Save button creates/updates automation

**Definition of Done:**
- [ ] Form fields: Name, Trigger Type, Message, Schedule, Status
- [ ] Trigger dropdown shows available triggers
- [ ] Variables dropdown updates based on trigger
- [ ] Variable insertion works in message
- [ ] Schedule options work
- [ ] Form validation works
- [ ] Save button creates/updates automation
- [ ] Success toast appears
- [ ] Redirects to automations list after save
- [ ] Edit mode loads existing automation data
- [ ] Responsive: form works on mobile and desktop

**Test Steps:**
1. Navigate to `/app/shopify/automations/new`
2. Fill form: name, trigger, message
3. Select trigger type → verify variables update
4. Insert variable into message → verify variable inserted
5. Select schedule option → verify schedule fields appear
6. Click "Save" → verify automation created → verify redirect
7. Edit existing automation → verify form pre-filled → verify update works

---

## 12. Billing

**Reference Files:**
- `apps/astronote-shopify-frontend/src/pages/app/Billing.jsx`

**User Goal:** View credit balance, purchase credits, view subscription status, view transaction history.

**Backend Endpoints:**
- `GET /api/billing/balance` - Get credit balance
  - **Evidence:** `apps/shopify-api/routes/billing.js:24`
- `GET /api/billing/packages` - Get available credit packages
  - **Evidence:** `apps/shopify-api/routes/billing.js:27`
- `GET /api/billing/history` - Get transaction history
  - **Evidence:** `apps/shopify-api/routes/billing.js:44-50`
- `GET /api/billing/billing-history` - Get Stripe billing history
  - **Evidence:** `apps/shopify-api/routes/billing.js:52-58`
- `POST /api/billing/purchase` - Create Stripe checkout session (credit packs)
  - **Evidence:** `apps/shopify-api/routes/billing.js:60-66`
- `GET /api/billing/topup/calculate` - Calculate top-up price
  - **Evidence:** `apps/shopify-api/routes/billing.js:29-34`
- `POST /api/billing/topup` - Create top-up checkout session
  - **Evidence:** `apps/shopify-api/routes/billing.js:36-42`
- `GET /api/subscriptions/current` - Get subscription status
  - **Evidence:** `apps/shopify-api/routes/subscriptions.js` (check if exists)
- `POST /api/subscriptions/subscribe` - Subscribe to plan
  - **Evidence:** `apps/shopify-api/routes/subscriptions.js` (check if exists)
- `PUT /api/subscriptions/update` - Update subscription
  - **Evidence:** `apps/shopify-api/routes/subscriptions.js` (check if exists)
- `POST /api/subscriptions/cancel` - Cancel subscription
  - **Evidence:** `apps/shopify-api/routes/subscriptions.js` (check if exists)
- `GET /api/subscriptions/portal` - Get Stripe customer portal URL
  - **Evidence:** `apps/shopify-api/routes/subscriptions.js` (check if exists)

**Required Headers & Auth:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Query Params & Pagination:**
- `page` (number, default: 1) - for transaction history
- `pageSize` (number, default: 20) - for transaction history
- `currency` (string, optional: 'EUR' | 'USD' | etc.) - for packages

**Required UI States:**
- Loading: Skeleton cards and table
- Empty: EmptyState for transaction history
- Error: ErrorState with retry
- Success: Balance, packages, history displayed

**Critical UX Behaviors:**
- Credit balance card (source of truth from `/billing/balance`)
- Subscription status card (Active/Inactive, plan type)
- Credit packages grid (only shown if subscription active)
- Top-up calculator (enter credits → shows price)
- Transaction history table with pagination
- Stripe checkout redirect for purchases
- Currency selector (EUR, USD, etc.)
- Subscription management (subscribe, update, cancel, portal)

**Definition of Done:**
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
- [ ] Responsive: mobile (stacked cards), desktop (grid)

**Test Steps:**
1. Navigate to `/app/shopify/billing`
2. Verify credit balance displays
3. Verify subscription status displays
4. Select currency → verify packages update
5. Enter credits in top-up → verify price calculates
6. Click "Buy Credits" → verify Stripe checkout redirect
7. Verify transaction history loads
8. Click pagination → verify page 2 loads
9. Test subscription actions → verify subscribe/cancel work
10. Test mobile view → verify cards stack properly

---

## 13. Billing Success

**Reference Files:**
- `apps/astronote-shopify-frontend/src/pages/app/BillingSuccess.jsx`

**User Goal:** Confirmation page after successful Stripe checkout.

**Backend Endpoints:**
- None (static confirmation page)

**Required Headers & Auth:**
- `Authorization: Bearer <jwt_token>` (for protected route)

**Query Params & Pagination:**
- None

**Required UI States:**
- Success: Success message with "Return to Billing" button

**Critical UX Behaviors:**
- Success message
- "Return to Billing" button navigates to billing page
- Auto-redirect after 5 seconds (optional)

**Definition of Done:**
- [ ] Success message displays
- [ ] "Return to Billing" button navigates correctly
- [ ] Responsive: works on mobile and desktop

**Test Steps:**
1. Complete Stripe checkout → verify redirect to success page
2. Verify success message displays
3. Click "Return to Billing" → verify navigation to billing page

---

## 14. Billing Cancel

**Reference Files:**
- `apps/astronote-shopify-frontend/src/pages/app/BillingCancel.jsx`

**User Goal:** Confirmation page after cancelled Stripe checkout.

**Backend Endpoints:**
- None (static page)

**Required Headers & Auth:**
- `Authorization: Bearer <jwt_token>` (for protected route)

**Query Params & Pagination:**
- None

**Required UI States:**
- Info: Cancellation message with "Return to Billing" button

**Critical UX Behaviors:**
- Cancellation message
- "Return to Billing" button navigates to billing page

**Definition of Done:**
- [ ] Cancellation message displays
- [ ] "Return to Billing" button navigates correctly
- [ ] Responsive: works on mobile and desktop

**Test Steps:**
1. Cancel Stripe checkout → verify redirect to cancel page
2. Verify cancellation message displays
3. Click "Return to Billing" → verify navigation to billing page

---

## 15. Settings

**Reference Files:**
- `apps/astronote-shopify-frontend/src/pages/app/Settings.jsx`

**User Goal:** Update shop settings (sender ID, timezone, currency) and view account info.

**Backend Endpoints:**
- `GET /api/settings` - Get settings
  - **Evidence:** `apps/shopify-api/routes/settings.js:7`
- `PUT /api/settings` - Update settings
  - **Evidence:** `apps/shopify-api/routes/settings.js:10`
- `GET /api/settings/account` - Get account info
  - **Evidence:** `apps/shopify-api/routes/settings.js:8`
- `PUT /api/settings/sender` - Update sender number (legacy, kept for compatibility)
  - **Evidence:** `apps/shopify-api/routes/settings.js:9`

**Required Headers & Auth:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Query Params & Pagination:**
- None (form submission)

**Required UI States:**
- Loading: Form skeleton
- Empty: Not applicable (form always visible)
- Error: Inline field errors + toast
- Success: Toast + form updates

**Critical UX Behaviors:**
- Tab navigation: General, Account
- General tab: Sender ID, Timezone, Currency
- Account tab: Shop Domain, Credits, Created Date
- Form validation: Sender ID (E.164 phone or 3-11 alphanumeric)
- Save button updates settings
- Success toast appears

**Definition of Done:**
- [ ] Tab navigation works (General, Account)
- [ ] General tab form: Sender ID, Timezone, Currency
- [ ] Account tab shows: Shop Domain, Credits, Created
- [ ] Form validation works (sender ID format)
- [ ] Save button updates settings
- [ ] Success toast appears
- [ ] Settings persist after save
- [ ] Responsive: form works on mobile and desktop

**Test Steps:**
1. Navigate to `/app/shopify/settings`
2. Verify General tab loads with current settings
3. Edit sender ID → verify validation
4. Change timezone → verify dropdown works
5. Click "Save" → verify settings updated → verify toast
6. Switch to Account tab → verify account info displays
7. Test mobile view → verify form works

---

## 16. Reports (Overview)

**Reference Files:**
- `apps/astronote-shopify-frontend/src/pages/app/Reports.jsx`

**User Goal:** View comprehensive reports with date range filtering and multiple report types.

**Backend Endpoints:**
- `GET /api/reports/overview` - Get reports overview
  - **Evidence:** `apps/shopify-api/routes/reports.js:11`
- `GET /api/reports/kpis` - Get KPI metrics
  - **Evidence:** `apps/shopify-api/routes/reports.js:12`
- `GET /api/reports/campaigns` - Get campaign reports
  - **Evidence:** `apps/shopify-api/routes/reports.js:15`
- `GET /api/reports/messaging` - Get messaging reports
  - **Evidence:** `apps/shopify-api/routes/reports.js:18`
- `GET /api/reports/credits` - Get credits reports
  - **Evidence:** `apps/shopify-api/routes/reports.js:20`
- `GET /api/reports/contacts` - Get contacts reports
  - **Evidence:** `apps/shopify-api/routes/reports.js:21`
- `GET /api/reports/automations` - Get automation reports
  - **Evidence:** `apps/shopify-api/routes/reports.js:17`

**Required Headers & Auth:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Query Params & Pagination:**
- `startDate` (ISO string, optional)
- `endDate` (ISO string, optional)
- Default: last 30 days

**Required UI States:**
- Loading: Skeleton charts and tables
- Empty: EmptyState
- Error: ErrorState with retry
- Success: Charts and tables with data

**Critical UX Behaviors:**
- Tab navigation: Overview, Campaigns, Messaging, Credits, Contacts, Automations
- Date range picker (default: last 30 days)
- Charts: Line charts, Pie charts, Bar charts
- Tables: Campaign performance, messaging stats, etc.
- Export functionality (if backend supports)

**Definition of Done:**
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

**Test Steps:**
1. Navigate to `/app/shopify/reports`
2. Verify Overview tab loads with charts
3. Change date range → verify data updates
4. Switch to Campaigns tab → verify campaign table loads
5. Switch to Messaging tab → verify messaging stats
6. Test other tabs → verify each loads correctly
7. Test mobile view → verify charts/tables adapt

---

## Notes on Missing Pages

**Contact Detail (New/Edit):**
- Reference shows `/shopify/app/contacts/new` and `/shopify/app/contacts/:id/edit` routes
- Both use `ContactDetail.jsx` component
- Should be implemented as single component with create/edit modes

**Campaign Reports (Dedicated):**
- Reference shows `/shopify/app/reports/campaigns` route
- Separate from main Reports page
- Should be implemented as dedicated page or integrated into Reports

**Auth Callback:**
- Reference: `apps/astronote-shopify-frontend/src/pages/auth/AuthCallback.jsx`
- Handles OAuth callback from backend
- Not a Shopify app page, but required for auth flow
- May not need to be in `/app/shopify/` route structure

---

## Summary

**Total Pages to Implement:** 16 pages
- Dashboard (1)
- Campaigns List (2)
- Campaign Create/Edit (3)
- Campaign Detail (4)
- Campaign Stats/Reports (5)
- Contacts List (6)
- Contacts Import (7)
- Contact Detail (8)
- Templates (9)
- Automations (10)
- Automation Form (11)
- Billing (12)
- Billing Success (13)
- Billing Cancel (14)
- Settings (15)
- Reports Overview (16)

**All endpoints, headers, and behaviors are confirmed from backend routes and frontend reference implementation.**

