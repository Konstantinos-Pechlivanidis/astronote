# Workers Comparison - Retail vs Shopify

## Date
2025-01-23

## Overview

Comparison between `apps/retail-worker` and `apps/shopify-worker` to ensure consistency and deployment readiness.

---

## Architecture Comparison

| Aspect | Retail Worker | Shopify Worker |
|--------|--------------|---------------|
| **Module System** | CommonJS (`require`) | ESM (`import/export`) |
| **Entry Point** | `src/sms.worker.js` | `index.js` |
| **Env Loading** | `dotenv` with `DOTENV_CONFIG_PATH=../.env` | `loadEnv` from `shopify-api/config/loadEnv.js` |
| **Logging** | Pino (standalone) | Logger from `shopify-api/utils/logger.js` |
| **Code Sharing** | Relative imports from `retail-api/src/` | Relative imports from `shopify-api/` |
| **Graceful Shutdown** | ✅ SIGTERM, SIGINT | ✅ SIGTERM, SIGINT, uncaughtException, unhandledRejection |

---

## Package.json Comparison

| Field | Retail Worker | Shopify Worker |
|-------|--------------|----------------|
| **name** | `@astronote/retail-worker` | `@astronote/shopify-worker` |
| **version** | `1.0.0` | `1.0.0` |
| **type** | (CommonJS default) | `"module"` |
| **private** | ✅ `true` | ✅ `true` |
| **description** | ✅ Present | ✅ Present |
| **author** | ✅ `Astronote Team` | ✅ `Astronote Team` |
| **license** | ✅ `ISC` | ✅ `ISC` |
| **engines** | ✅ `node >=18.0.0` | ✅ `node >=18.0.0` |
| **keywords** | ✅ Present | ✅ Present |

---

## Scripts Comparison

| Script | Retail Worker | Shopify Worker |
|-------|--------------|----------------|
| **build** | ✅ `echo 'No build step...'` | ✅ `echo 'No build step...'` |
| **start** | ✅ `node src/sms.worker.js` | ✅ `node index.js` |
| **dev** | ✅ `DOTENV_CONFIG_PATH=../.env node -r dotenv/config src/sms.worker.js` | ✅ `node index.js` |
| **worker:sms** | ✅ Present | N/A (single entry point) |
| **worker:scheduler** | ✅ Present | N/A (handled in main) |
| **worker:contactImport** | ✅ Present | N/A |
| **worker:birthday** | ✅ Present | N/A (handled in main) |
| **worker:statusRefresh** | ✅ Present | N/A |
| **worker:piiRetention** | ✅ Present | N/A |

---

## Worker Types

### Retail Worker
- **Multiple worker types** (SMS, scheduler, contactImport, birthday, statusRefresh, piiRetention)
- Each worker type has its own entry point
- Can run multiple workers as separate processes

### Shopify Worker
- **Single entry point** (`index.js`)
- All workers started from one process
- Workers: SMS, campaign, automation, delivery status, reconciliation
- Pollers: event poller, schedulers

---

## Environment Variables

### Retail Worker
- Loads from root `.env` via `DOTENV_CONFIG_PATH=../.env`
- Uses same env vars as `retail-api`
- No special worker-specific env vars

### Shopify Worker
- Loads from root `.env` and `apps/shopify-api/.env` via `loadEnv`
- Uses same env vars as `shopify-api`
- Worker-specific: `START_WORKER=true` (or omit), `RUN_SCHEDULER=true`

---

## Deployment Readiness

### ✅ Both Workers Ready

| Check | Retail Worker | Shopify Worker |
|-------|--------------|---------------|
| **Syntax Valid** | ✅ | ✅ |
| **Start Script** | ✅ | ✅ |
| **Build Script** | ✅ | ✅ |
| **Graceful Shutdown** | ✅ | ✅ |
| **Documentation** | ✅ README.md | ✅ README.md |
| **Package.json Complete** | ✅ | ✅ |
| **Deployment Docs** | ✅ | ✅ |

---

## Production Deployment

### Retail Worker (Render)

**Settings:**
- Type: Background Worker
- Root Directory: `apps/retail-worker`
- Build: `npm ci`
- Start: `npm run start`

**Env Vars:**
- Same as retail-api (see `docs/deploy/checklists/render-retail-worker-env.md`)

---

### Shopify Worker (Render)

**Settings:**
- Type: Background Worker
- Root Directory: `apps/shopify-worker`
- Build: `npm ci`
- Start: `npm run start`

**Env Vars:**
- Same as shopify-api (see `docs/deploy/checklists/render-shopify-worker-env.md`)
- `START_WORKER=true` (or omit)
- `RUN_SCHEDULER=true`

---

## Differences (By Design)

### Module System
- **Retail:** CommonJS (legacy codebase)
- **Shopify:** ESM (modern codebase)

### Worker Architecture
- **Retail:** Multiple worker types, can scale independently
- **Shopify:** Single entry point, all workers in one process

### Env Loading
- **Retail:** Simple dotenv with explicit path
- **Shopify:** Centralized loadEnv with priority order

---

## Consistency Improvements Made

1. ✅ Added `build` script to shopify-worker
2. ✅ Added `description`, `author`, `license` to both workers
3. ✅ Added `engines` to retail-worker
4. ✅ Added `keywords` to both workers
5. ✅ Fixed documentation (retail-worker start script was incorrectly marked as missing)
6. ✅ Added README.md to retail-worker
7. ✅ Updated services-and-scripts.md with correct info

---

## Summary

**Status: ✅ BOTH WORKERS READY FOR DEPLOYMENT**

Both workers are:
- ✅ Syntax valid
- ✅ Have start scripts
- ✅ Have build scripts
- ✅ Have graceful shutdown
- ✅ Have complete package.json
- ✅ Have documentation
- ✅ Have deployment guides

**Differences are by design** (different module systems, different architectures) and do not affect deployment readiness.

---

## Next Steps

1. ✅ Code consistency: Complete
2. ✅ Documentation: Complete
3. ⏳ Test locally (requires Redis)
4. ⏳ Deploy to Render
5. ⏳ Verify workers process jobs correctly

