# Retail Billing 500 Root Cause Report

## Findings
- `/api/subscriptions/subscribe` was returning 500 when required Stripe price env vars were missing (`CONFIG_MISSING_PRICE_ID`). This now returns 400 with a clear code; startup should fail fast if price envs are absent.
- `/api/billing/topup/calculate` could return 500 on invalid currency; now returns 400 (`INVALID_CURRENCY`). Price calculation still requires sane billing profile data but will not 500 on validation errors.
- Error handler now logs `rootCauseHint` for missing price ids, invalid currency, or missing Stripe config.
- Likely prod misconfig: ensure Stripe price IDs and FRONTEND_URL are set (see env list below).

## Env requirements (retail-simple, 2 SKUs)
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- FRONTEND_URL (for success/cancel URL building)
- STRIPE_PRICE_ID_SUB_STARTER_EUR / USD
- STRIPE_PRICE_ID_SUB_PRO_EUR / USD
- STRIPE_PRICE_ID_CREDIT_TOPUP_EUR (and USD if selling USD topups)
- Optional credit pricing overrides: CREDIT_PRICE_EUR, CREDIT_PRICE_USD, CREDIT_VAT_RATE

## Curl smoke (local after `npm run dev` in apps/retail-api/apps/api)
```bash
# Subscribe starter EUR
curl -i -X POST http://localhost:3001/api/subscriptions/subscribe \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer <token>" \
  -d '{"planType":"starter","currency":"EUR"}'

# Topup calculate 500 credits EUR
curl -i "http://localhost:3001/api/billing/topup/calculate?credits=500&currency=EUR" \
  -H "Authorization: Bearer <token>"
```
Expected: 201 with checkoutUrl for subscribe; 200 with price breakdown (or 400 INVALID_CURRENCY/VALIDATION_ERROR).

## Changes made
- `routes/billing.js`: CONFIG_MISSING_PRICE_ID now 400; topup/calculate returns 400 on invalid currency.
- `lib/errors.js`: rootCauseHint logging for config/currency/Stripe setup.
- Added UAT reset script and how-to (see `scripts/reset-uat-user.js`, `RESET_UAT_USER.md`).

## Deploy notes
- Set/verify the env vars above in Render before restarting.
- Run prisma checks on Node 20.x (Prisma engine fails on Node 24).
