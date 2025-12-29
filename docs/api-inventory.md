# API Endpoint Inventory

**Generated**: 2025-01-XX  
**Purpose**: Complete endpoint catalog with auth requirements, validation, and side effects

## Endpoint Table

| Method | Path | Auth | Tenant Scope | Request Schema | Response Shape | Side Effects |
|--------|------|------|--------------|----------------|----------------|--------------|
| **PUBLIC ENDPOINTS** |
| GET | `/` | None | None | None | `{ok: true, message, time}` | None |
| GET | `/health` | None | None | None | `{ok: true, t}` | None |
| GET | `/health/config` | None | None | None | `{ok, shopify, redis, mitto}` | None |
| GET | `/health/full` | None | None | None | `{ok, checks, metrics, timestamp, uptime}` | DB/Redis queries |
| GET | `/metrics` | None | None | `?format=json\|prometheus` | Metrics object or Prometheus text | None |
| GET | `/public/packages` | None | None | None | Array of packages | None |
| POST | `/public/contact` | None | None | Contact form schema | `{success, message}` | DB write (contact form) |
| POST | `/webhooks/app_uninstalled` | HMAC | None | Shopify webhook | `200 OK` | DB update (shop status) |
| GET | `/unsubscribe/:token` | None | None | Token in path | Unsubscribe page info | None |
| POST | `/unsubscribe/:token` | None | None | Token in path | `{success, message}` | DB update (contact consent) |
| POST | `/api/opt-in` | None | None | Opt-in schema | `{success, message}` | DB write (contact) |
| POST | `/mitto/*` | HMAC | None | Mitto webhook | `200 OK` | DB update (delivery status) |
| **AUTHENTICATION** |
| POST | `/auth/shopify-token` | None | None | `{sessionToken}` | `{token, store, expiresIn}` | DB read (store lookup) |
| GET | `/auth/shopify?shop=<domain>` | None | None | `shop` query param | Redirect to Shopify OAuth | None |
| GET | `/auth/callback` | HMAC | None | OAuth callback params | Redirect to frontend | DB write (store create/update), webhook registration |
| GET | `/auth/verify` | Bearer | None | Bearer token header | `{valid, store, token}` | DB read (store lookup) |
| POST | `/auth/refresh` | Bearer | None | Bearer token header | `{token, expiresIn}` | DB read (store lookup) |
| **DASHBOARD** |
| GET | `/dashboard` | Bearer | shopId | None | Dashboard stats | DB read (aggregates) |
| GET | `/dashboard/overview` | Bearer | shopId | None | Overview data | DB read (aggregates) |
| GET | `/dashboard/quick-stats` | Bearer | shopId | None | Quick stats | DB read (aggregates) |
| **CONTACTS** |
| GET | `/contacts` | Bearer | shopId | `?page, limit, search, smsConsent, gender, tags` | `{contacts, pagination, total}` | DB read (filtered) |
| GET | `/contacts/stats` | Bearer | shopId | None | `{total, optedIn, optedOut, unknown}` | DB read (aggregates) |
| GET | `/contacts/birthdays` | Bearer | shopId | `?month, day` | Array of contacts | DB read (filtered) |
| GET | `/contacts/:id` | Bearer | shopId | ID in path | Contact object | DB read |
| POST | `/contacts` | Bearer | shopId | `createContactSchema` | Created contact | DB write (contact), cache invalidation |
| POST | `/contacts/import` | Bearer | shopId | `importContactsSchema` (CSV) | `{imported, skipped, errors}` | DB write (bulk), cache invalidation |
| PUT | `/contacts/:id` | Bearer | shopId | `updateContactSchema` | Updated contact | DB update, cache invalidation |
| DELETE | `/contacts/:id` | Bearer | shopId | ID in path | `{success}` | DB delete, cache invalidation |
| **CAMPAIGNS** |
| GET | `/campaigns` | Bearer | shopId | `?page, limit, status, search` | `{campaigns, pagination, total}` | DB read (filtered), cached |
| GET | `/campaigns/stats/summary` | Bearer | shopId | None | Campaign statistics | DB read (aggregates), cached |
| GET | `/campaigns/queue/stats` | Bearer | shopId | None | Queue statistics | Queue read |
| GET | `/campaigns/:id` | Bearer | shopId | ID in path | Campaign object | DB read |
| POST | `/campaigns` | Bearer | shopId | `createCampaignSchema` | Created campaign | DB write (campaign + metrics), cache invalidation |
| PUT | `/campaigns/:id` | Bearer | shopId | `updateCampaignSchema` | Updated campaign | DB update, cache invalidation |
| DELETE | `/campaigns/:id` | Bearer | shopId | ID in path | `{success}` | DB delete (cascade), cache invalidation |
| POST | `/campaigns/:id/prepare` | Bearer | shopId | ID in path | `{recipientCount, estimatedCost}` | DB read (recipient resolution) |
| POST | `/campaigns/:id/enqueue` | Bearer | shopId | ID in path | `{ok, enqueuedJobs, reservationId}` | DB transaction (status update, credit reservation, recipient creation), queue jobs |
| POST | `/campaigns/:id/send` | Bearer | shopId | ID in path | Same as enqueue | Same as enqueue (deprecated) |
| PUT | `/campaigns/:id/schedule` | Bearer | shopId | `scheduleCampaignSchema` | Updated campaign | DB update (scheduleAt, status), cache invalidation |
| POST | `/campaigns/:id/cancel` | Bearer | shopId | ID in path | `{success}` | DB update (status), credit release, queue cancellation, cache invalidation |
| GET | `/campaigns/:id/metrics` | Bearer | shopId | ID in path | Campaign metrics | DB read (aggregates), cached |
| GET | `/campaigns/:id/status` | Bearer | shopId | ID in path | Campaign status with metrics | DB read (aggregates), cached |
| GET | `/campaigns/:id/preview` | Bearer | shopId | ID in path | `{recipientCount, estimatedCost}` | DB read (recipient resolution) |
| GET | `/campaigns/:id/progress` | Bearer | shopId | ID in path | `{sent, failed, pending, percentage}` | DB read (aggregates), cached |
| GET | `/campaigns/:id/failed-recipients` | Bearer | shopId | ID in path | Array of failed recipients | DB read (filtered) |
| POST | `/campaigns/:id/retry-failed` | Bearer | shopId | ID in path | `{ok, enqueuedJobs}` | Queue jobs (retry failed), cache invalidation |
| POST | `/campaigns/:id/update-status` | Bearer | shopId | ID in path | `{ok, updated}` | DB update (delivery status), cache invalidation |
| **AUTOMATIONS** |
| GET | `/automations` | Bearer | shopId | None | Array of user automations | DB read |
| POST | `/automations` | Bearer | shopId | `createAutomationSchema` | Created automation | DB write, cache invalidation |
| GET | `/automations/stats` | Bearer | shopId | None | Automation statistics | DB read (aggregates) |
| GET | `/automations/variables/:triggerType` | Bearer | shopId | `triggerType` in path | Array of available variables | None |
| PUT | `/automations/:id` | Bearer | shopId | `updateAutomationSchema` | Updated automation | DB update, cache invalidation |
| DELETE | `/automations/:id` | Bearer | shopId | ID in path | `{success}` | DB delete, cache invalidation |
| GET | `/automations/defaults` | Bearer | shopId | None | Array of system defaults | DB read |
| POST | `/automations/sync` | Bearer | shopId | None | `{synced}` | DB write (sync defaults) |
| **REPORTS** |
| GET | `/reports/overview` | Bearer | shopId | None | Overview report | DB read (aggregates), cached |
| GET | `/reports/kpis` | Bearer | shopId | None | KPI metrics | DB read (aggregates), cached |
| GET | `/reports/campaigns` | Bearer | shopId | None | Campaign reports | DB read (aggregates), cached |
| GET | `/reports/campaigns/:id` | Bearer | shopId | ID in path | Campaign report | DB read (aggregates), cached |
| GET | `/reports/automations` | Bearer | shopId | None | Automation reports | DB read (aggregates), cached |
| GET | `/reports/messaging` | Bearer | shopId | None | Messaging reports | DB read (aggregates), cached |
| GET | `/reports/credits` | Bearer | shopId | None | Credit reports | DB read (aggregates), cached |
| GET | `/reports/contacts` | Bearer | shopId | None | Contact reports | DB read (aggregates), cached |
| GET | `/reports/export` | Bearer | shopId | `?type, format` | CSV/JSON export | DB read (bulk) |
| **BILLING** |
| GET | `/billing/balance` | Bearer | shopId | None | `{balance, reserved, available}` | DB read, cached |
| GET | `/billing/packages` | Bearer | shopId | None | Array of packages | DB read |
| GET | `/billing/topup/calculate` | Bearer | shopId | `?credits, currency` | `{credits, price, currency}` | None |
| POST | `/billing/topup` | Bearer | shopId | `topupCreateSchema` | `{sessionId, url}` | Stripe API call, cache invalidation |
| GET | `/billing/history` | Bearer | shopId | `?page, limit, type` | `{transactions, pagination}` | DB read, cached |
| GET | `/billing/billing-history` | Bearer | shopId | `?page, limit` | `{billingTransactions, pagination}` | DB read, cached |
| POST | `/billing/purchase` | Bearer | shopId | `createPurchaseSchema` | `{sessionId, url}` | Stripe API call, cache invalidation |
| **SUBSCRIPTIONS** |
| GET | `/subscriptions/status` | Bearer | shopId | None | `{status, planType, subscriptionId}` | DB read |
| POST | `/subscriptions/subscribe` | Bearer | shopId | `subscriptionSubscribeSchema` | `{sessionId, url}` | Stripe API call |
| POST | `/subscriptions/update` | Bearer | shopId | `subscriptionUpdateSchema` | `{success}` | Stripe API call, DB update |
| POST | `/subscriptions/cancel` | Bearer | shopId | None | `{success}` | Stripe API call, DB update |
| POST | `/subscriptions/verify-session` | Bearer | shopId | None | `{verified}` | Stripe API call |
| GET | `/subscriptions/portal` | Bearer | shopId | None | `{url}` | Stripe API call |
| **SETTINGS** |
| GET | `/settings` | Bearer | shopId | None | Settings object | DB read |
| GET | `/settings/account` | Bearer | shopId | None | Account info | DB read |
| PUT | `/settings/sender` | Bearer | shopId | `{senderNumber, senderName}` | Updated settings | DB update (legacy) |
| PUT | `/settings` | Bearer | shopId | Settings update schema | Updated settings | DB update |
| **AUDIENCES** |
| GET | `/audiences` | Bearer | shopId | None | Array of audiences | DB read |
| GET | `/audiences/:audienceId/details` | Bearer | shopId | `?page, limit` | Audience details with contacts | DB read (filtered) |
| POST | `/audiences/validate` | Bearer | shopId | `{audienceId}` | `{valid, count}` | DB read (validation) |
| **TEMPLATES** |
| GET | `/templates` | Bearer | shopId (optional) | None | Array of templates | DB read |
| GET | `/templates/:id` | Bearer | shopId (optional) | ID in path | Template object | DB read |
| GET | `/templates/:id/track` | Bearer | shopId | ID in path | Tracking redirect | DB write (usage tracking) |
| **TRACKING** |
| GET | `/tracking/mitto/:messageId` | Bearer | shopId | `messageId` in path | Message status | DB read, Mitto API call |
| GET | `/tracking/campaign/:campaignId` | Bearer | shopId | `campaignId` in path | Campaign delivery status | DB read (aggregates) |
| POST | `/tracking/bulk-update` | Bearer | shopId | `{messageIds}` | `{updated}` | DB update (bulk), Mitto API calls |
| **SHOPIFY** |
| GET | `/shopify/*` | Bearer | shopId | Various | Various | Shopify API calls |
| **WEBHOOKS** |
| POST | `/automation-webhooks/*` | HMAC | None | Shopify webhook | `200 OK` | DB write (event processing), queue jobs |
| POST | `/webhooks/stripe` | Signature | None | Stripe webhook | `200 OK` | DB write (billing updates) |

## Authentication Methods

### 1. Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`
- **Source**: Generated via `/auth/shopify-token` or `/auth/callback`
- **Validation**: `verifyAppToken()` in `services/auth.js`
- **Store Resolution**: Token contains `storeId`, resolved via `resolveStore` middleware

### 2. Shopify Session Token
- **Header**: `Authorization: Bearer <shopify-session-token>`
- **Source**: Shopify App Bridge (embedded apps)
- **Validation**: `verifyShopifySessionToken()` in `services/auth.js`
- **Store Resolution**: Token contains `shop` domain, resolved via `resolveStore` middleware

### 3. HMAC (Webhooks)
- **Header**: `X-Shopify-Hmac-Sha256: <hmac>`
- **Validation**: `validateShopifyWebhook()` in `middlewares/shopify-webhook.js`
- **Store Resolution**: Webhook payload contains shop domain

## Tenant Scoping

All store-scoped routes use:
1. **`resolveStore` middleware**: Extracts shopId from JWT, headers, or query params
2. **`requireStore` middleware**: Ensures store context exists
3. **Database queries**: Filtered by `shopId` at Prisma level
4. **No cross-shop access**: Prisma queries always include `shopId` filter

## Request Validation

- **Zod Schemas**: All POST/PUT requests validated via Zod schemas in `schemas/`
- **Middleware**: `validateBody()`, `validateQuery()`, `validateParams()` in `middlewares/validation.js`
- **Error Response**: `400 Bad Request` with validation errors

## Response Format

Standard response shape:
```json
{
  "success": true,
  "data": {...},
  "message": "..."
}
```

Error response:
```json
{
  "success": false,
  "error": "error_code",
  "message": "Human-readable message"
}
```

## Side Effects Summary

### Database Writes
- Contact creation/update/deletion
- Campaign creation/update/deletion
- Credit transactions (reservation, debit, refund)
- Message logs
- Automation logs
- Billing transactions

### Queue Jobs
- Campaign enqueue → `bulkSms` jobs
- Automation triggers → `automationTrigger` jobs
- Delivery status updates → `deliveryStatusUpdate` jobs

### External API Calls
- **Mitto**: SMS sending, status checks
- **Stripe**: Payment processing, subscription management
- **Shopify**: GraphQL queries, webhook registration

### Cache Operations
- Cache invalidation on writes (contacts, campaigns, billing)
- Cache reads for list endpoints (with TTL)

## Rate Limiting

- **General API**: 1000 requests / 15 minutes
- **Auth endpoints**: 5 requests / 15 minutes
- **SMS sending**: 10 requests / minute
- **Webhooks**: 100 requests / minute
- **Per-route limits**: Defined in `middlewares/rateLimits.js`

## Pagination

Standard pagination query params:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

Response includes:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

