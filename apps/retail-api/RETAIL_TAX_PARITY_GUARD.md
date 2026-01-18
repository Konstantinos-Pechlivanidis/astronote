# Retail Tax/VAT Parity Guard (vs Shopify)

## Confirmed behaviors
- Stripe Tax: Checkout sessions (subscription, subscription change, purchase/topup) set `automatic_tax.enabled=true` and `tax_id_collection.enabled=true` when Stripe Tax is on (default on). Billing address collection is required.
- Billing profile: fields include `legalName`, `billingEmail`, `billingAddress{country uppercase}`, `vatNumber`, `vatCountry`, `taxStatus`, `taxExempt`, `isBusiness`, `vatValidated`, `currency`. Sync to Stripe customer adds/removes VAT IDs and sets `tax_exempt` (reverse for EU B2B) via tax-resolver treatment.
- Tax resolver: GR domestic VAT; EU B2B reverse-charge when VAT validated; EU B2C VAT; non-EU 0%. Used for topup pricing, checkout tax settings, and tax evidence.
- Invoices & evidence: `InvoiceRecord` stores subtotal/tax/total/pdf/hosted URL; `TaxEvidence` upserted from webhook events and linked to invoices.
- Success/verify flow: `checkout.session.completed` webhooks activate subscriptions/credits and record billing transactions; `/api/billing/verify-payment` + `/api/subscriptions/finalize` provide safe reconciliation from success redirect.
- Endpoints mounted: billing router mounted under `/api`; `/api/billing/invoices` and `/api/billing/billing-history` respond (no 404).

## Alignment actions (none required)
- Tax logic, customer sync (including `tax_exempt`), invoice/tax evidence persistence, and verify flows already match Shopify parity target. No code changes needed.

## Manual test steps
1) GR B2C subscription checkout shows VAT; invoice includes tax.
2) GR B2B requires VAT; checkout collects VAT ID; invoice reflects VAT rule.
3) EU B2B with valid VAT → reverse charge (0 VAT) on checkout and invoice.
4) EU B2C shows VAT applied.
5) Non-EU checkout shows 0 VAT.
6) Topup/credit purchase grants wallet once; billing history + invoice (if generated) include tax amounts.
7) Success page verify (`/api/billing/verify-payment`) returns ok and UI shows updated subscription/credits; invoices list shows hosted/pdf URLs.
