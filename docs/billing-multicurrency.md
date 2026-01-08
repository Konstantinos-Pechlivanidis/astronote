# Billing Multi-Currency (EUR + USD)

## Overview
Astronote retail billing supports EUR and USD across credit topups (packages + custom), subscription plans (Starter/Pro), and the Stripe customer portal. Currency is tenant-scoped and defaults to EUR.

## Supported Currencies
- EUR
- USD

## Tenant Currency Resolution
Backend resolves billing currency in this order:
1) Explicit query/body `currency` parameter if valid (EUR/USD)
2) Tenant default from `User.billingCurrency`
3) Fallback `EUR`

## Required Stripe Environment Variables
Credit topups:
- `STRIPE_PRICE_ID_CREDIT_TOPUP_EUR`
- `STRIPE_PRICE_ID_CREDIT_TOPUP_USD`

Subscriptions:
- `STRIPE_PRICE_ID_SUB_STARTER_EUR`
- `STRIPE_PRICE_ID_SUB_PRO_EUR`
- `STRIPE_PRICE_ID_SUB_STARTER_USD`
- `STRIPE_PRICE_ID_SUB_PRO_USD`

## Optional Pricing Env Vars (Display + Validation)
Used for topup price calculation and webhook validation.
- `CREDIT_PRICE_EUR` (default: 0.045)
- `CREDIT_PRICE_USD` (default: same as EUR)
- `CREDIT_VAT_RATE` (default: 0.24)
- `CREDIT_VAT_RATE_USD` (default: 0)

## Backend Endpoints (Currency-Aware)
- `GET /api/billing/balance` → includes `billingCurrency`
- `GET /api/billing/packages?currency=EUR|USD`
- `POST /api/billing/purchase` → body includes `currency`
- `GET /api/billing/topup/calculate?credits=...&currency=...`
- `POST /api/billing/topup` → body includes `currency`
- `POST /api/subscriptions/subscribe` → body includes `currency`
- `POST /api/subscriptions/update` → body includes `currency`
- `GET /api/subscriptions/portal`

## Stripe Metadata
Checkout sessions include:
- `currency`
- `priceAmount` (topups)
- `credits` / `units`
- `ownerId`

Webhooks validate payment amounts using `priceAmount` and `currency`.

## Frontend Behavior
- Billing page includes a EUR/USD selector.
- Selection is stored per-tenant in localStorage.
- Packages, topups, and subscription actions use the selected currency.

## Audit Script
Run:
- `npm run audit:billing`

The audit checks schema currency fields, Stripe price mapping module, and frontend currency wiring.
