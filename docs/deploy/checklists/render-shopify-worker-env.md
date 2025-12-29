# Render Environment Variables Checklist - Shopify Worker

## Date
2025-01-23

## Service
**Name:** `astronote-shopify-worker`  
**Type:** Background Worker  
**URL:** N/A (no HTTP server)

---

## Required Environment Variables

### Core Application
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `NODE_ENV` | `production` | Environment mode |
| `START_WORKER` | `true` (or omit) | Workers enabled (default: true) |
| `RUN_SCHEDULER` | `true` | Enable schedulers (default: true) |

### Database (Neon Postgres)
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `DATABASE_URL` | `postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require` | **REQUIRED** - Neon pooled connection |
| `DIRECT_URL` | `postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require` | **RECOMMENDED** - Neon direct connection (for migrations) |

**Note:** Worker shares same database as shopify-api.

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

**Note:** Worker must use same Redis instance as shopify-api (for queue access).

### Shopify
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `SHOPIFY_API_KEY` | `your_shopify_api_key` | **REQUIRED** - Shopify API key |
| `SHOPIFY_API_SECRET` | `your_shopify_api_secret` | **REQUIRED** - Shopify API secret |
| `SCOPES` | `read_customers,write_customers,read_orders,...` | Comma-separated OAuth scopes |

### Mitto SMS
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `MITTO_API_BASE` | `https://messaging.mittoapi.com` | Mitto API base URL |
| `MITTO_API_KEY` | `your_mitto_api_key` | **REQUIRED** - Mitto API key |
| `MITTO_TRAFFIC_ACCOUNT_ID` | `your_traffic_account_id` | **REQUIRED** - Mitto traffic account ID |
| `MITTO_SENDER_NAME` | `Astronote` | SMS sender name |
| `MITTO_WEBHOOK_SECRET` | `your_webhook_secret` | Mitto webhook secret |

### Stripe
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | **REQUIRED** - Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe webhook secret |

### Event Polling
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `EVENT_POLLING_ENABLED` | `true` | Enable event polling (default: true) |
| `EVENT_POLLING_INTERVAL` | `5` | Polling interval in minutes (default: 5) |

### Logging
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `LOG_LEVEL` | `info` | Log level (info/debug/warn/error) |
| `LOG_DIR` | `./logs` | Log directory (optional) |
| `SENTRY_DSN` | `your_sentry_dsn` | Sentry DSN for error tracking (optional) |

---

## Notes

### Shared Environment Variables
- Worker uses **same env vars as shopify-api** for:
  - Database connections
  - Redis connections
  - Shopify API credentials
  - Mitto SMS credentials
  - Stripe credentials

### Worker-Specific
- `START_WORKER=true` (or omit, defaults to true)
- `RUN_SCHEDULER=true` (for schedulers to run)

### No HTTP Server
- Worker does NOT need:
  - `PORT` (no HTTP server)
  - `HOST` (no OAuth callbacks)
  - `CORS_ALLOWLIST` (no HTTP endpoints)
  - `URL_SHORTENER_*` (no HTTP endpoints)

---

## Verification

After setting env vars, verify:
1. Worker starts successfully (check Render logs)
2. Workers connect to Redis (check logs)
3. Workers process jobs (check queue stats if available)
4. Event poller runs (check logs for polling messages)
5. Schedulers run (check logs for scheduled job messages)

---

## Full Environment Variable List

For complete list, see `apps/shopify-api/env.example` (worker uses same vars as API, except HTTP-related ones).

