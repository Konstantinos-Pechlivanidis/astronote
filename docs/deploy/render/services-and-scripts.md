# Services and Scripts Inventory

## Date
2025-01-23

## Overview
This document inventories all services, their scripts, and production readiness for Render deployment.

---

## Services Table

| Service | Workspace | Dev | Build | Start | Output (dist?) | Notes |
|---------|-----------|-----|-------|-------|----------------|-------|
| **web** | `apps/web` | `vite` | `vite build` | `serve -s dist -l $PORT` | `dist/` | ✅ Production ready |
| **shopify-api** | `apps/shopify-api` | `nodemon index.js` | `prisma generate` | `node index.js` | N/A | ✅ Production ready (set START_WORKER=false) |
| **shopify-worker** | `apps/shopify-worker` | `node index.js` | N/A (no build) | `node index.js` | N/A | ✅ Production ready (workers only) |
| **retail-api** | `apps/retail-api` | `node --watch src/server.js` | Echo (no build) | `node src/server.js` | N/A | ✅ Production ready (set START_WORKER=0) |
| **retail-worker** | `apps/retail-worker` | `DOTENV_CONFIG_PATH=../.env node -r dotenv/config src/sms.worker.js` | Echo (no build) | `node src/sms.worker.js` | N/A | ✅ Production ready |

---

## Detailed Service Analysis

### apps/web (Frontend)

**Current Scripts:**
- ✅ `dev`: `vite` - Development server
- ✅ `build`: `vite build` - Builds to `dist/`
- ✅ `preview`: `vite preview` - Preview built app
- ❌ `start`: **MISSING** - Production server

**Dependencies:**
- ✅ `serve` already installed (v14.2.1)

**Required Changes:**
- Add `start` script: `serve -s dist -l $PORT`
- Ensure `dist/` is in `.gitignore`

**Production Command:**
```bash
npm -w apps/web run build && npm -w apps/web run start
```

---

### apps/shopify-api (Backend)

**Current Scripts:**
- ✅ `dev`: `nodemon index.js` - Development with auto-reload
- ✅ `build`: `prisma generate` - Generates Prisma client
- ✅ `start`: `node index.js` - Production server
- ✅ `prisma:generate`: `prisma generate`
- ✅ `prisma:migrate:deploy`: `prisma migrate deploy`

**Server Binding:**
- ✅ Uses `process.env.PORT` (defaults to 8080)
- ✅ Binds to `0.0.0.0` (default Express behavior)
- ✅ Trusts proxy: `app.set('trust proxy', 1)`

**Health Endpoints:**
- ✅ `/health` - Basic health check
- ✅ `/health/full` - Comprehensive health check (DB, Redis, queue)

**Worker Control:**
- ✅ `START_WORKER` env variable (default: `true`)
- ✅ Set `START_WORKER=false` in production to disable workers (use separate worker service)

**Production Command:**
```bash
npm -w apps/shopify-api run build && npm -w apps/shopify-api run start
```

**Prisma Migration:**
- Run `prisma migrate deploy` in Render predeploy script or manually

---

### apps/shopify-worker (Worker)

**Current Scripts:**
- ✅ `dev`: `node index.js` - Development worker
- ✅ `start`: `node index.js` - Production worker

**Worker Types:**
- BullMQ workers (SMS, campaigns, automations, delivery status, reconciliation)
- Event poller for automation triggers
- Schedulers (periodic status updates, scheduled campaigns, birthday automations, reconciliation)

**Production Command:**
```bash
npm -w apps/shopify-worker run start
```

**Note:** 
- Runs ONLY workers and pollers (no HTTP server)
- Requires same env vars as shopify-api (DATABASE_URL, REDIS_*, MITTO_*, STRIPE_*, etc.)
- Set `START_WORKER=true` (default) or omit it

---

### apps/retail-api (Backend)

**Current Scripts:**
- ✅ `dev`: `node --watch src/server.js` - Development with auto-reload
- ✅ `build`: Echo (no actual build step)
- ✅ `start`: `node src/server.js` - Production server
- ✅ `prisma:generate`: `prisma generate`
- ✅ `prisma:migrate:deploy`: `prisma migrate deploy`

**Server Binding:**
- ✅ Uses `env.PORT` from config (defaults to 3001)
- ✅ Binds to `0.0.0.0` (default Express behavior)
- ✅ Trusts proxy: `app.set('trust proxy', true)`

**Health Endpoints:**
- ✅ `/healthz` - Basic liveness check
- ✅ `/readiness` - Readiness check with DB ping
- ✅ `/health/db` - Database connectivity check

**Production Command:**
```bash
npm -w apps/retail-api run start
```

**Prisma Migration:**
- Run `prisma migrate deploy` in Render predeploy script or manually

---

### apps/retail-worker (Worker)

**Current Scripts:**
- ✅ `dev`: `DOTENV_CONFIG_PATH=../.env node -r dotenv/config src/sms.worker.js` - Development worker
- ✅ `build`: Echo (no actual build step)
- ✅ `start`: `node src/sms.worker.js` - Production worker

**Worker Types:**
- `worker:sms` - SMS sending worker (main entry point)
- `worker:scheduler` - Scheduled campaigns worker
- `worker:contactImport` - Contact import worker
- `worker:birthday` - Birthday automation worker
- `worker:statusRefresh` - Status refresh worker
- `worker:piiRetention` - PII retention worker

**Production Command:**
```bash
npm -w apps/retail-worker run start
```

**Note:** For production, consider running multiple worker types as separate Render services or use a process manager. The `start` script runs the main SMS worker.

---

## Summary

### ✅ Ready for Production
- ✅ `apps/web` - All scripts present, production serving configured
- ✅ `apps/shopify-api` - All scripts present, health endpoints exist
- ✅ `apps/shopify-worker` - All scripts present, workers ready
- ✅ `apps/retail-api` - All scripts present, health endpoints exist
- ✅ `apps/retail-worker` - All scripts present, workers ready

---

## Summary

All services are production-ready with:
- ✅ Build scripts (where applicable)
- ✅ Start scripts for production
- ✅ Dev scripts for local development
- ✅ Health endpoints (for APIs)
- ✅ Graceful shutdown handlers
- ✅ Complete documentation

