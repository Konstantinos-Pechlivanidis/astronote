## Retail Billing Verification (Shopify Target Spec Parity)

This document is the **post-implementation verification guide** for Retail billing parity work.

**NO COMMIT** — this repo state is intended to be validated locally and in CI without committing.

Target spec reference: `apps/shopify-api/BILLING_ARCHITECTURE_SHOPIFY.md`  
Parity checklist reference: `apps/retail-api/BILLING_PARITY_REPORT_RETAIL.md`

---

## 1) Retail billing flow summary (new behavior)

### A) Subscribe (new subscription)
1. FE calls `POST /api/subscriptions/subscribe` with `{ planType, currency? }`.
2. API creates Stripe Checkout session (mode `subscription`).
3. User completes checkout.
4. Stripe webhook (`POST /webhooks/stripe`) activates subscription and resets allowance (idempotent).
5. FE success page calls `POST /billing/verify-payment` (generic) and then redirects to billing.

### B) Switch (policy-based)
Endpoint: `POST /api/subscriptions/switch`

Policy parity (Shopify):
- **month → year**: `changeMode = 'checkout'` (upgrade requires checkout)
- **year → month**: `changeMode = 'scheduled'` (downgrade scheduled at period end)

Retail-simple mode enforcement:
- `interval=month` implies **starter/month**
- `interval=year` implies **pro/year**
- Invalid combos (e.g. starter/year) are rejected.

### C) Scheduled downgrade management
- `POST /api/subscriptions/scheduled/change`
  - Creates/updates Stripe subscription schedule and sets DB `pendingChange*`
- `POST /api/subscriptions/scheduled/cancel`
  - Releases/cancels Stripe schedule and clears DB `pendingChange*`

### D) Cancel
Endpoint: `POST /api/subscriptions/cancel`
- Retail current behavior: cancels subscription immediately in Stripe and marks DB inactive (webhook also confirms).

### E) StripeSync transparency (read-time reconciliation)
Endpoint: `GET /api/subscriptions/current`
- Reads DB snapshot.
- If Stripe enabled and `stripeSubscriptionId` exists, fetches Stripe subscription and syncs DB if mismatch.
- Derives `pendingChange` from Stripe schedule phases (when present).

---

## 2) DTO example: `GET /api/subscriptions/current`

Example shape (abbreviated):

```json
{
  "active": true,
  "planType": "pro",
  "planCode": "pro",
  "status": "active",
  "interval": "year",
  "billingCurrency": "EUR",
  "currentPeriodStart": "2026-01-01T00:00:00.000Z",
  "currentPeriodEnd": "2027-01-01T00:00:00.000Z",
  "cancelAtPeriodEnd": false,
  "includedSmsPerPeriod": 500,
  "usedSmsThisPeriod": 12,
  "remainingSmsThisPeriod": 488,
  "pendingChange": {
    "planCode": "starter",
    "interval": "month",
    "currency": "EUR",
    "effectiveAt": "2027-01-01T00:00:00.000Z"
  },
  "allowedActions": ["changePlan", "cancelScheduledChange", "updatePaymentMethod", "viewInvoices", "refreshFromStripe"],
  "availableOptions": [
    { "planCode": "starter", "interval": "month", "currency": "EUR" },
    { "planCode": "pro", "interval": "year", "currency": "EUR" }
  ],
  "derivedFrom": "stripe_verified",
  "sourceOfTruth": "stripe",
  "mismatchDetected": false,
  "lastSyncedAt": "2026-01-16T12:34:56.000Z"
}
```

Notes:
- `planType` is kept for Retail legacy UI; `planCode` is the Shopify-parity alias.
- `pendingChange` is present only when a Stripe schedule exists and a future phase is detected.

---

## 3) Manual verification checklist (must-pass)

### Setup
- Ensure env vars:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `FRONTEND_URL` or `APP_URL`
  - Price IDs for your chosen catalog mode:
    - retail-simple: `STRIPE_PRICE_ID_SUB_STARTER_{EUR,USD}`, `STRIPE_PRICE_ID_SUB_PRO_{EUR,USD}`
    - matrix: `STRIPE_PRICE_ID_SUB_{STARTER,PRO}_{MONTH,YEAR}_{EUR,USD}`

### Tests
1. **Subscribe**:
   - Start with no active subscription.
   - Subscribe → checkout → return to billing.
   - Confirm `/api/subscriptions/current` shows `active=true`, correct `planType`, `interval`, and period dates.
2. **Upgrade (month → year)**:
   - If on starter/month, click “Switch to Yearly”.
   - Confirm API returns `changeMode='checkout'` with `checkoutUrl` and browser redirects.
   - After payment, confirm only one active Stripe subscription remains (old one cancelled by webhook handler).
3. **Downgrade scheduled (year → month)**:
   - If on pro/year, click “Switch to Monthly”.
   - Confirm API returns `changeMode='scheduled'` and `/api/subscriptions/current` shows `pendingChange`.
4. **Cancel scheduled change**:
   - Call `POST /api/subscriptions/scheduled/cancel`.
   - Confirm `pendingChange` cleared and Stripe schedule released.
5. **Portal return sync**:
   - Open customer portal; return to billing.
   - Confirm billing page triggers reconcile once (`fromPortal=true`) and then cleans URL.
6. **Top-up / credit pack success page**:
   - Complete a top-up or pack purchase checkout.
   - Confirm success page uses `POST /billing/verify-payment` and redirects back with `paymentSuccess=1`.

---

## 4) Gates to run

From repo root:

```bash
npm -w @astronote/retail-api run prisma:generate
npm -w @astronote/retail-api run prisma:migrate:deploy

npm -w @astronote/retail-api run lint
npm -w @astronote/retail-api run test
npm -w @astronote/retail-api run build

npm -w @astronote/web-next run lint
npm -w @astronote/web-next run build

npm run retail:gate
```

### Note on `prisma migrate dev`
At the time of writing, `npm -w @astronote/retail-api run prisma:migrate:dev` fails with:
- `P3006` / shadow DB apply failure (`Contact` table missing while replaying early migrations)

This is a **legacy migration replayability issue** (shadow DB starts empty) and does not affect `migrate deploy`.

