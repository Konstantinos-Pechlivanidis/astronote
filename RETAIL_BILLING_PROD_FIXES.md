# Retail Billing Production Fixes

## Base path
- Retail API mounts billing under `/api`; use `/api/billing/*` and `/api/subscriptions/*` (e.g., `/api/billing/invoices`, `/api/billing/billing-history`, `/api/billing/verify-payment`, `/api/subscriptions/reconcile|finalize`).
- Retail web client updated to call the `/api` paths to eliminate production 404s on invoices, billing history, and success-page verification.

## Webhooks & diagnostics
- Stripe webhook (`/webhooks/stripe`) now verifies signatures against the raw payload, logging requestIds and payload hashes on failures; unmatched events are stored in `WebhookEvent` with `status=unmatched` + reason `owner_not_found`.
- Webhook processing dedupes by provider/eventId and payload hash; retryable errors return 500 for Stripe retries, non-retryable are acknowledged with requestId.
- Success redirects can be reconciled safely via `POST /api/billing/verify-payment` (all checkout types) with optional `POST /api/subscriptions/finalize` for subscriptions; logs now include requestIds.

## VAT / Stripe Tax
- Billing profiles now carry `isBusiness`, VAT number/country, billing address, currency, `taxStatus`, and `taxExempt`; responses expose derived `vatValidated` and infer business when VAT is present.
- Stripe customers sync from the billing profile (address/email/name, `tax_exempt` derived from tax treatment, VAT IDs refreshed/removed when changed, metadata records business flag).
- Checkout sessions for subscriptions, plan changes, topups, and purchases require billing address collection and enable `automatic_tax` + `tax_id_collection` (default on unless `STRIPE_TAX_ENABLED=false`).
- Tax resolver behavior: Greece domestic charges VAT; EU B2B with verified VAT → reverse charge (0%); EU B2C applies country VAT; non-EU defaults to 0% VAT. Ensure Stripe Automatic Tax is enabled and price IDs are configured.
