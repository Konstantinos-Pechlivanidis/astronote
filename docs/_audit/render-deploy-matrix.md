# Render Deployment Matrix

## Overview

This document outlines the deployment configuration for all services on Render.com.

## Services Overview

| Service | Domain | Type | Status |
|---------|--------|------|--------|
| **web** | `https://astronote.onrender.com` | Static Site | To be unified |
| **shopify-api** | `https://astronote-shopify.onrender.com` | Web Service | Production-ready |
| **retail-api** | `https://astronote-retail.onrender.com` | Web Service | Production-ready |
| **retail-worker** | N/A (same as retail-api or separate) | Background Worker | Production-ready |
| **extension** | N/A (Shopify CLI deploy) | Shopify Extension | Active |

---

## Service 1: Unified Web Frontend

### Service Name
`astronote-web` (or `astronote-frontend`)

### Domain
`https://astronote.onrender.com`

### Type
**Static Site**

### Build Command
```bash
npm ci && npm --workspace apps/web run build
```

### Start Command
```bash
npx serve -s apps/web/dist -l $PORT
```

### Environment Variables

#### Required
- `VITE_SHOPIFY_API_BASE_URL`: `https://astronote-shopify.onrender.com`
- `VITE_RETAIL_API_BASE_URL`: `https://astronote-retail.onrender.com`
- `VITE_APP_URL`: `https://astronote.onrender.com`

#### Optional
- `VITE_SENTRY_DSN`: Sentry DSN for error tracking

### Build Output
- Directory: `apps/web/dist/`
- Contains: `index.html`, `assets/` folder with JS/CSS bundles

### Dependencies
- `serve`: Static file server (already in dependencies)

### Notes
- Vite build creates optimized production bundles
- `serve` serves static files on Render's `$PORT`
- Environment variables must be prefixed with `VITE_` for client-side access

---

## Service 2: Shopify API Backend

### Service Name
`astronote-shopify-api`

### Domain
`https://astronote-shopify.onrender.com`

### Type
**Web Service**

### Build Command
```bash
npm ci && npm --workspace apps/shopify-api run prisma:generate && npm --workspace apps/shopify-api run prisma:migrate:deploy
```

### Start Command
```bash
npm --workspace apps/shopify-api run start
```

### Environment Variables

#### Database
- `DATABASE_URL`: Neon pooled connection (PostgreSQL)
- `DIRECT_URL`: Neon direct connection (for migrations)

#### Redis
- `REDIS_HOST`: Redis hostname
- `REDIS_PORT`: Redis port
- `REDIS_USERNAME`: Redis username
- `REDIS_PASSWORD`: Redis password
- `REDIS_TLS`: `true` or `false`

#### Application
- `NODE_ENV`: `production`
- `PORT`: `$PORT` (Render provides)
- `HOST`: `https://astronote-shopify.onrender.com`
- `ALLOWED_ORIGINS`: `https://astronote.onrender.com,https://admin.shopify.com`

#### Shopify
- `SHOPIFY_API_KEY`: Shopify API key
- `SHOPIFY_API_SECRET`: Shopify API secret
- `SCOPES`: Comma-separated Shopify scopes

#### Mitto SMS
- `MITTO_API_BASE`: `https://messaging.mittoapi.com`
- `MITTO_API_KEY`: Mitto API key
- `MITTO_TRAFFIC_ACCOUNT_ID`: Mitto traffic account ID
- `MITTO_SENDER_NAME`: Default sender name
- `MITTO_WEBHOOK_SECRET`: Mitto webhook secret

#### Stripe
- `STRIPE_SECRET_KEY`: Stripe secret key (starts with `sk_`)
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret (starts with `whsec_`)
- `STRIPE_PRICE_ID_1000_EUR`: Credit pack price ID
- `STRIPE_PRICE_ID_5000_EUR`: Credit pack price ID
- `STRIPE_PRICE_ID_10000_EUR`: Credit pack price ID
- `STRIPE_PRICE_ID_25000_EUR`: Credit pack price ID
- `STRIPE_PRICE_ID_1000_USD`: Credit pack price ID
- `STRIPE_PRICE_ID_5000_USD`: Credit pack price ID
- `STRIPE_PRICE_ID_10000_USD`: Credit pack price ID
- `STRIPE_PRICE_ID_25000_USD`: Credit pack price ID
- `STRIPE_PRICE_ID_SUB_STARTER_EUR`: Subscription price ID
- `STRIPE_PRICE_ID_SUB_PRO_EUR`: Subscription price ID

#### Security
- `JWT_SECRET`: JWT signing secret (32+ characters)
- `SESSION_SECRET`: Session secret

#### Frontend URLs
- `FRONTEND_URL`: `https://astronote.onrender.com`
- `WEB_APP_URL`: `https://astronote.onrender.com`
- `PUBLIC_BASE_URL`: `https://astronote.onrender.com`

#### URL Shortener
- `URL_SHORTENER_TYPE`: `backend`
- `URL_SHORTENER_BASE_URL`: `https://astronote-shopify.onrender.com`
- `REDIRECT_ALLOWED_HOSTS`: Optional CSV of allowed hosts

#### Logging
- `LOG_LEVEL`: `info` or `debug`
- `LOG_DIR`: `./logs`
- `SENTRY_DSN`: Optional Sentry DSN

### Health Check
- Path: `/health/full`
- Expected: 200 OK with health status

### Notes
- Requires PostgreSQL database (Neon)
- Requires Redis instance
- Prisma migrations run during build
- BullMQ workers start automatically with server

---

## Service 3: Retail API Backend

### Service Name
`astronote-retail-api`

### Domain
`https://astronote-retail.onrender.com`

### Type
**Web Service**

### Build Command
```bash
npm ci && cd apps/retail-api && npm run prisma:generate && npm run prisma:migrate:deploy
```

### Start Command
```bash
cd apps/retail-api && npm run start
```

### Environment Variables

#### Database
- `DATABASE_URL`: PostgreSQL connection (pooled)
- `DIRECT_DATABASE_URL`: PostgreSQL direct connection (optional, for migrations)

#### Redis
- `REDIS_HOST`: Redis hostname
- `REDIS_PORT`: Redis port
- `REDIS_USERNAME`: Redis username
- `REDIS_PASSWORD`: Redis password
- `REDIS_TLS`: `true` or `false`
- `REDIS_DB`: Redis database number (optional)
- `REDIS_URL`: Redis connection string (fallback)

#### Application
- `NODE_ENV`: `production`
- `PORT`: `$PORT` (Render provides)
- `API_URL`: `https://astronote-retail.onrender.com`
- `API_BASE_URL`: `https://astronote-retail.onrender.com`
- `CORS_ALLOWLIST`: `https://astronote.onrender.com`

#### JWT
- `JWT_SECRET`: JWT signing secret (min 24 characters)
- `JWT_ACCESS_TTL`: `15m`
- `JWT_REFRESH_TTL`: `30d`

#### Mitto SMS
- `MITTO_API_BASE`: `https://messaging.mittoapi.com`
- `MITTO_API_KEY`: Mitto API key
- `MITTO_TRAFFIC_ACCOUNT_ID`: Mitto traffic account ID
- `MITTO_SENDER`: Sender name (optional)

#### Stripe
- `STRIPE_SECRET_KEY`: Stripe secret key (starts with `sk_`)
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret (starts with `whsec_`)

#### Frontend URLs
- `FRONTEND_URL`: `https://astronote.onrender.com`
- `FRONTEND_BASE_URL`: `https://astronote.onrender.com`
- `APP_PUBLIC_BASE_URL`: `https://astronote.onrender.com`
- `UNSUBSCRIBE_BASE_URL`: Optional override
- `OFFER_BASE_URL`: Optional override

#### Queue Configuration
- `QUEUE_DISABLED`: `0` or unset (enable queues)
- `QUEUE_ATTEMPTS`: `5`
- `QUEUE_BACKOFF_MS`: `3000`
- `QUEUE_RATE_MAX`: `20`
- `QUEUE_RATE_DURATION_MS`: `1000`
- `WORKER_CONCURRENCY`: `5`
- `SCHEDULER_CONCURRENCY`: `2`
- `CONTACT_IMPORT_CONCURRENCY`: `1`
- `STATUS_REFRESH_CONCURRENCY`: `1`

#### Worker Configuration
- `START_WORKER`: `1` (enable worker on server)
- `STATUS_REFRESH_ENABLED`: `1`
- `STATUS_REFRESH_INTERVAL`: `600000` (10 minutes)

#### System
- `SYSTEM_USER_ID`: `1`

#### URL Shortener
- `URL_SHORTENER_TYPE`: `custom`, `bitly`, `tinyurl`, or `none`
- `URL_SHORTENER_BASE_URL`: Optional
- `BITLY_API_TOKEN`: Optional
- `TINYURL_API_KEY`: Optional

#### Other
- `UNSUBSCRIBE_TOKEN_SECRET`: Unsubscribe token secret
- `WEBHOOK_SECRET`: Generic webhook secret
- `SMS_BATCH_SIZE`: `5000`
- `PII_RETENTION_DAYS`: `90`
- `PII_RETENTION_ENABLED`: Optional

### Health Check
- Path: `/healthz` or `/readiness`
- Expected: 200 OK

### Notes
- Requires PostgreSQL database
- Requires Redis instance
- Prisma migrations run during build
- Workers can run on same instance (if `START_WORKER=1`) or separate worker service

---

## Service 4: Retail Worker (Optional Separate Service)

### Service Name
`astronote-retail-worker`

### Domain
N/A (background worker)

### Type
**Background Worker**

### Build Command
```bash
npm ci && cd apps/retail-api && npm run prisma:generate
```

### Start Command
```bash
cd apps/retail-api && npm run worker:sms
# Or run multiple workers:
# npm run worker:sms & npm run worker:scheduler & npm run worker:contactImport & npm run worker:birthday & npm run worker:statusRefresh & npm run worker:piiRetention
```

### Environment Variables
Same as Retail API (shares same .env)

### Notes
- Only needed if running workers separately from API server
- Can run multiple worker processes
- Requires Redis connection
- Requires database connection

---

## Service 5: Shopify Extension

### Service Name
N/A (deployed via Shopify CLI)

### Domain
N/A (hosted by Shopify)

### Type
**Shopify Extension** (not deployed to Render)

### Build Command
```bash
cd apps/astronote-shopify-extension && npm run build
```

### Deploy Command
```bash
cd apps/astronote-shopify-extension && shopify app deploy
```

### Environment Variables
- Managed by Shopify Partners Dashboard
- `SHOPIFY_API_KEY`: From Shopify Partners
- `SHOPIFY_API_SECRET`: From Shopify Partners

### Notes
- Deployed via Shopify CLI, not Render
- Uses Shopify's hosting infrastructure
- Connects to `shopify-api` backend

---

## Database Services

### PostgreSQL (Neon)
- **Service**: Neon PostgreSQL database
- **Connection**: Pooled (`DATABASE_URL`) and Direct (`DIRECT_URL`)
- **Used By**: `shopify-api`, `retail-api`
- **Note**: Can use separate databases or shared (with schema separation)

### Redis
- **Service**: Redis Cloud or Render Redis
- **Connection**: Individual vars (`REDIS_HOST`, `REDIS_PORT`, etc.) or `REDIS_URL`
- **Used By**: `shopify-api`, `retail-api`
- **Note**: Can use separate instances or shared

---

## Deployment Checklist

### Pre-Deployment
- [ ] All environment variables configured in Render
- [ ] Database migrations tested locally
- [ ] Redis connection tested
- [ ] Health checks verified
- [ ] CORS configured correctly
- [ ] Webhook URLs configured in external services (Stripe, Mitto, Shopify)

### Deployment Steps
1. **Database**: Ensure PostgreSQL database is created and accessible
2. **Redis**: Ensure Redis instance is created and accessible
3. **shopify-api**: Deploy with build + start commands
4. **retail-api**: Deploy with build + start commands
5. **retail-worker**: Deploy separately if needed (or run on API server)
6. **web**: Deploy static site with build + serve commands

### Post-Deployment
- [ ] Verify health checks (`/health/full`, `/healthz`)
- [ ] Test API endpoints
- [ ] Verify webhook endpoints are accessible
- [ ] Test OAuth flows
- [ ] Monitor logs for errors
- [ ] Verify queue workers are processing jobs

---

## Render-Specific Notes

### Build Environment
- Node.js version: 18+ (specify in `package.json` engines)
- npm version: 8+ (specify in `package.json` engines)

### Port Configuration
- Render provides `$PORT` environment variable
- Services must listen on `$PORT`

### Environment Variables
- Set in Render dashboard per service
- Can use Render's environment variable groups
- Secrets should be marked as "Secret" in Render

### Health Checks
- Configure health check path in Render
- Expected response: 200 OK
- Health check interval: 60 seconds (default)

### Auto-Deploy
- Configure auto-deploy from Git branch (e.g., `main`, `production`)
- Can use webhooks for manual deploys

### Scaling
- **shopify-api**: Can scale horizontally (stateless)
- **retail-api**: Can scale horizontally (stateless)
- **retail-worker**: Scale based on queue depth
- **web**: Static site (no scaling needed)

---

## Cost Optimization

### Recommendations
1. **Shared Redis**: Use single Redis instance for both APIs (if compatible)
2. **Shared Database**: Consider shared PostgreSQL with schema separation (if data isolation not critical)
3. **Worker Consolidation**: Run workers on API server if low volume
4. **Static Site CDN**: Use Render's CDN for static site (automatic)

---

## Summary

| Service | Build | Start | Env Vars | Dependencies |
|---------|-------|-------|----------|--------------|
| **web** | `npm ci && npm -w apps/web run build` | `npx serve -s apps/web/dist -l $PORT` | 3 required | None |
| **shopify-api** | `npm ci && npm -w apps/shopify-api run prisma:generate && npm -w apps/shopify-api run prisma:migrate:deploy` | `npm -w apps/shopify-api run start` | ~30 required | PostgreSQL, Redis |
| **retail-api** | `npm ci && cd apps/retail-api && npm run prisma:generate && npm run prisma:migrate:deploy` | `cd apps/retail-api && npm run start` | ~40 required | PostgreSQL, Redis |
| **retail-worker** | Same as retail-api | `cd apps/retail-api && npm run worker:sms` | Same as retail-api | PostgreSQL, Redis |

