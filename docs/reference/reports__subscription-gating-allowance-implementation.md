# Subscription Gating + Allowance Implementation

Date: 2025-01-09

## Summary
- Enforced active subscription gating before enqueue and before SMS send (bulk + individual).
- Implemented free SMS allowance tracking by subscription interval (month/year) with consumption before paid credits.
- Added billing summary endpoint and subscription switch endpoint for monthly/yearly switching.
- Updated retail billing UI to show status, interval, allowance, and management actions (switch/cancel/portal).

## Files Changed
- apps/retail-api/prisma/schema.prisma
- apps/retail-api/prisma/migrations/20250109143000_subscription_allowance/migration.sql
- apps/retail-api/apps/api/src/services/subscription.service.js
- apps/retail-api/apps/api/src/services/campaignEnqueue.service.js
- apps/retail-api/apps/api/src/services/smsBulk.service.js
- apps/retail-api/apps/api/src/routes/campaigns.js
- apps/retail-api/apps/api/src/routes/billing.js
- apps/retail-api/apps/api/src/routes/stripe.webhooks.js
- apps/retail-api/apps/worker/src/sms.worker.js
- apps/astronote-web/src/lib/retail/api/endpoints.ts
- apps/astronote-web/src/lib/retail/api/billing.ts
- apps/astronote-web/src/lib/retail/api/subscriptions.ts
- apps/astronote-web/src/features/retail/billing/hooks/useBillingGate.ts
- apps/astronote-web/src/features/retail/campaigns/hooks/useEnqueueCampaign.ts
- apps/astronote-web/app/app/retail/billing/page.tsx
- scripts/audit-billing.mjs

## Endpoint Contracts

### GET /api/billing/summary
Response:
```
{
  "credits": { "balance": number },
  "subscription": {
    "active": boolean,
    "status": "active"|"trialing"|"past_due"|"unpaid"|"incomplete"|"paused"|"inactive"|"cancelled",
    "planType": "starter"|"pro"|null,
    "interval": "month"|"year"|null,
    "currentPeriodStart": string|null,
    "currentPeriodEnd": string|null,
    "cancelAtPeriodEnd": boolean,
    "includedSmsPerPeriod": number,
    "usedSmsThisPeriod": number,
    "remainingSmsThisPeriod": number,
    "lastBillingError": string|null
  },
  "allowance": {
    "includedPerPeriod": number,
    "usedThisPeriod": number,
    "remainingThisPeriod": number,
    "currentPeriodStart": string|null,
    "currentPeriodEnd": string|null,
    "interval": "month"|"year"|null
  },
  "billingCurrency": "EUR"|"USD"
}
```

### POST /api/subscriptions/switch
Body:
```
{ "interval": "month"|"year", "planType"?: "starter"|"pro", "currency"?: "EUR"|"USD" }
```
Response:
```
{ "ok": true, "message": string, "planType": "starter"|"pro", "interval": "month"|"year", "currency": "EUR"|"USD" }
```

### POST /api/campaigns/:id/enqueue
- Returns 403 with code `SUBSCRIPTION_REQUIRED` if subscription is not active.
- Returns 402 with code `INSUFFICIENT_CREDITS` when free allowance + credits are insufficient.

## Behavior Matrix

| Condition | Enqueue | Bulk/Individual Send | Billing Consumption |
| --- | --- | --- | --- |
| Subscription active | Allowed if allowance+credits >= recipients | Allowed | Allowance first, then credits |
| Subscription inactive | 403 SUBSCRIPTION_REQUIRED | Blocked (no send) | No billing |
| Allowance remaining >= required | Allowed | Allowed | Allowance increments usedSmsThisPeriod |
| Allowance insufficient but credits available | Allowed | Allowed | Remaining debited from wallet |
| Allowance + credits insufficient | 402 INSUFFICIENT_CREDITS | Blocked | No billing |

## Notes
- Allowance resets are handled by Stripe webhooks on checkout completion and invoice payment success.
- Billing portal flow remains available for payment method updates.
