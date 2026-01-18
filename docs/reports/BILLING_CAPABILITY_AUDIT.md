# Billing Capability Audit - Shopify Billing System

## Capability Checklist

| Capability | Endpoint(s) | DB Fields | UI Location | Status | Notes |
|-----------|-------------|-----------|-------------|--------|-------|
| **1. Subscribe** | | | | | |
| - Plan selection (starter/pro) | `POST /subscriptions/subscribe` | `planType`, `planCode` | Billing page plan cards | ✅ OK | Supports planCode, interval, currency |
| - Interval selection (month/year) | `POST /subscriptions/subscribe` | `interval` | Plan cards (starter=month, pro=year) | ✅ OK | Explicitly set |
| - Currency (EUR/USD) | `POST /subscriptions/subscribe` | `currency` | Currency selector | ✅ OK | From shop settings or request |
| - Checkout collects billing details | `createSubscriptionCheckoutSession` | `billing_address_collection: 'required'`, `tax_id_collection: { enabled: true }` | Stripe Checkout | ✅ OK | Configured in stripe.js |
| - Success/cancel routes | Frontend routes | - | `/app/shopify/billing/success`, `/app/shopify/billing/cancel` | ✅ OK | Routes exist |
| - Finalize + reconcile | `POST /subscriptions/finalize`, `POST /subscriptions/reconcile` | All subscription fields | Success page calls finalize | ✅ OK | Immediate DB sync |
| **2. Change Subscription** | | | | | |
| - Change plan (upgrade/downgrade) | `POST /subscriptions/update` | `planCode`, `planType` | Action buttons | ✅ OK | Immediate by default |
| - Change interval (month↔year) | `POST /subscriptions/switch`, `POST /subscriptions/update` | `interval` | "Switch to Yearly/Monthly" button | ⚠️ FIX NEEDED | Monthly→Yearly should use checkout (requires payment) |
| - Pro Yearly downgrade exception | `POST /subscriptions/update` | `pendingChange*` fields | Status display | ✅ OK | Scheduled at period end |
| - Action labels (Upgrade/Downgrade/Switch) | Action Matrix | - | Plan cards, action buttons | ✅ OK | Computed correctly |
| - Confirmations | ConfirmDialog component | - | All destructive actions | ✅ OK | Implemented |
| **3. Cancel + Resume** | | | | | |
| - Cancel at period end | `POST /subscriptions/cancel` | `cancelAtPeriodEnd: true` | Cancel button | ✅ OK | Professional behavior |
| - Resume before period end | `POST /subscriptions/resume` | `cancelAtPeriodEnd: false` | Resume button | ✅ OK | Available when cancelAtPeriodEnd=true |
| - UI shows effective dates | Status display | `currentPeriodEnd` | Billing page | ✅ OK | "Cancels on DATE" shown |
| - Access until messaging | Status banners | - | Yellow banner | ✅ OK | "You'll keep access until then" |
| **4. Billing Profile + VAT/AFM** | | | | | |
| - In-app billing details form | `PUT /billing/profile` | `ShopBillingProfile` model | `/app/shopify/billing/settings` | ✅ OK | Full form with all fields |
| - Tax ID collection in checkout | `tax_id_collection: { enabled: true }` | - | Stripe Checkout | ✅ OK | Enabled |
| - Tax ID sync to Stripe | `syncStripeCustomerBillingProfile` | `vatNumber`, `vatCountry` | After checkout/portal return | ✅ OK | Idempotent sync |
| - Validations with friendly UX | `validateBillingProfileForCheckout` | - | Billing settings form | ✅ OK | Shows missing fields |
| **5. Invoices/Receipts** | | | | | |
| - List invoices | `GET /billing/invoices` | `InvoiceRecord` (optional) | Billing page invoices section | ✅ OK | Returns hosted_invoice_url, pdfUrl |
| - Hosted invoice + PDF | Stripe API | - | Invoice table "View" links | ✅ OK | Links to Stripe hosted invoice |
| - Responsive table/list | Frontend | - | Billing page | ✅ OK | Table on desktop, list on mobile |
| **6. Stripe Portal** | | | | | |
| - Manage payment method | `GET /subscriptions/portal` | - | "Manage Payment Method" button | ✅ OK | Opens Stripe Billing Portal |
| **7. Reconciliation & Transparency** | | | | | |
| - Status always Stripe-derived | `GET /subscriptions/status` | All fields | Billing page | ✅ OK | Uses StripeSyncService |
| - Manual reconcile endpoint | `POST /subscriptions/reconcile` | All fields | "Refresh Status" button | ✅ OK | Available in UI |
| - Webhooks idempotent | Webhook handlers | `WebhookEvent` table | - | ✅ OK | providerEventId UNIQUE |
| - Webhooks tenant-safe | Webhook handlers | `stripeCustomerId` → `shopId` | - | ✅ OK | Unique mapping |
| - Dev truth snapshot | `_debug` field (dev only) | - | Status DTO | ✅ OK | Shows Stripe vs DB vs DTO |

## Issues Found

### ⚠️ FIX NEEDED: Monthly→Yearly Switch Requires Payment (Checkout Flow)

**Current Behavior**: `POST /subscriptions/switch` or `POST /subscriptions/update` directly updates subscription, which may not handle payment for monthly→yearly upgrade.

**Required Behavior**: Monthly→Yearly switch should:
1. Create a checkout session for the yearly price
2. User pays via Stripe Checkout
3. After payment, subscription is updated to yearly

**Solution**: Implement `POST /subscriptions/change-with-checkout` endpoint that:
- Detects when monthly→yearly switch requires payment
- Creates checkout session for target price
- Stores pending intent
- Webhook/finalize completes the change

## Missing Features

### ❌ Help & Guidance Section
- No help/instructions section on billing page
- Users may not understand:
  - How switching plans works
  - When they're charged
  - Why billing details are needed
  - How to fix payment issues
  - How to get invoices/receipts

**Solution**: Add "Billing Help" accordion or side panel with guided instructions.

