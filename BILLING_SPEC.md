# Shopify Billing System - Professional Specification

## Supported Plans & Pricing

### Plans
- **Starter**: Entry-level plan
- **Pro**: Professional plan

### Intervals
- **Monthly**: Billed every month
- **Yearly**: Billed once per year (saves ~50% vs monthly)

### Currencies
- **EUR**: Euro (primary)
- **USD**: US Dollar

### Plan Details
| Plan | Monthly (EUR) | Yearly (EUR) | Included SMS/Period |
|------|---------------|--------------|---------------------|
| Starter | €40/month | €240/year | 100 SMS/month or 1200 SMS/year |
| Pro | €80/month | €480/year | 500 SMS/month or 6000 SMS/year |

## User Actions

### 1. Subscribe
- **Action**: Create new subscription
- **Input**: `{ planCode: 'starter' | 'pro', interval: 'month' | 'year', currency: 'EUR' | 'USD' }`
- **Behavior**: 
  - Creates Stripe Checkout session
  - Collects billing details (email, address, VAT) during checkout
  - After payment, activates subscription and allocates free credits
- **Validation**: Billing profile must be complete (email, legal name, country, address) OR collected during checkout

### 2. Switch Monthly/Yearly
- **Action**: Change billing interval (keeps same plan)
- **Input**: `{ interval: 'month' | 'year' }`
- **Behavior**: 
  - **Scheduled at period end** (no proration surprises)
  - Stores pending change in DB
  - Updates Stripe subscription schedule
  - UI shows "Scheduled: Will switch to [Interval] on [DATE]"
- **Validation**: Must have active subscription

### 3. Upgrade/Downgrade Plan
- **Action**: Change plan (keeps same interval)
- **Input**: `{ planCode: 'starter' | 'pro' }`
- **Behavior**:
  - **Upgrade**: Immediate with proration
  - **Downgrade**: Scheduled at period end
  - Stores pending change if scheduled
- **Validation**: Must have active subscription

### 4. Cancel Subscription
- **Action**: Cancel at period end
- **Input**: None
- **Behavior**:
  - Sets `cancel_at_period_end: true` in Stripe
  - Keeps status as 'active' until period ends
  - User retains access until paid period ends
  - UI shows "Cancels on [DATE] (access until then)"
  - Status changes to 'cancelled' via webhook when period ends
- **Validation**: Must have active subscription

### 5. Resume Subscription (Optional)
- **Action**: Undo cancellation
- **Input**: None
- **Behavior**:
  - Sets `cancel_at_period_end: false` in Stripe
  - Removes cancellation flag from DB
  - Subscription continues normally
- **Validation**: Must have `cancelAtPeriodEnd: true`

### 6. Manage Payment Method
- **Action**: Open Stripe Customer Portal
- **Input**: None
- **Behavior**: Opens Stripe portal in new tab for payment method management
- **Validation**: Must have Stripe customer ID

### 7. Refresh Status (Reconcile)
- **Action**: Manual sync from Stripe
- **Input**: None
- **Behavior**:
  - Fetches current subscription from Stripe
  - Derives planCode/interval/currency from priceId (reverse lookup)
  - Updates DB to match Stripe truth
  - Returns updated status DTO
- **Use Case**: Recovery for missed webhooks or manual verification

## Behavior Rules

### Upgrade (to higher plan)
- **Behavior**: Immediate with proration
- **Reason**: User gets immediate access to higher tier features
- **Stripe**: `proration_behavior: 'always_invoice'`

### Downgrade (to lower plan)
- **Behavior**: Scheduled at period end
- **Reason**: User keeps access to current tier until paid period ends
- **Stripe**: `proration_behavior: 'none'`, scheduled for `current_period_end`

### Interval Switch (month ↔ year)
- **Behavior**: Scheduled at period end
- **Reason**: No proration surprises, clean transition
- **Stripe**: Updates priceId, scheduled for `current_period_end`

### Cancel
- **Behavior**: Cancel at period end (`cancel_at_period_end: true`)
- **Reason**: User keeps access until paid period ends (professional behavior)
- **Stripe**: Sets `cancel_at_period_end: true`, status remains 'active' until period ends

## Validation Rules

### Billing Profile Completeness
**Required Fields:**
- `billingEmail`: Valid email address
- `legalName`: Company or individual name
- `country`: ISO country code
- `addressLine1`: Street address

**Optional but Recommended:**
- `addressLine2`: Additional address info
- `city`: City name
- `postalCode`: Postal/ZIP code
- `vatNumber`: VAT/AFM number (required for Greek businesses)
- `vatCountry`: VAT country (defaults to country)

### VAT/AFM Rules
- **Greek Businesses**: VAT number (AFM) is required if `isBusiness: true` and `country: 'GR'`
- **Other EU Businesses**: VAT number optional but recommended for reverse charge
- **Non-EU**: VAT number optional

### Checkout Validation
- If billing profile incomplete: Block checkout, redirect to billing settings
- OR: Allow checkout to collect details, then sync back to Prisma after completion

## UI Display Requirements

### Subscription Summary Card
**Must Show:**
1. **Status Badge**: 
   - "Active" (green)
   - "Trial" (blue)
   - "Past Due" (yellow)
   - "Cancels on [DATE]" (yellow, if `cancelAtPeriodEnd: true`)
   - "Scheduled: switches on [DATE]" (blue, if `pendingChange` exists)

2. **Plan Title**: 
   - Format: "[Plan] Plan — [Interval]"
   - Example: "Pro Plan — Yearly" or "Starter Plan — Monthly"

3. **Price**: 
   - Format: "€X / [interval]"
   - Example: "€240 / year" or "€40 / month"

4. **SMS Allowance**:
   - "Included: X SMS per [period]"
   - "Used this period: X SMS"
   - "Remaining: X SMS"
   - "Resets on: [DATE]"

5. **Billing Period**:
   - "Renews on: [DATE]" (if active)
   - "Cancels on: [DATE]" (if `cancelAtPeriodEnd: true`)
   - "Scheduled: Will switch to [Plan] — [Interval] on [DATE]" (if `pendingChange` exists)

### Actions Area
**Show Only Valid Actions:**
- If `interval === 'month'`: Show "Switch to Yearly" button
- If `interval === 'year'`: Show "Switch to Monthly" button
- If `planCode === 'starter'`: Show "Upgrade to Pro" button
- If `planCode === 'pro'`: Show "Downgrade to Starter" button (if supported)
- If `cancelAtPeriodEnd === false`: Show "Cancel Subscription" button
- If `cancelAtPeriodEnd === true`: Show "Resume Subscription" button
- Always show: "Manage Payment Method" and "Refresh Status" buttons

### Plan Selection UI
**Each Plan Card Must Show:**
- Plan name (Starter/Pro)
- Price for selected interval (monthly/yearly toggle)
- Included SMS per period
- Clear action button: "Subscribe" / "Upgrade" / "Downgrade" / "Current Plan"
- Helper text: "Change takes effect on [DATE]" if scheduled

### Billing Details UI
**Form Fields:**
- Email (required)
- Legal Name (required)
- Country (required, dropdown)
- Address Line 1 (required)
- Address Line 2 (optional)
- City (optional but recommended)
- Postal Code (optional but recommended)
- VAT/AFM Number (optional, required for Greek businesses)
- Is Business (checkbox)

**Validation Messages:**
- Clear indication of missing required fields
- Explanation: "Billing details are required to generate invoices and calculate VAT"

**Actions:**
- "Save" button
- "Sync from Stripe" button (optional, syncs customer details from Stripe)

### Invoices UI
**Table Columns:**
- Date (issued date)
- Invoice Number
- Amount (with currency)
- Status (paid/unpaid/past_due)
- Actions: "View" (opens hosted invoice URL) and "Download PDF"

**Empty State:**
- "No invoices yet"
- "Invoices will appear here after successful subscription payments"

## Data Flow & Sync

### Stripe → DB Sync
1. **Primary**: Webhooks (idempotent)
   - `checkout.session.completed` → Activate subscription
   - `customer.subscription.updated` → Update subscription state
   - `customer.subscription.deleted` → Deactivate subscription
   - `invoice.paid` → Record invoice, allocate credits

2. **Fallback**: Reconcile endpoint
   - Manual sync from Stripe
   - Derives planCode/interval/currency from priceId reverse lookup
   - Updates DB to match Stripe truth

3. **Finalize**: After checkout success
   - Retrieves checkout session from Stripe
   - Activates subscription
   - Syncs billing profile from Stripe customer

### DB → DTO → UI
1. **Backend**: `getSubscriptionStatus()` derives canonical fields from:
   - Stripe subscription (source of truth)
   - DB Subscription record (pending changes)
   - DB Shop record (legacy fields)

2. **Frontend**: React Query caches status DTO
   - Invalidates after mutations (subscribe/switch/cancel)
   - Refreshes automatically after actions

### Truth Priority
1. **Stripe** (source of truth)
2. **DB Subscription record** (pending changes, last synced)
3. **DB Shop record** (legacy fallback)

## Error Handling

### Validation Errors
- **BILLING_PROFILE_INCOMPLETE**: Missing required billing fields
  - Response: `{ code: 'BILLING_PROFILE_INCOMPLETE', missingFields: [...] }`
  - UI: Redirect to billing settings, show missing fields

### Configuration Errors
- **CONFIG_ERROR**: Missing Stripe price ID mapping
  - Response: `{ code: 'CONFIG_ERROR', message: 'Missing env var: STRIPE_PRICE_ID_SUB_STARTER_YEAR_EUR' }`
  - UI: Show error message, contact support

### Stripe Errors
- **STRIPE_ERROR**: Stripe API error
  - Response: `{ code: 'STRIPE_ERROR', message: '...', stripeErrorCode: '...' }`
  - UI: Show user-friendly message, log details server-side

## Security & Tenant Isolation

### Tenant Resolution
- All endpoints resolve `shopId` from `X-Shopify-Shop-Domain` header
- Webhooks resolve `shopId` from `stripeCustomerId` unique mapping
- If shopId cannot be resolved: Store event as unmatched, do not mutate

### Data Isolation
- All queries scoped by `shopId`
- Stripe customer ID must be unique per shop
- Webhook events stored with `shopId` for audit

## Observability

### Logging
- Log all billing actions (subscribe/switch/cancel) with shopId
- Log Stripe errors with error code/type (never log secrets)
- Log mismatch detection when DB differs from Stripe

### Metrics (Optional)
- Subscription activations
- Cancellations
- Upgrades/downgrades
- Interval switches
- Invoice payments

