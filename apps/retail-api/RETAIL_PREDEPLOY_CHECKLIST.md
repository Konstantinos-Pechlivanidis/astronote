# Retail Pre-Deploy Checklist

## 1) Env vars
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Price IDs per catalog mode (retail-simple): `STRIPE_PRICE_ID_SUB_STARTER_{EUR,USD}`, `STRIPE_PRICE_ID_SUB_PRO_{EUR,USD}` (and topup/package price IDs if used)
- `STRIPE_TAX_ENABLED` (leave true/enabled for VAT), `FRONTEND_URL`/`APP_URL`, `CORS_ALLOWLIST`

## 2) Prisma state
- Run migrations on the target DB (includes `BillingProfile.isBusiness`).
- Confirm `prisma/schema.prisma` matches deployed DB (`prisma migrate deploy` or `prisma db pull && diff`).

## 3) Route sanity
- Server mounts billing router under `/api`; verify `/api/billing/invoices` and `/api/billing/billing-history` return 200 (no 404).
- Success/cancel pages exist at `/app/retail/billing/success` and `/app/retail/billing/cancel`; success page calls `/api/billing/verify-payment` then `/api/subscriptions/finalize` (idempotent) when needed.

## 4) Manual QA (max 10)
1. Subscribe via billing page → Stripe checkout → on return, UI shows active plan/period dates.
2. Invoice appears in billing invoices list (and hosted invoice link works).
3. Wallet balance updates with included credits after subscription activation (once).
4. Billing history shows the subscription charge/included credits once.
5. Purchase a top-up or credit pack → wallet increments once; billing history records the payment.
6. Send a campaign (draft → sending) and observe credits debited + status moves to completed/failed appropriately.
7. Schedule a campaign → status shows scheduled, then after time enqueue moves to sending/completed.
8. From success or portal return, `Reconcile/Refresh` action reflects Stripe state (no drift).
9. Webhook unmatched events are absent in logs for valid tenants; signature failures emit requestId/payload hash.
10. VAT: GR B2C shows VAT applied; EU B2B with valid VAT shows VAT exempt; non-EU shows no VAT.

## 5) Commands before deploy
```bash
npm -w @astronote/retail-api run lint
npm -w @astronote/retail-api run build
npm -w @astronote/web-next run lint
npm -w @astronote/web-next run build
```
