# Render Environment Variables Checklist - Retail API

## Date
2025-01-23

## Service
**Name:** `astronote-retail-api`  
**Type:** Web Service  
**URL:** `https://astronote-retail.onrender.com`

---

## Required Environment Variables

### Core Application
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | (auto-set by Render) | Server port (Render sets automatically) |

### Database (Neon Postgres)
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `DATABASE_URL` | `postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require` | **REQUIRED** - Neon pooled connection (use for application) |
| `DIRECT_URL` | `postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require` | **RECOMMENDED** - Neon direct connection (use for migrations, bypasses pooler) |
| `DIRECT_DATABASE_URL` | (fallback) | Legacy fallback (also supported) |

**Note:** Use Neon pooled connection for `DATABASE_URL` and direct connection for `DIRECT_URL` (recommended for Prisma migrations).

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

**Note:** Use individual vars for Redis Cloud compatibility, or `REDIS_URL` as fallback.

### JWT & Security
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `JWT_SECRET` | `your_jwt_secret_key_min_24_characters` | **REQUIRED** - Must be at least 24 characters. Generate with: `openssl rand -base64 32` |
| `JWT_ACCESS_TTL` | `15m` | Access token TTL (default) |
| `JWT_REFRESH_TTL` | `30d` | Refresh token TTL (default) |

### CORS & Frontend URLs
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `CORS_ALLOWLIST` | `https://astronote.onrender.com` | **REQUIRED** - Comma-separated allowed origins (canonical) |
| `FRONTEND_URL` | `https://astronote.onrender.com` | Main web frontend URL |
| `APP_PUBLIC_BASE_URL` | `https://astronote-retail.onrender.com` | **REQUIRED** - Public base URL for links (canonical) |

### Mitto SMS
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `MITTO_API_BASE` | `https://messaging.mittoapi.com` | Mitto API base URL (default) |
| `MITTO_API_KEY` | `your_mitto_api_key` | **REQUIRED** - Mitto API key |
| `MITTO_TRAFFIC_ACCOUNT_ID` | `your_traffic_account_id` | Traffic account ID (canonical) |
| `MITTO_SENDER_NAME` | `Astronote` | Default sender name (canonical) |
| `MITTO_SENDER` | (fallback) | Legacy fallback (also supported) |
| `SMS_TRAFFIC_ACCOUNT_ID` | (fallback) | Legacy fallback (also supported) |

### Stripe
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | **REQUIRED** - Must start with `sk_` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | **REQUIRED** - Must start with `whsec_` |

### URL Shortener
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `URL_SHORTENER_TYPE` | `custom` | **REQUIRED** - Use `custom` for backend redirects (enum: custom/bitly/tinyurl/none) |
| `URL_SHORTENER_BASE_URL` | `https://astronote-retail.onrender.com` | **REQUIRED** - Backend URL for /r/:token redirects |

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
| `START_WORKER` | `0` | **RECOMMENDED** - Set to `0` if using separate worker service |
| `WORKER_CONCURRENCY` | `5` | SMS worker concurrency (default) |
| `SCHEDULER_CONCURRENCY` | `2` | Scheduler concurrency (default) |
| `STATUS_REFRESH_ENABLED` | `1` | Enable status refresh (default) |
| `STATUS_REFRESH_INTERVAL` | `600000` | Status refresh interval ms (default) |

### Rate Limiting
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `RATE_LIMIT_TRAFFIC_ACCOUNT_MAX` | `100` | Traffic account limit (default) |
| `RATE_LIMIT_TENANT_MAX` | `50` | Tenant limit (default) |
| `RATE_LIMIT_GLOBAL_MAX` | `200` | Global limit (default) |

### Other
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `SYSTEM_USER_ID` | `1` | System user ID (default) |
| `UNSUBSCRIBE_TOKEN_SECRET` | `your_secret` | Unsubscribe token secret (change from default) |
| `PII_RETENTION_DAYS` | `90` | PII retention days (default) |
| `SMS_BATCH_SIZE` | `5000` | SMS batch size (default) |

---

## Optional Environment Variables

- `FRONTEND_BASE_URL` - Frontend base URL override
- `APP_URL` - App URL (legacy)
- `UNSUBSCRIBE_BASE_URL` - Unsubscribe endpoint base URL
- `OFFER_BASE_URL` - Offer links base URL
- `API_URL` - API base URL override
- `WEBHOOK_SECRET` - Webhook secret
- `ALLOW_BILLING_SEED` - Allow billing seed (1/true)
- `PII_RETENTION_ENABLED` - Enable PII retention (1/true)
- `RUN_BIRTHDAY_ON_START` - Run birthday automation on start (1/true)

---

## Production Checklist

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` set (Neon pooled connection)
- [ ] `DIRECT_URL` set (Neon direct connection)
- [ ] `JWT_SECRET` set (min 24 characters)
- [ ] `MITTO_API_KEY` set
- [ ] `STRIPE_SECRET_KEY` set (production key)
- [ ] `STRIPE_WEBHOOK_SECRET` set
- [ ] `CORS_ALLOWLIST` includes `https://astronote.onrender.com`
- [ ] `APP_PUBLIC_BASE_URL` set to `https://astronote-retail.onrender.com`
- [ ] `URL_SHORTENER_TYPE=custom`
- [ ] `URL_SHORTENER_BASE_URL` set to `https://astronote-retail.onrender.com`
- [ ] Redis configured (individual vars or `REDIS_URL`)
- [ ] `START_WORKER=0` (if using separate worker service)

---

## Notes

### Neon Database
- Use **pooled connection** for `DATABASE_URL` (application connections)
- Use **direct connection** for `DIRECT_URL` (migrations, bypasses pooler)
- Both connections required for Prisma

### Redis
- **Eviction policy must be `noeviction`** (set in Redis provider, not in code)
- Use individual vars (`REDIS_HOST`, `REDIS_PORT`, etc.) for Redis Cloud
- Or use `REDIS_URL` as fallback

### Worker Separation
- **Recommended:** Run worker as separate Render service
- Set `START_WORKER=0` in retail-api to disable in-process workers
- See `docs/deploy/checklists/render-retail-worker-env.md` for worker config

### Stripe Webhooks
- Configure webhook endpoint in Stripe dashboard: `https://astronote-retail.onrender.com/webhooks/stripe`
- Use `STRIPE_WEBHOOK_SECRET` from Stripe webhook configuration

---

## Verification

After setting env vars, verify:
1. Health endpoint: `curl https://astronote-retail.onrender.com/healthz`
2. Readiness: `curl https://astronote-retail.onrender.com/readiness`
3. Database connectivity: `curl https://astronote-retail.onrender.com/health/db`
4. All endpoints return expected responses

