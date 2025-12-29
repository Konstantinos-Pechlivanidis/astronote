# Environment Variables Map

## Section A: Environment Files Inventory

### Root Level
- **`.env`**: Not found (gitignored)
- **`.env.example`**: Not found (should be created)

### apps/shopify-api
- **`.env`**: Not found (gitignored)
- **`.env.example`**: `apps/shopify-api/env.example` (136 lines, comprehensive)

### apps/retail-api
- **`.env`**: Not found (gitignored, loaded from `apps/retail-api/.env`)
- **`.env.example`**: Not found (should be created)
- **Note**: Sub-apps load env from `../../.env` (parent directory)

### apps/web
- **`.env.local`**: Not found (gitignored)
- **`.env.example`**: Not found (should be created)

### apps/retail-api/apps/web
- **`.env.local`**: Not found (gitignored)
- **`.env.example`**: Not found (should be created)

### apps/astronote-shopify-extension
- **`.env`**: Not found (gitignored)
- **`.env.example`**: Not found (should be created)

---

## Section B: Environment Key Usage Map

### Database Configuration

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `DATABASE_URL` | shopify-api, retail-api | PostgreSQL connection (pooled) | Neon pooled connection |
| `DIRECT_URL` | shopify-api | PostgreSQL direct connection | Neon direct (migrations) |
| `DIRECT_DATABASE_URL` | retail-api | PostgreSQL direct connection | Alternative name for DIRECT_URL |

**Conflicts**: None - both apps use same keys but different databases (should be separate DBs)

**Recommendation**: 
- Keep as-is if using separate databases
- If sharing DB, consider `SHOPIFY_DATABASE_URL` and `RETAIL_DATABASE_URL`

---

### Redis Configuration

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `REDIS_HOST` | shopify-api, retail-api | Redis hostname | Individual vars preferred |
| `REDIS_PORT` | shopify-api, retail-api | Redis port | Individual vars preferred |
| `REDIS_USERNAME` | shopify-api, retail-api | Redis username | Individual vars preferred |
| `REDIS_PASSWORD` | shopify-api, retail-api | Redis password | Individual vars preferred |
| `REDIS_TLS` | shopify-api, retail-api | Redis TLS enabled | Boolean string |
| `REDIS_DB` | retail-api | Redis database number | Optional |
| `REDIS_URL` | shopify-api, retail-api | Redis connection string | Fallback option |

**Conflicts**: None - both apps use same keys (likely sharing Redis instance)

**Recommendation**: Keep as-is if sharing Redis, or prefix if separate instances

---

### Application Configuration

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `NODE_ENV` | All apps | Environment mode | `development`, `production`, `test` |
| `PORT` | shopify-api, retail-api | Server port | shopify-api: 8080, retail-api: 3001 |
| `HOST` | shopify-api | Backend URL | For OAuth callbacks, webhooks |
| `APP_URL` | retail-api | Application URL | Alternative to HOST |
| `API_URL` | retail-api | API base URL | For URL generation |
| `API_BASE_URL` | retail-api | API base URL (alias) | Alternative to API_URL |

**Conflicts**: 
- `HOST` vs `APP_URL` vs `API_URL` - different names for similar purpose
- **Recommendation**: Standardize on `HOST` or `API_BASE_URL`

---

### Frontend URLs

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `FRONTEND_URL` | shopify-api, retail-api | Frontend base URL | Used for redirects |
| `FRONTEND_BASE_URL` | retail-api | Frontend base URL (alias) | Alternative to FRONTEND_URL |
| `WEB_APP_URL` | shopify-api | Web app URL | For OAuth callbacks |
| `APP_PUBLIC_BASE_URL` | retail-api | Public frontend URL | Default: `http://localhost:5173` |
| `UNSUBSCRIBE_BASE_URL` | retail-api | Unsubscribe page URL | Optional override |
| `OFFER_BASE_URL` | retail-api | Offer page URL | Optional override |
| `PUBLIC_BASE_URL` | shopify-api | Public base URL | For dynamic URL generation |

**Conflicts**: Multiple keys for similar purpose (`FRONTEND_URL`, `FRONTEND_BASE_URL`, `WEB_APP_URL`, `APP_PUBLIC_BASE_URL`)

**Recommendation**: 
- Standardize on `FRONTEND_URL` for main frontend
- Use `PUBLIC_BASE_URL` for public-facing URLs
- Remove redundant aliases

---

### CORS Configuration

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `ALLOWED_ORIGINS` | shopify-api | CORS allowed origins | CSV format |
| `CORS_ALLOWLIST` | retail-api | CORS allowed origins | CSV format (different name) |

**Conflicts**: Different key names for same purpose

**Recommendation**: Standardize on `ALLOWED_ORIGINS` or `CORS_ALLOWLIST`

---

### Shopify Configuration

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `SHOPIFY_API_KEY` | shopify-api, extension | Shopify API key | OAuth client ID |
| `SHOPIFY_API_SECRET` | shopify-api, extension | Shopify API secret | OAuth client secret |
| `SCOPES` | shopify-api | Shopify API scopes | CSV format |
| `SHOPIFY_SHOP_DOMAIN` | shopify-api | Dev shop domain | Development only |
| `SHOPIFY_ACCESS_TOKEN` | shopify-api | Dev access token | Development only |

**Conflicts**: None - shopify-api and extension share credentials

---

### SMS Provider (Mitto) Configuration

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `MITTO_API_BASE` | shopify-api, retail-api | Mitto API base URL | Default: `https://messaging.mittoapi.com` |
| `MITTO_API_KEY` | shopify-api, retail-api | Mitto API key | Required |
| `MITTO_TRAFFIC_ACCOUNT_ID` | shopify-api, retail-api | Mitto traffic account ID | Required |
| `SMS_TRAFFIC_ACCOUNT_ID` | retail-api | Mitto traffic account ID (alias) | Alternative name |
| `MITTO_SENDER_NAME` | shopify-api, retail-api | Default sender name | Default: "Astronote" |
| `MITTO_SENDER_NUMBER` | shopify-api | Sender phone number | Optional |
| `MITTO_WEBHOOK_SECRET` | shopify-api | Mitto webhook secret | For webhook verification |
| `WEBHOOK_SECRET` | retail-api | Webhook secret (generic) | Used for Mitto + others |

**Conflicts**: 
- `MITTO_TRAFFIC_ACCOUNT_ID` vs `SMS_TRAFFIC_ACCOUNT_ID` (alias)
- `MITTO_WEBHOOK_SECRET` vs `WEBHOOK_SECRET` (different naming)

**Recommendation**: 
- Standardize on `MITTO_TRAFFIC_ACCOUNT_ID`
- Use `MITTO_WEBHOOK_SECRET` for Mitto-specific, `WEBHOOK_SECRET` for generic

---

### Stripe Configuration

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `STRIPE_SECRET_KEY` | shopify-api, retail-api | Stripe secret key | Must start with `sk_` |
| `STRIPE_WEBHOOK_SECRET` | shopify-api, retail-api | Stripe webhook secret | Must start with `whsec_` |
| `STRIPE_PRICE_ID_1000_EUR` | shopify-api | Credit pack price ID | EUR 1000 credits |
| `STRIPE_PRICE_ID_5000_EUR` | shopify-api | Credit pack price ID | EUR 5000 credits |
| `STRIPE_PRICE_ID_10000_EUR` | shopify-api | Credit pack price ID | EUR 10000 credits |
| `STRIPE_PRICE_ID_25000_EUR` | shopify-api | Credit pack price ID | EUR 25000 credits |
| `STRIPE_PRICE_ID_1000_USD` | shopify-api | Credit pack price ID | USD 1000 credits |
| `STRIPE_PRICE_ID_5000_USD` | shopify-api | Credit pack price ID | USD 5000 credits |
| `STRIPE_PRICE_ID_10000_USD` | shopify-api | Credit pack price ID | USD 10000 credits |
| `STRIPE_PRICE_ID_25000_USD` | shopify-api | Credit pack price ID | USD 25000 credits |
| `STRIPE_PRICE_ID_SUB_STARTER_EUR` | shopify-api | Subscription price ID | Starter plan EUR |
| `STRIPE_PRICE_ID_SUB_PRO_EUR` | shopify-api | Subscription price ID | Pro plan EUR |
| `STRIPE_PRICE_ID_CREDIT_TOPUP_EUR` | shopify-api | Credit top-up price ID | Optional |

**Conflicts**: None - shopify-api uses more Stripe price IDs (more granular pricing)

---

### Authentication & Security

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `JWT_SECRET` | shopify-api, retail-api | JWT signing secret | Min 24 chars (retail), 32+ recommended (shopify) |
| `JWT_ACCESS_TTL` | retail-api | JWT access token TTL | Default: `15m` |
| `JWT_REFRESH_TTL` | retail-api | JWT refresh token TTL | Default: `30d` |
| `SESSION_SECRET` | shopify-api | Session secret | For session management |
| `UNSUBSCRIBE_TOKEN_SECRET` | retail-api | Unsubscribe token secret | Default: `default-secret-change-in-production` |
| `UNSUBSCRIBE_SECRET` | shopify-api | Unsubscribe token secret | Alternative to JWT_SECRET |

**Conflicts**: 
- `UNSUBSCRIBE_TOKEN_SECRET` vs `UNSUBSCRIBE_SECRET` (different names)
- **Recommendation**: Standardize on `UNSUBSCRIBE_SECRET`

---

### URL Shortener Configuration

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `URL_SHORTENER_TYPE` | shopify-api, retail-api | Shortener type | `backend`, `custom`, `bitly`, `tinyurl`, `none` |
| `URL_SHORTENER_BASE_URL` | shopify-api, retail-api | Shortener base URL | Backend URL for redirects |
| `BITLY_API_TOKEN` | shopify-api, retail-api | Bitly API token | If using Bitly |
| `TINYURL_API_KEY` | shopify-api, retail-api | TinyURL API key | If using TinyURL |
| `REDIRECT_ALLOWED_HOSTS` | shopify-api | Allowed redirect hosts | CSV format, optional |

**Conflicts**: None - consistent usage

---

### Queue Configuration

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `QUEUE_DISABLED` | retail-api | Disable queues | `1` or `true` to disable |
| `QUEUE_ATTEMPTS` | retail-api | Job retry attempts | Default: `5` |
| `QUEUE_BACKOFF_MS` | retail-api | Retry backoff delay | Default: `3000` |
| `QUEUE_RATE_MAX` | retail-api | Queue rate limit max | Default: `20` |
| `QUEUE_RATE_DURATION_MS` | retail-api | Queue rate limit window | Default: `1000` |
| `WORKER_CONCURRENCY` | retail-api | SMS worker concurrency | Default: `5` |
| `SCHEDULER_CONCURRENCY` | retail-api | Scheduler worker concurrency | Default: `2` |
| `CONTACT_IMPORT_CONCURRENCY` | retail-api | Contact import concurrency | Default: `1` |
| `STATUS_REFRESH_CONCURRENCY` | retail-api | Status refresh concurrency | Default: `1` |
| `SMS_BATCH_SIZE` | shopify-api, retail-api | SMS batch size | Default: `5000` |

**Conflicts**: None - retail-api has more granular queue config

---

### Worker Configuration

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `START_WORKER` | retail-api | Start worker on server | Default: `1` (enabled) |
| `STATUS_REFRESH_ENABLED` | retail-api | Enable status refresh | Default: `1` (enabled) |
| `STATUS_REFRESH_INTERVAL` | retail-api | Status refresh interval | Default: `600000` (10 min) |
| `RUN_BIRTHDAY_ON_START` | retail-api | Run birthday worker on start | Optional |
| `RUN_PII_RETENTION_ON_START` | retail-api | Run PII retention on start | Optional |
| `RUN_SCHEDULER` | shopify-api | Run scheduler | Default: `true` |
| `EVENT_POLLING_ENABLED` | shopify-api | Enable event polling | Default: `true` |
| `EVENT_POLLING_INTERVAL` | shopify-api | Event polling interval | Default: `5` (minutes) |

**Conflicts**: None - different apps have different worker configs

---

### Rate Limiting

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `RATE_LIMIT_TRAFFIC_ACCOUNT_MAX` | shopify-api, retail-api | Traffic account rate limit | Default: `100` |
| `RATE_LIMIT_TRAFFIC_ACCOUNT_WINDOW_MS` | shopify-api, retail-api | Traffic account window | Default: `1000` |
| `RATE_LIMIT_TENANT_MAX` | shopify-api, retail-api | Tenant rate limit | Default: `50` |
| `RATE_LIMIT_TENANT_WINDOW_MS` | shopify-api, retail-api | Tenant window | Default: `1000` |
| `RATE_LIMIT_GLOBAL_MAX` | shopify-api, retail-api | Global rate limit | Default: `200` |
| `RATE_LIMIT_GLOBAL_WINDOW_MS` | shopify-api, retail-api | Global window | Default: `1000` |

**Conflicts**: None - consistent usage

---

### Frontend Environment Variables (Vite)

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `VITE_SHOPIFY_API_BASE_URL` | apps/web | Shopify API base URL | For axios client |
| `VITE_APP_URL` | apps/web | App URL | Optional |
| `VITE_API_BASE_URL` | retail-api/apps/web | Retail API base URL | For axios client |

**Conflicts**: None - different apps use different prefixes

**Note**: Vite requires `VITE_` prefix for client-side env vars

---

### Logging & Monitoring

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `LOG_LEVEL` | shopify-api | Log level | Default: `info` |
| `LOG_DIR` | shopify-api | Log directory | Default: `./logs` |
| `SENTRY_DSN` | shopify-api | Sentry DSN | Optional |

**Conflicts**: None - shopify-api only

---

### System Configuration

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `SYSTEM_USER_ID` | retail-api | System user ID | Default: `1` |
| `APP_DEFAULT_CURRENCY` | shopify-api | Default currency | Default: `EUR` |

**Conflicts**: None

---

### Development/Testing

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `ADMIN_TOKEN` | shopify-api | Dev admin token | Development only |
| `SKIP_REDIS` | shopify-api | Skip Redis | Testing only |
| `SKIP_QUEUES` | shopify-api, retail-api | Skip queues | Testing only |
| `ALLOW_BILLING_SEED` | retail-api | Allow billing seed | Development only |
| `ALLOW_DEV_BILLING_OVERRIDE` | retail-api | Dev billing override | Development only |

**Conflicts**: None - development/testing only

---

### PII & GDPR

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `PII_RETENTION_DAYS` | retail-api | PII retention period | Default: `90` |
| `PII_RETENTION_ENABLED` | retail-api | Enable PII retention | Optional |
| `UNSUBSCRIBE_CONFIRMATION_ENABLED` | retail-api | Unsubscribe confirmation | Optional |

**Conflicts**: None - retail-api only

---

### Documentation

| Key | Used By | Purpose | Notes |
|-----|---------|---------|-------|
| `DOCS_PORT` | retail-api | Docs server port | Default: `3002` |

**Conflicts**: None

---

## Section C: Conflicts & Recommended Normalization Strategy

### Critical Conflicts (P0)

1. **Frontend URL Keys**:
   - `FRONTEND_URL`, `FRONTEND_BASE_URL`, `WEB_APP_URL`, `APP_PUBLIC_BASE_URL`
   - **Recommendation**: Standardize on `FRONTEND_URL` for main frontend, `PUBLIC_BASE_URL` for public URLs

2. **CORS Configuration**:
   - `ALLOWED_ORIGINS` (shopify-api) vs `CORS_ALLOWLIST` (retail-api)
   - **Recommendation**: Standardize on `ALLOWED_ORIGINS`

3. **Unsubscribe Secret**:
   - `UNSUBSCRIBE_SECRET` (shopify-api) vs `UNSUBSCRIBE_TOKEN_SECRET` (retail-api)
   - **Recommendation**: Standardize on `UNSUBSCRIBE_SECRET`

4. **API Base URL**:
   - `HOST` (shopify-api) vs `APP_URL` / `API_URL` / `API_BASE_URL` (retail-api)
   - **Recommendation**: Standardize on `HOST` or `API_BASE_URL`

### Medium Priority Conflicts (P1)

1. **Mitto Traffic Account ID**:
   - `MITTO_TRAFFIC_ACCOUNT_ID` vs `SMS_TRAFFIC_ACCOUNT_ID` (alias in retail-api)
   - **Recommendation**: Standardize on `MITTO_TRAFFIC_ACCOUNT_ID`, remove alias

2. **Webhook Secret**:
   - `MITTO_WEBHOOK_SECRET` (shopify-api) vs `WEBHOOK_SECRET` (retail-api, generic)
   - **Recommendation**: Keep both (specific vs generic), document usage

### Low Priority (P2)

1. **Database Direct URL**:
   - `DIRECT_URL` (shopify-api) vs `DIRECT_DATABASE_URL` (retail-api)
   - **Recommendation**: Standardize on `DIRECT_URL`

### Normalization Strategy

#### Phase 1: Create Unified .env.example
Create root `.env.example` with all variables, organized by category:
- Database
- Redis
- Application
- Frontend URLs
- CORS
- Shopify
- Mitto
- Stripe
- Auth
- URL Shortener
- Queue
- Workers
- Rate Limiting
- Logging
- Development

#### Phase 2: Standardize Key Names
1. Frontend URLs: Use `FRONTEND_URL` and `PUBLIC_BASE_URL`
2. CORS: Use `ALLOWED_ORIGINS`
3. API Base: Use `API_BASE_URL` or `HOST`
4. Unsubscribe: Use `UNSUBSCRIBE_SECRET`
5. Direct DB: Use `DIRECT_URL`

#### Phase 3: Add Prefixes (If Needed)
If apps need separate instances:
- `SHOPIFY_DATABASE_URL`, `RETAIL_DATABASE_URL`
- `SHOPIFY_REDIS_HOST`, `RETAIL_REDIS_HOST`
- Only if truly separate infrastructure

#### Phase 4: Documentation
- Document all env vars in root `.env.example`
- Add validation scripts
- Add startup checks for required vars

---

## Summary

- **Total Unique Env Keys**: ~80+
- **Conflicts Identified**: 6 critical, 2 medium, 1 low
- **Recommendation**: Create unified `.env.example`, standardize key names, add validation

