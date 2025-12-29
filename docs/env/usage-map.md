# Environment Variable Usage Map

## Overview
This document maps all environment variables used across the monorepo, showing where each key is used.

## Frontend (apps/web)

### VITE_SHOPIFY_API_BASE_URL
- **Files:**
  - `apps/web/src/api/axiosClient.js` - Base URL for API requests
- **Usage:** Frontend API client base URL
- **Type:** VITE_ prefix (build-time)

### import.meta.env.DEV
- **Files:**
  - `apps/web/src/app/providers.jsx` - Conditional React Query DevTools
- **Usage:** Development mode detection (Vite built-in)

---

## Retail API (apps/retail-api)

### Core Application
- **NODE_ENV** - Environment mode (development/production/test)
- **PORT** - Server port (default: 3001)

### Database
- **DATABASE_URL** - Primary database connection (Neon pooled)
- **DIRECT_DATABASE_URL** - Direct connection for migrations (Neon direct)

### Redis
- **REDIS_HOST** - Redis hostname
- **REDIS_PORT** - Redis port
- **REDIS_USERNAME** - Redis username
- **REDIS_PASSWORD** - Redis password
- **REDIS_DB** - Redis database number
- **REDIS_TLS** - Enable TLS (true/false)
- **REDIS_URL** - Fallback Redis connection string

### JWT
- **JWT_SECRET** - JWT signing secret (min 24 chars)
- **JWT_ACCESS_TTL** - Access token TTL (default: 15m)
- **JWT_REFRESH_TTL** - Refresh token TTL (default: 30d)

### CORS & Frontend URLs
- **CORS_ALLOWLIST** - Comma-separated allowed origins
- **FRONTEND_URL** - Main frontend URL
- **FRONTEND_BASE_URL** - Frontend base URL override
- **APP_PUBLIC_BASE_URL** - Public base URL for links (default: http://localhost:5173)
- **APP_URL** - App URL (legacy)
- **UNSUBSCRIBE_BASE_URL** - Unsubscribe endpoint base URL
- **OFFER_BASE_URL** - Offer links base URL
- **API_URL** - API base URL override
- **API_BASE_URL** - API base URL (alternative)

### Mitto SMS
- **MITTO_API_BASE** - Mitto API base URL (default: https://messaging.mittoapi.com)
- **MITTO_API_KEY** - Mitto API key (required)
- **MITTO_SENDER** - Default sender name/number
- **SMS_TRAFFIC_ACCOUNT_ID** - Traffic account ID
- **MITTO_TRAFFIC_ACCOUNT_ID** - Traffic account ID (alias)

### Stripe
- **STRIPE_SECRET_KEY** - Stripe secret key (starts with sk_)
- **STRIPE_WEBHOOK_SECRET** - Stripe webhook secret (starts with whsec_)

### Queue Configuration
- **QUEUE_DISABLED** - Disable queues (1/true)
- **QUEUE_ATTEMPTS** - Max retry attempts (default: 5)
- **QUEUE_BACKOFF_MS** - Backoff delay (default: 3000)
- **QUEUE_RATE_MAX** - Rate limit max (default: 20)
- **QUEUE_RATE_DURATION_MS** - Rate limit window (default: 1000)
- **WORKER_CONCURRENCY** - SMS worker concurrency (default: 5)
- **SCHEDULER_CONCURRENCY** - Scheduler concurrency (default: 2)
- **CONTACT_IMPORT_CONCURRENCY** - Import concurrency (default: 1)
- **STATUS_REFRESH_CONCURRENCY** - Status refresh concurrency (default: 1)

### Worker Configuration
- **START_WORKER** - Start worker on server (default: 1)
- **STATUS_REFRESH_ENABLED** - Enable status refresh (default: 1)
- **STATUS_REFRESH_INTERVAL** - Status refresh interval ms (default: 600000)
- **RUN_BIRTHDAY_ON_START** - Run birthday automation on start (1/true)

### Rate Limiting
- **RATE_LIMIT_TRAFFIC_ACCOUNT_MAX** - Traffic account limit (default: 100)
- **RATE_LIMIT_TRAFFIC_ACCOUNT_WINDOW_MS** - Traffic account window (default: 1000)
- **RATE_LIMIT_TENANT_MAX** - Tenant limit (default: 50)
- **RATE_LIMIT_TENANT_WINDOW_MS** - Tenant window (default: 1000)
- **RATE_LIMIT_GLOBAL_MAX** - Global limit (default: 200)
- **RATE_LIMIT_GLOBAL_WINDOW_MS** - Global window (default: 1000)

### URL Shortener
- **URL_SHORTENER_TYPE** - Type: custom/bitly/tinyurl/none (default: custom)
- **URL_SHORTENER_BASE_URL** - Shortener base URL
- **BITLY_API_TOKEN** - Bitly API token
- **TINYURL_API_KEY** - TinyURL API key

### Other
- **SYSTEM_USER_ID** - System user ID (default: 1)
- **UNSUBSCRIBE_TOKEN_SECRET** - Unsubscribe token secret
- **UNSUBSCRIBE_CONFIRMATION_ENABLED** - Enable confirmation (1/true)
- **WEBHOOK_SECRET** - Webhook secret
- **ALLOW_BILLING_SEED** - Allow billing seed (1/true)
- **PII_RETENTION_DAYS** - PII retention days (default: 90)
- **PII_RETENTION_ENABLED** - Enable PII retention (1/true)
- **SMS_BATCH_SIZE** - SMS batch size (default: 5000)
- **DOCS_PORT** - Docs server port (default: 3002)
- **NODE_PATH** - Node path override

---

## Retail Worker (apps/retail-worker)

### Shared with Retail API
Worker uses same env as retail-api (via `DOTENV_CONFIG_PATH=../.env`):
- All database, Redis, JWT, Mitto, Stripe variables
- Queue configuration variables
- Worker configuration variables

### Worker-Specific
- **QUEUE_DISABLED** - Disable queues (1/true)
- **WORKER_CONCURRENCY** - SMS worker concurrency
- **SCHEDULER_CONCURRENCY** - Scheduler concurrency
- **CONTACT_IMPORT_CONCURRENCY** - Import concurrency
- **STATUS_REFRESH_CONCURRENCY** - Status refresh concurrency
- **DELIVERY_STATUS_POLLER_CONCURRENCY** - Poller concurrency
- **WATCHDOG_CONCURRENCY** - Watchdog concurrency
- **STUCK_SENDING_MINUTES** - Stuck sending threshold (default: 10)
- **STUCK_LOCKED_MINUTES** - Stuck locked threshold (default: 5)
- **RUN_BIRTHDAY_ON_START** - Run birthday on start (1/true)
- **RUN_PII_RETENTION_ON_START** - Run PII retention on start (1/true)

---

## Shopify API (apps/shopify-api)

### Core Application
- **NODE_ENV** - Environment mode
- **PORT** - Server port (default: 8080)
- **LOG_LEVEL** - Log level (info/debug/warn/error)
- **LOG_DIR** - Log directory (default: ./logs)

### Database
- **DATABASE_URL** - Primary database connection (Neon pooled)
- **DIRECT_URL** - Direct connection for migrations (Neon direct)

### Redis
- **REDIS_HOST** - Redis hostname
- **REDIS_PORT** - Redis port
- **REDIS_USERNAME** - Redis username
- **REDIS_PASSWORD** - Redis password
- **REDIS_TLS** - Enable TLS (true/false)
- **REDIS_URL** - Fallback Redis connection string

### Shopify
- **SHOPIFY_API_KEY** - Shopify API key
- **SHOPIFY_API_SECRET** - Shopify API secret
- **SCOPES** - Comma-separated OAuth scopes
- **HOST** - Backend public URL (for OAuth/webhooks)
- **SESSION_SECRET** - Session secret

### CORS & Frontend URLs
- **ALLOWED_ORIGINS** - Comma-separated allowed origins (legacy)
- **FRONTEND_URL** - Frontend URL
- **FRONTEND_BASE_URL** - Frontend base URL (alternative)
- **WEB_APP_URL** - Web app URL (alternative)
- **PUBLIC_BASE_URL** - Public base URL
- **REDIRECT_ALLOWED_HOSTS** - Allowed redirect hosts

### Mitto SMS
- **MITTO_API_BASE** - Mitto API base URL (default: https://messaging.mittoapi.com)
- **MITTO_API_KEY** - Mitto API key
- **MITTO_TRAFFIC_ACCOUNT_ID** - Traffic account ID
- **MITTO_SENDER_NAME** - Default sender name
- **MITTO_SENDER_NUMBER** - Default sender number
- **MITTO_WEBHOOK_SECRET** - Webhook secret

### Stripe
- **STRIPE_SECRET_KEY** - Stripe secret key
- **STRIPE_WEBHOOK_SECRET** - Stripe webhook secret
- **STRIPE_PRICE_ID_1000_EUR** - 1000 credits EUR price ID
- **STRIPE_PRICE_ID_5000_EUR** - 5000 credits EUR price ID
- **STRIPE_PRICE_ID_10000_EUR** - 10000 credits EUR price ID
- **STRIPE_PRICE_ID_25000_EUR** - 25000 credits EUR price ID
- **STRIPE_PRICE_ID_1000_USD** - 1000 credits USD price ID
- **STRIPE_PRICE_ID_5000_USD** - 5000 credits USD price ID
- **STRIPE_PRICE_ID_10000_USD** - 10000 credits USD price ID
- **STRIPE_PRICE_ID_25000_USD** - 25000 credits USD price ID
- **STRIPE_PRICE_ID_SUB_STARTER_EUR** - Starter subscription EUR price ID
- **STRIPE_PRICE_ID_SUB_PRO_EUR** - Pro subscription EUR price ID
- **STRIPE_PRICE_ID_CREDIT_TOPUP_EUR** - Credit top-up EUR price ID

### JWT & Security
- **JWT_SECRET** - JWT signing secret
- **API_KEY** - API key for external auth

### URL Shortener
- **URL_SHORTENER_TYPE** - Type: backend/custom/bitly/tinyurl/none
- **URL_SHORTENER_BASE_URL** - Shortener base URL
- **BITLY_API_TOKEN** - Bitly API token
- **TINYURL_API_KEY** - TinyURL API key

### Queue & Scheduler
- **RUN_SCHEDULER** - Run scheduler (true/false, default: true)
- **SKIP_QUEUES** - Skip queues in test (true/false)
- **SMS_BATCH_SIZE** - SMS batch size (default: 5000)

### Event Polling
- **EVENT_POLLING_ENABLED** - Enable event polling (default: true)
- **EVENT_POLLING_INTERVAL** - Polling interval seconds (default: 5)

### Rate Limiting
- **RATE_LIMIT_TRAFFIC_ACCOUNT_MAX** - Traffic account limit (default: 100)
- **RATE_LIMIT_TRAFFIC_ACCOUNT_WINDOW_MS** - Traffic account window (default: 1000)
- **RATE_LIMIT_TENANT_MAX** - Tenant limit (default: 50)
- **RATE_LIMIT_TENANT_WINDOW_MS** - Tenant window (default: 1000)
- **RATE_LIMIT_GLOBAL_MAX** - Global limit (default: 200)
- **RATE_LIMIT_GLOBAL_WINDOW_MS** - Global window (default: 1000)

### Other
- **APP_DEFAULT_CURRENCY** - Default currency (default: EUR)
- **SENTRY_DSN** - Sentry DSN
- **RENDER_INSTANCE_COUNT** - Render instance count
- **SHOPIFY_SHOP_DOMAIN** - Test shop domain
- **SHOPIFY_ACCESS_TOKEN** - Test access token
- **UNSUBSCRIBE_SECRET** - Unsubscribe secret (fallback to JWT_SECRET)

---

## Extension (apps/astronote-shopify-extension)

### Build/Config Only
- Uses Shopify app configuration (shopify.app.toml)
- No runtime env vars required (uses Shopify App Bridge)

---

## Summary by Category

### Database
- `DATABASE_URL` - Used by retail-api, shopify-api
- `DIRECT_URL` / `DIRECT_DATABASE_URL` - Used by retail-api, shopify-api

### Redis
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_TLS` - Used by retail-api, shopify-api
- `REDIS_URL` - Fallback used by retail-api, shopify-api

### Frontend URLs
- `FRONTEND_URL` - Used by retail-api, shopify-api
- `FRONTEND_BASE_URL` - Used by retail-api, shopify-api
- `WEB_APP_URL` - Used by shopify-api
- `APP_PUBLIC_BASE_URL` - Used by retail-api
- `APP_URL` - Used by retail-api (legacy)

### CORS
- `CORS_ALLOWLIST` - Used by retail-api
- `ALLOWED_ORIGINS` - Used by shopify-api

### Mitto
- `MITTO_API_KEY`, `MITTO_API_BASE` - Used by retail-api, shopify-api
- `MITTO_TRAFFIC_ACCOUNT_ID` / `SMS_TRAFFIC_ACCOUNT_ID` - Used by retail-api, shopify-api
- `MITTO_SENDER_NAME` / `MITTO_SENDER` - Used by retail-api, shopify-api

### Stripe
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Used by retail-api, shopify-api
- `STRIPE_PRICE_ID_*` - Used by shopify-api

