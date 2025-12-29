# Redis Requirements

## Date
2025-01-23

## Overview
This document explains Redis configuration requirements, particularly the eviction policy requirement.

---

## Redis Eviction Policy

### Requirement: `noeviction`

**CRITICAL**: Redis must be configured with the `noeviction` eviction policy for production use.

### What is `noeviction`?

The `noeviction` policy means:
- Redis will **NOT** evict keys when memory is full
- Instead, Redis will **reject write operations** when memory limit is reached
- This prevents data loss from automatic key eviction

### Why is this required?

1. **Queue Jobs**: BullMQ stores job data in Redis. Eviction would cause job loss.
2. **Rate Limiting**: Rate limit counters must persist. Eviction would break rate limiting.
3. **Caching**: Cache eviction is acceptable, but queue/rate-limit eviction is not.
4. **Data Integrity**: Prevents silent data loss from eviction.

### Where to Configure

**Redis Provider Settings** (not in application code):
- **Redis Cloud**: Set in Redis Cloud dashboard → Configuration → Max Memory Policy → `noeviction`
- **Self-hosted Redis**: Set in `redis.conf`:
  ```
  maxmemory-policy noeviction
  ```

### Application Behavior

The application does NOT:
- ❌ Check eviction policy at startup
- ❌ Validate eviction policy
- ❌ Set eviction policy (must be set in Redis provider)

The application DOES:
- ✅ Use Redis for queues (BullMQ)
- ✅ Use Redis for rate limiting
- ✅ Use Redis for caching
- ✅ Fail gracefully if Redis is unavailable

---

## Redis Connection Configuration

### Individual Variables (Preferred for Redis Cloud)

```bash
REDIS_HOST=redis-xxx.xxx.xxx.xxx
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=your_password
REDIS_DB=0
REDIS_TLS=true
```

### REDIS_URL (Fallback)

```bash
REDIS_URL=rediss://username:password@host:port/db
```

### Priority Order

1. Individual variables (`REDIS_HOST`, `REDIS_PORT`, etc.)
2. `REDIS_URL` (if individual vars not set)

---

## Redis Usage in Application

### Retail API
- **Queues**: BullMQ for SMS sending, scheduling, contact import
- **Rate Limiting**: Per-traffic-account, per-tenant, global limits
- **Caching**: Template cache, segment cache

### Shopify API
- **Queues**: BullMQ for SMS sending, campaign processing
- **Rate Limiting**: Per-traffic-account, per-tenant, global limits
- **Caching**: Various service caches

### Retail Worker
- **Queues**: Consumes BullMQ jobs
- **Rate Limiting**: Uses same Redis instance as retail-api

---

## Monitoring & Alerts

### Recommended Monitoring

1. **Memory Usage**: Monitor Redis memory usage (should stay below limit)
2. **Eviction Count**: Should be 0 (if `noeviction` is set correctly)
3. **Connection Status**: Monitor Redis connection health
4. **Queue Depth**: Monitor BullMQ queue sizes

### Warning Signs

- ⚠️ **Memory near limit**: Increase Redis memory or optimize usage
- ⚠️ **Evictions > 0**: Eviction policy not set to `noeviction`
- ⚠️ **Connection errors**: Check Redis availability and credentials

---

## Troubleshooting

### Issue: Jobs Disappearing

**Possible Causes**:
1. Eviction policy is NOT `noeviction` (keys being evicted)
2. Redis memory limit reached (writes rejected)
3. Redis connection issues

**Solution**:
1. Verify eviction policy is `noeviction` in Redis provider
2. Increase Redis memory limit
3. Check Redis connection status

### Issue: Rate Limiting Not Working

**Possible Causes**:
1. Redis not connected
2. Rate limit keys being evicted
3. Redis memory full (writes rejected)

**Solution**:
1. Check Redis connection
2. Verify eviction policy is `noeviction`
3. Check Redis memory usage

---

## Summary

- ✅ **Set eviction policy to `noeviction`** in Redis provider (not in code)
- ✅ **Monitor Redis memory usage** to prevent write rejections
- ✅ **Use individual Redis vars** for Redis Cloud compatibility
- ⚠️ **Application does not validate eviction policy** (must be set manually)
- ✅ **Application fails gracefully** if Redis unavailable

