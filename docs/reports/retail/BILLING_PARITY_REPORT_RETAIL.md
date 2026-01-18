## Retail Billing Parity Report (vs Shopify Billing Architecture Target)

Target spec: `apps/shopify-api/BILLING_ARCHITECTURE_SHOPIFY.md`  
Scope reviewed:
- Backend: `apps/retail-api/apps/api` (billing routes, subscription service, Stripe services, Stripe webhooks, invoices, wallet)
- Prisma: `apps/retail-api/prisma/schema.prisma`
- Frontend: `apps/astronote-web/app/app/retail/billing/*` + `apps/astronote-web/src/lib/retail/api/*`

**REPORT ONLY** — no runtime behavior changes.  
**NO COMMIT**.

---

## 1) Current Retail billing surface (as-is)

### 1.1 Tenant model and “source of truth”
- Tenant identifier is **`ownerId`** (`User.id`, integer) rather than `shopId` (Shopify).
- Stripe is used as the **truth** for subscription state; DB mirrors subscription snapshot on `User` plus a separate `Subscription` model (see Prisma below).
- Replay protection exists for Stripe webhooks (via `WebhookEvent` + `services/webhook-replay.service`).

### 1.2 Backend endpoints (Retail API)

Routes are implemented primarily in:
- `apps/retail-api/apps/api/src/routes/billing.js` (includes **both** `/billing/*` and `/subscriptions/*` endpoints)
- `apps/retail-api/apps/api/src/routes/stripe.webhooks.js` (`POST /webhooks/stripe`)

#### Billing endpoints (`/billing/*`) — `apps/retail-api/apps/api/src/routes/billing.js`
- **GET `/billing/balance`**: wallet balance + subscription snapshot + allowance
- **GET `/billing/wallet`**: alias for `/billing/balance` (legacy)
- **GET `/billing/summary`**: subscription + allowance + credits (wallet)
- **GET `/billing/profile`**: billing profile
- **PUT `/billing/profile`**: update billing profile and sync to Stripe customer
- **GET `/billing/invoices`**: invoices list (DB-first, Stripe fallback)
- **GET `/billing/transactions`**: wallet ledger (`CreditTransaction`-style)
- **GET `/api/billing/packages`**: packages list (credit packs / subscription packages depending on implementation)
- **GET `/api/billing/purchases`**: purchases list (`Purchase`)
- **GET `/api/billing/billing-history`**: unified billing ledger (`BillingTransaction`)
- **POST `/api/billing/seed-packages`**: seeds packages (internal/admin-ish)
- **POST `/api/billing/purchase`**: purchase a package (Stripe checkout)
- **POST `/api/billing/topup`**: variable top-up checkout
- **GET `/api/billing/topup/calculate`**: VAT/tax-aware top-up quote
- **POST `/api/billing/verify-payment`**: generic verify endpoint for any checkout session type
- **GET `/api/billing/verify-sync`**: diagnostic endpoint for sync (internal)

#### Subscription endpoints (`/api/subscriptions/*`) — `apps/retail-api/apps/api/src/routes/billing.js`
- **GET `/api/subscriptions/current`**: subscription status snapshot (`getSubscriptionStatusWithStripeSync`) + `plan` config
- **POST `/api/subscriptions/reconcile`**: manual reconcile from Stripe (`reconcileSubscriptionFromStripe`)
- **POST `/api/subscriptions/subscribe`**: create Stripe Checkout session for subscription
- **POST `/api/subscriptions/update`**: update subscription plan (immediate)
- **POST `/api/subscriptions/switch`**: switch plan/interval (currently maps interval→plan)
- **POST `/api/subscriptions/cancel`**: cancel subscription; updates DB immediately
- **GET `/api/subscriptions/portal`**: Stripe customer portal session
- **POST `/api/subscriptions/verify-session`**: verify/activate subscription from checkout session (manual recovery)
- **POST `/api/subscriptions/finalize`**: alias of verify-session (explicitly intended for FE success page)

### 1.3 Stripe webhook handling

Public endpoint:
- `POST /webhooks/stripe` in `apps/retail-api/apps/api/src/routes/stripe.webhooks.js`

Key properties:
- Signature verification with `STRIPE_WEBHOOK_SECRET`
- Tenant resolution (`resolveOwnerIdFromStripeEvent`) by:
  - metadata `ownerId`/`userId`
  - `customerId → User.stripeCustomerId`
  - `subscriptionId → User.stripeSubscriptionId` and `Subscription.stripeSubscriptionId`
- Replay protection:
  - `services/webhook-replay.service` stores `WebhookEvent` with `@@unique([provider,eventId])`
  - Unmatched events are recorded and acknowledged

Events handled (switch in webhook handler):
- `checkout.session.completed` → routes by `metadata.type`:
  - subscription: `handleCheckoutSessionCompletedForSubscription`
  - credit_topup: `handleCheckoutSessionCompletedForTopup`
  - package purchase (default)
- `payment_intent.succeeded` / `payment_intent.payment_failed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `charge.refunded`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### 1.4 Invoices: DB-first with Stripe fallback

Service:
- `apps/retail-api/apps/api/src/services/invoices.service.js`

Behavior:
- Lists `InvoiceRecord` from DB.
- If **DB empty** and Stripe configured:
  - resolves Stripe customer id (`services/stripe-sync.service.js#resolveStripeCustomerId`)
  - fetches invoices from Stripe and upserts them into DB
  - re-reads DB to return results

This matches Shopify target’s “DB-first with Stripe fallback” pattern.

### 1.5 Retail frontend billing wiring

Entry pages:
- `apps/astronote-web/app/app/retail/billing/page.tsx`
- `apps/astronote-web/app/app/retail/billing/success/page.tsx`
- `apps/astronote-web/app/app/retail/billing/cancel/page.tsx`

API clients:
- `apps/astronote-web/src/lib/retail/api/billing.ts`
- `apps/astronote-web/src/lib/retail/api/subscriptions.ts`

Notable FE behaviors:
- Billing page queries invoices via raw axios calls to:
  - `/billing/invoices`
  - `/billing/billing-history`
  - and calls `/subscriptions/reconcile` via mutation.
- Success page calls `/subscriptions/finalize {sessionId}` and falls back to `/subscriptions/reconcile` if finalize is missing.

---

## 2) Gap list vs Shopify target spec (grouped)

The Shopify target spec expects:
- A plan catalog module with startup validation and reverse lookup
- StripeSync read-time reconciliation with strong invariants and drift correction
- Scheduled changes (pendingChange modeling + endpoints + UI exposure)
- Invoice DB-first with fallback/backfill (already largely present in Retail)
- `allowedActions`/`availableOptions` contract between backend and frontend
- Correct finalize/redirect UX for *all* checkout flows (subscription + purchases/topups)

Below are Retail gaps against those expectations.

---

### A) Plan catalog & env validation

**Current Retail**
- Subscription price IDs are resolved in `apps/retail-api/apps/api/src/billing/stripePrices.js`:
  - `getSubscriptionPriceId(planType, currency)` uses `STRIPE_PRICE_ID_SUB_{STARTER,PRO}_{EUR,USD}`
  - Also supports **matrix-key alias** with implied interval (starter→MONTH, pro→YEAR).
- Reverse lookup (priceId → plan) is duplicated ad-hoc:
  - `apps/retail-api/apps/api/src/routes/stripe.webhooks.js#handleSubscriptionUpdated` compares against `getStripeSubscriptionPriceId(...)`
  - `apps/retail-api/apps/api/src/services/subscription.service.js#resolvePlanTypeFromStripeSubscription` also uses hard-coded comparisons
- No obvious **startup catalog validation** (Shopify fails fast in prod/CI when Stripe enabled).

**Gap vs Shopify target**
- Missing a centralized `plan-catalog` module with:
  - mode detection (retail-simple vs matrix)
  - `validateCatalog()` called at startup
  - canonical reverse lookup `resolvePlanFromPriceId()`

**Minimal change proposal (no code yet)**
- **Add** Retail parity module similar to Shopify:
  - New file: `apps/retail-api/apps/api/src/services/plan-catalog.service.js` (or `billing/planCatalog.js`)
  - Implement: `getPriceId(planCode, interval, currency)`, `resolvePlanFromPriceId(priceId)`, `validateCatalog()`
- **Call** validation at startup (fail fast when Stripe is enabled):
  - Likely in `apps/retail-api/apps/api/src/server.js` (or earliest bootstrap module)
- **Replace** ad-hoc comparisons in:
  - `apps/retail-api/apps/api/src/routes/stripe.webhooks.js`
  - `apps/retail-api/apps/api/src/services/subscription.service.js`
  with `resolvePlanFromPriceId()`.

---

### B) StripeSync read-time reconciliation

**Current Retail**
- `apps/retail-api/apps/api/src/services/stripe-sync.service.js#getSubscriptionStatusWithStripeSync(ownerId)`:
  - reads DB snapshot via `getSubscriptionStatus`
  - if Stripe is configured and `stripeSubscriptionId` exists: runs `reconcileSubscriptionFromStripe(ownerId)`
  - returns `derivedFrom` plus approximate `mismatchDetected` based on a small set of fields
- Tenant-link resolution helper exists:
  - `resolveStripeCustomerId(ownerId)` updates `User.stripeCustomerId` by reading Stripe subscription when needed

**Gap vs Shopify target**
- Shopify’s `stripe-sync` is stronger:
  - canonical field derivation using plan catalog reverse lookup
  - handles Stripe “not found” cases by clearing DB mirror safely
  - tracks pending scheduled change from Stripe schedule phases
  - produces richer transparency metadata (`sourceOfTruth`, `mismatchDetected`, etc.)

**Minimal change proposal**
- Expand Retail `stripe-sync.service.js` to match Shopify behaviors:
  - Add canonical derivation using the new plan catalog module.
  - Add “Stripe subscription not found” handling (clear/mark DB state to prevent phantom actives).
  - Add `lastSyncedAt`/`sourceOfTruth` semantics (could be stored on `Subscription` model like Shopify).
- Update reconcile function:
  - `apps/retail-api/apps/api/src/services/subscription.service.js#reconcileSubscriptionFromStripe`
  - Ensure it updates both `User` mirror fields and the `Subscription` record consistently.

---

### C) Scheduled changes (pendingChange modeling + endpoints)

**Current Retail**
- No `pendingChange*` fields exist in the Retail `Subscription` Prisma model.
  - See `apps/retail-api/prisma/schema.prisma` `model Subscription` (no pendingChange columns).
- API surface has no `/subscriptions/scheduled/*` endpoints.
- `/subscriptions/switch` in `apps/retail-api/apps/api/src/routes/billing.js`:
  - maps interval to plan (`month→starter`, `year→pro`)
  - calls Stripe subscription update directly (appears immediate)
- Webhooks do not derive pending change from Stripe schedules.

**Gap vs Shopify target**
- Shopify supports:
  - scheduling downgrades at period end
  - storing pending change details and exposing them to the UI
  - action matrix changes when pending change exists

**Minimal change proposal**
- Prisma migration to add pending change fields (match Shopify naming for parity):
  - `apps/retail-api/prisma/schema.prisma` `model Subscription`:
    - `pendingChangePlanCode`, `pendingChangeInterval`, `pendingChangeCurrency`, `pendingChangeEffectiveAt`
    - `lastSyncedAt`, `sourceOfTruth` (optional but recommended for parity)
- Add endpoints:
  - `POST /subscriptions/scheduled/change`
  - `POST /subscriptions/scheduled/cancel`
  - Implement in `apps/retail-api/apps/api/src/routes/billing.js` (or split into `routes/subscriptions.js` for cleanliness).
- Add Stripe schedule handling:
  - Extend `apps/retail-api/apps/api/src/routes/stripe.webhooks.js#handleSubscriptionUpdated` to parse subscription schedules if expanded
  - Or incorporate into enhanced `stripe-sync.service.js` (preferred: derive pending change from Stripe schedule at read-time).

---

### D) Invoices DB-first + Stripe fallback/backfill

**Current Retail**
- Already implemented:
  - DB-first list + Stripe fallback when DB empty
  - Tax evidence linking per invoice is supported (`TaxEvidence.invoiceId` points to `InvoiceRecord.id`)
  - Included credits ledger entries are recorded on `invoice.payment_succeeded`

**Gaps vs Shopify target**
- **Backfill tooling parity**: Shopify has explicit ops script(s) for backfill across tenants.

**Minimal change proposal**
- Add a Retail ops script (report-only proposal):
  - New script (example): `apps/retail-api/apps/api/scripts/backfill-billing-from-stripe.js`
  - Iterates users with `stripeCustomerId`, fetches invoices, upserts `InvoiceRecord`, and records missing `BillingTransaction` items idempotently.

---

### E) `allowedActions` / `availableOptions` contract (backend-driven action matrix)

**Current Retail**
- No evidence of `allowedActions` or `availableOptions` being returned from:
  - `GET /subscriptions/current`
  - `GET /billing/summary`
- FE billing page logic appears to be UI-derived rather than backend-driven (in `apps/astronote-web/app/app/retail/billing/page.tsx`).

**Gap vs Shopify target**
- Shopify returns a backend-driven action matrix; FE prefers backend `allowedActions` to prevent drift.

**Minimal change proposal**
- Add a Retail action-matrix service:
  - New file: `apps/retail-api/apps/api/src/services/subscription-actions.service.js`
  - Implement `computeAllowedActions(subscriptionDto)` and optional `availableOptions` (currency/interval options).
- Attach to responses:
  - `apps/retail-api/apps/api/src/routes/billing.js` in `/subscriptions/current` (and optionally `/billing/summary`)
  - FE can then render actions deterministically like Shopify.

---

### F) Redirect/finalize UX correctness (subscription vs topup vs package purchase)

**Current Retail**
- Backend constructs success/cancel URLs for:
  - subscriptions: `/app/retail/billing/success?session_id={CHECKOUT_SESSION_ID}`
  - topups: same success page path
  - purchases: also uses success/cancel URLs (depends on route)
- FE success page (`apps/astronote-web/app/app/retail/billing/success/page.tsx`) currently:
  - calls `/subscriptions/finalize {sessionId}`
  - falls back to `/subscriptions/reconcile` if finalize is missing

**Gap vs Shopify target**
- Shopify expects preview/finalize behavior to correctly handle **all payment types**:
  - subscription checkout sessions (mode=subscription)
  - payment sessions (topups, credit packs)
- Retail FE success page calling `/subscriptions/finalize` is subscription-only; it may fail for topup/package sessions.
- Retail backend already provides a generic endpoint:
  - `POST /api/billing/verify-payment` in `apps/retail-api/apps/api/src/routes/billing.js`

**Minimal change proposal**
- Update FE success page (`apps/astronote-web/app/app/retail/billing/success/page.tsx`):
  - Call `POST /api/billing/verify-payment` first (generic)
  - If paymentType indicates subscription: then call `/subscriptions/finalize` (or just rely on verify result)
  - Otherwise: refresh billing page state (balance/history/invoices) without calling subscription finalize
- Update portal return URL to include a sync hint:
  - In `apps/retail-api/apps/api/src/routes/billing.js` `/subscriptions/portal`
  - Use `/app/retail/billing?fromPortal=true` like Shopify
  - Then in `apps/astronote-web/app/app/retail/billing/page.tsx`, if `fromPortal=true`, auto-run reconcile once.

---

## 3) Gap-by-gap file paths + minimal change proposals (index)

### Plan catalog & env validation
- **Current**:
  - `apps/retail-api/apps/api/src/billing/stripePrices.js`
  - `apps/retail-api/apps/api/src/services/subscription.service.js`
  - `apps/retail-api/apps/api/src/routes/stripe.webhooks.js`
- **Proposed**:
  - Add `apps/retail-api/apps/api/src/services/plan-catalog.service.js`
  - Call `validateCatalog()` during startup in `apps/retail-api/apps/api/src/server.js`

### StripeSync read-time reconciliation
- **Current**:
  - `apps/retail-api/apps/api/src/services/stripe-sync.service.js`
  - `apps/retail-api/apps/api/src/services/subscription.service.js` (reconcile)
- **Proposed**:
  - Enhance `stripe-sync.service.js` with stronger canonical derivation, Stripe-not-found handling, and transparency metadata

### Scheduled changes
- **Current**:
  - `apps/retail-api/prisma/schema.prisma` (`Subscription` lacks pending-change columns)
  - `apps/retail-api/apps/api/src/routes/billing.js` (`/subscriptions/switch` is immediate)
- **Proposed**:
  - Prisma migration + endpoints `/subscriptions/scheduled/change` + `/subscriptions/scheduled/cancel`
  - Extend `stripe-sync.service.js` to derive pending change from Stripe schedules

### Invoices fallback/backfill
- **Current**:
  - `apps/retail-api/apps/api/src/services/invoices.service.js`
- **Proposed**:
  - Add ops backfill script under `apps/retail-api/apps/api/scripts/*`

### allowedActions/availableOptions contract
- **Current**:
  - No backend contract found; FE derives behavior.
- **Proposed**:
  - Add `apps/retail-api/apps/api/src/services/subscription-actions.service.js`
  - Add to `/subscriptions/current` response in `apps/retail-api/apps/api/src/routes/billing.js`
  - Optionally mirror Shopify query keys approach in FE.

### Redirect/finalize UX
- **Current**:
  - FE: `apps/astronote-web/app/app/retail/billing/success/page.tsx`
  - Backend: `apps/retail-api/apps/api/src/routes/billing.js` (`/api/subscriptions/finalize`, `/api/billing/verify-payment`)
- **Proposed**:
  - FE success page uses `/api/billing/verify-payment` as primary
  - Add `fromPortal=true` return hint and reconcile-on-return behavior

---

## 4) Production readiness checklist (Retail)

### Commands (gates)
From repo root:
- `npm -w @astronote/retail-api run lint`
- `npm -w @astronote/retail-api run test`
- `npm -w @astronote/retail-api run build`
- `npm -w @astronote/web-next run lint`
- `npm -w @astronote/web-next run build`
- Optional meta-gate:
  - `npm run retail:gate`

### Required env vars (minimum)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FRONTEND_URL` (or `APP_URL`, depending on `buildRetailFrontendUrl` behavior)
- Plan price IDs (Retail-simple):
  - `STRIPE_PRICE_ID_SUB_STARTER_EUR`, `STRIPE_PRICE_ID_SUB_PRO_EUR`
  - plus USD variants if USD supported
- Top-up price IDs:
  - `STRIPE_PRICE_ID_CREDIT_TOPUP_EUR` (and USD variant if enabled)

### Manual tests (must-pass)
- **Subscription subscribe**:
  - Subscribe → Stripe Checkout → success page → billing shows active subscription and allowance
- **Portal**:
  - Open portal → return → billing reflects updated state (especially after cancel/resume)
- **Top-up**:
  - Create top-up checkout → success → wallet balance increases exactly once; billing history entry appears once
- **Package purchase**:
  - Purchase a package → success → wallet credit once; invoice (if applicable) and billing history update
- **Webhook resilience**:
  - Replay same Stripe webhook event ID → DB should not double-credit or double-record ledger
- **Invoices list**:
  - If DB empty, invoices endpoint fetches from Stripe and returns results (fallback)

---

## Implemented (Parity Work Summary)

This section summarizes what was implemented to move Retail billing closer to the Shopify billing target spec.

### Backend (Retail API)
- **Plan catalog + fail-fast validation**
  - Added centralized plan catalog: `apps/retail-api/apps/api/src/services/plan-catalog.service.js`
  - Startup validation (prod/CI fail-fast when Stripe enabled + missing price IDs):
    - `apps/retail-api/apps/api/src/server.js`
  - Routed subscription price resolution through catalog:
    - `apps/retail-api/apps/api/src/billing/stripePrices.js`
- **Reverse lookup consolidation**
  - Replaced ad-hoc priceId→plan mappings with `resolvePlanFromPriceId()` in:
    - `apps/retail-api/apps/api/src/services/subscription.service.js`
    - `apps/retail-api/apps/api/src/routes/stripe.webhooks.js`
- **StripeSync strengthened**
  - Expanded `apps/retail-api/apps/api/src/services/stripe-sync.service.js` to:
    - derive canonical plan/interval/currency from priceId via plan-catalog
    - derive `pendingChange` from Stripe schedules
    - handle Stripe subscription “not found” by clearing phantom DB mirrors
    - return transparency metadata (derivedFrom/sourceOfTruth/mismatchDetected/lastSyncedAt)
- **Scheduled changes parity**
  - Stripe schedule helpers:
    - `apps/retail-api/apps/api/src/services/stripe.service.js` (`createOrUpdateSubscriptionSchedule`, `cancelSubscriptionSchedule`)
  - Added endpoints:
    - `POST /api/subscriptions/scheduled/change`
    - `POST /api/subscriptions/scheduled/cancel`
    - Implemented in `apps/retail-api/apps/api/src/routes/billing.js`
  - Updated `/api/subscriptions/switch` and `/api/subscriptions/update` policy behavior:
    - month→year: checkout
    - year→month: scheduled
- **Backend-driven allowedActions/availableOptions**
  - Added action matrix service:
    - `apps/retail-api/apps/api/src/services/subscription-actions.service.js`
  - Attached to `GET /api/subscriptions/current`:
    - `apps/retail-api/apps/api/src/routes/billing.js`
- **Subscription-change checkout**
  - Added `createSubscriptionChangeCheckoutSession` to `apps/retail-api/apps/api/src/services/stripe.service.js`
  - Webhook cancels previous subscription after successful change checkout (best-effort):
    - `apps/retail-api/apps/api/src/routes/stripe.webhooks.js`

### Prisma (Retail)
- Added pending-change + sync transparency fields to `Subscription`:
  - `apps/retail-api/prisma/schema.prisma`
  - Fields: `pendingChangePlanCode`, `pendingChangeInterval`, `pendingChangeCurrency`, `pendingChangeEffectiveAt`, `lastSyncedAt`, `sourceOfTruth`

### Frontend (Retail billing pages only)
- **Generic success flow for all checkout types**
  - `apps/astronote-web/app/app/retail/billing/success/page.tsx` now calls `POST /api/billing/verify-payment` first, then redirects to billing.
- **Portal-return reconciliation**
  - Portal return URL now includes `fromPortal=true` (backend).
  - Billing page auto-runs reconcile once and cleans URL:
    - `apps/astronote-web/app/app/retail/billing/page.tsx`
- **Switch UX aligned with backend policy**
  - Billing page now handles `changeMode='checkout'` by redirecting to checkout URL.
  - Pulls backend-driven subscription contract (`/subscriptions/current`) for allowedActions and pendingChange.

### Verification doc
- Added: `apps/retail-api/apps/api/RETAIL_BILLING_VERIFICATION.md`
