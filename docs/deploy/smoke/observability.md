# Observability Checklist

## Date
2025-01-23

## Overview
Minimal observability checklist for production deployment on Render. What logs to check, what success/failure looks like, and recommended alerts.

---

## Log Locations

### Render Dashboard Logs

**Access:**
- Render dashboard → Service → Logs
- Real-time streaming available
- Historical logs available (retention depends on plan)

**Services:**
- `astronote-web` - Frontend logs
- `astronote-shopify-api` - Shopify API logs
- `astronote-retail-api` - Retail API logs
- `astronote-retail-worker` - Worker logs

---

## What to Check in Logs

### 1. Request Logs

#### Success Pattern

**Shopify API:**
```
[INFO] Server started { port: 8080, environment: 'production' }
[INFO] GET /health -> 200
[INFO] GET /dashboard -> 200 { requestId: '...', shopId: '...' }
```

**Retail API:**
```
[INFO] API running on http://localhost:3001
[INFO] GET /healthz -> 200
[INFO] GET /api/dashboard/kpis -> 200 { requestId: '...', userId: '...' }
```

**Web Frontend:**
```
[INFO] Serving static files from dist/
[INFO] GET / -> 200
[INFO] GET /retail/login -> 200
```

#### Failure Pattern

**API Errors:**
```
[ERROR] Database connection failed { error: '...' }
[ERROR] Redis connection error { error: '...' }
[ERROR] Campaign creation failed { error: '...', shopId: '...' }
[WARN] Rate limit exceeded { key: '...', current: 101, max: 100 }
```

**Frontend Errors:**
```
[ERROR] Failed to load resource: https://astronote-shopify.onrender.com/dashboard
[ERROR] CORS error: Origin not allowed
```

**Action:** Check error message, verify environment variables, check database/Redis connectivity.

---

### 2. Worker Processing Logs

#### Success Pattern

**Retail Worker:**
```
[INFO] SMS worker started
[INFO] Processing job { jobId: '...', campaignId: '...' }
[INFO] Job completed { jobId: '...', status: 'completed' }
[INFO] Queue stats { waiting: 0, active: 5, completed: 100, failed: 0 }
```

**Shopify API Worker (in-process):**
```
[INFO] BullMQ worker started
[INFO] Processing campaign { campaignId: '...', shopId: '...' }
[INFO] Campaign sent { campaignId: '...', sent: 100, failed: 0 }
```

#### Failure Pattern

**Worker Errors:**
```
[ERROR] Job failed { jobId: '...', error: '...', attempts: 3/5 }
[ERROR] Queue connection failed { error: '...' }
[WARN] Job stalled { jobId: '...', stalledAfter: 30000 }
```

**Action:** Check Redis connection, verify job data, check for stuck jobs.

---

### 3. Webhook Delivery Logs

#### Success Pattern

**Stripe Webhooks:**
```
[INFO] Stripe webhook received { eventType: 'payment_intent.succeeded', eventId: '...', shopId: '...' }
[INFO] Webhook processed successfully { eventId: '...', shopId: '...' }
```

**Shopify Webhooks:**
```
[INFO] Shopify webhook received { topic: 'customers/create', shopDomain: '...' }
[INFO] Webhook processed successfully { topic: '...', shopDomain: '...' }
```

**Mitto Webhooks:**
```
[INFO] Mitto webhook received { event: 'delivery_status', messageId: '...' }
[INFO] Delivery status updated { messageId: '...', status: 'delivered' }
```

#### Failure Pattern

**Webhook Errors:**
```
[ERROR] Webhook signature verification failed { shopDomain: '...', topic: '...' }
[ERROR] Webhook processing failed { eventId: '...', error: '...' }
[WARN] Webhook replay detected { eventId: '...', shopId: '...' }
```

**Action:** Check webhook secret, verify signature, check for duplicate processing.

---

### 4. Database Query Logs

#### Success Pattern

**Normal Queries:**
```
[DEBUG] Database query { query: 'SELECT ...', duration: 45ms }
[INFO] Dashboard data fetched { shopId: '...', duration: 120ms }
```

#### Failure Pattern

**Database Errors:**
```
[ERROR] Database connection error { error: 'Connection timeout' }
[ERROR] Query failed { query: '...', error: '...' }
[WARN] Slow query { query: '...', duration: 5000ms }
```

**Action:** Check `DATABASE_URL`, verify database is accessible, check connection pool limits.

---

### 5. Redis Connection Logs

#### Success Pattern

**Redis Connected:**
```
[INFO] Redis connecting...
[INFO] Redis ready
[INFO] Rate limit check { key: '...', allowed: true, remaining: 99 }
```

#### Failure Pattern

**Redis Errors:**
```
[WARN] Redis connection error: Connection refused
[ERROR] Rate limit check failed, allowing request { key: '...', error: '...' }
[WARN] Redis not available, allowing request (rate limit disabled)
```

**Action:** Check `REDIS_HOST`, `REDIS_PASSWORD`, verify Redis is accessible, check eviction policy.

---

## Success Indicators

### Service Health

**All Services Running:**
- ✅ Health endpoints return 200 OK
- ✅ No errors in logs
- ✅ Response times < 500ms (p95)

**Frontend:**
- ✅ Pages load without errors
- ✅ API calls succeed
- ✅ No CORS errors in browser console

**APIs:**
- ✅ Health checks pass
- ✅ Database connected
- ✅ Redis connected (if configured)
- ✅ Queue processing (if applicable)

**Worker:**
- ✅ Jobs being processed
- ✅ No stuck jobs
- ✅ Queue depth decreasing

---

## Failure Indicators

### Critical Failures

**Service Down:**
- ❌ Health endpoint returns 500/503
- ❌ Service not responding
- ❌ Render shows service as "stopped"

**Database Issues:**
- ❌ Database connection errors
- ❌ Query timeouts
- ❌ Migration failures

**Redis Issues:**
- ❌ Redis connection errors
- ❌ Rate limiting disabled (fallback)
- ❌ Queue not processing

**Worker Issues:**
- ❌ Jobs failing repeatedly
- ❌ Queue depth increasing
- ❌ Worker crashes

---

## Recommended Alerts

### Basic Alerts (Render Built-in)

**Service Health:**
- Service down (Render automatically alerts)
- Health check failures (if configured)

**Resource Usage:**
- High CPU usage (>80%)
- High memory usage (>80%)
- Disk space low

### Application-Level Alerts (Manual Setup)

**Error Rate:**
- Alert if error rate > 5% (5xx responses)
- Alert if error rate spikes (>10% increase)

**Response Time:**
- Alert if p95 response time > 1000ms
- Alert if response time spikes (>50% increase)

**Database:**
- Alert if database connection errors > 10/min
- Alert if query timeouts > 5/min

**Redis:**
- Alert if Redis connection errors > 5/min
- Alert if rate limiting disabled (fallback mode)

**Worker:**
- Alert if failed jobs > 10/min
- Alert if queue depth > 1000
- Alert if worker crashes

**Webhooks:**
- Alert if webhook signature failures > 5/min
- Alert if webhook processing errors > 10/min

---

## Log Monitoring Tools

### Render Built-in

**Features:**
- Real-time log streaming
- Log search/filter
- Historical logs (retention depends on plan)

**Usage:**
- Render dashboard → Service → Logs
- Filter by log level (INFO, WARN, ERROR)
- Search by keyword

### External Tools (Optional)

**Sentry:**
- Error tracking
- Performance monitoring
- Alerting

**Setup:**
- Set `SENTRY_DSN` in environment variables
- Errors automatically sent to Sentry

**Log Aggregation:**
- Consider external log aggregation (Datadog, Logtail, etc.) for advanced monitoring

---

## Key Metrics to Monitor

### Request Metrics

- **Request Rate:** Requests per second
- **Error Rate:** 5xx responses / total requests
- **Response Time:** p50, p95, p99 percentiles
- **Status Codes:** Distribution of 2xx, 4xx, 5xx

### Database Metrics

- **Connection Pool:** Active connections / max connections
- **Query Time:** Average query duration
- **Query Errors:** Failed queries per minute

### Redis Metrics

- **Connection Status:** Connected / disconnected
- **Memory Usage:** Used memory / max memory
- **Commands:** Commands per second

### Queue Metrics

- **Queue Depth:** Waiting jobs count
- **Processing Rate:** Jobs processed per minute
- **Failure Rate:** Failed jobs / total jobs
- **Stuck Jobs:** Jobs stuck > 5 minutes

---

## Log Retention

### Render Logs

**Free Plan:**
- 7 days retention

**Paid Plans:**
- Longer retention (check Render docs)

**Recommendation:**
- Export important logs for long-term storage
- Use external log aggregation for compliance

---

## Troubleshooting Guide

### High Error Rate

1. **Check Logs:**
   - Filter by ERROR level
   - Look for common error patterns

2. **Check Health:**
   - Verify database connectivity
   - Verify Redis connectivity
   - Check service status

3. **Check Recent Changes:**
   - Review recent deployments
   - Check environment variable changes

### Slow Response Times

1. **Check Database:**
   - Look for slow queries
   - Check connection pool usage
   - Verify database load

2. **Check Redis:**
   - Verify Redis is responding
   - Check memory usage
   - Verify connection pool

3. **Check Application:**
   - Look for blocking operations
   - Check for memory leaks
   - Verify CPU usage

### Worker Not Processing

1. **Check Worker Logs:**
   - Verify worker is running
   - Check for errors
   - Verify Redis connection

2. **Check Queue:**
   - Verify queue exists
   - Check queue depth
   - Look for stuck jobs

3. **Check Configuration:**
   - Verify `QUEUE_DISABLED` is not set
   - Check worker concurrency
   - Verify Redis connection

---

## Summary

### Logs to Check Regularly

- ✅ Request logs (success/failure patterns)
- ✅ Worker processing logs
- ✅ Webhook delivery logs
- ✅ Database query logs
- ✅ Redis connection logs

### Success Indicators

- ✅ Health endpoints return 200 OK
- ✅ No errors in logs
- ✅ Jobs being processed
- ✅ Webhooks delivered successfully

### Failure Indicators

- ❌ Health endpoints return 5xx
- ❌ High error rate in logs
- ❌ Jobs failing repeatedly
- ❌ Webhook signature failures

### Recommended Alerts

- Service health (automatic in Render)
- Error rate > 5%
- Response time > 1000ms (p95)
- Database connection errors
- Worker failures
- Queue depth > 1000

