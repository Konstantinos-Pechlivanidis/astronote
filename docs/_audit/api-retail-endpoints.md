# Retail API Endpoints

## Overview

The `apps/retail-api/apps/api` backend provides a comprehensive REST API for the retail SMS marketing platform. All protected endpoints require JWT Bearer token authentication.

## Authentication

### Auth Mechanism
- **Type**: JWT Bearer tokens (access + refresh)
- **Header**: `Authorization: Bearer <accessToken>`
- **Refresh Token**: Stored in HTTP-only cookie `rt`
- **Token Source**: 
  - Register: `POST /api/auth/register`
  - Login: `POST /api/auth/login`
  - Refresh: `POST /api/auth/refresh`

### Public Endpoints
- Health checks (`/healthz`, `/readiness`, `/health/db`)
- Public tracking (`/tracking/*`)
- Public conversion (`/conversion/*`)
- Public NFC opt-in (`/nfc/*`)
- Webhooks (Stripe, Mitto)

---

## Health Routes

### `GET /healthz`
- **Auth**: Public
- **Purpose**: Basic liveness check
- **Response**: `{ status: 'ok' }`

### `GET /readiness`
- **Auth**: Public
- **Purpose**: Readiness check with database ping
- **Response**: `{ status: 'ready' }` or 500 if DB unavailable

### `GET /health/db`
- **Auth**: Public
- **Purpose**: Database connectivity check
- **Response**: `{ status: 'ok', database: 'connected' }` or 500

---

## Auth Routes (`/api/auth`)

### `POST /api/auth/register`
- **Auth**: Public
- **Body**: `{ email, password, senderName?, company? }`
- **Rate Limit**: 30 req/10m per IP, 10 req/10m per email
- **Purpose**: Register new user
- **Response**: `{ accessToken, user: {...} }` + refresh token in cookie

### `POST /api/auth/login`
- **Auth**: Public
- **Body**: `{ email, password }`
- **Rate Limit**: 50 req/10m per IP, 20 req/10m per email
- **Purpose**: Login user
- **Response**: `{ accessToken, user: {...} }` + refresh token in cookie

### `POST /api/auth/refresh`
- **Auth**: Public (requires refresh token cookie)
- **Rate Limit**: 300 req/10m per IP
- **Purpose**: Refresh access token
- **Response**: `{ accessToken }` + new refresh token in cookie

### `POST /api/auth/logout`
- **Auth**: Protected
- **Rate Limit**: 120 req/10m per IP
- **Purpose**: Logout user (clears refresh token)
- **Response**: `{ message: 'Logged out' }`

---

## User Routes (`/api/user`, `/api/me`)

### `GET /api/me`
- **Auth**: Protected
- **Purpose**: Get current user info with credits
- **Response**: `{ user: { id, email, senderName, company, timezone, credits } }`

### `PUT /api/user`
- **Auth**: Protected
- **Body**: User update data
- **Purpose**: Update user profile
- **Response**: Updated user

### `PUT /api/user/password`
- **Auth**: Protected
- **Body**: `{ currentPassword, newPassword }`
- **Purpose**: Change password
- **Response**: Success confirmation

---

## Dashboard Routes (`/api/dashboard`)

### `GET /api/dashboard/kpis`
- **Auth**: Protected
- **Purpose**: Get dashboard KPIs
- **Response**: KPI data (campaigns, messages, credits, etc.)

---

## Campaigns Routes (`/api/campaigns`)

### `GET /api/campaigns`
- **Auth**: Protected
- **Query Params**: `page`, `pageSize`, `q`, `status`, `dateFrom`, `dateTo`, `orderBy`, `order`, `withStats`
- **Purpose**: List campaigns with filtering
- **Response**: Paginated campaign list

### `GET /api/v1/campaigns` (Versioned)
- **Auth**: Protected
- **Purpose**: Versioned campaign list endpoint
- **Response**: Campaign list

### `GET /api/campaigns/:id`
- **Auth**: Protected
- **Purpose**: Get single campaign
- **Response**: Campaign details

### `POST /api/campaigns`
- **Auth**: Protected
- **Body**: `{ name, messageText, filterGender?, filterAgeGroup?, scheduledDate?, scheduledTime? }`
- **Purpose**: Create campaign
- **Response**: Created campaign

### `PUT /api/campaigns/:id`
- **Auth**: Protected
- **Body**: Campaign update data
- **Purpose**: Update campaign
- **Response**: Updated campaign

### `DELETE /api/campaigns/:id`
- **Auth**: Protected
- **Purpose**: Delete campaign
- **Response**: Success confirmation

### `POST /api/campaigns/:id/enqueue`
- **Auth**: Protected
- **Purpose**: Enqueue campaign for sending
- **Response**: Enqueue result

### `POST /api/campaigns/:id/schedule`
- **Auth**: Protected
- **Body**: `{ scheduledDate, scheduledTime }`
- **Purpose**: Schedule campaign
- **Response**: Scheduled campaign

### `POST /api/campaigns/:id/unschedule`
- **Auth**: Protected
- **Purpose**: Unschedule campaign
- **Response**: Unscheduled campaign

### `GET /api/campaigns/:id/status`
- **Auth**: Protected
- **Purpose**: Get campaign status
- **Response**: Campaign status

### `GET /api/campaigns/:id/stats`
- **Auth**: Protected
- **Purpose**: Get campaign statistics
- **Response**: Campaign stats

### `GET /api/campaigns/:id/preview`
- **Auth**: Protected
- **Purpose**: Get campaign preview
- **Response**: Preview data

### `GET /api/campaigns/preview-audience`
- **Auth**: Protected
- **Query Params**: Audience filter params
- **Purpose**: Preview audience for campaign
- **Response**: Audience preview

### `GET /api/v1/campaigns/stats`
- **Auth**: Protected
- **Query Params**: `ids` (comma-separated)
- **Purpose**: Get stats for multiple campaigns
- **Response**: Array of campaign stats

---

## Contacts Routes (`/api/contacts`)

### `GET /api/contacts`
- **Auth**: Protected
- **Query Params**: `page`, `pageSize`, `q`, `gender`, `ageGroup`, etc.
- **Purpose**: List contacts with filtering
- **Response**: Paginated contact list

### `GET /api/contacts/:id`
- **Auth**: Protected
- **Purpose**: Get single contact
- **Response**: Contact details

### `POST /api/contacts`
- **Auth**: Protected
- **Body**: Contact creation data
- **Purpose**: Create contact
- **Response**: Created contact

### `PUT /api/contacts/:id`
- **Auth**: Protected
- **Body**: Contact update data
- **Purpose**: Update contact
- **Response**: Updated contact

### `DELETE /api/contacts/:id`
- **Auth**: Protected
- **Purpose**: Delete contact
- **Response**: Success confirmation

### `POST /api/contacts/import`
- **Auth**: Protected
- **Body**: CSV file (multipart/form-data)
- **Purpose**: Import contacts from CSV
- **Response**: Import job ID

### `GET /api/contacts/import/:jobId`
- **Auth**: Protected
- **Purpose**: Get import job status
- **Response**: Import job status

### `GET /api/contacts/import/template`
- **Auth**: Protected
- **Purpose**: Download CSV import template
- **Response**: CSV file

### `GET /api/contacts/unsubscribed`
- **Auth**: Protected
- **Query Params**: `page`, `pageSize`
- **Purpose**: Get unsubscribed contacts
- **Response**: Unsubscribed contacts list

### `POST /api/contacts/:id/unsubscribe`
- **Auth**: Protected
- **Purpose**: Unsubscribe contact
- **Response**: Unsubscribe result

### `POST /api/contacts/:id/resubscribe`
- **Auth**: Protected
- **Purpose**: Resubscribe contact
- **Response**: Resubscribe result

### `GET /api/contacts/birthdays`
- **Auth**: Protected
- **Query Params**: `month`, `day`
- **Purpose**: Get contacts with birthdays
- **Response**: Birthday contacts

### `GET /api/contacts/stats`
- **Auth**: Protected
- **Purpose**: Get contact statistics
- **Response**: Contact stats

---

## Lists Routes (`/api/lists`)

### `GET /api/lists`
- **Auth**: Protected
- **Query Params**: `page`, `pageSize`, `q`
- **Purpose**: List contact lists
- **Response**: Paginated list of lists

### `GET /api/lists/:listId`
- **Auth**: Protected
- **Purpose**: Get single list
- **Response**: List details

### `POST /api/lists`
- **Auth**: Protected
- **Body**: `{ name, description?, filterGender?, filterAgeMin?, filterAgeMax? }`
- **Purpose**: Create list
- **Response**: Created list

### `PUT /api/lists/:listId`
- **Auth**: Protected
- **Body**: List update data
- **Purpose**: Update list
- **Response**: Updated list

### `DELETE /api/lists/:listId`
- **Auth**: Protected
- **Purpose**: Delete list
- **Response**: Success confirmation

### `GET /api/lists/:listId/contacts`
- **Auth**: Protected
- **Query Params**: `page`, `pageSize`
- **Purpose**: Get contacts in list
- **Response**: Paginated contacts

### `POST /api/lists/:listId/contacts/:contactId`
- **Auth**: Protected
- **Purpose**: Add contact to list
- **Response**: Success confirmation

### `DELETE /api/lists/:listId/contacts/:contactId`
- **Auth**: Protected
- **Purpose**: Remove contact from list
- **Response**: Success confirmation

### `POST /api/lists/:listId/sync`
- **Auth**: Protected
- **Purpose**: Sync list (recalculate contacts)
- **Response**: Sync result

---

## Templates Routes (`/api/templates`)

### `GET /api/templates`
- **Auth**: Protected
- **Query Params**: `page`, `pageSize`, `q`, `category`, `language` (required: "en" or "gr")
- **Purpose**: List templates (system + user's custom)
- **Response**: Paginated template list

### `GET /api/templates/:id`
- **Auth**: Protected
- **Purpose**: Get single template
- **Response**: Template details

### `POST /api/templates`
- **Auth**: Protected
- **Body**: Template creation data
- **Purpose**: Create custom template
- **Response**: Created template

### `PUT /api/templates/:id`
- **Auth**: Protected
- **Body**: Template update data
- **Purpose**: Update template
- **Response**: Updated template

### `DELETE /api/templates/:id`
- **Auth**: Protected
- **Purpose**: Delete template
- **Response**: Success confirmation

### `POST /api/templates/:id/render`
- **Auth**: Protected
- **Body**: `{ placeholders: {...} }`
- **Purpose**: Render template with placeholders
- **Response**: Rendered template text

### `GET /api/templates/:id/stats`
- **Auth**: Protected
- **Purpose**: Get template statistics
- **Response**: Template stats

---

## Automations Routes (`/api/automations`)

### `GET /api/automations`
- **Auth**: Protected
- **Purpose**: Get all automations (welcome + birthday)
- **Response**: `{ welcome: {...}, birthday: {...} }` with stats

### `GET /api/automations/:type`
- **Auth**: Protected
- **Params**: `type` = "welcome" or "birthday"
- **Purpose**: Get specific automation
- **Response**: Automation details

### `PUT /api/automations/:type`
- **Auth**: Protected
- **Body**: Automation update data
- **Purpose**: Update automation (enable/disable, edit message)
- **Response**: Updated automation

### `POST /api/automations`
- **Auth**: Protected
- **Purpose**: Create automation (not typically used - system creates defaults)
- **Response**: Created automation

### `GET /api/automations/:type/stats`
- **Auth**: Protected
- **Purpose**: Get automation statistics
- **Response**: Automation stats

### `DELETE /api/automations/:type`
- **Auth**: Protected
- **Purpose**: Delete automation (not recommended)
- **Response**: Success confirmation

---

## Billing Routes (`/api/billing`)

### `GET /api/billing/balance`
- **Auth**: Protected
- **Purpose**: Get credit balance and subscription status
- **Response**: `{ balance, subscription: {...} }`

### `GET /api/billing/wallet`
- **Auth**: Protected
- **Purpose**: Alias for `/billing/balance`
- **Response**: Same as balance

### `GET /api/billing/packages`
- **Auth**: Protected
- **Purpose**: Get available credit packages
- **Response**: Package list

### `GET /api/billing/transactions`
- **Auth**: Protected
- **Query Params**: `page`, `pageSize`
- **Purpose**: Get transaction history
- **Response**: Transaction history

### `GET /api/billing/purchases`
- **Auth**: Protected
- **Query Params**: `page`, `pageSize`
- **Purpose**: Get purchase history
- **Response**: Purchase history

### `POST /api/billing/purchase`
- **Auth**: Protected
- **Body**: `{ packageId }`
- **Purpose**: Create credit pack checkout session
- **Response**: Checkout session URL

### `POST /api/billing/topup`
- **Auth**: Protected
- **Body**: `{ credits }`
- **Purpose**: Create credit top-up checkout session
- **Response**: Checkout session URL

---

## Subscriptions Routes (`/api/subscriptions`)

### `GET /api/subscriptions/current`
- **Auth**: Protected
- **Purpose**: Get current subscription
- **Response**: Subscription details

### `POST /api/subscriptions/subscribe`
- **Auth**: Protected
- **Body**: `{ planId }`
- **Purpose**: Create subscription checkout
- **Response**: Checkout session URL

### `POST /api/subscriptions/update`
- **Auth**: Protected
- **Body**: `{ planId }`
- **Purpose**: Update subscription plan
- **Response**: Update result

### `POST /api/subscriptions/cancel`
- **Auth**: Protected
- **Purpose**: Cancel subscription
- **Response**: Cancellation result

### `GET /api/subscriptions/portal`
- **Auth**: Protected
- **Purpose**: Get Stripe Customer Portal URL
- **Response**: Portal URL

---

## Mitto Routes (`/api/mitto`)

### `POST /api/mitto/refresh-status`
- **Auth**: Protected
- **Body**: `{ providerMessageId }`
- **Purpose**: Refresh message status from Mitto API
- **Response**: Status refresh result

### `GET /api/mitto/message/:messageId`
- **Auth**: Protected
- **Purpose**: Get message status
- **Response**: Message status

### `POST /api/mitto/refresh-status-bulk`
- **Auth**: Protected
- **Body**: `{ messageIds: [...] }`
- **Purpose**: Refresh multiple message statuses
- **Response**: Bulk refresh result

---

## Jobs Routes (`/api/jobs`)

### `GET /api/jobs/health`
- **Auth**: Protected
- **Purpose**: Get queue health status
- **Response**: `{ sms: {...}, scheduler: {...}, schedulerDetails: {...} }`

---

## Tracking Routes (`/tracking`)

### `GET /tracking/offer/:trackingId`
- **Auth**: Public
- **Rate Limit**: 60 req/min per IP, 10 req/min per trackingId
- **Purpose**: Get offer details for public redemption page
- **Response**: Offer details (store name, offer text)

### `GET /tracking/redeem/:trackingId`
- **Auth**: Public
- **Rate Limit**: 60 req/min per IP, 10 req/min per trackingId
- **Purpose**: Check if offer is redeemable
- **Response**: Redeemability status

### `POST /tracking/redeem/:trackingId`
- **Auth**: Public
- **Rate Limit**: 30 req/min per IP
- **Body**: `{ phone }`
- **Purpose**: Redeem offer (mark as converted)
- **Response**: Redemption result

---

## Conversion Routes (`/conversion`)

### `GET /conversion/:tagPublicId`
- **Auth**: Public
- **Rate Limit**: 60 req/min per IP
- **Purpose**: Get NFC tag configuration for visit confirmation form
- **Response**: Tag configuration

### `POST /conversion/:tagPublicId`
- **Auth**: Public
- **Rate Limit**: 30 req/min per IP, 5 req/hour per phone
- **Body**: `{ phone }`
- **Purpose**: Record conversion (visit confirmation)
- **Response**: Conversion result

---

## NFC Routes (`/nfc`)

### `GET /nfc/:publicId`
- **Auth**: Public
- **Rate Limit**: 60 req/min per IP
- **Purpose**: Get NFC tag configuration for opt-in form
- **Response**: NFC tag config

### `POST /nfc/:publicId`
- **Auth**: Public
- **Rate Limit**: 30 req/min per IP, 5 req/hour per phone
- **Body**: `{ phone, name?, email? }`
- **Purpose**: Submit NFC opt-in
- **Response**: Opt-in result

---

## Webhooks

### `POST /webhooks/mitto/dlr`
- **Auth**: Public (Mitto signature verification)
- **Purpose**: Handle Mitto delivery reports
- **Response**: 202 Accepted

### `POST /webhooks/mitto/inbound`
- **Auth**: Public (Mitto signature verification)
- **Purpose**: Handle inbound SMS messages
- **Response**: 200 OK

### `POST /webhooks/stripe`
- **Auth**: Public (Stripe signature verification)
- **Purpose**: Handle Stripe webhooks
- **Response**: 200 OK

---

## Docs Routes (`/api/docs`)

### `GET /api/docs`
- **Auth**: Public
- **Purpose**: Swagger UI documentation
- **Response**: Swagger UI HTML

### `GET /api/openapi.json`
- **Auth**: Public
- **Purpose**: OpenAPI JSON spec
- **Response**: OpenAPI specification

### `GET /api/openapi.yaml`
- **Auth**: Public
- **Purpose**: OpenAPI YAML spec
- **Response**: OpenAPI specification

---

## Notes

- All protected routes require `Authorization: Bearer <accessToken>` header
- Refresh tokens are stored in HTTP-only cookies (`rt`)
- Rate limiting is applied to most endpoints (Redis-backed if available)
- CORS is configured via `CORS_ALLOWLIST` environment variable
- All routes are prefixed with `/api` except public tracking/conversion/NFC routes

