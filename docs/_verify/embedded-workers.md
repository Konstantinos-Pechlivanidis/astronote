# Embedded Workers Verification

## Overview

This document describes the verification process for embedded worker mode.

## Prerequisites

1. Both APIs are running
2. Redis is running and accessible
3. Database is accessible
4. `WORKER_MODE=embedded` is set (or default in development)

## Verification Steps

### 1. Health Checks

#### Liveness (`/healthz`)
```bash
curl http://localhost:3001/healthz
# Expected: {"status":"ok"}

curl http://localhost:8080/healthz
# Expected: {"status":"ok"}
```

#### Readiness (`/readiness`)
```bash
curl http://localhost:3001/readiness
# Expected: {"status":"ready","checks":{"database":true,"redis":true,"workers":true}}

curl http://localhost:8080/readiness
# Expected: {"status":"ready","checks":{"database":true,"redis":true,"workers":true}}
```

**If `workers: false`**: Workers failed to start. Check logs for errors.

### 2. Full Health Check (Shopify API)

```bash
curl http://localhost:8080/health/full
# Expected: {"ok":true,"checks":{"db":{...},"redis":{...},"workers":{...}}}
```

Check `checks.workers.status`:
- `healthy`: Workers started successfully
- `unhealthy`: Workers failed to start
- `unknown`: Worker check failed

### 3. Log Verification

Check API startup logs for:

**Retail API**:
```
[Server] Worker mode: embedded
[Workers] Starting workers in embedded mode...
[Workers] Workers started successfully (embedded mode)
[Workers] Queue: smsQueue, Concurrency: 5
```

**Shopify API**:
```
Worker mode resolved { mode: 'embedded' }
Starting workers in embedded mode...
Workers started successfully (embedded mode)
```

### 4. Worker Lock Verification

Check Redis for worker lock:
```bash
redis-cli GET locks:workers:retail-api:development
# Expected: <lock-token> (if embedded mode)

redis-cli GET locks:workers:shopify-api:development
# Expected: <lock-token> (if embedded mode)
```

**If lock exists**: Workers are running in embedded mode.

**If lock doesn't exist**:
- Workers may not have started
- Or `WORKER_MODE` is not `embedded`

### 5. Job Processing Test

#### Retail API
```bash
# Create a test campaign and enqueue it
# Verify jobs are processed by checking:
# - Campaign status changes to "sent"
# - Messages are sent
# - Worker logs show job processing
```

#### Shopify API
```bash
# Create a test campaign and enqueue it
# Verify jobs are processed by checking:
# - Campaign status changes to "sent"
# - Messages are sent
# - Worker logs show job processing
```

## Automated Verification

Run the verification script:
```bash
./scripts/verify-embedded-workers.sh
```

Or with custom URLs:
```bash
./scripts/verify-embedded-workers.sh http://localhost:3001 http://localhost:8080
```

## Common Issues

### Workers not starting

**Symptoms**:
- `/readiness` shows `workers: false`
- Logs show "Workers not started"

**Causes**:
1. `WORKER_MODE` is not `embedded`
2. Redis not accessible
3. Database not accessible
4. Worker lock already held

**Solutions**:
1. Check `WORKER_MODE` env var
2. Verify Redis connection
3. Verify Database connection
4. Check for duplicate API instances

### Double worker execution

**Symptoms**:
- Jobs processed twice
- Duplicate SMS sends

**Causes**:
- Multiple API instances with `WORKER_MODE=embedded`

**Solutions**:
1. Ensure only ONE API instance has `WORKER_MODE=embedded`
2. Or switch to `WORKER_MODE=separate` and deploy dedicated worker services

### Workers not processing jobs

**Symptoms**:
- Jobs queued but not processed
- Campaigns stuck in "sending" status

**Causes**:
1. Workers not started
2. Redis connection issues
3. Queue disabled (`QUEUE_DISABLED=1`)

**Solutions**:
1. Check worker startup logs
2. Verify Redis connection
3. Check `QUEUE_DISABLED` env var

## Production Verification

For production deployments:

1. **Health checks**: Monitor `/readiness` endpoint
2. **Logs**: Monitor for "Workers started successfully"
3. **Metrics**: Monitor job processing rates
4. **Alerts**: Set up alerts for worker failures

## References

- [Worker Modes Guide](../deploy/worker-modes.md)
- [Health Checks](../deploy/smoke/smoke-matrix.md)
- [Render Deployment](../deploy/render/go-live-runbook.md)

