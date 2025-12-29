# Standard Environment Variable Keys

## Overview
This document defines the canonical environment variable keys for the Astronote monorepo. All services should use these keys, with backward-compatible fallbacks where needed.

---

## A) Frontend (apps/web)

### VITE_APP_URL
- **Type:** VITE_ prefix (build-time)
- **Description:** Main frontend application URL
- **Example:** `http://localhost:5173` (dev), `https://astronote.onrender.com` (prod)
- **Required:** Yes

### VITE_RETAIL_API_BASE_URL
- **Type:** VITE_ prefix (build-time)
- **Description:** Retail API base URL for frontend requests
- **Example:** `http://localhost:3001` (dev), `https://astronote-retail.onrender.com` (prod)
- **Required:** Yes

### VITE_SHOPIFY_API_BASE_URL
- **Type:** VITE_ prefix (build-time)
- **Description:** Shopify API base URL for frontend requests
- **Example:** `http://localhost:3000` (dev), `https://astronote-shopify.onrender.com` (prod)
- **Required:** Yes

**Note:** Frontend ONLY uses `VITE_` prefixed keys. No backend env vars should be in frontend `.env`.

---

## B) Retail API/Worker

### Core Application
- **NODE_ENV** - `development` | `production` | `test` (default: `development`)
- **PORT** - Server port (default: `3001`) - API only, not worker
- **LOG_LEVEL** - `debug` | `info` | `warn` | `error` (default: `info`)

### Public URLs
- **HOST** - Public base URL of retail API (e.g., `https://astronote-retail.onrender.com`)
- **FRONTEND_URL** - Main web frontend URL (canonical, with fallbacks)
- **APP_PUBLIC_BASE_URL** - Public base URL for links (default: `http://localhost:5173`)

### Database (Prisma)
- **DATABASE_URL** - Neon pooled connection (required)
- **DIRECT_URL** - Neon direct connection for migrations (canonical, with fallback)

### Redis
- **REDIS_HOST** - Redis hostname
- **REDIS_PORT** - Redis port (default: `6379`)
- **REDIS_USERNAME** - Redis username (optional)
- **REDIS_PASSWORD** - Redis password
- **REDIS_DB** - Redis database number (default: `0`)
- **REDIS_TLS** - Enable TLS: `true` | `false` (default: `false`)
- **REDIS_URL** - Fallback connection string (optional, if individual vars not set)

### JWT
- **JWT_SECRET** - JWT signing secret (min 24 chars, required)
- **JWT_ACCESS_TTL** - Access token TTL (default: `15m`)
- **JWT_REFRESH_TTL** - Refresh token TTL (default: `30d`)

### Mitto SMS
- **MITTO_API_BASE** - API base URL (default: `https://messaging.mittoapi.com`)
- **MITTO_API_KEY** - API key (required)
- **MITTO_SENDER_NAME** - Default sender name (canonical, with fallback)
- **MITTO_TRAFFIC_ACCOUNT_ID** - Traffic account ID (canonical, with fallback)

### Stripe
- **STRIPE_SECRET_KEY** - Secret key (starts with `sk_`, required)
- **STRIPE_WEBHOOK_SECRET** - Webhook secret (starts with `whsec_`, required)

### CORS
- **CORS_ALLOWLIST** - Comma-separated allowed origins (canonical, with fallback)

### Worker Configuration
- **QUEUE_DISABLED** - Disable queues: `1` | `true` (optional)
- **WORKER_CONCURRENCY** - SMS worker concurrency (default: `5`)
- **SCHEDULER_CONCURRENCY** - Scheduler concurrency (default: `2`)
- **STATUS_REFRESH_ENABLED** - Enable status refresh: `1` | `true` (default: `1`)
- **STATUS_REFRESH_INTERVAL** - Status refresh interval ms (default: `600000`)
- **WATCHDOG_CONCURRENCY** - Watchdog concurrency (default: `1`)
- **STUCK_SENDING_MINUTES** - Stuck sending threshold (default: `10`)
- **STUCK_LOCKED_MINUTES** - Stuck locked threshold (default: `5`)

---

## C) Shopify API

### Core Application
- **NODE_ENV** - `development` | `production` | `test` (default: `development`)
- **PORT** - Server port (default: `3000` or `8080`)
- **LOG_LEVEL** - `debug` | `info` | `warn` | `error` (default: `info`)
- **LOG_DIR** - Log directory (default: `./logs`)

### Public URLs
- **HOST** - Public base URL of Shopify API (e.g., `https://astronote-shopify.onrender.com`)
- **FRONTEND_URL** - Main web frontend URL (canonical, with fallbacks)
- **PUBLIC_BASE_URL** - Public base URL for links (canonical, with fallback)

### Database (Prisma)
- **DATABASE_URL** - Neon pooled connection (required)
- **DIRECT_URL** - Neon direct connection for migrations (required for migrations)

### Redis
- **REDIS_HOST** - Redis hostname
- **REDIS_PORT** - Redis port (default: `6379`)
- **REDIS_USERNAME** - Redis username (optional)
- **REDIS_PASSWORD** - Redis password
- **REDIS_TLS** - Enable TLS: `true` | `false` (default: `false`)
- **REDIS_URL** - Fallback connection string (optional)

### Shopify
- **SHOPIFY_API_KEY** - Shopify API key (required)
- **SHOPIFY_API_SECRET** - Shopify API secret (required)
- **SCOPES** - Comma-separated OAuth scopes (default: `read_products`)
- **SESSION_SECRET** - Session secret (required)

### JWT
- **JWT_SECRET** - JWT signing secret (required)

### CORS
- **CORS_ALLOWLIST** - Comma-separated allowed origins (canonical, with fallback)

### Mitto SMS
- **MITTO_API_BASE** - API base URL (default: `https://messaging.mittoapi.com`)
- **MITTO_API_KEY** - API key (required)
- **MITTO_SENDER_NAME** - Default sender name
- **MITTO_SENDER_NUMBER** - Default sender number (optional)
- **MITTO_TRAFFIC_ACCOUNT_ID** - Traffic account ID
- **MITTO_WEBHOOK_SECRET** - Webhook secret

### Stripe
- **STRIPE_SECRET_KEY** - Secret key (required)
- **STRIPE_WEBHOOK_SECRET** - Webhook secret (required)
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
- **STRIPE_PRICE_ID_CREDIT_TOPUP_EUR** - Credit top-up EUR price ID (optional)

### Queue & Scheduler
- **RUN_SCHEDULER** - Run scheduler: `true` | `false` (default: `true`)
- **SMS_BATCH_SIZE** - SMS batch size (default: `5000`)

### Event Polling
- **EVENT_POLLING_ENABLED** - Enable event polling: `true` | `false` (default: `true`)
- **EVENT_POLLING_INTERVAL** - Polling interval seconds (default: `5`)

### Rate Limiting
- **RATE_LIMIT_TRAFFIC_ACCOUNT_MAX** - Traffic account limit (default: `100`)
- **RATE_LIMIT_TRAFFIC_ACCOUNT_WINDOW_MS** - Traffic account window (default: `1000`)
- **RATE_LIMIT_TENANT_MAX** - Tenant limit (default: `50`)
- **RATE_LIMIT_TENANT_WINDOW_MS** - Tenant window (default: `1000`)
- **RATE_LIMIT_GLOBAL_MAX** - Global limit (default: `200`)
- **RATE_LIMIT_GLOBAL_WINDOW_MS** - Global window (default: `1000`)

### Other
- **APP_DEFAULT_CURRENCY** - Default currency (default: `EUR`)
- **SENTRY_DSN** - Sentry DSN (optional)
- **URL_SHORTENER_TYPE** - `backend` | `custom` | `bitly` | `tinyurl` | `none` (default: `backend`)
- **URL_SHORTENER_BASE_URL** - Shortener base URL
- **REDIRECT_ALLOWED_HOSTS** - Comma-separated allowed redirect hosts (optional)

---

## D) Extension (apps/astronote-shopify-extension)

### Build/Config Only
- No runtime environment variables required
- Uses Shopify App Bridge (client-side)
- Configuration in `shopify.app.toml`

---

## Key Naming Conventions

### Prefixes
- **VITE_** - Frontend build-time variables (Vite)
- **MITTO_** - Mitto SMS provider
- **STRIPE_** - Stripe payment provider
- **SHOPIFY_** - Shopify platform
- **REDIS_** - Redis connection
- **JWT_** - JWT authentication
- **RATE_LIMIT_** - Rate limiting configuration
- **QUEUE_** - Queue configuration
- **WORKER_** - Worker configuration

### Suffixes
- **_URL** - Full URL (e.g., `FRONTEND_URL`)
- **_BASE_URL** - Base URL without path (e.g., `API_BASE_URL`)
- **_SECRET** - Secret key (e.g., `JWT_SECRET`)
- **_KEY** - API key (e.g., `MITTO_API_KEY`)
- **_ID** - Identifier (e.g., `TRAFFIC_ACCOUNT_ID`)
- **_TTL** - Time to live (e.g., `JWT_ACCESS_TTL`)

### Standard Patterns
- **{SERVICE}_API_KEY** - API key for service
- **{SERVICE}_API_BASE** - API base URL for service
- **{SERVICE}_SECRET** - Secret for service
- **{SERVICE}_WEBHOOK_SECRET** - Webhook secret for service

---

## Required vs Optional

### Required (Production)
- `DATABASE_URL` - All backends
- `DIRECT_URL` - All backends (for migrations)
- `JWT_SECRET` - All backends
- `STRIPE_SECRET_KEY` - All backends
- `STRIPE_WEBHOOK_SECRET` - All backends
- `MITTO_API_KEY` - All backends
- `SHOPIFY_API_KEY` - shopify-api only
- `SHOPIFY_API_SECRET` - shopify-api only
- `VITE_SHOPIFY_API_BASE_URL` - web only
- `VITE_RETAIL_API_BASE_URL` - web only (if using retail API)

### Optional (Have Defaults)
- `NODE_ENV` - Defaults to `development`
- `PORT` - Service-specific defaults
- `LOG_LEVEL` - Defaults to `info`
- `REDIS_*` - Optional if Redis not used
- `CORS_ALLOWLIST` - Optional (defaults to localhost in dev)
- `FRONTEND_URL` - Optional (has defaults based on NODE_ENV)

---

## Environment-Specific Values

### Development
- `NODE_ENV=development`
- `FRONTEND_URL=http://localhost:5173`
- `HOST=http://localhost:3000` (shopify-api) or `http://localhost:3001` (retail-api)
- `DATABASE_URL=postgresql://...` (local or Neon dev)
- `REDIS_HOST=localhost` (if using local Redis)

### Production
- `NODE_ENV=production`
- `FRONTEND_URL=https://astronote.onrender.com`
- `HOST=https://astronote-shopify.onrender.com` (shopify-api) or `https://astronote-retail.onrender.com` (retail-api)
- `DATABASE_URL=postgresql://...` (Neon pooled)
- `DIRECT_URL=postgresql://...` (Neon direct)
- `REDIS_HOST=redis-xxx.xxx.xxx.xxx` (Redis Cloud)
- `CORS_ALLOWLIST=https://astronote.onrender.com,https://astronote-shopify.onrender.com,https://astronote-retail.onrender.com`

