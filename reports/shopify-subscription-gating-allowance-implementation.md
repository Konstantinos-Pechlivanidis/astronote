# Shopify Subscription Gating + Allowance Implementation

## Overview
- Enforced subscription gating on campaign enqueue/send and worker SMS execution, aligned with Retail rules.
- Added allowance-first consumption (free SMS per billing period) and correct paid-credit reservation/debit ordering.
- Exposed billing summary with plan/interval/period fields plus last billing error for UI parity.
- Updated Shopify UI to match contract and disable send actions when subscription inactive.

## Endpoint Contracts (Shopify API)
| Method | Path | Auth | Tenant Scope | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | /api/billing/summary | Required | shopId | none | `{ credits: { balance, currency }, subscription, allowance, billingCurrency }` | `subscription` includes status/planType/interval/period/lastBillingError |
| GET | /api/billing/packages?currency=EUR|USD | Required | shopId | query `currency` | `{ packages: [], currency }` or packages list | Returns empty list if subscription inactive |
| POST | /api/billing/purchase | Required | shopId | `{ packageId, successUrl, cancelUrl, currency? }` | `{ sessionId, sessionUrl|checkoutUrl, purchaseId, package }` | Requires `Idempotency-Key` header |
| GET | /api/subscriptions/portal | Required | shopId | none | `{ portalUrl }` | Creates Stripe customer if missing/invalid |
| POST | /api/subscriptions/switch | Required | shopId | `{ interval?: 'month'|'year', planType?: 'starter'|'pro' }` | `{ interval }` or update response | Switches interval/plan safely |
| POST | /api/subscriptions/cancel | Required | shopId | none | `{ cancelledAt }` | Cancels Stripe subscription |
| POST | /api/campaigns/:id/enqueue | Required | shopId | none | `{ ok, queued, enqueuedJobs, campaignId }` | 403 `SUBSCRIPTION_REQUIRED` when inactive |
| POST | /api/campaigns/:id/send | Required | shopId | none | `{ campaignId, recipientCount, status }` | 403 `SUBSCRIPTION_REQUIRED` when inactive |

## Behavior Matrix (Parity with Retail)
| Scenario | Result |
| --- | --- |
| Subscription status = active | Campaign enqueue/send allowed; allowance applied first, then paid credits. |
| Subscription status != active | Campaign enqueue/send blocked (403 `SUBSCRIPTION_REQUIRED`); worker bulk sends and automations skip with subscription_required reason. |
| Allowance remaining >= required | No paid credits reserved/debited; allowance tracked on send. |
| Allowance remaining < required | Reserve/debit only the paid-credit remainder; allowance tracked first. |
| invoice.payment_failed webhook | `lastBillingError` stored for UI. |
| invoice.payment_succeeded webhook | `lastBillingError` cleared. |
| subscription.updated webhook | Status/plan/interval/period synchronized (supports past_due/unpaid/trialing/etc). |

## Files Changed (Scope)
Backend (apps/shopify-api):
- apps/shopify-api/prisma/schema.prisma
- apps/shopify-api/prisma/migrations/20250130000000_add_subscription_statuses_and_billing_error/migration.sql
- apps/shopify-api/utils/prismaEnums.js
- apps/shopify-api/utils/errors.js
- apps/shopify-api/schemas/subscription.schema.js
- apps/shopify-api/routes/subscriptions.js
- apps/shopify-api/scripts/validateEnums.js
- apps/shopify-api/services/subscription.js
- apps/shopify-api/controllers/stripe-webhooks.js
- apps/shopify-api/services/campaigns.js
- apps/shopify-api/controllers/campaigns.js
- apps/shopify-api/services/smsBulk.js
- apps/shopify-api/services/credit-validation.js
- apps/shopify-api/services/mitto.js
- apps/shopify-api/queue/jobs/automationTriggers.js

Frontend (apps/astronote-web Shopify):
- apps/astronote-web/src/lib/shopify/api/billing.ts
- apps/astronote-web/src/lib/shopify/api/campaigns.ts
- apps/astronote-web/src/features/shopify/billing/hooks/useBillingMutations.ts
- apps/astronote-web/src/features/shopify/campaigns/hooks/useCampaignMutations.ts
- apps/astronote-web/app/app/shopify/billing/page.tsx
- apps/astronote-web/app/app/shopify/campaigns/page.tsx
- apps/astronote-web/app/app/shopify/campaigns/[id]/page.tsx
- apps/astronote-web/app/app/shopify/campaigns/new/page.tsx

Audits:
- scripts/audit-shopify-billing.mjs
- scripts/audit-shopify-subscription-gating.mjs

## Notes on Parity
- Gating and allowance behavior now matches Retail: subscription required for all send paths, allowance consumed first, paid credits debited after successful send.
- Shopify-specific differences retained: tenant resolution via `X-Shopify-Shop-Domain`/Bearer auth and shopId scoping.
