# Repository Map

**Generated**: 2025-01-XX  
**Purpose**: Complete architectural overview of the Astronote Shopify Backend

## 1. Entry Points & Bootstrap

### Server Bootstrap
- **`index.js`**: Main entry point
  - Loads environment variables via `dotenv`
  - Validates environment on startup
  - Starts Express server
  - Initializes BullMQ worker
  - Starts periodic schedulers (delivery status updates, scheduled campaigns, birthday automations, event poller)
  - Graceful shutdown handlers (SIGTERM, SIGINT, uncaught exceptions)

- **`app.js`**: Express application setup
  - Security middleware (helmet, CORS, HPP, compression)
  - Request processing (request ID, performance monitoring, sanitization)
  - API versioning middleware
  - Body parsing with raw body preservation for webhooks
  - Route mounting
  - Global error handlers

### Runtime Environment
- **Node.js**: >=18.0.0 (ES modules)
- **Framework**: Express.js 4.18.2
- **Database**: PostgreSQL (via Prisma ORM)
- **Queue System**: BullMQ 4.15.4 (Redis-backed)
- **Cache**: Redis (ioredis 5.3.2)
- **Auth Strategy**: JWT tokens (jsonwebtoken 9.0.2) + Shopify session tokens

## 2. Route Structure

All routes are mounted in `app.js` with appropriate middleware.

### Public Routes (No Authentication)
- **`/`** (core.js): Health checks, metrics
- **`/health`**, **`/health/config`**, **`/health/full`**: Health endpoints
- **`/metrics`**: Prometheus/metrics export
- **`/public/packages`**: Public pricing packages
- **`/public/contact`**: Public contact form
- **`/webhooks/app_uninstalled`**: Shopify app uninstall webhook
- **`/unsubscribe/:token`**: Public unsubscribe endpoint
- **`/api/opt-in`**: Public opt-in endpoint
- **`/mitto/*`**: Mitto webhook endpoints (no auth, HMAC validated)

### Authentication Routes (`/auth`)
- **POST `/auth/shopify-token`**: Exchange Shopify session token for app JWT
- **GET `/auth/shopify?shop=<domain>`**: Initiate Shopify OAuth flow
- **GET `/auth/callback`**: Handle Shopify OAuth callback
- **GET `/auth/verify`**: Verify app JWT token
- **POST `/auth/refresh`**: Refresh app JWT token

### Store-Scoped Routes (Require `resolveStore` + `requireStore`)

#### Dashboard (`/dashboard`)
- **GET `/dashboard`**: Dashboard stats and overview

#### Contacts (`/contacts`)
- **GET `/contacts`**: List contacts (pagination, filtering, search)
- **GET `/contacts/stats`**: Contact statistics
- **GET `/contacts/birthdays`**: Contacts with birthdays
- **GET `/contacts/:id`**: Get single contact
- **POST `/contacts`**: Create contact
- **POST `/contacts/import`**: Import contacts from CSV
- **PUT `/contacts/:id`**: Update contact
- **DELETE `/contacts/:id`**: Delete contact

#### Campaigns (`/campaigns`)
- **GET `/campaigns`**: List campaigns (filtering, pagination)
- **GET `/campaigns/stats/summary`**: Campaign statistics
- **GET `/campaigns/queue/stats`**: Queue statistics
- **GET `/campaigns/:id`**: Get single campaign
- **POST `/campaigns`**: Create campaign
- **PUT `/campaigns/:id`**: Update campaign
- **DELETE `/campaigns/:id`**: Delete campaign
- **POST `/campaigns/:id/prepare`**: Prepare campaign for sending
- **POST `/campaigns/:id/enqueue`**: Enqueue campaign for bulk SMS
- **POST `/campaigns/:id/send`**: Send campaign immediately (deprecated, uses enqueue)
- **PUT `/campaigns/:id/schedule`**: Schedule campaign
- **POST `/campaigns/:id/cancel`**: Cancel sending campaign
- **GET `/campaigns/:id/metrics`**: Get campaign metrics
- **GET `/campaigns/:id/status`**: Get campaign status
- **GET `/campaigns/:id/preview`**: Get campaign preview
- **GET `/campaigns/:id/progress`**: Get campaign progress
- **GET `/campaigns/:id/failed-recipients`**: Get failed recipients
- **POST `/campaigns/:id/retry-failed`**: Retry failed SMS
- **POST `/campaigns/:id/update-status`**: Manually trigger delivery status update

#### Automations (`/automations`)
- **GET `/automations`**: Get user automations
- **POST `/automations`**: Create user automation
- **GET `/automations/stats`**: Get automation statistics
- **GET `/automations/variables/:triggerType`**: Get available variables
- **PUT `/automations/:id`**: Update user automation
- **DELETE `/automations/:id`**: Delete user automation
- **GET `/automations/defaults`**: Get system default automations
- **POST `/automations/sync`**: Sync system defaults

#### Reports (`/reports`)
- Various reporting endpoints (see routes/reports.js)

#### Discounts (`/discounts`)
- Discount link management endpoints

#### Billing (`/billing`)
- **GET `/billing/balance`**: Get credit balance
- **GET `/billing/packages`**: Get available credit packages
- **GET `/billing/topup/calculate`**: Calculate top-up price
- **POST `/billing/topup`**: Create top-up checkout session
- **GET `/billing/history`**: Get transaction history
- **GET `/billing/billing-history`**: Get billing history (Stripe)
- **POST `/billing/purchase`**: Create Stripe checkout session

#### Subscriptions (`/subscriptions`)
- Subscription management endpoints

#### Settings (`/settings`)
- Shop settings management

#### Audiences (`/audiences`)
- Segment/audience management

#### Templates (`/templates`)
- Template management (with store context for tracking)

#### Tracking (`/tracking`)
- **GET `/tracking/mitto/:messageId`**: Get Mitto message status
- **GET `/tracking/campaign/:campaignId`**: Get campaign delivery status
- **POST `/tracking/bulk-update`**: Bulk update delivery status

#### Shopify (`/shopify`)
- Shopify integration endpoints

### Webhook Routes (HMAC Validated, No Store Context)
- **`/automation-webhooks/*`**: Automation webhooks (Shopify events)
- **`/webhooks/stripe`**: Stripe webhooks

### Admin Routes
- **`/admin/templates`**: Admin template management

## 3. Controllers

Controllers handle request/response logic and delegate to services:

- `admin-templates.js`: Admin template management
- `audiences.js`: Audience/segment management
- `automation-webhooks.js`: Automation webhook handlers
- `automations.js`: Automation CRUD
- `billing.js`: Billing and credit management
- `campaigns.js`: Campaign CRUD and sending
- `contact.js`: Public contact form
- `contacts-enhanced.js`: Enhanced contact management
- `dashboard.js`: Dashboard data aggregation
- `discounts.js`: Discount link management
- `mitto-status.js`: Mitto status refresh
- `mitto.js`: Mitto webhook handlers
- `opt-in.js`: Public opt-in handler
- `reports.js`: Reporting endpoints
- `settings.js`: Shop settings management
- `stripe-webhooks.js`: Stripe webhook handlers
- `subscriptions.js`: Subscription management
- `templates.js`: Template management
- `tracking.js`: Delivery tracking
- `unsubscribe.js`: Unsubscribe processing

## 4. Services

Business logic layer:

- `auth.js`: JWT token generation/verification, Shopify session token verification
- `automation-scheduler.js`: Automation scheduling logic
- `automation-variables.js`: Template variable processing
- `automations.js`: Automation execution
- `billing.js`: Credit packages, Stripe integration
- `campaignAggregates.js`: Campaign metrics aggregation
- `campaigns.js`: Campaign business logic (enqueue, send, metrics)
- `contacts.js`: Contact business logic
- `credit-validation.js`: Credit reservation/debit/refund logic
- `dashboard.js`: Dashboard data aggregation
- `delivery-status.js`: Delivery status updates from Mitto
- `event-automation-mapper.js`: Map Shopify events to automations
- `event-deduplication.js`: Prevent duplicate event processing
- `mitto-status.js`: Mitto status refresh
- `mitto.js`: Mitto SMS API client
- `post-purchase-series.js`: Post-purchase automation sequences
- `product-recommendations.js`: Product recommendation logic
- `prisma.js`: Prisma client singleton
- `rateLimiter.js`: Rate limiting logic
- `reports-cache.js`: Report caching
- `reports.js`: Report generation
- `scheduler.js`: Periodic task scheduling
- `settings.js`: Settings management
- `shopify-events.js`: Shopify event processing
- `shopify-graphql.js`: Shopify GraphQL client
- `shopify.js`: Shopify API client
- `smsBulk.js`: Bulk SMS sending via Mitto
- `stripe.js`: Stripe payment processing
- `subscription.js`: Subscription management
- `templates.js`: Template management
- `tracking.js`: Click tracking
- `wallet.js`: Credit wallet management
- `webhook-registration.js`: Shopify webhook registration

## 5. Workers & Queues

### Queue System (BullMQ)
- **`queue/index.js`**: Queue initialization (smsQueue)
- **`queue/worker.js`**: BullMQ worker that processes jobs
- **`queue/jobs/automationTriggers.js`**: Automation trigger jobs
- **`queue/jobs/bulkSms.js`**: Bulk SMS sending jobs
- **`queue/jobs/campaignSend.js`**: Campaign send jobs
- **`queue/jobs/deliveryStatusUpdate.js`**: Delivery status update jobs
- **`queue/jobs/mittoSend.js`**: Individual Mitto send jobs

### Background Workers
- **`workers/event-poller.js`**: Polls Shopify for events (orders, checkouts, etc.)

## 6. Middleware

- **`store-resolution.js`**: Resolves shop/store context from JWT, headers, or query params
- **`shopify-webhook.js`**: Validates Shopify webhook HMAC signatures
- **`security.js`**: Request sanitization, content-type validation, size limits
- **`validation.js`**: Zod schema validation
- **`versioning.js`**: API versioning support
- **`rateLimits.js`**: Rate limiting middleware
- **`cache.js`**: Response caching middleware
- **`database-rate-limit.js`**: Database-backed rate limiting

## 7. Database Schema (Prisma)

### Core Models
- **Shop**: Store/tenant information, credits, subscription status
- **Contact**: Customer contacts with phone, email, consent, purchase history
- **Segment**: Audience segments with rule-based membership
- **Campaign**: SMS campaigns with status, schedule, priority
- **CampaignRecipient**: Individual recipient records with delivery status
- **CampaignMetrics**: Aggregated campaign metrics
- **MessageLog**: All SMS messages sent/received
- **ClickEvent**: Link click tracking

### Billing Models
- **Wallet**: Credit wallet per shop
- **CreditTransaction**: Credit debit/credit/refund transactions
- **CreditReservation**: Reserved credits for campaigns
- **BillingTransaction**: Stripe billing transactions
- **Purchase**: Credit package purchases
- **Package**: Available credit packages
- **SmsPackage**: Legacy package model

### Automation Models
- **Automation**: System default automations
- **UserAutomation**: Shop-specific automation configurations
- **AutomationLog**: Automation execution logs
- **AbandonedCheckout**: Abandoned cart tracking
- **ScheduledAutomation**: Scheduled automation jobs
- **AutomationSequence**: Multi-step automation sequences
- **EventProcessingState**: Event deduplication state

### Other Models
- **Template**: SMS message templates
- **TemplateUsage**: Template usage tracking
- **DiscountLink**: Discount code links
- **ShopSettings**: Shop-specific settings
- **ShopifySession**: Shopify OAuth sessions
- **QueueJob**: Queue job tracking (optional)
- **RateLimitRecord**: Rate limit tracking

## 8. Configuration Files

- **`config/env-validation.js`**: Environment variable validation
- **`config/security.js`**: Security middleware configs
- **`config/redis.js`**: Redis connection configuration
- **`config/development.js`**: Development-specific configs
- **`config/production.js`**: Production-specific configs

## 9. Utilities

- **`utils/logger.js`**: Winston logger with file rotation
- **`utils/errors.js`**: Custom error classes and global error handler
- **`utils/response.js`**: Standardized response helpers
- **`utils/cache.js`**: Cache manager (Redis-backed)
- **`utils/metrics.js`**: Application metrics collection
- **`utils/frontendUrl.js`**: Frontend URL generation helpers
- **`utils/unsubscribe.js`**: Unsubscribe token generation/verification
- **`utils/urlShortener.js`**: URL shortening (custom/bitly/tinyurl)
- **`utils/personalization.js`**: Message personalization
- **`utils/store-scoping.js`**: Store scoping helpers
- **`utils/prismaEnums.js`**: Prisma enum helpers
- **`utils/enumValidation.js`**: Enum validation

## 10. Validation Schemas (Zod)

- **`schemas/automations.schema.js`**: Automation validation
- **`schemas/billing.schema.js`**: Billing validation
- **`schemas/campaigns.schema.js`**: Campaign validation
- **`schemas/contacts.schema.js`**: Contact validation
- **`schemas/opt-in.schema.js`**: Opt-in validation
- **`schemas/subscription.schema.js`**: Subscription validation

## 11. Environment Variables

### Database
- `DATABASE_URL`: PostgreSQL connection string
- `DIRECT_URL`: Direct database connection (for migrations)

### Redis
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_TLS`: Redis connection
- `REDIS_URL`: Alternative Redis connection string

### Shopify
- `SHOPIFY_API_KEY`: Shopify app API key
- `SHOPIFY_API_SECRET`: Shopify app secret
- `SCOPES`: Comma-separated Shopify scopes
- `HOST`: Backend base URL (for OAuth callbacks)

### Mitto SMS
- `MITTO_API_BASE`: Mitto API base URL
- `MITTO_API_KEY`: Mitto API key
- `MITTO_TRAFFIC_ACCOUNT_ID`: Traffic account ID
- `MITTO_SENDER_NAME`: Default sender name
- `MITTO_SENDER_NUMBER`: Default sender number
- `MITTO_WEBHOOK_SECRET`: Webhook secret

### Stripe
- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret
- `STRIPE_PRICE_ID_*_EUR`: Stripe price IDs for EUR packages
- `STRIPE_PRICE_ID_*_USD`: Stripe price IDs for USD packages
- `STRIPE_PRICE_ID_SUB_STARTER_EUR`: Starter subscription price
- `STRIPE_PRICE_ID_SUB_PRO_EUR`: Pro subscription price

### Application
- `NODE_ENV`: Environment (production/development/test)
- `PORT`: Server port (default: 8080)
- `JWT_SECRET`: JWT signing secret
- `SESSION_SECRET`: Session secret
- `API_KEY`: Optional API key for external auth
- `ALLOWED_ORIGINS`: Comma-separated allowed CORS origins
- `FRONTEND_URL`: Frontend base URL
- `WEB_APP_URL`: Web app URL (for OAuth redirects)

### URL Shortening
- `URL_SHORTENER_TYPE`: custom/bitly/tinyurl/none
- `URL_SHORTENER_BASE_URL`: Base URL for custom shortener
- `BITLY_API_TOKEN`: Bitly API token
- `TINYURL_API_KEY`: TinyURL API key

### Logging & Monitoring
- `LOG_LEVEL`: Log level (info/debug/warn/error)
- `LOG_DIR`: Log directory
- `SENTRY_DSN`: Sentry DSN (optional)

### Feature Flags
- `EVENT_POLLING_ENABLED`: Enable/disable event polling
- `EVENT_POLLING_INTERVAL`: Event polling interval (seconds)
- `RUN_SCHEDULER`: Enable/disable scheduler
- `SMS_BATCH_SIZE`: Batch size for SMS sending

### Rate Limiting
- `RATE_LIMIT_TRAFFIC_ACCOUNT_MAX`: Traffic account rate limit
- `RATE_LIMIT_TENANT_MAX`: Tenant rate limit
- `RATE_LIMIT_GLOBAL_MAX`: Global rate limit

## 12. Public Endpoints Summary

### No Authentication Required
- Health checks (`/`, `/health`, `/health/config`, `/health/full`)
- Metrics (`/metrics`)
- Public packages (`/public/packages`)
- Public contact form (`/public/contact`)
- Unsubscribe (`/unsubscribe/:token`)
- Opt-in (`/api/opt-in`)
- Mitto webhooks (`/mitto/*`)
- Shopify app uninstall webhook (`/webhooks/app_uninstalled`)

### Authentication Required (JWT or Shopify Session Token)
- All `/dashboard`, `/contacts`, `/campaigns`, `/automations`, `/reports`, `/billing`, `/subscriptions`, `/settings`, `/audiences`, `/templates`, `/tracking`, `/shopify` routes
- All routes use `resolveStore` + `requireStore` middleware for tenant isolation

## 13. Webhook Endpoints

### Shopify Webhooks
- **`/webhooks/app_uninstalled`**: App uninstall (HMAC validated)
- **`/automation-webhooks/*`**: Automation triggers (HMAC validated)

### Stripe Webhooks
- **`/webhooks/stripe`**: Payment events (signature validated)

### Mitto Webhooks
- **`/mitto/*`**: Delivery status updates (HMAC validated)

## 14. Security Architecture

### Authentication Flow
1. **Shopify Extension**: Uses Shopify App Bridge session token → exchanged for app JWT
2. **Web App**: Uses Shopify OAuth → receives app JWT
3. **API Requests**: Bearer token in Authorization header

### Tenant Isolation
- All store-scoped routes use `resolveStore` middleware
- Database queries filtered by `shopId` at Prisma level
- No cross-shop data access possible

### Webhook Security
- Shopify: HMAC-SHA256 validation
- Stripe: Signature validation
- Mitto: HMAC validation

### Rate Limiting
- General API: 1000 requests per 15 minutes
- Auth endpoints: 5 requests per 15 minutes
- SMS sending: 10 requests per minute
- Webhooks: 100 requests per minute
- Per-route rate limits via `rateLimits.js`

## 15. Queue Architecture

### Queue Names
- `sms`: SMS sending queue

### Job Types
- `bulkSms`: Bulk SMS sending
- `campaignSend`: Campaign send job
- `automationTrigger`: Automation trigger job
- `deliveryStatusUpdate`: Delivery status update
- `mittoSend`: Individual Mitto send

### Worker Configuration
- Automatic retry with exponential backoff
- Job deduplication via job IDs
- Dead letter queue for failed jobs

## 16. Scheduled Tasks

- **Delivery Status Updates**: Periodic polling of Mitto for delivery status
- **Scheduled Campaigns**: Process campaigns scheduled for future send
- **Birthday Automations**: Daily check for birthday automations
- **Event Poller**: Polls Shopify for new events (orders, checkouts, etc.)

