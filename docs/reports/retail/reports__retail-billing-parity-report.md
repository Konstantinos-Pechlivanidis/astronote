# Retail Billing Parity Verification

## Expected catalog (Retail parity)
- UI options: `starter/month`, `pro/year`
- Interval inference: `month -> starter`, `year -> pro`

## FE options (parsed)
| planType/interval |
| --- |
| pro/year |
| starter/month |

## Backend switch policy
- ok ✅ (intervalToPlan mapping found)

## Stripe price resolver env reads (retail-api)
- STRIPE_PRICE_ID_CREDIT_TOPUP_{EUR|USD}
- STRIPE_PRICE_ID_SUB_{STARTER|PRO}_{EUR|USD}
- alias: STRIPE_PRICE_ID_SUB_{STARTER_MONTH|PRO_YEAR}_{EUR|USD}

## Required env vars
- STRIPE_PRICE_ID_SUB_STARTER_EUR
- STRIPE_PRICE_ID_SUB_STARTER_USD
- STRIPE_PRICE_ID_SUB_PRO_EUR
- STRIPE_PRICE_ID_SUB_PRO_USD

## Optional env vars
- STRIPE_PRICE_ID_CREDIT_TOPUP_EUR
- STRIPE_PRICE_ID_CREDIT_TOPUP_USD

## Result
- FE options match expected ✅
- Overall: PASS ✅
