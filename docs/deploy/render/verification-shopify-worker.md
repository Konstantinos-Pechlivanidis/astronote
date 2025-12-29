# Verification Steps - Shopify Worker Separation

## Date
2025-01-23

## Overview
Verification steps to ensure shopify-worker separation works correctly.

---

## Local Verification

### 1. Test API without Workers

```bash
cd apps/shopify-api
START_WORKER=false npm run dev
```

**Expected Output:**
```
Environment loaded: { ... }
Workers disabled (START_WORKER=false) - API mode only
Server started { port: 8080, mode: 'API only (workers disabled)', workersEnabled: false }
Schedulers and pollers disabled (START_WORKER=false)
```

**Verify:**
- ✅ API starts on port 8080
- ✅ Health endpoint works: `curl http://localhost:8080/health`
- ✅ No worker logs (no "Workers started successfully")
- ✅ No queue processing logs

---

### 2. Test Worker Separately

```bash
cd apps/shopify-worker
npm run dev
```

**Expected Output:**
```
Environment loaded: { ... }
Starting Shopify workers...
Workers started successfully
Starting schedulers and pollers...
Shopify worker started successfully {
  environment: 'development',
  mode: 'Worker mode (no HTTP server)',
  workersEnabled: true
}
```

**Verify:**
- ✅ Workers start (SMS, campaign, automation, etc.)
- ✅ Pollers start (event poller, schedulers)
- ✅ No HTTP server (no port binding)
- ✅ No "Server started" message

---

### 3. Test Both Together (Simulating Production)

**Terminal 1:**
```bash
cd apps/shopify-api
START_WORKER=false npm run dev
```

**Terminal 2:**
```bash
cd apps/shopify-worker
npm run dev
```

**Verify:**
- ✅ API runs without workers
- ✅ Worker runs separately
- ✅ Jobs are processed by worker (not API)
- ✅ No duplicate processing

---

## Production Verification

### 1. Shopify API Service

**Check Logs:**
```bash
# In Render dashboard → shopify-api → Logs
# Should see:
Workers disabled (START_WORKER=false) - API mode only
Server started { mode: 'API only (workers disabled)' }
```

**Check Health:**
```bash
curl https://astronote-shopify.onrender.com/health
# Should return: { "ok": true, ... }
```

**Verify No Workers:**
- ✅ No "Workers started successfully" in logs
- ✅ No queue processing logs
- ✅ API endpoints work normally

---

### 2. Shopify Worker Service

**Check Logs:**
```bash
# In Render dashboard → shopify-worker → Logs
# Should see:
Shopify worker started successfully
{ mode: 'Worker mode (no HTTP server)', workersEnabled: true }
Workers started successfully
```

**Verify Workers:**
- ✅ Workers connect to Redis
- ✅ Workers process jobs
- ✅ Pollers run (event poller, schedulers)
- ✅ No HTTP server errors

---

### 3. End-to-End Test

**Create Test Campaign:**
1. Use API to create a campaign
2. Enqueue the campaign
3. Check worker logs for job processing
4. Verify campaign status updates

**Expected Flow:**
1. API receives request → Creates campaign → Queues job
2. Worker picks up job → Processes SMS → Updates status
3. API can query updated status

---

## Troubleshooting

### Issue: Workers Not Processing

**Symptoms:**
- Jobs queued but not processed
- Worker logs show no activity

**Checks:**
1. Worker service is running (Render dashboard)
2. `START_WORKER=true` in worker service (or omitted)
3. Redis connection (check logs for Redis errors)
4. Database connection (check logs for DB errors)
5. Queue names match (should be automatic)

**Fix:**
- Verify env vars are set correctly
- Check Redis connectivity
- Check database connectivity

---

### Issue: Duplicate Processing

**Symptoms:**
- Jobs processed twice
- Both API and worker processing jobs

**Cause:**
- Both services have `START_WORKER=true`

**Fix:**
- Set `START_WORKER=false` in API service
- Verify only worker service processes jobs

---

### Issue: API Shows Workers Enabled

**Symptoms:**
- API logs show "Workers enabled"
- Workers running in API process

**Cause:**
- `START_WORKER` not set to `false` in API service

**Fix:**
- Set `START_WORKER=false` in API service env vars
- Redeploy API service

---

## Verification Checklist

### Local Development
- [ ] API starts without workers (`START_WORKER=false`)
- [ ] Worker starts separately
- [ ] Jobs processed by worker (not API)
- [ ] No duplicate processing

### Production
- [ ] API service shows "Workers disabled"
- [ ] Worker service shows "Worker mode"
- [ ] Jobs processed correctly
- [ ] No errors in logs
- [ ] Health endpoints work

---

## Summary

**Success Criteria:**
- ✅ API runs without workers in production
- ✅ Worker runs separately in production
- ✅ Jobs processed correctly
- ✅ No duplicate processing
- ✅ Default dev behavior unchanged

