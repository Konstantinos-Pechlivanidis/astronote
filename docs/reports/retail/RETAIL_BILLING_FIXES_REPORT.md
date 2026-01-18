# Retail Billing Fixes Report

## Mount prefix
- All retail routes (billing/subscriptions) are mounted under `/api` (`src/server.js`: `app.use('/api', require('./routes/billing'))` etc.). Calling `/billing/*` without `/api` will 404.

## What was wrong
- Risk of 404s if FE called `/billing/*` without `/api` prefix.
- Success flow needed clearer verify-first order and immediate refresh so credits/invoices appear right after checkout.
- Billing page lacked user microcopy clarifying automatic sync after payment.

## Changes made (FE only)
- Success page (`apps/astronote-web/app/app/retail/billing/success/page.tsx`):
  - Keep order: POST `/api/billing/verify-payment` first, then `/api/subscriptions/finalize` + `/api/subscriptions/reconcile` only for subscription payments.
  - Added explicit verifying state, Greek helper text, and post-verify refresh: invalidates billing/subscription/invoice/history queries, calls `router.refresh`, then redirects to `/app/retail/billing?paymentSuccess=1`.
- Billing page (`apps/astronote-web/app/app/retail/billing/page.tsx`):
  - Added Greek microcopy: “Μετά την πληρωμή θα γίνει αυτόματος συγχρονισμός (verify/reconcile) και θα εμφανιστούν credits & τιμολόγια.”
- Endpoints already used `/api/billing/invoices` and `/api/billing/billing-history`; no path change required.

## How to test (manual)
1) Subscribe: start checkout, pay, return to `/app/retail/billing/success?session_id=...` → page calls verify → finalize/reconcile (subscription only) → redirects to `/app/retail/billing`; subscription active, credits/invoices visible.
2) Top-up credits: pay and return → verify-payment credits wallet once; billing history shows single ledger entry.
3) Invoices & billing history: UI hits `/api/billing/invoices?page=&pageSize=` and `/api/billing/billing-history?page=&pageSize=`; both return 200 (remember `/api` prefix).
4) If data missing after checkout: revisit success URL or use billing page reconcile to re-sync; query caches invalidate and refresh.
