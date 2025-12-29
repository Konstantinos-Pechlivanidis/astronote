# Shopify Worker Separation - Implementation Guide

## Date
2025-01-23

## Overview
This document describes the separation of Shopify BullMQ workers into a standalone deployable service (`apps/shopify-worker`) while keeping `apps/shopify-api` as API-only in production.

---

## Architecture

### Before (Unified)
```
apps/shopify-api/
├── index.js (starts API + workers)
└── queue/worker.js (BullMQ workers)
```

**Behavior:** Workers run in the same process as the API server.

### After (Separated)
```
apps/shopify-api/
├── index.js (starts API only, workers disabled if START_WORKER=false)
└── queue/worker.js (BullMQ workers - shared)

apps/shopify-worker/
└── index.js (starts workers only, no HTTP server)
```

**Behavior:** 
- Production: API runs without workers, workers run in separate service
- Development: Default behavior unchanged (workers run unless explicitly disabled)

---

## Implementation Details

### 1. START_WORKER Toggle

**Location:** `apps/shopify-api/index.js`

**Implementation:**
```javascript
// START_WORKER defaults to true (backward compatible for dev)
const startWorker =
  process.env.START_WORKER !== 'false' && process.env.START_WORKER !== '0';

if (startWorker) {
  await import('./queue/worker.js');
  logger.info('Workers enabled (START_WORKER=true)');
} else {
  logger.info('Workers disabled (START_WORKER=false) - API mode only');
}
```

**Behavior:**
- Default: `true` (workers enabled) - maintains dev behavior
- Production: Set `START_WORKER=false` to disable workers
- Schedulers/pollers also disabled when `START_WORKER=false`

---

### 2. Shopify Worker Service

**Location:** `apps/shopify-worker/index.js`

**Responsibilities:**
- Load environment (reuses `shopify-api/config/loadEnv.js`)
- Start BullMQ workers (imports `shopify-api/queue/worker.js`)
- Start schedulers and pollers:
  - `startPeriodicStatusUpdates()`
  - `startScheduledCampaignsProcessor()`
  - `startEventPoller()`
  - `startBirthdayAutomationScheduler()`
  - `startReconciliationScheduler()`
- **NO HTTP server** (no Express app)

**Shared Code:**
- Reuses all code from `apps/shopify-api/` via relative imports
- Same Prisma client, Redis config, services, etc.
- No code duplication

---

## Deployment Configuration

### Shopify API Service

**Render Settings:**
- Type: Web Service
- Root Directory: `apps/shopify-api`
- Build: `npm ci && npm run build`
- Start: `npm run start`

**Environment Variables:**
- `START_WORKER=false` (critical - disables workers)
- All other vars same as before

**Expected Logs:**
```
Workers disabled (START_WORKER=false) - API mode only
Server started { port: 8080, mode: 'API only (workers disabled)' }
```

---

### Shopify Worker Service

**Render Settings:**
- Type: Background Worker
- Root Directory: `apps/shopify-worker`
- Build: `npm ci` (no build step)
- Start: `npm run start`

**Environment Variables:**
- Same as shopify-api (DATABASE_URL, REDIS_*, MITTO_*, STRIPE_*, etc.)
- `START_WORKER=true` (or omit, defaults to true)
- `RUN_SCHEDULER=true` (for schedulers)

**Expected Logs:**
```
Shopify worker started successfully
{ mode: 'Worker mode (no HTTP server)', workersEnabled: true }
Workers started successfully
```

---

## Local Development

### Default Behavior (Unchanged)

```bash
# Workers run automatically (START_WORKER defaults to true)
npm -w @astronote/shopify-api run dev
```

**Logs:**
```
Workers enabled (START_WORKER=true)
Server started { mode: 'API + Workers' }
```

### Disable Workers (Testing)

```bash
# Set START_WORKER=false
START_WORKER=false npm -w @astronote/shopify-api run dev
```

**Logs:**
```
Workers disabled (START_WORKER=false) - API mode only
Server started { mode: 'API only (workers disabled)' }
```

### Run Worker Separately

```bash
# Start worker service
npm -w @astronote/shopify-worker run dev
```

**Logs:**
```
Shopify worker started successfully
{ mode: 'Worker mode (no HTTP server)' }
```

---

## Verification Steps

### 1. Local Verification

**Test API without workers:**
```bash
cd apps/shopify-api
START_WORKER=false npm run dev
```

**Expected:**
- ✅ API starts on port 8080
- ✅ Health endpoints work (`/health`, `/health/full`)
- ✅ No worker logs
- ✅ Log shows "API mode only (workers disabled)"

**Test worker separately:**
```bash
cd apps/shopify-worker
npm run dev
```

**Expected:**
- ✅ Worker connects to Redis
- ✅ Workers start (SMS, campaign, automation, etc.)
- ✅ Pollers start (event poller, schedulers)
- ✅ Log shows "Worker mode (no HTTP server)"
- ✅ No HTTP server (no port binding)

---

### 2. Production Verification

**Shopify API:**
```bash
curl https://astronote-shopify.onrender.com/health
# Should return 200 OK

# Check logs in Render dashboard
# Should show: "Workers disabled (START_WORKER=false) - API mode only"
```

**Shopify Worker:**
```bash
# Check logs in Render dashboard
# Should show: "Shopify worker started successfully"
# Should show: "Workers started successfully"
# Should show: "Worker mode (no HTTP server)"
```

**Queue Processing:**
- Create a test campaign
- Verify jobs are queued
- Check worker logs for job processing
- Verify jobs complete successfully

---

## Environment Variables

### Shopify API (Production)

**Required:**
- `START_WORKER=false` (critical)

**All other vars:** Same as before (see `docs/deploy/checklists/render-shopify-api-env.md`)

---

### Shopify Worker (Production)

**Required:**
- `START_WORKER=true` (or omit, defaults to true)
- `RUN_SCHEDULER=true` (for schedulers)

**All other vars:** Same as shopify-api (see `docs/deploy/checklists/render-shopify-worker-env.md`)

**Not needed:**
- `PORT` (no HTTP server)
- `HOST` (no OAuth callbacks)
- `CORS_ALLOWLIST` (no HTTP endpoints)
- `URL_SHORTENER_*` (no HTTP endpoints)

---

## Troubleshooting

### Workers Not Processing Jobs

**Check:**
1. Worker service is running (check Render dashboard)
2. `START_WORKER=true` in worker service
3. Redis connection (check logs)
4. Database connection (check logs)
5. Queue names match (should be automatic)

### Duplicate Job Processing

**Cause:** Both API and worker have `START_WORKER=true`

**Fix:** Set `START_WORKER=false` in API service

### API Shows "Workers disabled" but Jobs Not Processing

**Cause:** Worker service not running or misconfigured

**Fix:**
1. Verify worker service is deployed
2. Check worker logs for errors
3. Verify env vars are set correctly

---

## Migration Notes

### Backward Compatibility

- ✅ Default behavior unchanged (workers enabled in dev)
- ✅ Existing code paths preserved
- ✅ No breaking changes to API endpoints
- ✅ SKIP_QUEUES flag still works (for tests)

### Breaking Changes

- ❌ None - fully backward compatible

---

## Summary

### Benefits

1. **Scalability:** Can scale workers independently
2. **Reliability:** Worker crashes don't affect API
3. **Performance:** Better resource management
4. **Consistency:** Same architecture as retail-worker

### Trade-offs

- More services to manage (5 instead of 4)
- More environment variables to set
- Slightly more complex deployment

### Recommendation

✅ **Use separated workers in production** for better scalability and reliability.

---

## Files Modified

1. `apps/shopify-api/index.js` - Added START_WORKER toggle
2. `apps/shopify-api/env.example` - Added START_WORKER documentation
3. `apps/shopify-worker/package.json` - New workspace
4. `apps/shopify-worker/index.js` - New worker entry point
5. `package.json` - Added dev:shopify-worker script
6. `docs/deploy/render/services-and-scripts.md` - Updated service table
7. `docs/deploy/render/go-live-runbook.md` - Added shopify-worker section
8. `docs/deploy/render/SIMPLE_DEPLOYMENT_GUIDE_GR.md` - Added shopify-worker section
9. `docs/deploy/render/QUICK_REFERENCE.md` - Updated commands and env vars
10. `docs/deploy/checklists/render-shopify-worker-env.md` - New checklist

---

## Next Steps

1. ✅ Code changes complete
2. ✅ Documentation updated
3. ⏳ Test locally with START_WORKER=false
4. ⏳ Deploy to Render
5. ⏳ Verify workers process jobs correctly

