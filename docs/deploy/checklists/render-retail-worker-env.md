# Render Environment Variables Checklist - Retail Worker

## Date
2025-01-23

## Service
**Name:** `astronote-retail-worker`  
**Type:** Background Worker  
**URL:** N/A (no HTTP server)

---

## Required Environment Variables

### Core Application
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | (not used) | Worker doesn't use PORT (no HTTP server) |

### Database (Neon Postgres)
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `DATABASE_URL` | `postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require` | **REQUIRED** - Neon pooled connection |
| `DIRECT_URL` | `postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require` | **RECOMMENDED** - Neon direct connection (for migrations) |

**Note:** Worker shares same database as retail-api.

### Redis
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `REDIS_HOST` | `redis-xxx.xxx.xxx.xxx` | Redis Cloud hostname (preferred) |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_USERNAME` | `default` | Redis username |
| `REDIS_PASSWORD` | `your_redis_password` | Redis password |
| `REDIS_TLS` | `true` | Enable TLS (true/false) |
| `REDIS_DB` | `0` | Redis database number |
| `REDIS_URL` | `rediss://user:pass@host:port/db` | Alternative: Use REDIS_URL if individual vars not available |

**Note:** Worker must use same Redis instance as retail-api (for queue access).

### JWT & Security
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `JWT_SECRET` | `your_jwt_secret_key_min_24_characters` | **REQUIRED** - Must match retail-api (same secret) |
| `JWT_ACCESS_TTL` | `15m` | Access token TTL (default) |
| `JWT_REFRESH_TTL` | `30d` | Refresh token TTL (default) |

### Mitto SMS
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `MITTO_API_BASE` | `https://messaging.mittoapi.com` | Mitto API base URL (default) |
| `MITTO_API_KEY` | `your_mitto_api_key` | **REQUIRED** - Must match retail-api |
| `MITTO_TRAFFIC_ACCOUNT_ID` | `your_traffic_account_id` | Traffic account ID |
| `MITTO_SENDER_NAME` | `Astronote` | Default sender name |

### Stripe
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | **REQUIRED** - Must match retail-api |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | **REQUIRED** - Must match retail-api |

### Queue Configuration
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `QUEUE_DISABLED` | `0` | Disable queues (1/true to disable) |
| `QUEUE_ATTEMPTS` | `5` | Max retry attempts (default) |
| `QUEUE_BACKOFF_MS` | `3000` | Backoff delay (default) |
| `QUEUE_RATE_MAX` | `20` | Rate limit max (default) |
| `QUEUE_RATE_DURATION_MS` | `1000` | Rate limit window (default) |

### Worker Configuration
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `WORKER_CONCURRENCY` | `5` | SMS worker concurrency (default) |
| `SCHEDULER_CONCURRENCY` | `2` | Scheduler concurrency (default) |
| `CONTACT_IMPORT_CONCURRENCY` | `1` | Contact import concurrency (default) |
| `STATUS_REFRESH_CONCURRENCY` | `1` | Status refresh concurrency (default) |
| `STATUS_REFRESH_ENABLED` | `1` | Enable status refresh (default) |
| `STATUS_REFRESH_INTERVAL` | `600000` | Status refresh interval ms (default) |

### PII Retention
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `PII_RETENTION_DAYS` | `90` | PII retention days (default) |
| `PII_RETENTION_ENABLED` | `1` | Enable PII retention (1/true) |

---

## Optional Environment Variables

- `RUN_BIRTHDAY_ON_START` - Run birthday automation on start (1/true)
- `RUN_PII_RETENTION_ON_START` - Run PII retention on start (1/true)

---

## Production Checklist

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` set (same as retail-api)
- [ ] `DIRECT_URL` set (same as retail-api)
- [ ] `JWT_SECRET` set (same as retail-api)
- [ ] `MITTO_API_KEY` set (same as retail-api)
- [ ] `STRIPE_SECRET_KEY` set (same as retail-api)
- [ ] `STRIPE_WEBHOOK_SECRET` set (same as retail-api)
- [ ] Redis configured (same instance as retail-api)
- [ ] `WORKER_CONCURRENCY` set (adjust based on load)

---

## Notes

### Worker Types

The worker service runs the SMS worker by default (`src/sms.worker.js`). For other worker types, you can:

1. **Run multiple worker services** (recommended):
   - Create separate Render services for each worker type
   - Use different start commands:
     - `npm run worker:sms`
     - `npm run worker:scheduler`
     - `npm run worker:contactImport`
     - `npm run worker:birthday`
     - `npm run worker:statusRefresh`
     - `npm run worker:piiRetention`

2. **Use process manager** (not recommended for Render):
   - Use PM2 or similar (requires custom setup)

### Shared Configuration

Worker must share:
- ✅ Same `DATABASE_URL` as retail-api
- ✅ Same Redis instance as retail-api (for queue access)
- ✅ Same `JWT_SECRET` as retail-api
- ✅ Same `MITTO_API_KEY` as retail-api
- ✅ Same `STRIPE_SECRET_KEY` as retail-api

### No HTTP Server

- Worker doesn't bind to a port
- No health endpoints (worker is background process)
- Render will monitor process health (exit code)

---

## Render Configuration

**Service Type:** Background Worker  
**Root Directory:** `apps/retail-worker`  
**Build Command:** `npm ci`  
**Start Command:** `npm run start`

**Note:** For multiple worker types, create separate services with different start commands.

---

## Verification

After deployment, verify:
1. Worker process is running (check Render logs)
2. Jobs are being processed (check queue in Redis or database)
3. No errors in logs
4. SMS messages are being sent (if applicable)

---

## Troubleshooting

### Worker Not Processing Jobs

**Check:**
- Redis connection (must be same instance as retail-api)
- Queue configuration matches retail-api
- `QUEUE_DISABLED` is not set to `1` or `true`

### Worker Crashes

**Check:**
- Database connection is valid
- Redis connection is valid
- All required env vars are set
- Check Render logs for error messages

