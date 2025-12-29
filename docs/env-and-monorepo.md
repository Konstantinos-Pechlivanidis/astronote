# Environment Variables & Monorepo Readiness

**Generated**: 2025-01-XX  
**Purpose**: Complete environment variable contract and monorepo configuration guide

## Environment Variables Contract

### Database

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `DATABASE_URL` | ✅ Yes | None | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?connection_limit=100` |
| `DIRECT_URL` | ⚠️ Optional | None | Direct DB connection (for migrations) | Same as `DATABASE_URL` |

**Notes**:
- Include connection pooling params for high volume: `?connection_limit=100&pool_timeout=20`
- `DIRECT_URL` used by Prisma migrations (bypasses connection pooler)

### Redis

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `REDIS_HOST` | ⚠️ Optional* | None | Redis hostname | `redis-16617.c10.us-east-1-3.ec2.cloud.redislabs.com` |
| `REDIS_PORT` | ⚠️ Optional* | `6379` | Redis port | `16617` |
| `REDIS_USERNAME` | ⚠️ Optional* | `default` | Redis username | `default` |
| `REDIS_PASSWORD` | ⚠️ Optional* | None | Redis password | `your_password` |
| `REDIS_TLS` | ⚠️ Optional* | `false` | Enable TLS | `true` or `false` |
| `REDIS_URL` | ⚠️ Optional* | None | Alternative Redis connection string | `redis://user:pass@host:port` |

**Notes**:
- *Either individual vars (`REDIS_HOST`, etc.) OR `REDIS_URL` required
- Port 16617 typically does NOT support TLS (set `REDIS_TLS=false`)
- For TLS connections, use TLS port from Redis Cloud dashboard

### Shopify

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `SHOPIFY_API_KEY` | ✅ Yes | None | Shopify app API key | `your_shopify_api_key` |
| `SHOPIFY_API_SECRET` | ✅ Yes | None | Shopify app secret | `your_shopify_api_secret` |
| `SCOPES` | ⚠️ Optional | `read_products` | Comma-separated Shopify scopes | `read_customers,write_customers,read_orders` |
| `HOST` | ⚠️ Optional | None | Backend base URL (OAuth callbacks) | `https://astronote-shopify-backend.onrender.com` |
| `SHOPIFY_WEBHOOK_SECRET` | ⚠️ Optional | `SHOPIFY_API_SECRET` | Webhook secret (fallback to API secret) | `your_webhook_secret` |

**Notes**:
- `HOST` used for OAuth callback URLs
- `SCOPES` should include all required permissions for app functionality

### Mitto SMS

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `MITTO_API_BASE` | ⚠️ Optional | `https://messaging.mittoapi.com` | Mitto API base URL | `https://messaging.mittoapi.com` |
| `MITTO_API_KEY` | ⚠️ Optional | None | Mitto API key | `your_mitto_api_key` |
| `MITTO_TRAFFIC_ACCOUNT_ID` | ⚠️ Optional | None | Traffic account ID | `your_traffic_account_id` |
| `MITTO_SENDER_NAME` | ⚠️ Optional | `Astronote` | Default sender name | `Astronote` |
| `MITTO_SENDER_NUMBER` | ⚠️ Optional | None | Default sender number | `+1234567890` |
| `MITTO_WEBHOOK_SECRET` | ⚠️ Optional | None | Mitto webhook secret | `your_webhook_secret` |

**Notes**:
- `MITTO_SENDER_NAME` or `MITTO_SENDER_NUMBER` required for SMS sending
- `MITTO_TRAFFIC_ACCOUNT_ID` required for bulk SMS

### Stripe

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `STRIPE_SECRET_KEY` | ✅ Yes (prod) | None | Stripe secret key | `sk_live_...` or `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | ⚠️ Optional | None | Stripe webhook secret | `whsec_...` |
| `STRIPE_PRICE_ID_1000_EUR` | ⚠️ Optional | None | 1000 credits EUR price ID | `price_...` |
| `STRIPE_PRICE_ID_5000_EUR` | ⚠️ Optional | None | 5000 credits EUR price ID | `price_...` |
| `STRIPE_PRICE_ID_10000_EUR` | ⚠️ Optional | None | 10000 credits EUR price ID | `price_...` |
| `STRIPE_PRICE_ID_25000_EUR` | ⚠️ Optional | None | 25000 credits EUR price ID | `price_...` |
| `STRIPE_PRICE_ID_1000_USD` | ⚠️ Optional | None | 1000 credits USD price ID | `price_...` |
| `STRIPE_PRICE_ID_5000_USD` | ⚠️ Optional | None | 5000 credits USD price ID | `price_...` |
| `STRIPE_PRICE_ID_10000_USD` | ⚠️ Optional | None | 10000 credits USD price ID | `price_...` |
| `STRIPE_PRICE_ID_25000_USD` | ⚠️ Optional | None | 25000 credits USD price ID | `price_...` |
| `STRIPE_PRICE_ID_SUB_STARTER_EUR` | ⚠️ Optional | None | Starter subscription EUR | `price_...` |
| `STRIPE_PRICE_ID_SUB_PRO_EUR` | ⚠️ Optional | None | Pro subscription EUR | `price_...` |
| `STRIPE_PRICE_ID_CREDIT_TOPUP_EUR` | ⚠️ Optional | None | Credit top-up EUR price ID | `price_...` |

**Notes**:
- Price IDs must be configured in Stripe dashboard
- Subscription prices must be RECURRING prices
- Credit top-up price is optional (custom price_data used if not set)

### Application

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `NODE_ENV` | ⚠️ Optional | `development` | Environment | `production`, `development`, `test` |
| `PORT` | ⚠️ Optional | `8080` | Server port | `3001` |
| `JWT_SECRET` | ✅ Yes (prod) | None | JWT signing secret (32+ chars) | Generate with: `openssl rand -base64 32` |
| `SESSION_SECRET` | ⚠️ Optional | None | Session secret | Generate with: `openssl rand -base64 32` |
| `API_KEY` | ⚠️ Optional | None | Optional API key for external auth | `your_api_key` |
| `ALLOWED_ORIGINS` | ⚠️ Optional | None | Comma-separated CORS origins | `https://example.com,https://app.example.com` |
| `FRONTEND_URL` | ⚠️ Optional | None | Frontend base URL | `https://astronote-shopify-frontend.onrender.com` |
| `WEB_APP_URL` | ⚠️ Optional | `FRONTEND_URL` | Web app URL (OAuth redirects) | `https://astronote-shopify-frontend.onrender.com` |
| `PUBLIC_BASE_URL` | ⚠️ Optional | `HOST` | Public-facing base URL | `https://astronote-shopify-backend.onrender.com` |

**Notes**:
- `JWT_SECRET` must be 32+ characters for security
- `PUBLIC_BASE_URL` used for dynamic URL generation (see published-url-strategy.md)
- `FRONTEND_URL` and `WEB_APP_URL` can be same for Shopify Extension

### URL Shortening

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `URL_SHORTENER_TYPE` | ⚠️ Optional | `custom` | Shortener type | `custom`, `bitly`, `tinyurl`, `none` |
| `URL_SHORTENER_BASE_URL` | ⚠️ Optional | `FRONTEND_URL` | Base URL for custom shortener | `https://astronote-shopify-frontend.onrender.com` |
| `BITLY_API_TOKEN` | ⚠️ Optional* | None | Bitly API token (if using bitly) | `your_bitly_token` |
| `TINYURL_API_KEY` | ⚠️ Optional* | None | TinyURL API key (if using tinyurl) | `your_tinyurl_key` |

**Notes**:
- *Required if `URL_SHORTENER_TYPE` is `bitly` or `tinyurl`
- `custom` uses base64url encoding with `URL_SHORTENER_BASE_URL`

### Logging & Monitoring

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `LOG_LEVEL` | ⚠️ Optional | `info` | Log level | `info`, `debug`, `warn`, `error` |
| `LOG_DIR` | ⚠️ Optional | `./logs` | Log directory | `./logs` |
| `SENTRY_DSN` | ⚠️ Optional | None | Sentry DSN for error tracking | `https://...@sentry.io/...` |

### Feature Flags

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `EVENT_POLLING_ENABLED` | ⚠️ Optional | `true` | Enable Shopify event polling | `true` or `false` |
| `EVENT_POLLING_INTERVAL` | ⚠️ Optional | `5` | Event polling interval (seconds) | `5` |
| `RUN_SCHEDULER` | ⚠️ Optional | `true` | Enable periodic schedulers | `true` or `false` |
| `SMS_BATCH_SIZE` | ⚠️ Optional | `5000` | Batch size for SMS sending | `5000` |

### Rate Limiting

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `RATE_LIMIT_TRAFFIC_ACCOUNT_MAX` | ⚠️ Optional | `100` | Traffic account rate limit | `100` |
| `RATE_LIMIT_TENANT_MAX` | ⚠️ Optional | `50` | Per-tenant rate limit | `50` |
| `RATE_LIMIT_GLOBAL_MAX` | ⚠️ Optional | `200` | Global rate limit | `200` |

## Environment Validation

### Startup Validation

The app validates required environment variables on startup via `config/env-validation.js`:

**Production Required**:
- `DATABASE_URL`
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `STRIPE_SECRET_KEY`

**Development Required**:
- `DATABASE_URL`

**Production Warnings** (optional but recommended):
- `REDIS_URL` or Redis connection vars
- `MITTO_API_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `JWT_SECRET`
- `SESSION_SECRET`
- `HOST`
- `ALLOWED_ORIGINS`

### Validation Function

```javascript
import { validateAndLogEnvironment } from './config/env-validation.js';

// Called in index.js on startup
validateAndLogEnvironment();
```

## Monorepo Environment Loading

### Option A: Single Root .env (Simple)

**Structure**:
```
monorepo/
  .env                    # Shared env vars
  packages/
    backend/
      .env.local          # Backend overrides (optional)
    frontend/
      .env.local          # Frontend overrides (optional)
```

**Backend `package.json`**:
```json
{
  "scripts": {
    "start": "node -r dotenv/config index.js dotenv_config_path=../../.env",
    "dev": "nodemon -r dotenv/config index.js dotenv_config_path=../../.env"
  }
}
```

**Pros**: Simple, single source of truth  
**Cons**: All workspaces see all vars (security concern)

### Option B: Root .env + Per-Workspace Overrides (Recommended)

**Structure**:
```
monorepo/
  .env                    # Shared env vars (DATABASE_URL, REDIS_URL, etc.)
  packages/
    backend/
      .env                # Backend-specific vars (MITTO_API_KEY, etc.)
      .env.local           # Local overrides (gitignored)
    frontend/
      .env                # Frontend-specific vars
      .env.local           # Local overrides (gitignored)
```

**Backend `package.json`**:
```json
{
  "scripts": {
    "start": "node scripts/load-env.js && node index.js",
    "dev": "nodemon scripts/load-env.js && nodemon index.js"
  }
}
```

**Backend `scripts/load-env.js`**:
```javascript
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load root .env first (shared vars)
const rootEnvPath = resolve(__dirname, '../../.env');
dotenv.config({ path: rootEnvPath });

// Load workspace .env (backend-specific, overrides root)
const workspaceEnvPath = resolve(__dirname, '../.env');
dotenv.config({ path: workspaceEnvPath });

// Load .env.local last (local overrides, gitignored)
const localEnvPath = resolve(__dirname, '../.env.local');
dotenv.config({ path: localEnvPath, override: true });
```

**Pros**: 
- Clear separation of concerns
- Workspace-specific vars isolated
- Local overrides don't affect others

**Cons**: 
- Slightly more complex
- Need to maintain multiple .env files

### Option C: Environment-Specific Files

**Structure**:
```
monorepo/
  .env.development
  .env.staging
  .env.production
  packages/
    backend/
      .env.development.local
      .env.staging.local
      .env.production.local
```

**Backend `scripts/load-env.js`**:
```javascript
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const env = process.env.NODE_ENV || 'development';

// Load root env file
dotenv.config({ path: resolve(__dirname, `../../.env.${env}`) });

// Load workspace env file
dotenv.config({ path: resolve(__dirname, `../.env.${env}`) });

// Load local overrides
dotenv.config({ 
  path: resolve(__dirname, `../.env.${env}.local`),
  override: true 
});
```

**Pros**: 
- Environment-specific configuration
- Clear separation

**Cons**: 
- More files to maintain
- Risk of drift between environments

## Recommended Approach

**Use Option B (Root .env + Per-Workspace Overrides)**:

1. **Root `.env`**: Shared infrastructure vars
   - `DATABASE_URL`
   - `REDIS_HOST`, `REDIS_PORT`, etc.
   - `NODE_ENV`

2. **Backend `.env`**: Backend-specific vars
   - `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`
   - `MITTO_API_KEY`
   - `STRIPE_SECRET_KEY`
   - `JWT_SECRET`

3. **Frontend `.env`**: Frontend-specific vars
   - `VITE_API_URL` or similar
   - Frontend-only configs

4. **`.env.local`**: Local overrides (gitignored)
   - Developer-specific overrides
   - Local database URLs
   - Test credentials

## Implementation Steps

### 1. Create `scripts/load-env.js`

```javascript
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine monorepo root (2 levels up from scripts/)
const monorepoRoot = resolve(__dirname, '../..');
const workspaceRoot = resolve(__dirname, '..');

// Load in priority order (later overrides earlier)
// 1. Root .env (shared)
dotenv.config({ path: resolve(monorepoRoot, '.env') });

// 2. Workspace .env (workspace-specific)
dotenv.config({ path: resolve(workspaceRoot, '.env') });

// 3. .env.local (local overrides, gitignored)
dotenv.config({ 
  path: resolve(workspaceRoot, '.env.local'),
  override: true 
});

console.log('Environment loaded:', {
  nodeEnv: process.env.NODE_ENV,
  hasDatabase: !!process.env.DATABASE_URL,
  hasRedis: !!process.env.REDIS_HOST || !!process.env.REDIS_URL,
});
```

### 2. Update `index.js`

```javascript
// Load environment first (before any other imports)
import './scripts/load-env.js';

// Then load rest of app
import dotenv from 'dotenv';
// ... rest of index.js
```

**Note**: Remove `dotenv.config()` from `index.js` if using `load-env.js`

### 3. Update `package.json`

```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  }
}
```

### 4. Create `.env.example` Files

**Root `.env.example`**:
```bash
# Shared Infrastructure
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_HOST=redis.example.com
REDIS_PORT=6379
NODE_ENV=development
```

**Backend `.env.example`**:
```bash
# Shopify
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SCOPES=read_customers,write_customers,read_orders

# Mitto
MITTO_API_KEY=your_mitto_key
MITTO_TRAFFIC_ACCOUNT_ID=your_account_id

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Auth
JWT_SECRET=your_jwt_secret_min_32_chars
```

### 5. Update `.gitignore`

```
# Environment files
.env.local
.env*.local
```

## Testing

### Local Development

1. Copy `.env.example` to `.env` in root and backend
2. Fill in required values
3. Create `.env.local` for local overrides
4. Run `npm run dev`

### CI/CD

1. Set environment variables in CI/CD platform
2. CI should not use `.env.local` files
3. Use secrets management for sensitive vars

## Validation on Startup

The existing `validateAndLogEnvironment()` function in `config/env-validation.js` will:
- ✅ Check required vars are present
- ⚠️ Warn about missing optional vars in production
- ❌ Exit with error if required vars missing

## Troubleshooting

### Issue: Env vars not loading

**Check**:
1. File paths in `load-env.js` are correct
2. `.env` files exist in expected locations
3. `NODE_ENV` is set correctly

### Issue: Wrong env vars used

**Check**:
1. Load order (root → workspace → local)
2. `.env.local` not overriding unintentionally
3. No duplicate `dotenv.config()` calls

### Issue: Monorepo structure changed

**Update**: `load-env.js` paths to match new structure

