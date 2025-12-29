# Render Environment Variables Checklist

## Overview
This document lists all required environment variables for each service deployed on Render.

---

## Web Frontend (Static Site)

### Required Variables
- `VITE_APP_URL` - Main frontend URL (e.g., `https://astronote.onrender.com`)
- `VITE_RETAIL_API_BASE_URL` - Retail API URL (e.g., `https://astronote-retail.onrender.com`)
- `VITE_SHOPIFY_API_BASE_URL` - Shopify API URL (e.g., `https://astronote-shopify.onrender.com`)

### Notes
- ✅ Only `VITE_` prefixed variables are exposed to frontend
- ✅ Variables are baked into build at build time
- ✅ Update in Render dashboard → rebuild required

---

## Shopify API (Web Service)

### Required Variables

#### Core
- `NODE_ENV=production`
- `PORT=3000` (or Render default)
- `LOG_LEVEL=info`

#### Database (Neon)
- `DATABASE_URL` - Neon pooled connection (format: `postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require`)
- `DIRECT_URL` - Neon direct connection (for migrations, same format)

#### Redis
- `REDIS_HOST` - Redis Cloud hostname
- `REDIS_PORT` - Redis Cloud port (typically `16617` for non-TLS)
- `REDIS_USERNAME` - Redis Cloud username (usually `default`)
- `REDIS_PASSWORD` - Redis Cloud password
- `REDIS_TLS=false` (or `true` if using TLS port)

#### Shopify
- `SHOPIFY_API_KEY` - Shopify API key
- `SHOPIFY_API_SECRET` - Shopify API secret
- `SCOPES` - Comma-separated scopes (e.g., `read_customers,write_customers,read_orders`)
- `SESSION_SECRET` - Session secret

#### Public URLs
- `HOST` - Backend public URL (e.g., `https://astronote-shopify.onrender.com`)
- `FRONTEND_URL` - Frontend URL (e.g., `https://astronote.onrender.com`)
- `PUBLIC_BASE_URL` - Public base URL (e.g., `https://astronote-shopify.onrender.com`)

#### CORS
- `CORS_ALLOWLIST` - Comma-separated origins (e.g., `https://astronote.onrender.com,https://astronote-shopify.onrender.com`)
- **Note:** `ALLOWED_ORIGINS` also supported as fallback

#### JWT & Security
- `JWT_SECRET` - JWT signing secret (min 32 chars)

#### Mitto SMS
- `MITTO_API_BASE=https://messaging.mittoapi.com`
- `MITTO_API_KEY` - Mitto API key
- `MITTO_TRAFFIC_ACCOUNT_ID` - Traffic account ID
- `MITTO_SENDER_NAME=Astronote`
- `MITTO_WEBHOOK_SECRET` - Webhook secret

#### Stripe
- `STRIPE_SECRET_KEY` - Stripe secret key (starts with `sk_`)
- `STRIPE_WEBHOOK_SECRET` - Webhook secret (starts with `whsec_`)
- `STRIPE_PRICE_ID_1000_EUR` - 1000 credits EUR price ID
- `STRIPE_PRICE_ID_5000_EUR` - 5000 credits EUR price ID
- `STRIPE_PRICE_ID_10000_EUR` - 10000 credits EUR price ID
- `STRIPE_PRICE_ID_25000_EUR` - 25000 credits EUR price ID
- `STRIPE_PRICE_ID_1000_USD` - 1000 credits USD price ID
- `STRIPE_PRICE_ID_5000_USD` - 5000 credits USD price ID
- `STRIPE_PRICE_ID_10000_USD` - 10000 credits USD price ID
- `STRIPE_PRICE_ID_25000_USD` - 25000 credits USD price ID
- `STRIPE_PRICE_ID_SUB_STARTER_EUR` - Starter subscription EUR price ID
- `STRIPE_PRICE_ID_SUB_PRO_EUR` - Pro subscription EUR price ID

#### Other
- `APP_DEFAULT_CURRENCY=EUR`
- `URL_SHORTENER_TYPE=custom`
- `URL_SHORTENER_BASE_URL` - Shortener base URL (e.g., `https://astronote-shopify.onrender.com`)
- `RUN_SCHEDULER=true`
- `SMS_BATCH_SIZE=5000`

### Notes
- ✅ **CORS_ALLOWLIST must include:** `https://astronote.onrender.com`
- ✅ **Neon Setup:** Use pooled connection in `DATABASE_URL`, direct in `DIRECT_URL`
- ✅ **Redis Cloud:** Use individual vars (REDIS_HOST, REDIS_PORT, etc.) for compatibility

---

## Retail API (Web Service)

### Required Variables

#### Core
- `NODE_ENV=production`
- `PORT=3001` (or Render default)
- `LOG_LEVEL=info`

#### Database (Neon)
- `DATABASE_URL` - Neon pooled connection
- `DIRECT_URL` - Neon direct connection (for migrations)

#### Redis
- `REDIS_HOST` - Redis Cloud hostname
- `REDIS_PORT` - Redis Cloud port
- `REDIS_USERNAME` - Redis Cloud username
- `REDIS_PASSWORD` - Redis Cloud password
- `REDIS_DB=0`
- `REDIS_TLS=false` (or `true` if using TLS)

#### Public URLs
- `HOST` - Backend public URL (e.g., `https://astronote-retail.onrender.com`)
- `FRONTEND_URL` - Frontend URL (e.g., `https://astronote.onrender.com`)
- `APP_PUBLIC_BASE_URL` - Public base URL (e.g., `https://astronote.onrender.com`)

#### CORS
- `CORS_ALLOWLIST` - Comma-separated origins (e.g., `https://astronote.onrender.com,https://astronote-retail.onrender.com`)

#### JWT
- `JWT_SECRET` - JWT signing secret (min 24 chars)
- `JWT_ACCESS_TTL=15m`
- `JWT_REFRESH_TTL=30d`

#### Mitto SMS
- `MITTO_API_BASE=https://messaging.mittoapi.com`
- `MITTO_API_KEY` - Mitto API key
- `MITTO_TRAFFIC_ACCOUNT_ID` - Traffic account ID
- `MITTO_SENDER_NAME=Astronote`

#### Stripe
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret

#### Queue & Worker
- `WORKER_CONCURRENCY=5`
- `SCHEDULER_CONCURRENCY=2`
- `STATUS_REFRESH_ENABLED=1`
- `STATUS_REFRESH_INTERVAL=600000`

#### Rate Limiting
- `RATE_LIMIT_TRAFFIC_ACCOUNT_MAX=100`
- `RATE_LIMIT_TRAFFIC_ACCOUNT_WINDOW_MS=1000`
- `RATE_LIMIT_TENANT_MAX=50`
- `RATE_LIMIT_TENANT_WINDOW_MS=1000`
- `RATE_LIMIT_GLOBAL_MAX=200`
- `RATE_LIMIT_GLOBAL_WINDOW_MS=1000`

### Notes
- ✅ **CORS_ALLOWLIST must include:** `https://astronote.onrender.com`
- ✅ **Neon Setup:** Use pooled connection in `DATABASE_URL`, direct in `DIRECT_URL`
- ✅ **Worker:** Can run in same service or separate background worker

---

## Retail Worker (Background Worker)

### Required Variables

**Same as Retail API** (worker shares env with retail-api)

#### Additional Worker-Specific
- `WORKER_CONCURRENCY=5`
- `SCHEDULER_CONCURRENCY=2`
- `CONTACT_IMPORT_CONCURRENCY=1`
- `STATUS_REFRESH_CONCURRENCY=1`
- `DELIVERY_STATUS_POLLER_CONCURRENCY=1`
- `WATCHDOG_CONCURRENCY=1`
- `STUCK_SENDING_MINUTES=10`
- `STUCK_LOCKED_MINUTES=5`

### Notes
- ✅ Worker uses same database, Redis, JWT, Mitto, Stripe vars as retail-api
- ✅ Can be deployed as separate background worker or run in same service

---

## Neon Database Setup

### Connection Strings

**Pooled Connection (DATABASE_URL):**
```
postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
```
- Use for application connections
- Handles connection pooling automatically
- Recommended for production

**Direct Connection (DIRECT_URL):**
```
postgresql://user:password@ep-xxx-xxx-direct.region.aws.neon.tech/dbname?sslmode=require
```
- Use for migrations (Prisma migrate)
- Bypasses connection pooler
- Required for schema changes

### Notes
- ✅ Both connections required in production
- ✅ `DATABASE_URL` for runtime, `DIRECT_URL` for migrations
- ✅ Get both from Neon dashboard

---

## Redis Cloud Setup

### Individual Variables (Recommended)
- `REDIS_HOST` - From Redis Cloud dashboard
- `REDIS_PORT` - Typically `16617` for non-TLS
- `REDIS_USERNAME` - Usually `default`
- `REDIS_PASSWORD` - From Redis Cloud dashboard
- `REDIS_DB=0`
- `REDIS_TLS=false` (or `true` if using TLS port)

### Alternative: REDIS_URL
```
redis://username:password@host:port/db
```

### Notes
- ✅ Individual vars preferred for Redis Cloud compatibility
- ✅ `REDIS_URL` supported as fallback

---

## CORS Configuration

### Required Origins
All services must include:
- `https://astronote.onrender.com` (main frontend)

### Example CORS_ALLOWLIST
```
https://astronote.onrender.com,https://astronote-shopify.onrender.com,https://astronote-retail.onrender.com
```

### Notes
- ✅ Must include production frontend URL
- ✅ Comma-separated, no spaces (or trimmed in code)
- ✅ `CORS_ALLOWLIST` is canonical, `ALLOWED_ORIGINS` supported as fallback

---

## Deployment Checklist

### Before Deploying
- [ ] All required env vars set in Render dashboard
- [ ] `DATABASE_URL` and `DIRECT_URL` configured (Neon)
- [ ] `REDIS_*` vars configured (Redis Cloud)
- [ ] `CORS_ALLOWLIST` includes `https://astronote.onrender.com`
- [ ] `FRONTEND_URL` set to production frontend URL
- [ ] `HOST` set to service's own public URL
- [ ] All secrets (JWT_SECRET, STRIPE_*, MITTO_*) set
- [ ] `NODE_ENV=production` set

### After Deploying
- [ ] Verify services start without env errors
- [ ] Verify database connections work
- [ ] Verify Redis connections work
- [ ] Verify CORS allows frontend requests
- [ ] Verify webhooks receive requests (Stripe, Mitto)

---

## Quick Reference

### Shared Variables (Set in All Services)
- `DATABASE_URL` - Neon pooled
- `DIRECT_URL` - Neon direct
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_TLS`
- `JWT_SECRET`
- `MITTO_API_KEY`, `MITTO_API_BASE`, `MITTO_TRAFFIC_ACCOUNT_ID`, `MITTO_SENDER_NAME`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `FRONTEND_URL` - Main frontend URL

### Service-Specific Variables
- **shopify-api:** `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, `HOST`, `SESSION_SECRET`
- **retail-api:** `HOST`, `CORS_ALLOWLIST`, worker config vars
- **retail-worker:** Same as retail-api
- **web:** `VITE_APP_URL`, `VITE_RETAIL_API_BASE_URL`, `VITE_SHOPIFY_API_BASE_URL`

