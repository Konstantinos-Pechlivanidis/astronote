# Worker Modes - Deployment Guide

## Overview

The Astronote monorepo supports three worker deployment modes:

1. **`embedded`**: Workers run inside the API process (unified deployment)
2. **`separate`**: Workers run in separate services (scalable deployment)
3. **`off`**: Workers disabled (testing/development)

## Environment Variable: `WORKER_MODE`

### Values
- `embedded`: Start workers in API process
- `separate`: API does NOT start workers; worker service starts them
- `off`: No workers

### Precedence
1. **`WORKER_MODE`** (if set, takes precedence)
2. **`START_WORKER`** (backward compatibility)
   - `START_WORKER=false` or `START_WORKER=0` → equivalent to `WORKER_MODE=separate`
   - `START_WORKER=true` or `START_WORKER=1` → equivalent to `WORKER_MODE=embedded`
3. **Default based on `NODE_ENV`**:
   - `production` → `separate` (safer)
   - `development` → `embedded` (convenient)

### Examples

```bash
# Explicit embedded mode
WORKER_MODE=embedded

# Explicit separate mode
WORKER_MODE=separate

# Disable workers
WORKER_MODE=off

# Backward compatibility (old way)
START_WORKER=true   # equivalent to WORKER_MODE=embedded
START_WORKER=false  # equivalent to WORKER_MODE=separate
```

## Deployment Modes

### Mode 1: Embedded (Unified Deployment)

**Use case**: Simple deployment, single service, lower cost

**Configuration**:
- Set `WORKER_MODE=embedded` on API service
- Do NOT deploy separate worker services

**Services**:
- `retail-api`: API + Workers
- `shopify-api`: API + Workers

**Pros**:
- Simple: one service to manage
- Lower cost: fewer services
- Easier debugging: logs in one place

**Cons**:
- Less scalable: workers share API resources
- Single point of failure: if API crashes, workers stop
- Can't scale workers independently

**Render Configuration**:
```bash
# retail-api service
WORKER_MODE=embedded
DATABASE_URL=...
REDIS_HOST=...
# ... other env vars

# shopify-api service
WORKER_MODE=embedded
DATABASE_URL=...
REDIS_HOST=...
# ... other env vars
```

### Mode 2: Separate (Scalable Deployment)

**Use case**: Production, high volume, need to scale workers independently

**Configuration**:
- Set `WORKER_MODE=separate` on API services
- Deploy separate worker services with `WORKER_MODE=embedded`

**Services**:
- `retail-api`: API only
- `retail-worker`: Workers only
- `shopify-api`: API only
- `shopify-worker`: Workers only

**Pros**:
- Scalable: scale workers independently
- Resilient: if API crashes, workers continue
- Performance: workers don't compete with API for resources

**Cons**:
- More complex: multiple services to manage
- Higher cost: more services

**Render Configuration**:
```bash
# retail-api service
WORKER_MODE=separate
DATABASE_URL=...
REDIS_HOST=...
# ... other env vars

# retail-worker service (Background Worker)
WORKER_MODE=embedded
DATABASE_URL=...
REDIS_HOST=...
# ... same env vars as retail-api

# shopify-api service
WORKER_MODE=separate
DATABASE_URL=...
REDIS_HOST=...
# ... other env vars

# shopify-worker service (Background Worker)
WORKER_MODE=embedded
DATABASE_URL=...
REDIS_HOST=...
# ... same env vars as shopify-api
```

### Mode 3: Off (Testing/Development)

**Use case**: Testing, development, debugging

**Configuration**:
- Set `WORKER_MODE=off` on API services
- Do NOT deploy worker services

**Services**:
- `retail-api`: API only (no workers)
- `shopify-api`: API only (no workers)

**Note**: Jobs will be queued but not processed. Use only for testing.

## Switching Between Modes

### From Embedded to Separate

1. **Deploy worker services**:
   - Create `retail-worker` service on Render (Background Worker)
   - Create `shopify-worker` service on Render (Background Worker)
   - Set `WORKER_MODE=embedded` on both worker services
   - Copy all env vars from API services to worker services

2. **Update API services**:
   - Set `WORKER_MODE=separate` on `retail-api`
   - Set `WORKER_MODE=separate` on `shopify-api`
   - Deploy API services

3. **Verify**:
   - Check `/readiness` endpoint on API services (should show `workers: true` with mode `separate`)
   - Check worker service logs (should show workers started)
   - Enqueue a test job and verify it's processed

### From Separate to Embedded

1. **Update API services**:
   - Set `WORKER_MODE=embedded` on `retail-api`
   - Set `WORKER_MODE=embedded` on `shopify-api`
   - Deploy API services

2. **Stop worker services**:
   - Suspend or delete `retail-worker` service
   - Suspend or delete `shopify-worker` service

3. **Verify**:
   - Check `/readiness` endpoint on API services (should show `workers: true` with mode `embedded`)
   - Check API service logs (should show workers started)
   - Enqueue a test job and verify it's processed

## Health Checks

### `/healthz` (Liveness)
- Always returns `200 OK` if process is alive
- No dependencies checked

### `/readiness` (Readiness)
- Returns `200 OK` only if:
  - Database is connected
  - Redis is connected (if required)
  - Workers are started (if `WORKER_MODE=embedded`)

**Response**:
```json
{
  "status": "ready",
  "checks": {
    "database": true,
    "redis": true,
    "workers": true
  }
}
```

### `/health/full` (Shopify API only)
- Comprehensive health check including:
  - Database
  - Redis
  - Workers (if embedded)
  - Cache
  - Queue

## Safety Features

### Distributed Lock

When `WORKER_MODE=embedded`, the API acquires a Redis distributed lock to prevent double worker execution:

- Lock key: `locks:workers:{service-name}:{NODE_ENV}`
- TTL: 60 seconds (auto-refreshed every 30 seconds)
- If lock is already held, API exits with error (fail fast)

**Why**: Prevents accidental double worker execution if multiple API instances have `WORKER_MODE=embedded`.

### Validation

- Invalid `WORKER_MODE` value → API exits with error
- `WORKER_MODE=embedded` without Redis → API exits with error
- `WORKER_MODE=embedded` without Database → API exits with error

## Troubleshooting

### Workers not starting

1. Check `WORKER_MODE` value:
   ```bash
   echo $WORKER_MODE
   ```

2. Check logs for worker startup errors:
   ```bash
   # Look for "Workers started successfully" or error messages
   ```

3. Check Redis connection:
   ```bash
   # Verify REDIS_HOST, REDIS_PORT, etc. are set correctly
   ```

4. Check distributed lock:
   ```bash
   # If lock is held, another instance may be running workers
   # Check Redis: GET locks:workers:retail-api:production
   ```

### Double worker execution

**Symptom**: Jobs processed twice, duplicate SMS sends

**Cause**: Multiple API instances with `WORKER_MODE=embedded`

**Solution**:
1. Ensure only ONE API instance has `WORKER_MODE=embedded`
2. Or switch to `WORKER_MODE=separate` and deploy dedicated worker services

### Workers not processing jobs

1. Check worker mode:
   ```bash
   # Should be "embedded" or "separate" (not "off")
   ```

2. Check Redis connection:
   ```bash
   # Workers require Redis
   ```

3. Check queue status:
   ```bash
   # Verify jobs are being enqueued
   # Check Redis: LLEN bull:smsQueue:waiting
   ```

## Current Phase: Embedded Mode

For the current deployment phase, we recommend **embedded mode**:

- Set `WORKER_MODE=embedded` on `retail-api` and `shopify-api`
- Do NOT deploy separate worker services yet
- Later, switch to `separate` mode when you need to scale workers independently

## References

- [Render Deployment Guide](../render/go-live-runbook.md)
- [Environment Variables](../env/standard-keys.md)
- [Health Checks](../deploy/smoke/smoke-matrix.md)

