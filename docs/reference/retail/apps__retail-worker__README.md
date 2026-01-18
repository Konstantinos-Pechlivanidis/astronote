# Retail Worker - Local Development

## Overview

The Retail Worker is a separate service that processes BullMQ jobs for the Retail API. It handles SMS sending, scheduled campaigns, automations, and other background tasks.

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

The worker loads environment variables from the root `.env` file using `DOTENV_CONFIG_PATH=../.env`.

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

# JWT (for token validation if needed)
JWT_SECRET=your_jwt_secret_key

# Mitto SMS (optional for testing)
MITTO_API_KEY=your_mitto_api_key
MITTO_TRAFFIC_ACCOUNT_ID=your_traffic_account_id
```

**For full list:** See `apps/retail-api/.env.example` or `docs/deploy/checklists/render-retail-worker-env.md`

---

## Running Locally

### Start Main Worker (SMS)

```bash
cd apps/retail-worker
npm run dev
```

**Or using start (production mode):**
```bash
npm run start
```

**Expected output:**
```
Starting SMS worker (Redis will connect on first use)...
SMS worker started successfully
```

---

## Worker Types

The retail-worker supports multiple worker types:

### Main Worker (SMS)
```bash
npm run worker:sms
# or
npm run start  # (default)
```

### Scheduler Worker
```bash
npm run worker:scheduler
```

### Contact Import Worker
```bash
npm run worker:contactImport
```

### Birthday Automation Worker
```bash
npm run worker:birthday
```

### Status Refresh Worker
```bash
npm run worker:statusRefresh
```

### PII Retention Worker
```bash
npm run worker:piiRetention
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
1. Ensure `DATABASE_URL` is set in root `.env` file
2. For local development, you can use a Neon PostgreSQL connection string

---

### Error: Workers not processing jobs

**Problem:** Jobs are queued but not processed.

**Solution:**
1. Verify Redis connection (workers need Redis for BullMQ)
2. Check worker logs for errors
3. Ensure queues are created by the retail-api service
4. Check `QUEUE_DISABLED` is not set to `1`

---

## Development Workflow

### Running API and Worker Together

**Terminal 1 (API):**
```bash
cd apps/retail-api
START_WORKER=0 npm run dev
```

**Terminal 2 (Worker):**
```bash
cd apps/retail-worker
npm run dev
```

This simulates production setup where API and worker run separately.

---

## Architecture

### Worker Structure

- **Entry Point:** `src/sms.worker.js` (main worker)
- **Module System:** CommonJS (require)
- **Logging:** Pino
- **Queue System:** BullMQ with Redis

### Code Sharing

- Workers import code from `apps/retail-api/src/` via relative paths
- No code duplication - shared services and utilities

---

## Production Deployment

### Render Background Worker

**Settings:**
- Type: Background Worker
- Root Directory: `apps/retail-worker`
- Build: `npm ci`
- Start: `npm run start`

**Environment Variables:**
- Same as retail-api (see `docs/deploy/checklists/render-retail-worker-env.md`)

---

## Notes

- The worker **does NOT** start an HTTP server (no Express app)
- The worker **shares code** with `retail-api` via relative imports
- The worker **requires the same env vars** as `retail-api`
- For production, deploy as a **Background Worker** on Render
- Multiple worker types can run as separate Render services for better scalability

---

## See Also

- **Deployment Guide:** `docs/deploy/render/SIMPLE_DEPLOYMENT_GUIDE_GR.md`
- **Env Checklist:** `docs/deploy/checklists/render-retail-worker-env.md`
- **Services Documentation:** `docs/deploy/render/services-and-scripts.md`

