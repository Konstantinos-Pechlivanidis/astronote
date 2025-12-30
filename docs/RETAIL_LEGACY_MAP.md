# Retail Web Legacy - Route & Screen Map

This document maps all routes, pages, and screens in the `apps/retail-web-legacy` application.

## Route Structure

### Public Routes (No Auth Required)

#### `/` - Landing Page
- **Component**: `features/auth/pages/LandingPage.jsx`
- **Guard**: `PublicOnlyGuard` (redirects authenticated users to `/app/dashboard`)
- **Purpose**: Marketing/landing page for unauthenticated users
- **Components Used**: `AuthLayout`
- **API Calls**: None
- **Forms/Validations**: None

#### `/signup` - Signup Page
- **Component**: `features/auth/pages/SignupPage.jsx`
- **Guard**: `PublicOnlyGuard`
- **Purpose**: User registration
- **Components Used**: 
  - `AuthLayout`
  - `SignupForm`
- **Forms/Validations**: 
  - Schema: `signupSchema` (Zod)
  - Fields: `email`, `password`, `confirmPassword`, `senderName` (optional, max 11 chars), `company` (optional, max 160 chars)
  - Validation: Email format, password min 8 chars, passwords must match
- **API Calls**: 
  - `POST /api/auth/register` via `authApi.register()`

#### `/login` - Login Page
- **Component**: `features/auth/pages/LoginPage.jsx`
- **Guard**: `PublicOnlyGuard`
- **Purpose**: User authentication
- **Components Used**: 
  - `AuthLayout`
  - `LoginForm`
- **Forms/Validations**: 
  - Schema: `loginSchema` (Zod)
  - Fields: `email`, `password`
  - Validation: Email format, password required
- **API Calls**: 
  - `POST /api/auth/login` via `authApi.login()`

#### `/o/:trackingId` - Offer Page (Public)
- **Component**: `features/public/pages/OfferPage.jsx`
- **Guard**: None (public)
- **Purpose**: Public offer redemption page (tracking link)
- **Components Used**: `PublicLayout`, `PublicCard`, `PublicLoading`, `PublicError`, `PublicSuccess`
- **Forms/Validations**: None
- **API Calls**: 
  - `GET /tracking/offer/:trackingId` via `trackingApi.getOffer()`

#### `/unsubscribe` - Unsubscribe Page (Public)
- **Component**: `features/public/pages/UnsubscribePage.jsx`
- **Guard**: None (public)
- **Purpose**: Public unsubscribe flow
- **Components Used**: `PublicLayout`, `PublicCard`, `ConsentText`
- **Forms/Validations**: Phone number (E.164 format)
- **API Calls**: 
  - `POST /api/contacts/unsubscribe` via `publicContactsApi.unsubscribe()`
  - `GET /api/contacts/preferences/:pageToken` via `publicContactsApi.getPreferences()`

#### `/resubscribe` - Resubscribe Page (Public)
- **Component**: `features/public/pages/ResubscribePage.jsx`
- **Guard**: None (public)
- **Purpose**: Public resubscribe flow
- **Components Used**: `PublicLayout`, `PublicCard`, `ConsentText`
- **Forms/Validations**: Phone number (E.164 format)
- **API Calls**: 
  - `POST /api/contacts/resubscribe` via `publicContactsApi.resubscribe()`

#### `/nfc/:publicId` - NFC Opt-In Page (Public)
- **Component**: `features/public/pages/NfcOptInPage.jsx`
- **Guard**: None (public)
- **Purpose**: NFC-based opt-in form
- **Components Used**: `PublicLayout`, `PublicCard`
- **Forms/Validations**: Phone number (E.164 format)
- **API Calls**: 
  - `GET /nfc/:publicId/config` via `nfcApi.getConfig()`
  - `POST /nfc/:publicId/submit` via `nfcApi.submit()`

#### `/c/:tagPublicId` - Conversion Tag Page (Public)
- **Component**: `features/public/pages/ConversionTagPage.jsx`
- **Guard**: None (public)
- **Purpose**: Conversion tag opt-in form
- **Components Used**: `PublicLayout`, `PublicCard`
- **Forms/Validations**: Phone number (E.164 format)
- **API Calls**: 
  - `GET /api/conversion/:tagPublicId` via `conversionApi.getConfig()`
  - `POST /api/conversion/:tagPublicId` via `conversionApi.submit()`

#### `/link-expired` - Link Expired Page (Public)
- **Component**: `features/public/pages/LinkExpiredPage.jsx`
- **Guard**: None (public)
- **Purpose**: Display when tracking/unsubscribe links have expired
- **Components Used**: `PublicLayout`, `PublicCard`
- **Forms/Validations**: None
- **API Calls**: None

#### `/404` - Not Found Page
- **Component**: `features/public/pages/NotFoundPage.jsx`
- **Guard**: None (public)
- **Purpose**: 404 error page
- **Components Used**: `PublicLayout`
- **Forms/Validations**: None
- **API Calls**: None

---

### Protected Routes (Auth Required)

All protected routes are nested under `/app` and wrapped in `AppShell` component.

#### `/app/dashboard` - Dashboard
- **Component**: `features/dashboard/pages/DashboardPage.jsx`
- **Guard**: `AuthGuard`
- **Layout**: `AppShell`
- **Purpose**: Main dashboard with KPIs and quick actions
- **Components Used**: 
  - `KpiCard` (multiple)
  - `CreditsCard`
  - `QuickActions`
  - `RecentCampaigns`
  - `DashboardSkeleton` (loading)
  - `ErrorState` (error)
- **Forms/Validations**: None
- **API Calls**: 
  - `GET /api/dashboard/kpis` via `dashboardApi.getKPIs()`
  - `GET /api/billing/balance` (via CreditsCard)
  - `GET /api/campaigns` (via RecentCampaigns, with pagination)

#### `/app/campaigns` - Campaigns List
- **Component**: `features/campaigns/pages/CampaignsPage.jsx`
- **Guard**: `AuthGuard`
- **Layout**: `AppShell`
- **Purpose**: List all campaigns with filtering and search
- **Components Used**: 
  - `PageHeader`
  - `CampaignsToolbar` (search, filters)
  - `CampaignsTable` (list view)
  - `CampaignSkeleton` (loading)
  - `EmptyState`
  - `ErrorState`
- **Forms/Validations**: None (search/filter only)
- **API Calls**: 
  - `GET /api/campaigns` via `campaignsApi.list()` (with query params: page, pageSize, q, status)

#### `/app/campaigns/new` - New Campaign
- **Component**: `features/campaigns/pages/NewCampaignPage.jsx`
- **Guard**: `AuthGuard`
- **Layout**: `AppShell`
- **Purpose**: Create a new campaign via wizard
- **Components Used**: 
  - `PageHeader`
  - `CampaignWizard` (multi-step form)
- **Forms/Validations**: 
  - Schema: `campaignSchema` (Zod)
  - Fields: `name` (required, max 200), `messageText` (required, max 2000), `filterGender` (optional), `filterAgeGroup` (optional), `scheduledDate`, `scheduledTime`, `scheduledAt`
- **API Calls**: 
  - `POST /api/campaigns` via `campaignsApi.create()`
  - `POST /api/campaigns/preview-audience` via `campaignsApi.previewAudience()` (for audience preview)

#### `/app/campaigns/:id` - Campaign Detail
- **Component**: `features/campaigns/pages/CampaignDetailPage.jsx`
- **Guard**: `AuthGuard`
- **Layout**: `AppShell`
- **Purpose**: View campaign details, stats, and actions
- **Components Used**: 
  - `PageHeader`
  - `CampaignProgressCard`
  - `CampaignStatsCards`
  - `CampaignActions`
  - `MessagePreviewModal`
- **Forms/Validations**: None
- **API Calls**: 
  - `GET /api/campaigns/:id` via `campaignsApi.get()`
  - `GET /api/campaigns/:id/stats` via `campaignsApi.getStats()`
  - `GET /api/campaigns/:id/preview` via `campaignsApi.getPreview()`
  - `POST /api/campaigns/:id/enqueue` via `campaignsApi.enqueue()` (with Idempotency-Key header)
  - `POST /api/campaigns/:id/schedule` via `campaignsApi.schedule()`
  - `POST /api/campaigns/:id/unschedule` via `campaignsApi.unschedule()`

#### `/app/campaigns/:id/edit` - Edit Campaign
- **Component**: `features/campaigns/pages/EditCampaignPage.jsx`
- **Guard**: `AuthGuard`
- **Layout**: `AppShell`
- **Purpose**: Edit existing campaign
- **Components Used**: 
  - `PageHeader`
  - `CampaignWizard` (pre-filled)
- **Forms/Validations**: Same as New Campaign (`campaignSchema`)
- **API Calls**: 
  - `GET /api/campaigns/:id` via `campaignsApi.get()`
  - `PUT /api/campaigns/:id` via `campaignsApi.update()`

#### `/app/campaigns/:id/status` - Campaign Status
- **Component**: `features/campaigns/pages/CampaignStatusPage.jsx`
- **Guard**: `AuthGuard`
- **Layout**: `AppShell`
- **Purpose**: Real-time campaign sending status
- **Components Used**: 
  - `PageHeader`
  - `CampaignProgressCard`
- **Forms/Validations**: None
- **API Calls**: 
  - `GET /api/campaigns/:id/status` via `campaignsApi.getStatus()` (polling)

#### `/app/campaigns/:id/stats` - Campaign Statistics
- **Component**: `features/campaigns/pages/CampaignStatsPage.jsx`
- **Guard**: `AuthGuard`
- **Layout**: `AppShell`
- **Purpose**: Detailed campaign statistics and analytics
- **Components Used**: 
  - `PageHeader`
  - `CampaignStatsCards`
- **Forms/Validations**: None
- **API Calls**: 
  - `GET /api/campaigns/:id/stats` via `campaignsApi.getStats()`

#### `/app/contacts` - Contacts List
- **Component**: `features/contacts/pages/ContactsPage.jsx`
- **Guard**: `AuthGuard`
- **Layout**: `AppShell`
- **Purpose**: List all contacts with filtering by list and search
- **Components Used**: 
  - `PageHeader`
  - `ContactsToolbar` (search, list filter, add button)
  - `ContactsTable` (list view with pagination)
  - `ContactFormModal` (create/edit)
  - `ContactsSkeleton` (loading)
  - `EmptyState`
  - `ErrorState`
- **Forms/Validations**: 
  - Schema: `contactSchema` (Zod)
  - Fields: `phone` (required, E.164 format), `email` (optional, max 320), `firstName` (optional, max 120), `lastName` (optional, max 120), `gender` (optional: male/female/other), `birthday` (optional, past date), `isSubscribed` (optional boolean)
- **API Calls**: 
  - `GET /api/contacts` via `contactsApi.list()` (with params: page, pageSize, q, listId)
  - `GET /api/lists` via `listsApi.getSystemLists()` (for filter dropdown)
  - `POST /api/contacts` via `contactsApi.create()`
  - `PUT /api/contacts/:id` via `contactsApi.update()`
  - `DELETE /api/contacts/:id` via `contactsApi.delete()`

#### `/app/contacts/import` - Contacts Import
- **Component**: `features/contacts/pages/ContactsImportPage.jsx`
- **Guard**: `AuthGuard`
- **Layout**: `AppShell`
- **Purpose**: Bulk import contacts from CSV/Excel
- **Components Used**: 
  - `PageHeader`
  - File upload component
  - Import job status display
- **Forms/Validations**: File upload (CSV/Excel)
- **API Calls**: 
  - `POST /api/contacts/import` via `contactsApi.import()` (multipart/form-data)
  - `GET /api/contacts/import/:jobId` via `contactsApi.getImportStatus()` (polling)
  - `GET /api/contacts/import/template` via `contactsApi.downloadTemplate()` (download CSV template)

#### `/app/templates` - Templates List
- **Component**: `features/templates/pages/TemplatesPage.jsx`
- **Guard**: `AuthGuard`
- **Layout**: `AppShell`
- **Purpose**: List system and user-created templates
- **Components Used**: 
  - `PageHeader`
  - `TemplatesToolbar` (search, category filter, add button)
  - `TemplatesTable` (list view)
  - `TemplateFormModal` (create/edit)
  - `TemplatePreviewModal`
  - `TemplateTypeBadge`
  - `TemplatesSkeleton` (loading)
- **Forms/Validations**: 
  - Schema: `templateSchema` (Zod)
  - Fields: `name` (required, max 200), `text` (required, max 2000), `category` (optional: cafe/restaurant/gym/sports_club/generic/hotels), `goal` (optional, max 200), `suggestedMetrics` (optional, max 500), `language` (optional: en/gr, default 'en')
- **API Calls**: 
  - `GET /api/templates` via `templatesApi.list()` (with params: language, page, pageSize, q, category)
  - `GET /api/templates/:id` via `templatesApi.get()`
  - `POST /api/templates` via `templatesApi.create()`
  - `PUT /api/templates/:id` via `templatesApi.update()`
  - `DELETE /api/templates/:id` via `templatesApi.delete()`
  - `POST /api/templates/:id/render` via `templatesApi.render()` (preview with contact data)
  - `GET /api/templates/:id/stats` via `templatesApi.getStats()` (benchmark stats for system templates)

#### `/app/billing` - Billing Page
- **Component**: `features/billing/pages/BillingPage.jsx`
- **Guard**: `AuthGuard`
- **Layout**: `AppShell`
- **Purpose**: Manage subscription, purchase credit packs, view transactions
- **Components Used**: 
  - `PageHeader`
  - `BillingHeader`
  - `SubscriptionCard`
  - `PackageCard` (credit packs)
  - `CreditTopupCard`
  - `TransactionsTable`
- **Forms/Validations**: None (Stripe checkout redirects)
- **API Calls**: 
  - `GET /api/billing/balance` via `billingApi.getBalance()`
  - `GET /api/billing/packages` via `billingApi.getPackages()` (with currency param)
  - `GET /api/billing/transactions` via `billingApi.getTransactions()`
  - `GET /api/subscriptions/current` via `subscriptionsApi.getCurrent()`
  - `POST /api/subscriptions/subscribe` via `subscriptionsApi.subscribe()`
  - `POST /api/subscriptions/cancel` via `subscriptionsApi.cancel()`
  - `GET /api/subscriptions/portal` via `subscriptionsApi.getPortal()` (Stripe customer portal)
  - `POST /api/billing/purchase` via `billingApi.purchase()` (subscription package)
  - `POST /api/billing/topup` via `billingApi.topup()` (credit pack, packId must be string)

#### `/app/billing/success` - Billing Success
- **Component**: `features/billing/pages/BillingSuccessPage.jsx`
- **Guard**: `AuthGuard`
- **Layout**: `AppShell`
- **Purpose**: Success page after Stripe checkout redirect
- **Components Used**: Success message display
- **Forms/Validations**: None
- **API Calls**: None (reads success from URL params)

#### `/app/automations` - Automations Page
- **Component**: `features/automations/pages/AutomationsPage.jsx`
- **Guard**: `AuthGuard`
- **Layout**: `AppShell`
- **Purpose**: Manage automation settings (abandoned cart, winback, etc.)
- **Components Used**: 
  - `PageHeader`
  - `AutomationsList`
  - `AutomationCard`
  - `AutomationEditorModal`
  - `AutomationForm`
  - `AutomationsSkeleton` (loading)
- **Forms/Validations**: 
  - Schema: `automationMessageSchema` (Zod)
  - Fields: `messageBody` (required, max 2000)
- **API Calls**: 
  - `GET /api/automations` via `automationsApi.list()`
  - `GET /api/automations/:type` via `automationsApi.get()`
  - `PUT /api/automations/:type` via `automationsApi.update()`
  - `GET /api/automations/:type/stats` via `automationsApi.getStats()`

#### `/app/settings` - Settings Page
- **Component**: `features/settings/pages/SettingsPage.jsx`
- **Guard**: `AuthGuard`
- **Layout**: `AppShell`
- **Purpose**: User profile and account settings
- **Components Used**: 
  - `PageHeader`
  - `ProfileCard`
  - `ProfileForm`
  - `SecurityCard`
  - `ChangePasswordForm`
  - `BillingSummaryCard`
- **Forms/Validations**: 
  - Profile: `profileUpdateSchema` (Zod) - `company` (optional, max 160), `senderName` (optional, max 11, alphanumeric), `timezone` (optional, IANA format)
  - Password: `passwordChangeSchema` (Zod) - `currentPassword`, `newPassword` (min 8), `confirmPassword` (must match)
- **API Calls**: 
  - `GET /api/me` via `meApi.get()` (user profile)
  - `PUT /api/user` via `userApi.update()` (profile update)
  - `PUT /api/user/password` via `userApi.changePassword()`
  - `GET /api/billing/balance` (for billing summary)

---

## Common Components

### Layout Components
- `AppShell` - Main app layout with sidebar and topbar
- `AuthLayout` - Auth pages layout
- `PublicLayout` - Public pages layout

### UI Components
- `PageHeader` - Page title and subtitle
- `LoadingState` - Loading spinner
- `ErrorState` - Error display with retry
- `EmptyState` - Empty list state
- `ConfirmDialog` - Confirmation modal
- `StatusBadge` - Status indicator badge

### Navigation
- `SidebarNav` - Main navigation sidebar
- `TopBar` - Top navigation bar
- `UserMenu` - User dropdown menu
- `NavItem` - Navigation item component

---

## Notes

- All protected routes require authentication via `AuthGuard`
- Public routes use `PublicOnlyGuard` to redirect authenticated users
- All API calls use axios instance with automatic token injection and refresh logic
- Forms use Zod schemas for validation
- React Query is used for data fetching and caching
- Redux is used for UI state management

