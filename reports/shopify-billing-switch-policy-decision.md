# Shopify Billing — Switch Policy + Plan Catalog Decision (Starter monthly↔yearly)

## Root cause of `INVALID_INTERVAL_FOR_PLAN`

- **Backend hard-locks interval by plan** in `apps/shopify-api/controllers/subscriptions.js` via `enforceImpliedIntervalOrSendError()`, using `getImpliedInterval()` from `apps/shopify-api/services/plan-catalog.js`.
- That implied-interval mapping is **Starter → month, Pro → year** (simplified/Retail-parity mode), so `starter + year` is rejected even if a Stripe “Starter Year” price exists.
- **Frontend also assumes the lock** (e.g., when subscribing, it sets `starter=month`, `pro=year` in `apps/astronote-web/app/app/shopify/billing/page.tsx`).

## Intended meaning of “Switch to Yearly”

We will implement the preferred meaning:

- **“Switch to Yearly” = same plan, different interval** when the SKU exists.
  - Starter Monthly → **Starter Yearly** (requires checkout)
  - Starter Yearly → Starter Monthly (scheduled downgrade)

If an SKU does not exist (e.g., a legacy install without Starter Year price IDs), the UI will **not** offer an invalid action; it will instead offer a clearly-labeled upgrade path when applicable (e.g. “Upgrade to Pro (Yearly)”).

## Canonical Plan Catalog decision (single source of truth)

Supported subscription SKUs (Shopify):

- **starter**: `month` (EUR, USD)
- **starter**: `year` (EUR, USD)
- **pro**: `year` (EUR, USD)

Stripe price env vars for these SKUs:

- `STRIPE_PRICE_ID_SUB_STARTER_MONTH_EUR`
- `STRIPE_PRICE_ID_SUB_STARTER_MONTH_USD`
- `STRIPE_PRICE_ID_SUB_STARTER_YEAR_EUR`
- `STRIPE_PRICE_ID_SUB_STARTER_YEAR_USD`
- `STRIPE_PRICE_ID_SUB_PRO_YEAR_EUR`
- `STRIPE_PRICE_ID_SUB_PRO_YEAR_USD`

Backward compatibility:

- Legacy vars `STRIPE_PRICE_ID_SUB_{STARTER,PRO}_{EUR,USD}` remain supported as a fallback
  - Legacy implies **Starter=month**, **Pro=year** and therefore does **not** enable Starter Yearly.

## Subscription change policy

Modes:

- **checkout_required**: change requires payment authorization now (Stripe Checkout / Portal redirect)
- **scheduled_change**: downgrade takes effect at period end (via Stripe schedule)
- **immediate_update**: change can be applied immediately without checkout (rare in our subscription model)

Rules:

- Starter month → Starter year: **checkout_required**
- Starter month → Pro year: **checkout_required**
- Starter year → Starter month: **scheduled_change**
- Pro year → Starter (month or year): **scheduled_change**
- Cancel scheduled change: supported

## API/UX contract

- Backend returns backend-driven:
  - `allowedActions` (action matrix)
  - `availableOptions` (supported SKUs for the current environment)
- Frontend renders buttons/toggles **only** from `allowedActions` and `availableOptions`.


