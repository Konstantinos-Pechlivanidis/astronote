# Shopify Tax/VAT Parity Implementation Plan (vs Retail)

## Scope
- Backend: `apps/shopify-api` (Stripe customer sync, subscription updates, checkout sessions)
- Frontend: `apps/astronote-web` (Shopify billing page UX/copy)
- Prisma: no schema changes anticipated.

## Current findings (from SHOPIFY_TAX_BILLING_AUDIT.md)
- Checkout sessions gate `automatic_tax/tax_id_collection` on `STRIPE_TAX_ENABLED` (default off).
- Subscriptions created/updated via Stripe API without `automatic_tax`.
- Billing profile sync adds/removes VAT IDs but does not set Stripe `tax_exempt`; country not normalized.
- Tax resolver logic matches Retail; tax evidence/invoices are persisted.

## Changes to implement (minimal)
1) **Tax flag default**: Align with Retail by defaulting `STRIPE_TAX_ENABLED` to true unless explicitly disabled.
2) **Stripe customer sync**:
   - Normalize country to uppercase.
   - Derive tax treatment via `tax-resolver` and set `customer.tax_exempt` (`reverse` for EU B2B reverse-charge).
3) **Subscription tax support**:
   - When updating subscriptions (plan/interval) and creating checkout-based subscriptions, ensure `automatic_tax.enabled=true` (behind tax flag) and metadata retains `shopId/storeId`.
4) **Checkout sessions**:
   - Keep automatic tax + tax ID collection when tax flag is on; ensure billing address collection remains required.
5) **Frontend UX (Shopify billing page)**:
   - Ensure business toggle + VAT fields/copy match Retail; refetch profile/invoices/subscription after portal/checkout return.

## Verification
- Commands: `npm -w @astronote/shopify-api run lint`, `npm -w @astronote/shopify-api run build`, `npm -w @astronote/web-next run lint`, `npm -w @astronote/web-next run build`.
- Manual tests (Shopify):
  1. GR B2C checkout shows VAT.
  2. GR B2B requires VAT; invoice shows VAT behavior.
  3. EU B2B with valid VAT → reverse charge (0 VAT).
  4. EU B2C shows VAT.
  5. Non-EU shows 0 VAT.
  6. Invoices list shows tax totals + hosted/pdf URLs.
  7. Portal tax identity changes reflect after return (reconcile/refetch).
