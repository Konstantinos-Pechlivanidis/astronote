# Billing E2E Verification

Run Date: 2026-01-14T23:37:15.812Z

## Prisma Schema Checks
- OK: schema.prisma exists
- OK: User model exists
- OK: User.stripeCustomerId
- OK: User.stripeSubscriptionId
- OK: User.planType
- OK: User.subscriptionStatus
- OK: User.subscriptionInterval
- OK: User.subscriptionCurrentPeriodStart
- OK: User.subscriptionCurrentPeriodEnd
- OK: User.cancelAtPeriodEnd
- OK: User.includedSmsPerPeriod
- OK: User.usedSmsThisPeriod
- OK: User.lastBillingError
- OK: User.billingCurrency
- OK: BillingCurrency enum present
- OK: BillingCurrency includes EUR
- OK: BillingCurrency includes USD
- OK: SubscriptionInterval enum present
- OK: Wallet model exists
- OK: Wallet.ownerId
- OK: Wallet.balance
- OK: CreditTransaction model exists
- OK: CreditTransaction.ownerId
- OK: CreditTransaction.amount
- OK: CreditTransaction.meta
- OK: Package model exists
- OK: Package.stripePriceIdEur
- OK: Package.stripePriceIdUsd
- OK: Package.priceCentsUsd
- OK: Package unique name
- OK: Purchase model exists
- OK: Purchase.units
- OK: Purchase.priceCents
- OK: Purchase.status
- OK: Purchase.stripeSessionId
- OK: Purchase.stripePaymentIntentId
- OK: Purchase.currency
- OK: Purchase.idempotencyKey
- OK: Purchase ownerId+idempotencyKey unique
- OK: WebhookEvent model exists

## Backend Route Checks
- OK: Route present: r.get('/billing/balance'
- OK: Route present: r.get('/billing/wallet'
- OK: Route present: r.get('/billing/summary'
- OK: Route present: r.get('/billing/transactions'
- OK: Route present: r.get('/billing/packages'
- OK: Route present: r.post('/billing/purchase'
- OK: Route present: r.post('/billing/topup'
- OK: Route present: r.get('/subscriptions/portal'
- OK: Route present: r.post('/subscriptions/subscribe'
- OK: Route present: r.post('/subscriptions/update'
- OK: Route present: r.post('/subscriptions/switch'
- OK: Route present: r.post('/subscriptions/cancel'
- OK: Billing routes registered in server
- OK: Stripe webhooks registered in server
- OK: Stripe webhook endpoint present
- OK: Stripe price mapping module exists
- OK: Stripe price mapping has credit topup template
- OK: Stripe price mapping has subscription template
- OK: Stripe price mapping supports USD
- OK: Package seed migration present
- OK: Package seed migration inserts packages
- OK: Billing packages uses resolveBillingCurrency
- OK: Billing packages uses Prisma Package query
- OK: Billing packages ETag guard present
- OK: Stripe customer validation uses cus_ prefix
- OK: Portal uses resolveStripeCustomerId
- OK: Billing balance includes billingCurrency
- OK: Purchase route checks Idempotency-Key
- OK: Campaign enqueue uses SUBSCRIPTION_REQUIRED
- OK: Campaign enqueue checks allowance

## Frontend Checks
- OK: Retail billing page exists
- OK: Billing page uses billingApi.getSummary
- OK: Billing page uses billingApi.getPackages
- OK: Billing page uses billingApi.purchase
- OK: Billing page uses billingApi.topup
- OK: Billing page uses billingApi.calculateTopup
- OK: Billing page uses subscriptionsApi.getPortal
- OK: Billing page uses subscriptionsApi.switch
- OK: Billing page uses subscriptionsApi.cancel
- OK: Billing page passes selectedCurrency
- OK: Billing page passes currency to packages
- OK: Billing page passes currency to purchase
- OK: Billing page passes currency to topup
- OK: Billing page passes currency to subscribe
- OK: Endpoints include /api/billing/balance
- OK: Endpoints include /api/billing/summary
- OK: Endpoints include /api/billing/packages
- OK: Endpoints include /api/billing/purchase
- OK: Endpoints include /api/billing/topup
- OK: Endpoints include /api/billing/topup/calculate
- OK: Endpoints include /api/subscriptions/portal
- OK: Endpoints include /api/subscriptions/switch

## Env Var Checks
- OK: Env file exists: .env.example
- OK: .env.example includes STRIPE_PRICE_ID_CREDIT_TOPUP_EUR
- OK: .env.example includes STRIPE_PRICE_ID_CREDIT_TOPUP_USD
- OK: .env.example includes STRIPE_PRICE_ID_SUB_STARTER_EUR
- OK: .env.example includes STRIPE_PRICE_ID_SUB_STARTER_USD
- OK: .env.example includes STRIPE_PRICE_ID_SUB_PRO_EUR
- OK: .env.example includes STRIPE_PRICE_ID_SUB_PRO_USD

## Placeholder Scan
- OK: No dev_customer_ placeholders in code

## Tenant Scoping Scan (Best-Effort)
- OK: Billing routes reference req.user.id for tenant scoping

## Summary
- Issues: 0
- All checks passed