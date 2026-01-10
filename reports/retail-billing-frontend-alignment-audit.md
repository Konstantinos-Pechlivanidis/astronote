# Retail Billing Frontend Alignment Audit

Date: 2025-01-09

## Scope
- Backend: `apps/retail-api/apps/api/src/routes/billing.js`, related services
- Frontend: `apps/astronote-web/app/app/retail/billing/page.tsx`, retail billing client
- Prisma (retail): `apps/retail-api/prisma/schema.prisma`

## What Changed Recently (from scoped diffs)
- Added subscription allowance fields on `User` (interval, period start/end, included/used SMS, last billing error).
- Added `/api/billing/summary` response with subscription + allowance + credits.
- Added `/api/subscriptions/switch` for monthly/yearly changes (mapped to plan types).
- Enforced subscription gating and allowance+credit checks before enqueue and send.
- Updated Stripe webhooks to reset allowance each period and sync subscription status/period.

## Backend Endpoint Inventory (Retail)

| Method | Path | Auth | Request | Response (keys) | Error Codes/Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/billing/summary` | Yes | none | `credits.balance`, `subscription`, `allowance`, `billingCurrency` | 401
| GET | `/api/billing/balance` | Yes | none | `balance`, `subscription`, `allowance`, `billingCurrency` | 401
| GET | `/api/billing/wallet` | Yes | none | `balance`, `subscription`, `allowance`, `billingCurrency` | 401
| GET | `/api/billing/transactions` | Yes | `page`, `pageSize` | `page`, `pageSize`, `total`, `items` | 401
| GET | `/api/billing/packages` | Yes | `currency` | array of packages (`id`, `name`, `units`, `priceCents`, `amount`, `currency`, `priceId`, `available`, `type`) | 401, 304
| POST | `/api/billing/purchase` | Yes | `packageId`, `currency` | `ok`, `checkoutUrl`, `sessionId`, `purchaseId` | 400 `MISSING_IDEMPOTENCY_KEY`, 404 `RESOURCE_NOT_FOUND`, 503 `STRIPE_NOT_CONFIGURED`, 500 `CONFIG_MISSING_PRICE_ID`
| POST | `/api/billing/topup` | Yes | `credits`, `currency` | `ok`, `checkoutUrl`, `sessionId`, `credits`, `currency`, `price` | 400 `VALIDATION_ERROR`, 503 `STRIPE_NOT_CONFIGURED`
| GET | `/api/billing/topup/calculate` | Yes | `credits`, `currency` | price breakdown | 400 `VALIDATION_ERROR`
| GET | `/api/subscriptions/current` | Yes | none | subscription status + `plan` | 401
| POST | `/api/subscriptions/subscribe` | Yes | `planType`, `currency` | `ok`, `checkoutUrl`, `sessionId`, `planType`, `currency` | 400 `ALREADY_SUBSCRIBED`, `VALIDATION_ERROR`, 503 `STRIPE_NOT_CONFIGURED`
| POST | `/api/subscriptions/update` | Yes | `planType`, `currency` | `ok`, `message`, `planType`, `currency` | 400 `NO_ACTIVE_SUBSCRIPTION`, `ALREADY_ON_PLAN`, 503 `STRIPE_NOT_CONFIGURED`
| POST | `/api/subscriptions/switch` | Yes | `interval` or `planType`, `currency` | `ok`, `message`, `planType`, `interval`, `currency` | 400 `NO_ACTIVE_SUBSCRIPTION`, `INVALID_INTERVAL`, 503 `STRIPE_NOT_CONFIGURED`
| POST | `/api/subscriptions/cancel` | Yes | none | `ok`, `message` | 400 `INACTIVE_SUBSCRIPTION`, 503 `STRIPE_NOT_CONFIGURED`
| GET | `/api/subscriptions/portal` | Yes | none | `ok`, `portalUrl` | 400 `MISSING_CUSTOMER_ID`, 502 `STRIPE_PORTAL_ERROR`, 503 `STRIPE_NOT_CONFIGURED`

## Backend Business Rules
- Subscription gating: campaign enqueue requires `subscriptionStatus = active`; API returns 403 `SUBSCRIPTION_REQUIRED` when inactive.
- Allowance consumption: free SMS allowance is used before paid credits; enqueue checks allowance+credits combined.
- Currency: resolved via `resolveBillingCurrency` (query param → tenant default → EUR).
- Idempotency: `POST /api/billing/purchase` requires `Idempotency-Key` header (enforced).

## Expected Frontend Behavior
- Billing summary drives UI: show subscription status, plan, interval, renewal date, allowance remaining, and credits.
- Currency selection triggers `GET /api/billing/packages?currency=...` and purchase/topup requests in that currency.
- Package purchase must send `Idempotency-Key` header; show checkout URL on success.
- Subscription actions:
  - Subscribe: `POST /api/subscriptions/subscribe` with `planType`.
  - Switch interval: `POST /api/subscriptions/switch` with `interval` (month/year).
  - Cancel: `POST /api/subscriptions/cancel`.
  - Portal: `GET /api/subscriptions/portal` and open `portalUrl`.
- Enqueue UI surfaces should respect `SUBSCRIPTION_REQUIRED` and show appropriate guidance.
