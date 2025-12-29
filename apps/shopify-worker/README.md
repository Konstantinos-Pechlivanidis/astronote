# Shopify Worker - Local Development

## Overview

The Shopify Worker is a separate service that processes BullMQ jobs and runs schedulers/pollers. It shares the same environment variables as `shopify-api`.

---

## Prerequisites

### 1. Redis Running Locally

The worker requires Redis to be running. Install and start Redis:

**macOS (Homebrew):**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 redis:latest
```

**Verify Redis is running:**
```bash
redis-cli ping
# Should return: PONG
```

---

## Environment Variables

The worker uses the **same environment variables** as `shopify-api`. The `loadEnv` function loads from:

1. **Root `.env`** (shared vars)
2. **`apps/shopify-api/.env`** (app-specific vars)
3. **`apps/shopify-api/.env.local`** (local overrides, gitignored)

### Required Variables for Local Development

**Minimum required:**
```bash
# Redis (local)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=  # Leave empty for local Redis without password
REDIS_TLS=false

# Database (Neon or local Postgres)
DATABASE_URL=postgresql://user:password@host:port/db
DIRECT_URL=postgresql://user:password@host:port/db

# Shopify
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret

# Mitto SMS (optional for testing)
MITTO_API_KEY=your_mitto_api_key
MITTO_TRAFFIC_ACCOUNT_ID=your_traffic_account_id

# Worker Control
START_WORKER=true  # (or omit, defaults to true)
RUN_SCHEDULER=true
```

**For full list:** See `apps/shopify-api/env.example`

---

## Running Locally

### Start Worker

```bash
cd apps/shopify-worker
npm run dev
```

**Expected output:**
```
Environment loaded: { nodeEnv: 'development', hasDatabase: true, hasRedis: true, ... }
Starting Shopify workers...
Workers started successfully
Starting schedulers and pollers...
Shopify worker started successfully {
  environment: 'development',
  mode: 'Worker mode (no HTTP server)',
  workersEnabled: true
}
```

---

## Troubleshooting

### Error: `ECONNREFUSED` on Redis (port 6379)

**Problem:** Redis is not running locally.

**Solution:**
1. Start Redis (see Prerequisites above)
2. Verify Redis is running: `redis-cli ping`
3. Check `REDIS_HOST` and `REDIS_PORT` in your `.env` file

---

### Error: `Environment variable not found: DATABASE_URL`

**Problem:** Database connection string is missing.

**Solution:**
1. Ensure `DATABASE_URL` is set in `.env` or `apps/shopify-api/.env`
2. For local development, you can use a Neon PostgreSQL connection string

---

### Error: Workers not processing jobs

**Problem:** Jobs are queued but not processed.

**Solution:**
1. Verify `START_WORKER=true` (or omit, defaults to true)
2. Check Redis connection (workers need Redis for BullMQ)
3. Check worker logs for errors
4. Ensure queues are created by the API service

---

## Development Workflow

### Running API and Worker Together

**Terminal 1 (API):**
```bash
cd apps/shopify-api
START_WORKER=false npm run dev
```

**Terminal 2 (Worker):**
```bash
cd apps/shopify-worker
npm run dev
```

This simulates production setup where API and worker run separately.

---

## Notes

- The worker **does NOT** start an HTTP server (no Express app)
- The worker **shares all code** with `shopify-api` via relative imports
- The worker **requires the same env vars** as `shopify-api`
- For production, deploy as a **Background Worker** on Render

---

## See Also

- **Deployment Guide:** `docs/deploy/render/SIMPLE_DEPLOYMENT_GUIDE_GR.md`
- **Env Checklist:** `docs/deploy/checklists/render-shopify-worker-env.md`
- **Implementation Guide:** `docs/deploy/render/shopify-worker-separation.md`

