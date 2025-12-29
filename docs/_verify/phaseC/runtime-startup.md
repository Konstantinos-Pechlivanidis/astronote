# Runtime Startup Verification

## Date
2025-01-23

## Note
**BLOCKER**: Cannot start services in sandbox environment due to permission restrictions. This document outlines expected startup behavior.

## Expected Service Ports

### Retail API
- **Command**: `npm -w apps/retail-api run dev`
- **Expected Port**: `3001` (default, configurable via `PORT` env var)
- **Health Endpoints**:
  - `GET /healthz` - Basic liveness
  - `GET /readiness` - Readiness with DB check
  - `GET /health/db` - Database connectivity

### Shopify API
- **Command**: `npm -w apps/shopify-api run dev`
- **Expected Port**: `3000` (default, configurable via `PORT` env var)
- **Health Endpoints**:
  - `GET /health` - Basic health check
  - `GET /health/full` - Comprehensive health check

### Retail Worker (if required)
- **Command**: `npm -w apps/retail-worker run dev`
- **Note**: May be started automatically by retail-api if `START_WORKER=1`

### Web Frontend
- **Command**: `npm -w apps/web run dev`
- **Expected Port**: `5173` (Vite default, configurable)
- **URL**: `http://localhost:5173`

## Startup Verification Checklist
- ⚠️ **Cannot verify in sandbox** - Manual verification required
- ✅ Service scripts exist in package.json files
- ✅ Port configurations are documented

## Recommendation
Start services manually and verify:
1. All services start without errors
2. Health endpoints respond correctly
3. Frontend can connect to both API backends

## Prisma Generation Required

**CRITICAL**: Before starting services, Prisma clients must be generated:

```bash
npm -w apps/retail-api run prisma:generate
npm -w apps/shopify-api run prisma:generate
```

Without this, both services will fail with:
```
Error: @prisma/client did not initialize yet. Please run "prisma generate"
```

## Verdict
**BLOCKER** - Cannot verify runtime startup in automated environment. Additionally, Prisma clients must be generated before services can start. See `docs/_verify/phaseC/prisma-generation-blocker.md` for details.

