# Environment Variable Usage Map (Complete)

## Date
2025-01-23

## Overview
Complete mapping of all environment variables used across the monorepo, showing workspace, file paths, and requirements.

---

## Frontend (apps/web)

### VITE_APP_URL
- **Workspace**: `apps/web`
- **Files**: 
  - Not directly used (for reference)
- **Required**: Optional (defaults handled in code)
- **Type**: VITE_ prefix (build-time only)

### VITE_RETAIL_API_BASE_URL
- **Workspace**: `apps/web`
- **Files**:
  - `apps/web/src/api/axiosRetail.js` - Base URL for Retail API client
- **Required**: Optional (defaults to `http://localhost:3001`)
- **Type**: VITE_ prefix (build-time only)

### VITE_SHOPIFY_API_BASE_URL
- **Workspace**: `apps/web`
- **Files**:
  - `apps/web/src/api/axiosShopify.js` - Base URL for Shopify API client
- **Required**: Optional (defaults to `http://localhost:3000`)
- **Type**: VITE_ prefix (build-time only)

### import.meta.env.DEV
- **Workspace**: `apps/web`
- **Files**:
  - `apps/web/src/app/providers.jsx` - Conditional React Query DevTools
- **Required**: Automatic (Vite built-in)
- **Type**: Vite built-in

---

## Shopify API (apps/shopify-api)

### Core Application
- **NODE_ENV**: `apps/shopify-api/index.js`, `config/env-validation.js`, `config/development.js`, `config/production.js`
  - Required: Yes (defaults to 'development')
  - Enum: `['development', 'production', 'test']`

- **PORT**: `apps/shopify-api/index.js`, `config/development.js`
  - Required: Optional (defaults to 3000 or 8080)

- **LOG_LEVEL**: `apps/shopify-api/utils/logger.js`, `config/env-validation.js`
  - Required: Optional (defaults to 'info')

- **LOG_DIR**: `apps/shopify-api/utils/logger.js`, `env.example`
  - Required: Optional (defaults to './logs')

### Database
- **DATABASE_URL**: `apps/shopify-api/services/prisma.js`, `config/env-validation.js`, `config/development.js`
  - Required: Yes (all environments)

- **DIRECT_URL**: `apps/shopify-api/services/prisma.js`, `prisma/schema.prisma`
  - Required: Optional (recommended for Neon pooler)

### Redis
- **REDIS_HOST**: `apps/shopify-api/config/redis.js`, `config/loadEnv.js`
  - Required: Optional

- **REDIS_PORT**: `apps/shopify-api/config/redis.js`
  - Required: Optional

- **REDIS_USERNAME**: `apps/shopify-api/config/redis.js`
  - Required: Optional

- **REDIS_PASSWORD**: `apps/shopify-api/config/redis.js`
  - Required: Optional

- **REDIS_TLS**: `apps/shopify-api/config/redis.js`
  - Required: Optional

- **REDIS_URL**: `apps/shopify-api/config/redis.js`, `config/env-validation.js`, `config/loadEnv.js`
  - Required: Optional (fallback if individual vars not set)

### Shopify
- **SHOPIFY_API_KEY**: `apps/shopify-api/services/shopify.js`, `config/env-validation.js`, `config/development.js`
  - Required: Yes (production)

- **SHOPIFY_API_SECRET**: `apps/shopify-api/services/shopify.js`, `config/env-validation.js`, `config/development.js`
  - Required: Yes (production)

- **SCOPES**: `apps/shopify-api/services/shopify.js`, `config/development.js`
  - Required: Optional (defaults to 'read_products')

- **SESSION_SECRET**: `apps/shopify-api/config/env-validation.js`
  - Required: Optional (warned in production)

- **HOST**: `apps/shopify-api/services/shopify.js`, `app.js`, `config/env-validation.js`, `config/development.js`, `utils/baseUrl.js`
  - Required: Optional (warned in production)

### CORS & Frontend URLs
- **CORS_ALLOWLIST**: `apps/shopify-api/app.js`
  - Required: Optional (canonical)

- **ALLOWED_ORIGINS**: `apps/shopify-api/app.js`, `config/env-validation.js`, `config/development.js`
  - Required: Optional (fallback for CORS_ALLOWLIST)

- **FRONTEND_URL**: `apps/shopify-api/utils/frontendUrl.js`, `utils/urlShortener.js`
  - Required: Optional

- **PUBLIC_BASE_URL**: `apps/shopify-api/utils/baseUrl.js`
  - Required: Optional

- **WEB_APP_URL**: `apps/shopify-api/utils/baseUrl.js`
  - Required: Optional

### Mitto SMS
- **MITTO_API_BASE**: `apps/shopify-api/services/mitto.js`, `config/env-validation.js`, `config/development.js`
  - Required: Optional (defaults to 'https://messaging.mittoapi.com')

- **MITTO_API_KEY**: `apps/shopify-api/services/mitto.js`, `config/env-validation.js`, `config/development.js`
  - Required: Optional (warned in production)

- **MITTO_TRAFFIC_ACCOUNT_ID**: `apps/shopify-api/services/mitto.js`, `config/development.js`
  - Required: Optional

- **MITTO_SENDER_NAME**: `apps/shopify-api/services/mitto.js`, `config/development.js`
  - Required: Optional

- **MITTO_SENDER_NUMBER**: `apps/shopify-api/services/mitto.js`
  - Required: Optional

- **MITTO_WEBHOOK_SECRET**: `apps/shopify-api/routes/mitto-webhooks.js`
  - Required: Optional

### Stripe
- **STRIPE_SECRET_KEY**: `apps/shopify-api/services/stripe.js`, `config/env-validation.js`
  - Required: Yes (production)

- **STRIPE_WEBHOOK_SECRET**: `apps/shopify-api/controllers/stripe-webhooks.js`, `config/env-validation.js`
  - Required: Optional (warned in production)

- **STRIPE_PRICE_ID_***: `apps/shopify-api/services/billing.js`
  - Required: Optional (multiple price IDs)

### URL Shortener
- **URL_SHORTENER_TYPE**: `apps/shopify-api/utils/urlShortener.js`, `scripts/verify-production.js`
  - Required: Optional (defaults to 'backend')
  - **ISSUE**: Code supports 'backend' but retail-api schema only allows ['custom', 'bitly', 'tinyurl', 'none']
  - **FIX**: Use 'custom' for backend redirects

- **URL_SHORTENER_BASE_URL**: `apps/shopify-api/utils/urlShortener.js`
  - Required: Optional (defaults to FRONTEND_URL)

- **BITLY_API_TOKEN**: `apps/shopify-api/utils/urlShortener.js`
  - Required: Optional (if using bitly)

- **TINYURL_API_KEY**: `apps/shopify-api/utils/urlShortener.js`
  - Required: Optional (if using tinyurl)

- **REDIRECT_ALLOWED_HOSTS**: `apps/shopify-api/controllers/shortLinks.js`
  - Required: Optional

### JWT & Security
- **JWT_SECRET**: `apps/shopify-api/services/auth.js`, `config/env-validation.js`, `config/development.js`
  - Required: Optional (warned in production)

- **API_KEY**: `apps/shopify-api/env.example`
  - Required: Optional

- **ADMIN_TOKEN**: `apps/shopify-api/env.example`
  - Required: Optional (dev only)

### Monitoring
- **SENTRY_DSN**: `apps/shopify-api/config/env-validation.js`, `config/development.js`
  - Required: Optional

### Application
- **APP_DEFAULT_CURRENCY**: `apps/shopify-api/config/development.js`
  - Required: Optional (defaults to 'EUR')

### Queue & Scheduler
- **RUN_SCHEDULER**: `apps/shopify-api/services/scheduler.js`
  - Required: Optional

- **SMS_BATCH_SIZE**: `apps/shopify-api/queue/jobs/bulkSms.js`
  - Required: Optional

### Event Polling
- **EVENT_POLLING_ENABLED**: `apps/shopify-api/workers/event-poller.js`
  - Required: Optional

- **EVENT_POLLING_INTERVAL**: `apps/shopify-api/workers/event-poller.js`
  - Required: Optional

### Rate Limiting
- **RATE_LIMIT_***: `apps/shopify-api/services/rateLimiter.js`
  - Required: Optional (multiple rate limit vars)

---

## Retail API (apps/retail-api)

### Core Application
- **NODE_ENV**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to 'development')
  - Enum: `['development', 'production', 'test']`

- **PORT**: `apps/retail-api/src/config/env.js`, `src/server.js`
  - Required: Optional (defaults to '3001')

- **LOG_LEVEL**: Various logger files
  - Required: Optional

### Database
- **DATABASE_URL**: `apps/retail-api/src/config/env.js`, `prisma/schema.prisma`
  - Required: Yes

- **DIRECT_URL**: `apps/retail-api/src/config/env.js`, `prisma/schema.prisma`
  - Required: Optional (canonical, recommended for Neon)

- **DIRECT_DATABASE_URL**: `apps/retail-api/src/config/env.js`
  - Required: Optional (fallback for DIRECT_URL)

### Redis
- **REDIS_HOST**: `apps/retail-api/src/config/env.js`, `src/lib/redis.js`
  - Required: Optional

- **REDIS_PORT**: `apps/retail-api/src/config/env.js`, `src/lib/redis.js`
  - Required: Optional

- **REDIS_USERNAME**: `apps/retail-api/src/config/env.js`, `src/lib/redis.js`
  - Required: Optional

- **REDIS_PASSWORD**: `apps/retail-api/src/config/env.js`, `src/lib/redis.js`
  - Required: Optional

- **REDIS_DB**: `apps/retail-api/src/config/env.js`, `src/lib/redis.js`
  - Required: Optional

- **REDIS_TLS**: `apps/retail-api/src/config/env.js`, `src/lib/redis.js`
  - Required: Optional

- **REDIS_URL**: `apps/retail-api/src/config/env.js`, `src/lib/redis.js`
  - Required: Optional (fallback)

### JWT
- **JWT_SECRET**: `apps/retail-api/src/config/env.js`
  - Required: Yes (min 24 characters)

- **JWT_ACCESS_TTL**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '15m')

- **JWT_REFRESH_TTL**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '30d')

### CORS & Frontend URLs
- **CORS_ALLOWLIST**: `apps/retail-api/src/config/env.js`, `src/server.js`
  - Required: Optional (canonical)

- **FRONTEND_URL**: `apps/retail-api/src/config/env.js`, `src/lib/public-url-resolver.js`
  - Required: Optional

- **FRONTEND_BASE_URL**: `apps/retail-api/src/config/env.js`
  - Required: Optional

- **APP_PUBLIC_BASE_URL**: `apps/retail-api/src/config/env.js`, `src/lib/public-url-resolver.js`
  - Required: Optional (defaults to 'http://localhost:5173')

- **APP_URL**: `apps/retail-api/src/config/env.js`
  - Required: Optional

- **UNSUBSCRIBE_BASE_URL**: `apps/retail-api/src/config/env.js`
  - Required: Optional

- **OFFER_BASE_URL**: `apps/retail-api/src/config/env.js`
  - Required: Optional

### Mitto SMS
- **MITTO_API_BASE**: `apps/retail-api/src/config/env.js`, `src/services/mitto.service.js`
  - Required: Optional (defaults to 'https://messaging.mittoapi.com')

- **MITTO_API_KEY**: `apps/retail-api/src/config/env.js`, `src/services/mitto.service.js`
  - Required: Yes

- **MITTO_SENDER_NAME**: `apps/retail-api/src/config/env.js`, `src/services/mitto.service.js`
  - Required: Optional (canonical)

- **MITTO_SENDER**: `apps/retail-api/src/config/env.js`, `src/services/mitto.service.js`
  - Required: Optional (fallback for MITTO_SENDER_NAME)

- **MITTO_TRAFFIC_ACCOUNT_ID**: `apps/retail-api/src/config/env.js`
  - Required: Optional (canonical)

- **SMS_TRAFFIC_ACCOUNT_ID**: `apps/retail-api/src/config/env.js`
  - Required: Optional (fallback for MITTO_TRAFFIC_ACCOUNT_ID)

### Stripe
- **STRIPE_SECRET_KEY**: `apps/retail-api/src/config/env.js`
  - Required: Yes (must start with 'sk_')

- **STRIPE_WEBHOOK_SECRET**: `apps/retail-api/src/config/env.js`
  - Required: Yes (must start with 'whsec_')

### Queue Configuration
- **QUEUE_DISABLED**: `apps/retail-api/src/config/env.js`, `apps/retail-worker/src/sms.worker.js`
  - Required: Optional

- **QUEUE_ATTEMPTS**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '5')

- **QUEUE_BACKOFF_MS**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '3000')

- **QUEUE_RATE_MAX**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '20')

- **QUEUE_RATE_DURATION_MS**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '1000')

### Worker Configuration
- **WORKER_CONCURRENCY**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '5')

- **SCHEDULER_CONCURRENCY**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '2')

- **CONTACT_IMPORT_CONCURRENCY**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '1')

- **STATUS_REFRESH_CONCURRENCY**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '1')

- **START_WORKER**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '1')

- **STATUS_REFRESH_ENABLED**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '1')

- **STATUS_REFRESH_INTERVAL**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '600000')

- **RUN_BIRTHDAY_ON_START**: `apps/retail-api/src/config/env.js`
  - Required: Optional

### Rate Limiting
- **RATE_LIMIT_TRAFFIC_ACCOUNT_MAX**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '100')

- **RATE_LIMIT_TRAFFIC_ACCOUNT_WINDOW_MS**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '1000')

- **RATE_LIMIT_TENANT_MAX**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '50')

- **RATE_LIMIT_TENANT_WINDOW_MS**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '1000')

- **RATE_LIMIT_GLOBAL_MAX**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '200')

- **RATE_LIMIT_GLOBAL_WINDOW_MS**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '1000')

### URL Shortener
- **URL_SHORTENER_TYPE**: `apps/retail-api/src/config/env.js`, `src/lib/public-url-resolver.js`, `src/services/urlShortener.service.js`
  - Required: Optional (defaults to 'custom')
  - **Enum**: `['custom', 'bitly', 'tinyurl', 'none']` (Zod validated)
  - **NOTE**: 'backend' is NOT valid for retail-api

- **URL_SHORTENER_BASE_URL**: `apps/retail-api/src/config/env.js`, `src/lib/public-url-resolver.js`
  - Required: Optional

- **BITLY_API_TOKEN**: `apps/retail-api/src/config/env.js`
  - Required: Optional

- **TINYURL_API_KEY**: `apps/retail-api/src/config/env.js`
  - Required: Optional

### Other
- **SYSTEM_USER_ID**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '1')

- **UNSUBSCRIBE_TOKEN_SECRET**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to 'default-secret-change-in-production')

- **UNSUBSCRIBE_CONFIRMATION_ENABLED**: `apps/retail-api/src/config/env.js`
  - Required: Optional

- **WEBHOOK_SECRET**: `apps/retail-api/src/config/env.js`
  - Required: Optional

- **ALLOW_BILLING_SEED**: `apps/retail-api/src/config/env.js`
  - Required: Optional

- **PII_RETENTION_DAYS**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '90')

- **PII_RETENTION_ENABLED**: `apps/retail-api/src/config/env.js`
  - Required: Optional

- **SMS_BATCH_SIZE**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '5000')

- **API_URL**: `apps/retail-api/src/config/env.js`
  - Required: Optional

- **DOCS_PORT**: `apps/retail-api/src/config/env.js`
  - Required: Optional (defaults to '3002')

- **NODE_PATH**: `apps/retail-api/src/config/env.js`
  - Required: Optional

---

## Retail Worker (apps/retail-worker)

### Shared with Retail API
- All variables from `apps/retail-api` are used by workers
- Workers load env via `require('dotenv').config()` or `DOTENV_CONFIG_PATH=../.env`
- No separate validation (relies on retail-api validation if shared)

### Worker-Specific
- **WORKER_CONCURRENCY**: Used in worker initialization
- **QUEUE_***: All queue configuration vars
- **STATUS_REFRESH_***: Status refresh configuration

---

## Extension (apps/astronote-shopify-extension)

### Build-Time Only
- No runtime environment variables (build-time only if needed)
- Typically doesn't require env vars

---

## Critical Issues Found

1. **URL_SHORTENER_TYPE Mismatch**:
   - Retail API Zod schema: `['custom', 'bitly', 'tinyurl', 'none']`
   - Shopify API code: Supports `'backend'` but not validated
   - Shopify API env.example: Uses `URL_SHORTENER_TYPE=custom` (INVALID for retail-api)
   - **Fix**: Update shopify-api env.example to use `'custom'` for backend redirects

2. **Missing .env.example Files**:
   - `apps/web/.env.example` - Missing
   - `apps/retail-api/.env.example` - Missing
   - `apps/retail-worker/.env.example` - Missing

3. **Redis Eviction Policy**:
   - No validation or warning for Redis eviction policy
   - Should document requirement for 'noeviction' policy

