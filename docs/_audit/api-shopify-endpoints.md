# Shopify API Endpoints

## Overview

The `apps/shopify-api` backend provides a comprehensive REST API for the Shopify SMS marketing extension. All store-scoped endpoints require authentication via Bearer JWT token and store context via `X-Shopify-Shop-Domain` header.

## Authentication

### Auth Mechanism
- **Type**: JWT Bearer tokens
- **Header**: `Authorization: Bearer <token>`
- **Store Context**: `X-Shopify-Shop-Domain: <shop-domain>.myshopify.com`
- **Token Source**: 
  - Shopify Extension: Exchange Shopify session token via `POST /auth/shopify-token`
  - Web App: OAuth flow via `GET /auth/shopify` → `GET /auth/callback`

### Public Endpoints
- Health checks (`/`, `/health`, `/health/full`)
- Metrics (`/metrics`)
- Public packages (`/public/packages`)
- Public contact form (`/public/contact`)
- Webhooks (Stripe, Mitto, Shopify)
- Short link redirects (`/r/:token`)
- Unsubscribe (`/unsubscribe/:token`)
- Opt-in (`/opt-in`)

---

## Core Routes

### `GET /`
- **Auth**: Public
- **Purpose**: API status and info
- **Response**: `{ ok: true, message: 'Astronote API', time: Date.now() }`

### `GET /health`
- **Auth**: Public
- **Purpose**: Basic health check
- **Response**: `{ ok: true, t: Date.now() }`

### `GET /health/config`
- **Auth**: Public
- **Purpose**: Configuration health check
- **Response**: `{ ok: true, shopify: {...}, redis: boolean, mitto: {...} }`

### `GET /health/full`
- **Auth**: Public
- **Purpose**: Comprehensive health check
- **Response**: Full health status including DB, Redis, queue, cache, Mitto

### `GET /metrics`
- **Auth**: Public
- **Purpose**: Prometheus-compatible metrics
- **Query Params**: `format=prometheus` (optional)
- **Response**: Metrics in Prometheus or JSON format

### `GET /whoami`
- **Auth**: Protected (requires store context)
- **Purpose**: Get current store info
- **Response**: `{ success: true, shop: {...} }`

---

## Dashboard Routes (`/dashboard`)

### `GET /dashboard`
- **Auth**: Protected
- **Purpose**: Main dashboard with KPIs and reports
- **Response**: Dashboard data including embedded reports widgets

### `GET /dashboard/overview`
- **Auth**: Protected
- **Purpose**: Dashboard overview
- **Response**: Overview data

### `GET /dashboard/quick-stats`
- **Auth**: Protected
- **Purpose**: Quick stats summary
- **Response**: Quick stats

---

## Campaign Routes (`/campaigns`)

### `GET /campaigns`
- **Auth**: Protected
- **Purpose**: List campaigns with filtering
- **Query Params**: `page`, `limit`, `status`, `search`, etc.
- **Response**: Paginated campaign list

### `GET /campaigns/stats/summary`
- **Auth**: Protected
- **Purpose**: Campaign statistics summary
- **Response**: Campaign stats

### `GET /campaigns/queue/stats`
- **Auth**: Protected
- **Purpose**: Queue statistics
- **Response**: Queue stats (waiting, active, completed, failed)

### `GET /campaigns/:id`
- **Auth**: Protected
- **Purpose**: Get single campaign
- **Response**: Campaign details

### `POST /campaigns`
- **Auth**: Protected
- **Body**: `{ name, message, audience: { type, segmentId? }, includeDiscount?, discountValue? }`
- **Purpose**: Create new campaign
- **Response**: Created campaign

### `PUT /campaigns/:id`
- **Auth**: Protected
- **Body**: Campaign update data
- **Purpose**: Update campaign
- **Response**: Updated campaign

### `DELETE /campaigns/:id`
- **Auth**: Protected
- **Purpose**: Delete campaign
- **Response**: Success confirmation

### `POST /campaigns/:id/prepare`
- **Auth**: Protected
- **Purpose**: Prepare campaign for sending
- **Response**: Preparation result

### `POST /campaigns/:id/enqueue`
- **Auth**: Protected
- **Headers**: `Idempotency-Key` (optional, for idempotency)
- **Purpose**: Enqueue campaign for bulk SMS
- **Response**: Enqueue result with queued recipients

### `POST /campaigns/:id/send`
- **Auth**: Protected
- **Purpose**: Send campaign immediately (DEPRECATED - use `/enqueue`)
- **Response**: Send result

### `PUT /campaigns/:id/schedule`
- **Auth**: Protected
- **Body**: `{ scheduledAt }`
- **Purpose**: Schedule campaign
- **Response**: Scheduled campaign

### `POST /campaigns/:id/cancel`
- **Auth**: Protected
- **Purpose**: Cancel sending campaign
- **Response**: Cancellation result

### `GET /campaigns/:id/metrics`
- **Auth**: Protected
- **Purpose**: Get campaign metrics
- **Response**: Campaign metrics

### `GET /campaigns/:id/status`
- **Auth**: Protected
- **Purpose**: Get campaign status with metrics
- **Response**: Campaign status

### `GET /campaigns/:id/preview`
- **Auth**: Protected
- **Purpose**: Get campaign preview (recipient count, cost)
- **Response**: Preview data

### `GET /campaigns/:id/progress`
- **Auth**: Protected
- **Purpose**: Get campaign progress
- **Response**: Progress data (sent, failed, pending, percentage)

### `GET /campaigns/:id/failed-recipients`
- **Auth**: Protected
- **Purpose**: Get failed recipients
- **Response**: List of failed recipients

### `POST /campaigns/:id/retry-failed`
- **Auth**: Protected
- **Purpose**: Retry failed SMS
- **Response**: Retry result

### `POST /campaigns/:id/update-status`
- **Auth**: Protected
- **Purpose**: Manually trigger delivery status update
- **Response**: Update result

---

## Contacts Routes (`/contacts`)

### `GET /contacts`
- **Auth**: Protected
- **Purpose**: List contacts with filtering, search, pagination
- **Query Params**: `page`, `limit`, `search`, `gender`, `ageGroup`, etc.
- **Response**: Paginated contact list

### `GET /contacts/stats`
- **Auth**: Protected
- **Purpose**: Contact statistics
- **Response**: Contact stats

### `GET /contacts/birthdays`
- **Auth**: Protected
- **Purpose**: Get contacts with birthdays
- **Query Params**: `month`, `day`
- **Response**: Birthday contacts

### `GET /contacts/:id`
- **Auth**: Protected
- **Purpose**: Get single contact
- **Response**: Contact details

### `POST /contacts`
- **Auth**: Protected
- **Body**: Contact creation data
- **Purpose**: Create new contact
- **Response**: Created contact

### `POST /contacts/import`
- **Auth**: Protected
- **Body**: CSV import data
- **Purpose**: Import contacts from CSV
- **Response**: Import result

### `PUT /contacts/:id`
- **Auth**: Protected
- **Body**: Contact update data
- **Purpose**: Update contact
- **Response**: Updated contact

### `DELETE /contacts/:id`
- **Auth**: Protected
- **Purpose**: Delete contact
- **Response**: Success confirmation

---

## Templates Routes (`/templates`)

### `GET /templates`
- **Auth**: Public (no authentication required)
- **Purpose**: Get all templates
- **Response**: Template list

### `GET /templates/categories`
- **Auth**: Public
- **Purpose**: Get template categories
- **Response**: Categories list

### `GET /templates/:id`
- **Auth**: Public
- **Purpose**: Get template by ID
- **Response**: Template details

### `POST /templates/:id/track`
- **Auth**: Protected (optional - handles store context internally)
- **Purpose**: Track template usage
- **Response**: Tracking result

---

## Automations Routes (`/automations`)

### `GET /automations`
- **Auth**: Protected
- **Purpose**: Get user automations
- **Response**: Automation list

### `POST /automations`
- **Auth**: Protected
- **Body**: Automation creation data
- **Purpose**: Create new automation
- **Response**: Created automation

### `GET /automations/stats`
- **Auth**: Protected
- **Purpose**: Get automation statistics
- **Response**: Automation stats

### `GET /automations/variables/:triggerType`
- **Auth**: Protected
- **Purpose**: Get available variables for trigger type
- **Response**: Variables list

### `PUT /automations/:id`
- **Auth**: Protected
- **Body**: Automation update data
- **Purpose**: Update automation
- **Response**: Updated automation

### `DELETE /automations/:id`
- **Auth**: Protected
- **Purpose**: Delete automation
- **Response**: Success confirmation

### `GET /automations/defaults`
- **Auth**: Protected
- **Purpose**: Get system default automations
- **Response**: System defaults

### `POST /automations/sync`
- **Auth**: Protected
- **Purpose**: Sync system defaults
- **Response**: Sync result

---

## Audiences/Segments Routes (`/audiences`)

### `GET /audiences/segments`
- **Auth**: Protected
- **Purpose**: Get all segments (system + custom)
- **Response**: Segment list

### `GET /audiences/segments/:id`
- **Auth**: Protected
- **Purpose**: Get segment by ID
- **Response**: Segment details

### `GET /audiences/segments/:id/preview`
- **Auth**: Protected
- **Purpose**: Get segment preview (contact count)
- **Response**: Preview data

### `GET /audiences` (Legacy)
- **Auth**: Protected
- **Purpose**: Get predefined audiences (backward compatible)
- **Response**: Audience list

### `GET /audiences/:audienceId/details`
- **Auth**: Protected
- **Query Params**: `page`, `limit`
- **Purpose**: Get audience details with contact list
- **Response**: Audience details

### `POST /audiences/validate`
- **Auth**: Protected
- **Body**: `{ audienceId }`
- **Purpose**: Validate audience selection
- **Response**: Validation result

---

## Billing Routes (`/billing`)

### `GET /billing/balance`
- **Auth**: Protected
- **Purpose**: Get credit balance
- **Response**: Balance data

### `GET /billing/packages`
- **Auth**: Protected
- **Purpose**: Get available credit packages (requires subscription)
- **Response**: Package list

### `GET /billing/topup/calculate`
- **Auth**: Protected
- **Query Params**: `credits`
- **Purpose**: Calculate top-up price
- **Response**: Price calculation

### `POST /billing/topup`
- **Auth**: Protected
- **Body**: Top-up data
- **Purpose**: Create top-up checkout session
- **Response**: Checkout session

### `GET /billing/history`
- **Auth**: Protected
- **Query Params**: `page`, `limit`
- **Purpose**: Get transaction history
- **Response**: Transaction history

### `GET /billing/billing-history`
- **Auth**: Protected
- **Query Params**: `page`, `limit`
- **Purpose**: Get billing history (Stripe transactions)
- **Response**: Billing history

### `POST /billing/purchase`
- **Auth**: Protected
- **Body**: Purchase data
- **Purpose**: Create Stripe checkout session (credit packs)
- **Response**: Checkout session

---

## Subscriptions Routes (`/subscriptions`)

### `GET /subscriptions/status`
- **Auth**: Protected
- **Purpose**: Get subscription status
- **Response**: Subscription status

### `POST /subscriptions/subscribe`
- **Auth**: Protected
- **Body**: Subscription data
- **Purpose**: Create subscription checkout
- **Response**: Checkout session

### `POST /subscriptions/update`
- **Auth**: Protected
- **Body**: Update data
- **Purpose**: Update subscription plan
- **Response**: Update result

### `POST /subscriptions/cancel`
- **Auth**: Protected
- **Purpose**: Cancel subscription
- **Response**: Cancellation result

### `POST /subscriptions/verify-session`
- **Auth**: Protected
- **Purpose**: Manual verification
- **Response**: Verification result

### `GET /subscriptions/portal`
- **Auth**: Protected
- **Purpose**: Get Stripe Customer Portal URL
- **Response**: Portal URL

---

## Settings Routes (`/settings`)

### `GET /settings`
- **Auth**: Protected
- **Purpose**: Get settings
- **Response**: Settings data

### `GET /settings/account`
- **Auth**: Protected
- **Purpose**: Get account info
- **Response**: Account data

### `PUT /settings/sender` (Legacy)
- **Auth**: Protected
- **Body**: Sender data
- **Purpose**: Update sender number (backward compatibility)
- **Response**: Updated settings

### `PUT /settings`
- **Auth**: Protected
- **Body**: Settings update data
- **Purpose**: Update all settings
- **Response**: Updated settings

---

## Auth Routes (`/auth`)

### `POST /auth/shopify-token`
- **Auth**: Public (requires session token)
- **Body**: `{ sessionToken }`
- **Purpose**: Exchange Shopify session token for app JWT
- **Response**: `{ token, store, expiresIn }`

### `GET /auth/shopify`
- **Auth**: Public
- **Query Params**: `shop`
- **Purpose**: Initiate Shopify OAuth flow
- **Response**: Redirect to Shopify OAuth

### `GET /auth/callback`
- **Auth**: Public
- **Query Params**: `code`, `shop`, `hmac`
- **Purpose**: Handle Shopify OAuth callback
- **Response**: Redirect to web app with token

### `GET /auth/verify`
- **Auth**: Protected (requires Bearer token)
- **Purpose**: Verify JWT token validity
- **Response**: `{ valid: true, store: {...}, token: {...} }`

### `POST /auth/refresh`
- **Auth**: Protected
- **Purpose**: Refresh JWT token
- **Response**: `{ token, expiresIn }`

---

## Public Routes

### `GET /public/packages`
- **Auth**: Public
- **Purpose**: Public pricing packages (marketing page)
- **Response**: Package list

### `POST /public/contact`
- **Auth**: Public
- **Body**: Contact form data
- **Purpose**: Public contact form submission
- **Response**: Submission result

---

## Short Links Routes (`/r`)

### `GET /r/:token`
- **Auth**: Public
- **Purpose**: Redirect short link to destination
- **Rate Limit**: 100 requests/minute per IP
- **Response**: 302 redirect to destination URL

---

## Unsubscribe Routes (`/unsubscribe`)

### `GET /unsubscribe/:token`
- **Auth**: Public
- **Purpose**: Get unsubscribe page info
- **Response**: Unsubscribe page data

### `POST /unsubscribe/:token`
- **Auth**: Public
- **Purpose**: Process unsubscribe
- **Response**: Unsubscribe result

---

## Opt-in Routes (`/opt-in`)

### `POST /opt-in`
- **Auth**: Public
- **Body**: Opt-in data
- **Purpose**: Public opt-in endpoint (storefront extensions)
- **Response**: Opt-in result

---

## Tracking Routes (`/tracking`)

### `GET /tracking/mitto/:messageId`
- **Auth**: Protected
- **Purpose**: Get delivery status for Mitto message
- **Response**: Message status

### `GET /tracking/campaign/:campaignId`
- **Auth**: Protected
- **Purpose**: Get delivery status for campaign
- **Response**: Campaign delivery status

### `POST /tracking/bulk-update`
- **Auth**: Protected
- **Body**: Bulk update data
- **Purpose**: Bulk update delivery status
- **Response**: Update result

---

## Mitto Routes (`/mitto`)

### `POST /mitto/refresh-status`
- **Auth**: Protected
- **Body**: `{ messageId }`
- **Purpose**: Refresh single message status
- **Response**: Status refresh result

### `POST /mitto/refresh-status-bulk`
- **Auth**: Protected
- **Body**: Bulk refresh data
- **Purpose**: Refresh multiple message statuses
- **Response**: Bulk refresh result

### `GET /mitto/message/:messageId`
- **Auth**: Protected
- **Purpose**: Get message status (read-only)
- **Response**: Message status

---

## Reports Routes (`/reports`)

### `GET /reports/overview`
- **Auth**: Protected
- **Purpose**: Reports overview
- **Response**: Overview data

### `GET /reports/kpis`
- **Auth**: Protected
- **Purpose**: KPI reports
- **Response**: KPI data

### `GET /reports/campaigns`
- **Auth**: Protected
- **Purpose**: Campaign reports
- **Response**: Campaign report data

### `GET /reports/campaigns/:id`
- **Auth**: Protected
- **Purpose**: Campaign-specific report
- **Response**: Campaign report

### `GET /reports/automations`
- **Auth**: Protected
- **Purpose**: Automation reports
- **Response**: Automation report data

### `GET /reports/messaging`
- **Auth**: Protected
- **Purpose**: Messaging reports
- **Response**: Messaging report data

### `GET /reports/credits`
- **Auth**: Protected
- **Purpose**: Credits reports
- **Response**: Credits report data

### `GET /reports/contacts`
- **Auth**: Protected
- **Purpose**: Contacts reports
- **Response**: Contacts report data

### `GET /reports/export`
- **Auth**: Protected
- **Purpose**: Export data
- **Response**: Export file

---

## Discounts Routes (`/discounts`)

### `GET /discounts`
- **Auth**: Protected
- **Purpose**: Get available discount codes
- **Response**: Discount list

### `GET /discounts/:id`
- **Auth**: Protected
- **Purpose**: Get specific discount code
- **Response**: Discount details

### `GET /discounts/validate/:code`
- **Auth**: Protected
- **Purpose**: Validate discount code
- **Response**: Validation result

### `POST /discounts/validate`
- **Auth**: Protected
- **Body**: `{ discountId }`
- **Purpose**: Validate discount code for campaign use
- **Response**: Validation result

---

## Webhooks

### `POST /webhooks/stripe`
- **Auth**: Public (Stripe signature verification)
- **Purpose**: Handle Stripe webhooks
- **Response**: 200 OK

### `POST /webhooks/mitto/dlr`
- **Auth**: Public (Mitto signature verification)
- **Purpose**: Handle Mitto delivery reports
- **Response**: 202 Accepted

### `POST /webhooks/shopify/orders/create`
- **Auth**: Public (Shopify signature verification)
- **Purpose**: Handle order created webhook
- **Response**: 200 OK

### `POST /webhooks/shopify/orders/fulfilled`
- **Auth**: Public (Shopify signature verification)
- **Purpose**: Handle order fulfilled webhook
- **Response**: 200 OK

### `POST /webhooks/shopify/cart/abandoned`
- **Auth**: Public (Shopify signature verification)
- **Purpose**: Handle abandoned cart webhook
- **Response**: 200 OK

### `POST /webhooks/shopify/checkout/abandoned`
- **Auth**: Public (Shopify signature verification)
- **Purpose**: Handle abandoned checkout webhook
- **Response**: 200 OK

### `POST /webhooks/flow/abandoned-checkout`
- **Auth**: Public (may not have Shopify signature)
- **Purpose**: Handle Flow abandoned checkout
- **Response**: 200 OK

### `POST /webhooks/automation/trigger`
- **Auth**: Protected (for testing)
- **Purpose**: Manual trigger automation (testing)
- **Response**: Trigger result

---

## Admin Routes (`/admin/templates`)

### `GET /admin/templates`
- **Auth**: Protected
- **Purpose**: Get all templates (admin view)
- **Response**: Template list

### `POST /admin/templates`
- **Auth**: Protected
- **Body**: Template creation data
- **Purpose**: Create template
- **Response**: Created template

### `GET /admin/templates/:id/stats`
- **Auth**: Protected
- **Purpose**: Get template statistics
- **Response**: Template stats

### `PUT /admin/templates/:id`
- **Auth**: Protected
- **Body**: Template update data
- **Purpose**: Update template
- **Response**: Updated template

### `DELETE /admin/templates/:id`
- **Auth**: Protected
- **Purpose**: Delete template
- **Response**: Success confirmation

---

## Notes

- All protected routes require `Authorization: Bearer <token>` header
- Store-scoped routes require `X-Shopify-Shop-Domain` header
- Rate limiting is applied to most endpoints
- Caching is used for read-heavy endpoints (campaigns, contacts, billing)
- Idempotency keys are supported for campaign enqueue (`Idempotency-Key` header)

