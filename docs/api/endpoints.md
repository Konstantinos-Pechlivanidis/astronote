# API Endpoints Reference

Complete list of API endpoints for `apps/shopify-api`.

## Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/shopify` | Public | Initiate Shopify OAuth flow |
| GET | `/auth/callback` | Public | Shopify OAuth callback |
| GET | `/auth/verify` | Protected | Verify JWT token |
| POST | `/auth/refresh` | Protected | Refresh JWT token |
| POST | `/auth/shopify-token` | Public | Exchange Shopify token |

## Core / Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Public | API root (health check) |
| GET | `/health` | Public | Simple health check |
| GET | `/health/config` | Public | Configuration health |
| GET | `/health/full` | Public | Full health check (DB, Redis, Queue) |
| GET | `/whoami` | Protected | Get current store context |
| GET | `/metrics` | Public | Application metrics (Prometheus format) |
| GET | `/public/packages` | Public | Public pricing packages |
| POST | `/public/contact` | Public | Public contact form submission |

## Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/dashboard` | Protected | Main dashboard (KPIs + embedded reports) |
| GET | `/dashboard/overview` | Protected | Dashboard overview |
| GET | `/dashboard/quick-stats` | Protected | Quick statistics |

## Campaigns

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/campaigns` | Protected | List campaigns (with filters) |
| GET | `/campaigns/stats/summary` | Protected | Campaign statistics summary |
| GET | `/campaigns/queue/stats` | Protected | Queue statistics |
| GET | `/campaigns/:id` | Protected | Get single campaign |
| POST | `/campaigns` | Protected | Create new campaign |
| PUT | `/campaigns/:id` | Protected | Update campaign |
| DELETE | `/campaigns/:id` | Protected | Delete campaign |
| POST | `/campaigns/:id/prepare` | Protected | Prepare campaign for sending |
| POST | `/campaigns/:id/enqueue` | Protected | Enqueue campaign for bulk SMS |
| POST | `/campaigns/:id/send` | Protected | Send campaign (deprecated, use /enqueue) |
| PUT | `/campaigns/:id/schedule` | Protected | Schedule campaign |
| POST | `/campaigns/:id/cancel` | Protected | Cancel campaign |
| GET | `/campaigns/:id/metrics` | Protected | Get campaign metrics |
| GET | `/campaigns/:id/status` | Protected | Get campaign status |
| GET | `/campaigns/:id/preview` | Protected | Get campaign preview |
| GET | `/campaigns/:id/progress` | Protected | Get campaign progress |
| GET | `/campaigns/:id/failed-recipients` | Protected | Get failed recipients |
| POST | `/campaigns/:id/retry-failed` | Protected | Retry failed SMS |
| POST | `/campaigns/:id/update-status` | Protected | Manually trigger delivery status update |

## Contacts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/contacts` | Protected | List contacts (with search, pagination) |
| GET | `/contacts/stats` | Protected | Contact statistics |
| GET | `/contacts/birthday` | Protected | Get birthday contacts |
| GET | `/contacts/:id` | Protected | Get single contact |
| POST | `/contacts` | Protected | Create contact |
| POST | `/contacts/import` | Protected | Import contacts from CSV |
| PUT | `/contacts/:id` | Protected | Update contact |
| DELETE | `/contacts/:id` | Protected | Delete contact |

## Audiences / Segments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/audiences` | Protected | Get predefined audiences (legacy) |
| GET | `/audiences/segments` | Protected | Get all segments (system + custom) |
| GET | `/audiences/segments/:id` | Protected | Get single segment |
| GET | `/audiences/segments/:id/preview` | Protected | Get segment preview (estimated count) |
| GET | `/audiences/:audienceId/details` | Protected | Get audience details with contact list |
| POST | `/audiences/validate` | Protected | Validate audience selection |

## Automations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/automations` | Protected | Get user automations |
| POST | `/automations` | Protected | Create automation |
| GET | `/automations/stats` | Protected | Automation statistics |
| GET | `/automations/:id` | Protected | Get single automation |
| PUT | `/automations/:id` | Protected | Update automation (message) |
| PUT | `/automations/:id/status` | Protected | Toggle automation active/inactive |
| DELETE | `/automations/:id` | Protected | Delete automation |
| GET | `/automations/defaults` | Protected | Get system default automations |
| POST | `/automations/sync` | Protected | Sync system defaults |

## Automation Webhooks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/automations/webhooks/order-created` | Public | Shopify order created webhook |
| POST | `/automations/webhooks/order-updated` | Public | Shopify order updated webhook |
| POST | `/automations/webhooks/order-cancelled` | Public | Shopify order cancelled webhook |
| POST | `/automations/webhooks/order-fulfilled` | Public | Shopify order fulfilled webhook |
| POST | `/automations/webhooks/flow/abandoned-checkout` | Public | Abandoned checkout webhook |
| POST | `/automations/webhooks/trigger` | Protected | Manually trigger automation |

## Templates

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/templates` | Protected | Get all templates (read-only) |
| GET | `/templates/categories` | Protected | Get template categories |
| GET | `/templates/:id` | Protected | Get single template |
| POST | `/templates/:id/track` | Protected | Track template usage |

## Admin Templates

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/templates` | Protected | Get all templates (admin) |
| POST | `/admin/templates` | Protected | Create template (admin) |
| GET | `/admin/templates/:id/stats` | Protected | Get template statistics |
| PUT | `/admin/templates/:id` | Protected | Update template (admin) |
| DELETE | `/admin/templates/:id` | Protected | Delete template (admin) |

## Reports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/reports/overview` | Protected | Reports overview |
| GET | `/reports/kpis` | Protected | Key performance indicators |
| GET | `/reports/campaigns` | Protected | Campaign reports |
| GET | `/reports/campaigns/:id` | Protected | Single campaign report |
| GET | `/reports/automations` | Protected | Automation reports |
| GET | `/reports/messaging` | Protected | Messaging reports |
| GET | `/reports/credits` | Protected | Credits usage reports |
| GET | `/reports/contacts` | Protected | Contact reports |
| GET | `/reports/export` | Protected | Export reports data |

**Note:** Reports are also embedded in `/dashboard` response (no separate `/reports` page in frontend).

## Settings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/settings` | Protected | Get settings |
| GET | `/settings/account` | Protected | Get account info |
| PUT | `/settings` | Protected | Update all settings |
| PUT | `/settings/sender` | Protected | Update sender number (legacy) |

## Billing

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/billing/balance` | Protected | Get credit balance |
| GET | `/billing/packages` | Protected | Get available packages |
| GET | `/billing/transactions` | Protected | Get billing transactions |
| POST | `/billing/purchase` | Protected | Purchase credit package |
| GET | `/billing/sessions/:sessionId` | Protected | Get Stripe session |
| POST | `/billing/webhooks/stripe` | Public | Stripe webhook handler |

## Subscriptions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/subscriptions/status` | Protected | Get subscription status |
| POST | `/subscriptions/subscribe` | Protected | Subscribe to plan |
| POST | `/subscriptions/update` | Protected | Update subscription |
| POST | `/subscriptions/cancel` | Protected | Cancel subscription |
| POST | `/subscriptions/verify-session` | Protected | Verify Stripe session |
| GET | `/subscriptions/portal` | Protected | Get Stripe customer portal |

## Discounts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/discounts` | Protected | Get Shopify discount codes |
| GET | `/discounts/:id` | Protected | Get single discount code |
| GET | `/discounts/validate/:code` | Protected | Validate discount code |

## Shopify Integration

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/shopify/discounts` | Protected | Get Shopify discounts |
| GET | `/shopify/discounts/:id` | Protected | Get single Shopify discount |

## Tracking

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/tracking/mitto/:messageId` | Protected | Get Mitto message status |
| GET | `/tracking/campaign/:campaignId` | Protected | Get campaign delivery status |
| POST | `/tracking/bulk-update` | Protected | Bulk update delivery status |

## Mitto Integration

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/mitto/webhooks/mitto/dlr` | Public | Mitto delivery report webhook |
| POST | `/mitto/webhooks/mitto/inbound` | Public | Mitto inbound message webhook |
| POST | `/mitto/refresh-status` | Protected | Refresh message status |
| POST | `/mitto/bulk-refresh-status` | Protected | Bulk refresh status |
| GET | `/mitto/message/:messageId` | Protected | Get message status |

## Short Links (Redirect)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/r/:token` | Public | Redirect short link (302) |

## Unsubscribe

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/unsubscribe/:token` | Public | Get unsubscribe info |
| POST | `/unsubscribe/:token` | Public | Process unsubscribe |

## Opt-In

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/opt-in` | Public | Opt-in form submission |

## Documentation

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/docs/api` | Public | API documentation (Swagger/OpenAPI) |

## Webhooks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhooks/app_uninstalled` | Public | Shopify app uninstall webhook |
| POST | `/stripe/webhooks` | Public | Stripe webhook handler |

---

## Route Groups Summary

- **Public:** Health, auth, webhooks, redirect, unsubscribe, opt-in
- **Protected:** All other routes require authentication (JWT token)
- **Store-scoped:** Most protected routes are automatically scoped to the current store via `resolveStore` middleware

## Authentication

Protected endpoints require:
- `Authorization: Bearer <token>` header
- OR `x-shop-id` header (for some legacy endpoints)

## Response Format

Standard response envelope:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

Error response:
```json
{
  "success": false,
  "error": "Error code",
  "message": "Human-readable error message"
}
```

## Rate Limiting

Most endpoints have rate limiting applied. Check `middlewares/rateLimits.js` for specific limits.

## Caching

Some endpoints use caching (see `middlewares/cache.js`):
- Campaigns list
- Contacts list
- Dashboard data
- Template lists

