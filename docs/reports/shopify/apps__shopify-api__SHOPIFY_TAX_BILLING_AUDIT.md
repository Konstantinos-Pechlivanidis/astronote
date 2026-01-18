# Shopify Billing Tax/VAT Parity Audit (vs Retail)

## 1) Current Shopify Tax Behavior (AS-IS)
- **Stripe Tax usage:** Checkout sessions enable `automatic_tax` + `tax_id_collection` only when `STRIPE_TAX_ENABLED=true` (default is **off**), see `apps/shopify-api/services/stripe.js:createStripeCheckoutSession()`. No global default-on flag.
- **VAT ID collection:** Enabled in checkout when tax is enabled; customer creation/sync also attaches VAT ID if present (`ensureStripeCustomer`, `syncStripeCustomerBillingProfile`).
- **DB VAT fields:** `shopBillingProfile` holds `legalName`, `billingEmail`, `billingAddress`, `vatNumber`, `vatCountry`, `taxStatus`, `taxExempt`, `isBusiness`, `vatValidated`, `currency` (see `services/billing-profile.js`, `schemas/billing.schema.js`). Sync to Stripe customer address/name/email and VAT tax IDs (add/remove) but no `tax_exempt` on the customer.
- **Tax evidence:** `TaxEvidence` service exists (`services/tax-evidence.js`) and is written from billing/webhook flows in `services/billing.js`, linked to `InvoiceRecord` via `upsertTaxEvidence`.
- **B2B/B2C behavior:** Determined by `services/tax-resolver.js` (same logic as Retail: GR domestic VAT, EU B2B reverse-charge if verified VAT, EU B2C VAT, non-EU zero). Validation: Greek businesses require VAT for checkout (`validateBillingProfileForCheckout`). Automatic tax calculation is still delegated to Stripe when enabled.

## 2) Stripe Objects & Flows Impacted
- **Subscription checkout:** Implemented in `services/subscription.js` (uses `stripe.subscriptions` directly) and `controllers/subscriptions.js`; no Checkout session is created—subscriptions are created via API with price IDs, so `automatic_tax` / `tax_id_collection` are not set. Metadata includes `shopId` when using Checkout-less flow? (subscriptions use direct API, not checkout).
- **Topup/credit purchase checkout:** `services/stripe.js:createStripeCheckoutSession()` sets `automatic_tax` + `tax_id_collection` when env flag is true; metadata includes `shopId`/`storeId` and package info; success/cancel URLs default to `/settings`.
- **Webhooks:** `controllers/stripe-webhooks.js` handles `checkout.session.completed`, `invoice.payment_succeeded/failed`, `customer.subscription.updated/deleted`; it records invoices via `services/invoices.js`, tax evidence via `services/billing.js` (`resolveTaxTreatment` + `upsertTaxEvidence`), and syncs billing profile from Stripe (VAT/status/address).
- **Portal:** Customer portal session creation not shown with tax-specific handling; tax identity changes rely on subsequent webhook/profile sync.

## 3) Parity Matrix (Retail vs Shopify)
| Feature | Retail | Shopify | Gap | Proposed (minimal) |
| --- | --- | --- | --- | --- |
| automatic_tax on subscription checkout | Enabled by default on subscription Checkout sessions | Subscriptions created via Stripe API (no Checkout) → no automatic_tax | Enable automatic_tax/tax_id_collection when creating subscriptions or migrate to Checkout session | Add tax config in subscription creation path using Stripe Tax settings |
| automatic_tax on one-off checkout | On by default (`STRIPE_TAX_ENABLED` default true) | On only when `STRIPE_TAX_ENABLED=true` (default off) | Default mismatch | Flip default to true or document env requirement |
| tax_id_collection | Enabled for all Checkout modes | Enabled only when tax flag true | Same as above | Tie to tax flag default true |
| Billing profile fields | has `isBusiness`, vatValidated, taxExempt; syncs tax_exempt to Stripe | Has same fields but does not set Stripe `tax_exempt`; `vatValidated` stored; Greek VAT requirement enforced | Missing tax_exempt sync | Update `syncStripeCustomerBillingProfile` to set `tax_exempt` per treatment |
| Invoice persistence (tax fields/links) | `InvoiceRecord` stores subtotal/tax/total/pdf/hosted_url; fallback from Stripe | Similar via `services/invoices.js` | Parity OK | Keep |
| Tax evidence + linkage | `TaxEvidence` linked to invoices and sessions | Exists and linked via `upsertTaxEvidence` | Parity OK | Ensure continues |
| Business purchase UX | Toggle + VAT fields, address required | `billing-profile` requires email/name/address; `isBusiness` used for GR VAT requirement; no explicit toggle copy parity check | UX copy may differ | Align copy/toggle with Retail wording |
| Country & VAT validation | Basic country uppercase + GR requires VAT if business; reverse-charge logic in tax-resolver | Same logic; no deep VAT validation | Parity OK | Optional: format validation note |
| Action matrix/UI copy | Retail uses billing action matrix; Shopify has billingActionMatrix for shopify but copy may differ | Likely similar but verify | Minor | Reuse Retail copy where applicable |

## 4) Recommended Shopify Implementation Plan (no code)
- **Backend targets:**  
  - `apps/shopify-api/services/stripe.js`: add `tax_exempt` derivation (tax-resolver) when updating/creating customers; default `STRIPE_TAX_ENABLED` to true; ensure metadata includes `shopId`.  
  - `apps/shopify-api/services/subscription.js` + `controllers/subscriptions.js`: enable Stripe Tax when creating/updating subscriptions (or switch to Checkout session flow mirroring Retail: automatic_tax + tax_id_collection + billing_address_collection, metadata shopId).  
  - `apps/shopify-api/services/billing.js`: verify tax evidence writes stay linked to `InvoiceRecord`; ensure billingProfile sync handles address country upper-case.  
  - `apps/shopify-api/controllers/stripe-webhooks.js`: ensure unmatched events stored and tax evidence persists; keep idempotency via `BillingTransaction`/`InvoiceRecord`.
- **Frontend targets:**  
  - `apps/astronote-web/app/app/shopify/billing/page.tsx` and related hooks (`features/shopify/billing/hooks/*`): confirm business toggle + VAT fields shown and sent; surface tax messaging similar to Retail; ensure success/portal flows refetch profile/invoices after tax identity changes.  
  - `shopifyBillingApi` client: confirm endpoints for billing profile/invoices already used; no base-path mismatch.
- **Env vars:** `STRIPE_TAX_ENABLED` (set true), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs; ensure FRONTEND_URL for success/cancel.
- **Webhooks/idempotency/tenant:** Keep `WebhookEvent` dedupe; ensure metadata carries `shopId` for tenant resolution; maintain idempotent keys on billing/invoice grants.
- **Manual test checklist (Shopify):**
  1. Set `STRIPE_TAX_ENABLED=true`; create Checkout top-up → verify tax displayed, VAT ID prompt.  
  2. Subscription purchase path → Stripe shows tax (GR B2C applies VAT, EU B2B with VAT shows 0%).  
  3. After payment: invoice stored with tax totals + hosted/pdf URLs; tax evidence row linked.  
  4. Update billing profile VAT/country → Stripe customer tax IDs updated; checkout reflects change.  
  5. Portal change of tax ID/address → return to app, sync profile, invoices still coherent.  
  6. Unmatched webhook (remove metadata) logs as unmatched in `WebhookEvent`.  
  7. Credit purchase grants wallet once; billing history records once.
- **Risks & rollback:** Tax flag default change could impact legacy environments; guard with feature flag and rollback by setting `STRIPE_TAX_ENABLED=false`. If switching subscriptions to Checkout, keep previous API path behind flag and preserve idempotency keys; monitor webhook error rates and unmatched events.
