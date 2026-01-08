# Billing (Retail)

## Overview
Retail billing supports:
- Subscriptions (Starter/Pro) with recurring credits
- Credit package purchases (requires active subscription)
- Credit top-ups (one-off credits, no subscription required)
- Stripe customer portal for self-service billing management

All billing actions are scoped to the authenticated tenant via `req.user.id`.

## Flows

### Subscription
1) `POST /api/subscriptions/subscribe`
2) Stripe Checkout session created
3) Stripe webhook `checkout.session.completed`
4) `activateSubscription` + `allocateFreeCredits` -> wallet credit

### Credit Packages
1) `GET /api/billing/packages?currency=EUR|USD`
2) `POST /api/billing/purchase` (requires `Idempotency-Key` header, body includes `currency`)
3) Stripe Checkout session created
4) Stripe webhook `checkout.session.completed` -> purchase marked paid + wallet credited

### Credit Top-ups
1) `GET /api/billing/topup/calculate?credits=...&currency=EUR|USD` (optional pricing preview)
2) `POST /api/billing/topup` with `{ credits, currency }`
3) Stripe webhook `checkout.session.completed` -> wallet credited

### Customer Portal
1) `GET /api/subscriptions/portal`
2) Ensures a valid Stripe customer exists for the tenant
3) Returns portal session URL

## Required Environment Variables
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_SUB_STARTER_EUR`
- `STRIPE_PRICE_ID_SUB_PRO_EUR`
- `STRIPE_PRICE_ID_SUB_STARTER_USD`
- `STRIPE_PRICE_ID_SUB_PRO_USD`
- `STRIPE_PRICE_ID_CREDIT_TOPUP_EUR`
- `STRIPE_PRICE_ID_CREDIT_TOPUP_USD`

Optional (package checkout):
- `STRIPE_PRICE_ID_{PACKAGE_NAME}_EUR` / `STRIPE_PRICE_ID_{PACKAGE_NAME}_USD`
- Or set `stripePriceIdEur` / `stripePriceIdUsd` on `Package` rows

Frontend return URLs:
- `FRONTEND_URL` or `APP_URL` (must include `/retail` path for hosted UI)

Currency defaults:
- Explicit `currency` parameter is honored if valid (EUR/USD)
- Otherwise the tenant default from `User.billingCurrency` is used

## Idempotency
`POST /api/billing/purchase` requires `Idempotency-Key` (or `X-Idempotency-Key`) to prevent duplicate purchases.

## Webhooks
Configure Stripe to send events to:
- `POST /webhooks/stripe`

Required events:
- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

## Notes
- Credit packages are only available with an active subscription.
- Credits can be purchased at any time, but can only be used to send campaigns when subscribed.
