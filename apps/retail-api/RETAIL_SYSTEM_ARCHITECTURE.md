# Retail System Architecture

## A) Tenancy & Auth
- Tenant scope is `ownerId` on all billing/campaign records; `requireAuth` populates `req.user` from JWT (access token + refresh cookie) and guards protected routes.
- Stripe metadata carries `ownerId` (and client_reference_id=`owner_{id}`) so webhooks can resolve the tenant; unmatched events are stored with status `unmatched`.

## B) Billing & Tax
- Source of truth: Stripe subscriptions/invoices; DB mirrors on `User` subscription snapshot plus `Subscription`, `InvoiceRecord`, `BillingTransaction`, `Wallet`/`CreditTransaction`, `WebhookEvent`.
- Checkout flows (all include `metadata.ownerId` and success/cancel URLs to `/app/retail/billing/*`):
  1) **Subscribe:** POST `/api/subscriptions/subscribe` → Stripe Checkout (mode subscription) → user redirected to success page → `POST /api/billing/verify-payment` (and `/api/subscriptions/finalize` idempotent) → Stripe webhooks (`checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.updated/deleted`) activate subscription, reset allowance, and sync DB.
  2) **Top-up:** POST `/api/billing/topup` → Checkout (payment) → webhook `checkout.session.completed` credits wallet via `creditTransaction` + `billingTransaction` (idempotent on idempotencyKey/session).
  3) **Package purchase:** POST `/api/billing/purchase` with Idempotency-Key → Checkout (payment) → webhook `checkout.session.completed`/`payment_intent.succeeded` marks purchase paid and credits wallet; ledger recorded once via `billingTransaction`.
- Invoices: `/api/billing/invoices` reads `InvoiceRecord`; if empty it backfills from Stripe invoices (by customer) then normalizes totals. `/api/billing/billing-history` returns `BillingTransaction` ledger.
- Tax/VAT:
  - Stripe Automatic Tax + `tax_id_collection` enabled on all checkout sessions; billing address collection required.
  - `BillingProfile`: `legalName`, `billingEmail`, `billingAddress{...country}`, `vatNumber`, `vatCountry`, `currency`, `taxStatus`, `taxExempt`, `isBusiness`, derived `vatValidated`; synced to Stripe customer (address/name/email, tax_exempt, VAT IDs add/remove, metadata).
  - Tax treatment: Greece B2C charges VAT; EU B2B with verified VAT reverse-charges (0%); EU B2C uses country VAT; non-EU 0%. Invoice totals shown from Stripe/InvoiceRecord (`subtotal/tax/total` in currency).

## C) Campaign Send & Statuses
- Enqueue/schedule: POST `/api/campaigns` (draft or scheduled). Enqueue via `/api/campaigns/:id/enqueue` or scheduler worker; validates status (draft/scheduled/paused) then sets `status='sending'`, writes queued messages, and queues jobs.
- Status transitions: `draft|scheduled|paused` → `sending` → `completed` (all sent) or `failed` (no recipients/validation error) with `startedAt/finishedAt`. Messages track `queued/processing/sent/failed`; refresh endpoints pull provider (Mitto) statuses.
- Metrics: `campaignAggregates.service` updates counts (`total/sent/failed/processed`) and campaign status; `campaignMetrics.service` derives queued/processing/sent/failed counts; periodic reconcile worker refreshes aggregates.
- Frontend: after send/schedule it refetches campaign detail/status/statistics and billing balances (credits) to reflect debits.

## D) Operational Resilience
- Webhook replay protection: `WebhookEvent` unique on (provider,eventId) with payload hash; `processWebhookWithReplayProtection` dedupes before processing and marks status.
- Idempotency: `BillingTransaction` unique on (ownerId,idempotencyKey); purchase creation uses Idempotency-Key header; wallet credits check existing `creditTransaction` reason/meta; included credits keyed on subscription/invoice id; checkout session metadata ensures stable keys.
- Reconciliation: `GET /api/subscriptions/current` Stripe-syncs subscription snapshot; `POST /api/subscriptions/reconcile` manual Stripe reconciliation; `POST /api/billing/verify-payment` safe finalize from success redirect; invoices fallback sync from Stripe when DB empty.
