## Summary
- Good: Billing page consolidates subscription status, wallet balance, top-ups, invoices, and payment history in one place with clear status badges and Stripe portal access.
- Missing: No dedicated guidance for past_due/unpaid states beyond the generic status chip and optional last billing error.
- Recommended improvement 1: Clarify the action path for non-active statuses (past_due/unpaid/canceled) with explicit next-step messaging in the subscription section.
- Recommended improvement 2: Reduce potential confusion between “Wallet Activity” and “Payment History” by clarifying their difference in UI copy.
- Recommended improvement 3: Make current plan pricing more visible when subscription is active (currently shown mainly in inactive subscribe cards).

## File map
- Billing page: apps/astronote-web/app/app/retail/billing/page.tsx
- Billing success return: apps/astronote-web/app/app/retail/billing/success/page.tsx
- Billing cancel return: apps/astronote-web/app/app/retail/billing/cancel/page.tsx
- Retail nav entry: apps/astronote-web/app/app/retail/_components/RetailNavItems.ts
- Retail auth guard (route protection): apps/astronote-web/app/app/retail/layout.tsx, apps/astronote-web/src/components/retail/RetailAuthGuard.tsx
- Billing API client: apps/astronote-web/src/lib/retail/api/billing.ts
- Subscriptions API client: apps/astronote-web/src/lib/retail/api/subscriptions.ts
- API endpoints map: apps/astronote-web/src/lib/retail/api/endpoints.ts
- Billing gate hook (used outside billing page): apps/astronote-web/src/features/retail/billing/hooks/useBillingGate.ts
- Settings entry point: apps/astronote-web/src/components/retail/settings/BillingSummaryCard.tsx
- Dashboard entry point + credits card: apps/astronote-web/app/app/retail/dashboard/page.tsx
- Campaign send gating: apps/astronote-web/app/app/retail/campaigns/[id]/page.tsx
- Automations gating: apps/astronote-web/app/app/retail/automations/page.tsx

## 1) Entry points & navigation
- Sidebar navigation includes “Billing” under the “Revenue” group, linking to /app/retail/billing.
- Dashboard has “Buy Credits” CTA linking to /app/retail/billing.
- Settings page shows a “Billing Status” summary card with “Go to Billing” CTA.
- Automations page shows a billing gate card with “Go to Billing” when subscription is inactive.
- Campaign detail page shows a “Go to Billing” CTA when subscription is inactive.
- Route protection: all /app/retail/* pages are wrapped in RetailAuthGuard and redirect unauthenticated users to /auth/retail/login.
- No role-based gating or feature flag specific to Billing; nav feature flags exist in general but Billing has none.

## 2) Page structure (UI inventory)
- Page header
  - Title: “Billing”
  - Description: “Manage your subscription and credits”
  - Actions: “Refresh from Stripe” button + currency selector (EUR only)
- Info banner
  - Text: “After payment we automatically verify and reconcile…”
- Billing header card
  - Status chip (active/past_due/unpaid/inactive) with color coding
  - Wallet balance (credits)
  - Current plan label and included credits per cycle
  - Next renewal date, cancel/renew note
  - Persistent policy message: “Credits accumulate and never expire; spending requires an active subscription.”
  - Last billing error (if present)
- Subscription card
  - If active: shows current subscription details, renewal date, pending change date
  - Actions: switch to monthly/yearly, manage payment method (Stripe portal), cancel at period end, resume subscription
- Credit top-up card
  - Top-up tiers selector
  - Price breakdown (total, VAT)
  - Action: “Buy Credits” (redirects to Stripe checkout)
- Credit packages section (only when subscription.active)
  - List of purchasable packages (credit packs)
  - Action per package: “Purchase” (redirects to Stripe checkout)
- Wallet Activity table
  - Transactions list with date/type/amount/reason; pagination (20/page)
- Invoices table
  - Date/status/total + Hosted/PDF links; label “DB-first • Stripe fallback”
- Payment History table
  - Date/type/amount/credits/status for paid transactions (subscription/top-ups)

## 3) User flows & behavior
- Purchase subscription (monthly/yearly)
  - User selects plan -> subscriptionsApi.subscribe -> redirects to Stripe Checkout (if URL returned)
  - On return, /app/retail/billing/success verifies payment, optionally finalizes subscription, reconciles, then redirects back to billing with toast
- Buy top-up
  - User selects top-up tier -> billingApi.topup -> redirects to Stripe Checkout
  - On return, same success flow verifies and refreshes billing data
- Upgrade/downgrade/cancel
  - Switch plan uses subscriptionsApi.switch with idempotency key
  - Upgrade may require checkout; scheduled downgrades show pending change date
  - Cancel is “cancel at period end” (no immediate cancel); Resume is available if cancel is scheduled
  - “Manage Payment Method” opens Stripe portal in a new tab
- Behavior on PAST_DUE / CANCELED / INACTIVE
  - Status chip reflects raw status (past_due/unpaid shows yellow; inactive/canceled shows red)
  - UI treats anything other than status === 'active' as inactive, so subscription card shows subscribe options
  - Last billing error text appears if provided
- Gating messaging
  - Billing page and Credits cards repeat: “Credits accumulate and never expire; spending requires an active subscription.”
  - Campaign send and automations display blocking notices and CTA to Billing when subscription is inactive

## 4) Data sources & integration points (high level)
- Billing data
  - Summary: billingApi.getSummary -> /api/billing/summary
  - Balance: billingApi.getBalance -> /api/billing/balance
  - Transactions: billingApi.getTransactions -> /api/billing/transactions
  - Billing history: direct api.get -> /api/billing/billing-history
  - Invoices: direct api.get -> /api/billing/invoices
- Subscription actions
  - Current: subscriptionsApi.getCurrent -> /api/subscriptions/current
  - Subscribe: /api/subscriptions/subscribe
  - Switch plan: /api/subscriptions/switch (idempotency header)
  - Cancel: /api/subscriptions/cancel (idempotency header)
  - Resume: /api/subscriptions/resume
  - Portal: /api/subscriptions/portal
  - Reconcile: /api/subscriptions/reconcile
  - Finalize: /api/subscriptions/finalize (used in success return)
- Top-ups/packages
  - Tiers: /api/billing/topup/tiers
  - Calculate top-up: /api/billing/topup/calculate
  - Top-up purchase: /api/billing/topup
  - Packages: /api/billing/packages
  - Package purchase: /api/billing/purchase
- Client state
  - Selected currency stored per-tenant in localStorage
  - Selected top-up credits, pagination pages, pending mutations and toasts
  - Query cache invalidation on success (summary/balance/invoices/history)

## 5) UX issues / risks (quick audit)
- Past_due/unpaid users see a generic subscribe card (same as inactive), which may not clearly guide them to resolve billing issues.
- Two history tables (Wallet Activity vs Payment History) can be hard to distinguish without stronger labeling or explanation.
- Current plan price isn’t visible in the “active subscription” card; pricing is more explicit only in the subscribe cards.
- Top-up and package purchase flows rely on Stripe redirects with minimal in-page confirmation beyond success toast/return screen.
- Currency selector shows only EUR, but still occupies header space; may feel redundant unless more currencies are planned.
