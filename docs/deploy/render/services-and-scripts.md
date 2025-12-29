# Services and Scripts Inventory

## Date
2025-01-23

## Overview
This document inventories all services, their scripts, and production readiness for Render deployment.

---

## Services Table

| Service | Workspace | Dev | Build | Start | Output (dist?) | Notes |
|---------|-----------|-----|-------|-------|----------------|-------|
| **web** | `apps/web` | `vite` | `vite build` | ⚠️ Missing | `dist/` | Needs `start` script with `serve` |
| **shopify-api** | `apps/shopify-api` | `nodemon index.js` | `prisma generate` | `node index.js` | N/A | Prisma generate in build |
| **retail-api** | `apps/retail-api` | `node --watch src/server.js` | Echo (no build) | `node src/server.js` | N/A | Pure JS, no build step |
| **retail-worker** | `apps/retail-worker` | `node src/sms.worker.js` | Echo (no build) | ⚠️ Missing | N/A | Needs `start` script |

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

**Production Command:**
```bash
npm -w apps/shopify-api run build && npm -w apps/shopify-api run start
```

**Prisma Migration:**
- Run `prisma migrate deploy` in Render predeploy script or manually

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
- ✅ `dev`: `node src/sms.worker.js` - Development worker
- ✅ `build`: Echo (no actual build step)
- ❌ `start`: **MISSING** - Production worker

**Worker Types:**
- `worker:sms` - SMS sending worker
- `worker:scheduler` - Scheduled campaigns worker
- `worker:contactImport` - Contact import worker
- `worker:birthday` - Birthday automation worker
- `worker:statusRefresh` - Status refresh worker
- `worker:piiRetention` - PII retention worker

**Required Changes:**
- Add `start` script: `node src/sms.worker.js` (or make configurable)

**Production Command:**
```bash
npm -w apps/retail-worker run start
```

**Note:** For production, consider running multiple worker types as separate Render services or use a process manager.

---

## Summary

### ✅ Ready for Production
- ✅ `apps/shopify-api` - All scripts present, health endpoints exist
- ✅ `apps/retail-api` - All scripts present, health endpoints exist

### ⚠️ Needs Changes
- ⚠️ `apps/web` - Missing `start` script (add `serve -s dist -l $PORT`)
- ⚠️ `apps/retail-worker` - Missing `start` script (add `node src/sms.worker.js`)

---

## Next Steps

1. Add `start` script to `apps/web/package.json`
2. Add `start` script to `apps/retail-worker/package.json`
3. Verify all services bind to `0.0.0.0` (default Express behavior)
4. Document Prisma migration strategy for Render

