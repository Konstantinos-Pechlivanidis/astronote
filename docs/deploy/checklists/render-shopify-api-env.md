# Render Environment Variables Checklist - Shopify API

## Date
2025-01-23

## Service
**Name:** `astronote-shopify-api`  
**Type:** Web Service  
**URL:** `https://astronote-shopify.onrender.com`

---

## Required Environment Variables

### Core Application
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | (auto-set by Render) | Server port (Render sets automatically) |
| `LOG_LEVEL` | `info` | Log level (info/debug/warn/error) |

### Database (Neon Postgres)
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `DATABASE_URL` | `postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require` | **REQUIRED** - Neon pooled connection (use for application) |
| `DIRECT_URL` | `postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require` | **RECOMMENDED** - Neon direct connection (use for migrations, bypasses pooler) |

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

### Shopify
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `SHOPIFY_API_KEY` | `your_shopify_api_key` | **REQUIRED (production)** - Shopify API key |
| `SHOPIFY_API_SECRET` | `your_shopify_api_secret` | **REQUIRED (production)** - Shopify API secret |
| `SCOPES` | `read_customers,write_customers,read_orders,...` | Comma-separated OAuth scopes |
| `SESSION_SECRET` | `your_session_secret_key` | Session secret for Shopify OAuth |

### CORS & Public URLs
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `CORS_ALLOWLIST` | `https://astronote.onrender.com` | **REQUIRED** - Comma-separated allowed origins (canonical) |
| `ALLOWED_ORIGINS` | (fallback) | Legacy fallback (also supported) |
| `HOST` | `https://astronote-shopify.onrender.com` | **REQUIRED** - Public base URL (for OAuth/webhooks) |
| `PUBLIC_BASE_URL` | `https://astronote-shopify.onrender.com` | **RECOMMENDED** - Public base URL for links (canonical) |
| `FRONTEND_URL` | `https://astronote.onrender.com` | Main web frontend URL |

### JWT & Security
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `JWT_SECRET` | `your_jwt_secret_key_min_32_characters` | **RECOMMENDED** - Generate with: `openssl rand -base64 32` |
| `SESSION_SECRET` | `your_session_secret_key` | Session secret |

### Stripe
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | **REQUIRED (production)** - Must start with `sk_` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | **RECOMMENDED** - Must start with `whsec_` |
| `STRIPE_PRICE_ID_1000_EUR` | `prod_...` | Optional - Price IDs for credit packages |
| `STRIPE_PRICE_ID_5000_EUR` | `prod_...` | Optional |
| `STRIPE_PRICE_ID_10000_EUR` | `prod_...` | Optional |
| `STRIPE_PRICE_ID_25000_EUR` | `prod_...` | Optional |
| `STRIPE_PRICE_ID_SUB_STARTER_EUR` | `price_...` | **REQUIRED for subscriptions** - Recurring price |
| `STRIPE_PRICE_ID_SUB_PRO_EUR` | `price_...` | **REQUIRED for subscriptions** - Recurring price |

### Mitto SMS
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `MITTO_API_BASE` | `https://messaging.mittoapi.com` | Mitto API base URL (default) |
| `MITTO_API_KEY` | `your_mitto_api_key` | **RECOMMENDED** - Mitto API key |
| `MITTO_TRAFFIC_ACCOUNT_ID` | `your_traffic_account_id` | Traffic account ID |
| `MITTO_SENDER_NAME` | `Astronote` | Default sender name |
| `MITTO_WEBHOOK_SECRET` | `your_webhook_secret` | Optional - Webhook secret |

### URL Shortener
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `URL_SHORTENER_TYPE` | `custom` | **REQUIRED** - Use `custom` for backend redirects (enum: custom/bitly/tinyurl/none) |
| `URL_SHORTENER_BASE_URL` | `https://astronote-shopify.onrender.com` | **REQUIRED** - Backend URL for /r/:token redirects |
| `REDIRECT_ALLOWED_HOSTS` | `*.myshopify.com,https://astronote.onrender.com` | **RECOMMENDED** - Comma-separated allowed redirect hosts (supports wildcards) |

### Queue & Scheduler
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `RUN_SCHEDULER` | `true` | Enable scheduler |
| `SMS_BATCH_SIZE` | `5000` | SMS batch size |

### Monitoring
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `SENTRY_DSN` | `https://...@sentry.io/...` | Optional - Sentry DSN for error tracking |

---

## Optional Environment Variables

- `LOG_DIR` - Log directory (default: `./logs`)
- `API_KEY` - API key for external authentication
- `APP_DEFAULT_CURRENCY` - Default currency (default: `EUR`)
- `EVENT_POLLING_ENABLED` - Enable event polling (default: `true`)
- `EVENT_POLLING_INTERVAL` - Polling interval seconds (default: `5`)
- Rate limiting vars (defaults provided)

---

## Production Checklist

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` set (Neon pooled connection)
- [ ] `DIRECT_URL` set (Neon direct connection)
- [ ] `SHOPIFY_API_KEY` set
- [ ] `SHOPIFY_API_SECRET` set
- [ ] `STRIPE_SECRET_KEY` set (production key)
- [ ] `CORS_ALLOWLIST` includes `https://astronote.onrender.com`
- [ ] `HOST` set to `https://astronote-shopify.onrender.com`
- [ ] `PUBLIC_BASE_URL` set to `https://astronote-shopify.onrender.com`
- [ ] `URL_SHORTENER_TYPE=custom`
- [ ] `URL_SHORTENER_BASE_URL` set to `https://astronote-shopify.onrender.com`
- [ ] `REDIRECT_ALLOWED_HOSTS` set (if using redirects)
- [ ] Redis configured (individual vars or `REDIS_URL`)
- [ ] `JWT_SECRET` set (min 32 characters)
- [ ] `MITTO_API_KEY` set
- [ ] Stripe price IDs set (if using subscriptions)

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

### Stripe Webhooks
- Configure webhook endpoint in Stripe dashboard: `https://astronote-shopify.onrender.com/webhooks/stripe`
- Use `STRIPE_WEBHOOK_SECRET` from Stripe webhook configuration

### Shopify OAuth
- Configure OAuth redirect URL in Shopify Partners dashboard: `https://astronote-shopify.onrender.com/auth/callback`
- Use `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` from Shopify Partners

---

## Verification

After setting env vars, verify:
1. Health endpoint: `curl https://astronote-shopify.onrender.com/health`
2. Full health: `curl https://astronote-shopify.onrender.com/health/full`
3. Database connectivity (check `/health/full` response)
4. Redis connectivity (check `/health/full` response)

