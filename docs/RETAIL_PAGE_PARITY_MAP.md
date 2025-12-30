# Retail Page Parity Map

This document tracks the migration status of all Retail pages from `apps/retail-web-legacy` to `apps/astronote-web`.

## Status Legend
- ✅ **Implemented** - Fully migrated with parity
- 🟡 **Partial** - Partially implemented, missing features
- ❌ **Missing** - Not yet implemented
- 🔄 **In Progress** - Currently being implemented

---

## Public Routes (No Auth Required)

| Legacy Route | Legacy File | Astronote Route | Astronote File | APIs Used | Status |
|-------------|-------------|-----------------|----------------|-----------|--------|
| `/` | `features/auth/pages/LandingPage.jsx` | N/A | N/A | None | ❌ Skip (marketing page) |
| `/signup` | `features/auth/pages/SignupPage.jsx` | `/auth/retail/register` | `app/(retail)/auth/retail/register/page.tsx` | POST `/api/auth/register` | ✅ Implemented |
| `/login` | `features/auth/pages/LoginPage.jsx` | `/auth/retail/login` | `app/(retail)/auth/retail/login/page.tsx` | POST `/api/auth/login` | ✅ Implemented |
| `/o/:trackingId` | `features/public/pages/OfferPage.jsx` | `/tracking/offer/[trackingId]` | `app/(retail)/tracking/offer/[trackingId]/page.tsx` | GET `/tracking/offer/:trackingId` | 🟡 Partial |
| `/unsubscribe` | `features/public/pages/UnsubscribePage.jsx` | `/unsubscribe` | `app/(retail)/unsubscribe/page.tsx` | GET `/api/contacts/preferences/:pageToken`, POST `/api/contacts/unsubscribe` | 🟡 Partial |
| `/resubscribe` | `features/public/pages/ResubscribePage.jsx` | N/A | N/A | POST `/api/contacts/resubscribe` | ❌ Missing |
| `/nfc/:publicId` | `features/public/pages/NfcOptInPage.jsx` | N/A | N/A | GET `/nfc/:publicId/config`, POST `/nfc/:publicId/submit` | ❌ Missing |
| `/c/:tagPublicId` | `features/public/pages/ConversionTagPage.jsx` | N/A | N/A | GET `/api/conversion/:tagPublicId`, POST `/api/conversion/:tagPublicId` | ❌ Missing |
| `/link-expired` | `features/public/pages/LinkExpiredPage.jsx` | N/A | N/A | None | ❌ Missing |
| `/404` | `features/public/pages/NotFoundPage.jsx` | N/A | N/A | None | ❌ Missing |

---

## Protected Routes (Auth Required)

### Dashboard

| Legacy Route | Legacy File | Astronote Route | Astronote File | APIs Used | Status |
|-------------|-------------|-----------------|----------------|-----------|--------|
| `/app/dashboard` | `features/dashboard/pages/DashboardPage.jsx` | `/app/retail/dashboard` | `app/(retail)/app/retail/dashboard/page.tsx` | GET `/api/dashboard/kpis`, GET `/api/billing/balance`, GET `/api/campaigns` | 🟡 Partial (needs RecentCampaigns) |

### Campaigns

| Legacy Route | Legacy File | Astronote Route | Astronote File | APIs Used | Status |
|-------------|-------------|-----------------|----------------|-----------|--------|
| `/app/campaigns` | `features/campaigns/pages/CampaignsPage.jsx` | `/app/retail/campaigns` | `app/(retail)/app/retail/campaigns/page.tsx` | GET `/api/campaigns` | ✅ Implemented |
| `/app/campaigns/new` | `features/campaigns/pages/NewCampaignPage.jsx` | `/app/retail/campaigns/new` | `app/(retail)/app/retail/campaigns/new/page.tsx` | POST `/api/campaigns`, POST `/api/campaigns/preview-audience` | ✅ Implemented |
| `/app/campaigns/:id` | `features/campaigns/pages/CampaignDetailPage.jsx` | `/app/retail/campaigns/[id]` | `app/(retail)/app/retail/campaigns/[id]/page.tsx` | GET `/api/campaigns/:id`, GET `/api/campaigns/:id/stats`, GET `/api/campaigns/:id/preview`, POST `/api/campaigns/:id/enqueue`, POST `/api/campaigns/:id/schedule`, POST `/api/campaigns/:id/unschedule` | ✅ Implemented |
| `/app/campaigns/:id/edit` | `features/campaigns/pages/EditCampaignPage.jsx` | `/app/retail/campaigns/[id]/edit` | `app/(retail)/app/retail/campaigns/[id]/edit/page.tsx` | GET `/api/campaigns/:id`, PUT `/api/campaigns/:id` | ✅ Implemented |
| `/app/campaigns/:id/status` | `features/campaigns/pages/CampaignStatusPage.jsx` | `/app/retail/campaigns/[id]/status` | `app/(retail)/app/retail/campaigns/[id]/status/page.tsx` | GET `/api/campaigns/:id/status` (polling) | ✅ Implemented |
| `/app/campaigns/:id/stats` | `features/campaigns/pages/CampaignStatsPage.jsx` | `/app/retail/campaigns/[id]/stats` | `app/(retail)/app/retail/campaigns/[id]/stats/page.tsx` | GET `/api/campaigns/:id/stats` | ✅ Implemented |

### Contacts

| Legacy Route | Legacy File | Astronote Route | Astronote File | APIs Used | Status |
|-------------|-------------|-----------------|----------------|-----------|--------|
| `/app/contacts` | `features/contacts/pages/ContactsPage.jsx` | `/app/retail/contacts` | `app/(retail)/app/retail/contacts/page.tsx` | GET `/api/contacts`, GET `/api/lists`, POST `/api/contacts`, PUT `/api/contacts/:id`, DELETE `/api/contacts/:id` | ✅ Implemented |
| `/app/contacts/import` | `features/contacts/pages/ContactsImportPage.jsx` | `/app/retail/contacts/import` | N/A | POST `/api/contacts/import`, GET `/api/contacts/import/:jobId`, GET `/api/contacts/import/template` | ❌ Missing |

### Templates

| Legacy Route | Legacy File | Astronote Route | Astronote File | APIs Used | Status |
|-------------|-------------|-----------------|----------------|-----------|--------|
| `/app/templates` | `features/templates/pages/TemplatesPage.jsx` | `/app/retail/templates` | `app/(retail)/app/retail/templates/page.tsx` | GET `/api/templates`, GET `/api/templates/:id`, POST `/api/templates`, PUT `/api/templates/:id`, DELETE `/api/templates/:id`, POST `/api/templates/:id/render`, GET `/api/templates/:id/stats` | ✅ Implemented |

### Billing

| Legacy Route | Legacy File | Astronote Route | Astronote File | APIs Used | Status |
|-------------|-------------|-----------------|----------------|-----------|--------|
| `/app/billing` | `features/billing/pages/BillingPage.jsx` | `/app/retail/billing` | `app/(retail)/app/retail/billing/page.tsx` | GET `/api/billing/balance`, GET `/api/billing/packages`, GET `/api/billing/transactions`, GET `/api/subscriptions/current`, POST `/api/subscriptions/subscribe`, POST `/api/subscriptions/cancel`, GET `/api/subscriptions/portal`, POST `/api/billing/purchase`, POST `/api/billing/topup` | ✅ Implemented |
| `/app/billing/success` | `features/billing/pages/BillingSuccessPage.jsx` | `/app/retail/billing/success` | N/A | None (reads URL params) | ❌ Missing |

### Automations

| Legacy Route | Legacy File | Astronote Route | Astronote File | APIs Used | Status |
|-------------|-------------|-----------------|----------------|-----------|--------|
| `/app/automations` | `features/automations/pages/AutomationsPage.jsx` | `/app/retail/automations` | `app/(retail)/app/retail/automations/page.tsx` | GET `/api/automations`, GET `/api/automations/:type`, PUT `/api/automations/:type`, GET `/api/automations/:type/stats` | ✅ Implemented |

### Settings

| Legacy Route | Legacy File | Astronote Route | Astronote File | APIs Used | Status |
|-------------|-------------|-----------------|----------------|-----------|--------|
| `/app/settings` | `features/settings/pages/SettingsPage.jsx` | `/app/retail/settings` | `app/(retail)/app/retail/settings/page.tsx` | GET `/api/me`, PUT `/api/user`, PUT `/api/user/password`, GET `/api/billing/balance` | ✅ Implemented |

---

## Implementation Priority

### Phase 1: Critical Missing Pages (Core Functionality)
1. ❌ Contacts List (`/app/retail/contacts`)
2. ❌ Contacts Import (`/app/retail/contacts/import`)
3. ❌ Templates (`/app/retail/templates`)
4. ❌ Automations (`/app/retail/automations`)
5. ❌ Settings (`/app/retail/settings`)
6. ❌ Campaign Edit (`/app/retail/campaigns/[id]/edit`)

### Phase 2: Dashboard Enhancements
1. 🟡 Dashboard RecentCampaigns component

### Phase 3: Public Pages (Lower Priority)
1. ❌ Resubscribe page
2. ❌ NFC Opt-In page
3. ❌ Conversion Tag page
4. ❌ Link Expired page
5. ❌ 404 page
6. 🟡 Unsubscribe page (enhance)
7. 🟡 Offer page (enhance)

### Phase 4: Billing Success
1. ❌ Billing Success page

---

## Notes

- All placeholder pages must be replaced with full implementations
- Each page must match legacy UX, validations, and API usage exactly
- Error handling must not block navigation
- All pages must use Retail Light Mode theme

