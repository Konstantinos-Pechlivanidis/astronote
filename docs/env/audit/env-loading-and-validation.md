# Environment Loading and Validation Audit

## Date
2025-01-23

## Overview
This document maps where environment variables are loaded and validated across all workspaces.

---

## apps/web (Frontend)

### Entrypoint
- **File**: `apps/web/src/main.jsx`
- **Build Tool**: Vite
- **Env Loading**: Automatic via Vite (only `VITE_*` vars exposed)

### Validation
- **Type**: None (Vite handles env at build time)
- **Location**: N/A
- **Failure Behavior**: Build-time errors if invalid

### Env File Location
- **Dev**: `apps/web/.env.local` (gitignored)
- **Example**: `apps/web/.env.example` (should exist)
- **Note**: Vite only exposes variables prefixed with `VITE_`

### Required Variables
- `VITE_APP_URL` - Public URL of frontend
- `VITE_RETAIL_API_BASE_URL` - Retail API base URL
- `VITE_SHOPIFY_API_BASE_URL` - Shopify API base URL

---

## apps/shopify-api (Backend)

### Entrypoint
- **File**: `apps/shopify-api/index.js`
- **Line 1-3**: `import loadEnv from './config/loadEnv.js'; loadEnv();`

### Env Loading
- **File**: `apps/shopify-api/config/loadEnv.js`
- **Method**: `dotenv.config()` with priority order:
  1. Root `.env` (shared vars)
  2. `apps/shopify-api/.env` (app-specific)
  3. `apps/shopify-api/.env.local` (local overrides, gitignored)

### Validation
- **File**: `apps/shopify-api/config/env-validation.js`
- **Function**: `validateAndLogEnvironment()`
- **Type**: Custom validation (not Zod)
- **Called**: `apps/shopify-api/index.js` line 20
- **Failure Behavior**: Logs error and `process.exit(1)`

### Required Variables (by environment)
- **Production**: `DATABASE_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `STRIPE_SECRET_KEY`
- **Development**: `DATABASE_URL`
- **Test**: `DATABASE_URL`

### Optional Variables (warnings in production)
- `REDIS_URL`, `MITTO_API_KEY`, `MITTO_API_BASE`, `STRIPE_WEBHOOK_SECRET`, `JWT_SECRET`, `SESSION_SECRET`, `LOG_LEVEL`, `SENTRY_DSN`, `HOST`, `ALLOWED_ORIGINS`

---

## apps/retail-api (Backend)

### Entrypoint
- **File**: `apps/retail-api/src/server.js`
- **Line 2**: `const env = require('./config/env');`

### Env Loading
- **File**: `apps/retail-api/src/config/env.js`
- **Line 8**: `require('dotenv').config();`
- **Note**: Scripts use `DOTENV_CONFIG_PATH=../.env` to load from root `.env`

### Validation
- **File**: `apps/retail-api/src/config/env.js`
- **Function**: `validateEnv()` (line 120)
- **Type**: Zod schema validation
- **Called**: Immediately on module load (line 159: `const env = validateEnv();`)
- **Failure Behavior**: 
  - Prints missing/invalid variables
  - `process.exit(1)`

### Required Variables
- `DATABASE_URL` - Required
- `JWT_SECRET` - Must be at least 24 characters
- `MITTO_API_KEY` - Required
- `STRIPE_SECRET_KEY` - Must start with `sk_`
- `STRIPE_WEBHOOK_SECRET` - Must start with `whsec_`

### Optional Variables (with defaults)
- `NODE_ENV` - Default: `'development'`
- `PORT` - Default: `'3001'`
- `URL_SHORTENER_TYPE` - Default: `'custom'` (enum: `['custom', 'bitly', 'tinyurl', 'none']`)
- Many others with defaults

---

## apps/retail-worker (Worker)

### Entrypoint
- **File**: `apps/retail-worker/src/sms.worker.js` (and other workers)
- **Line 2**: `require('dotenv').config();`

### Env Loading
- **Method**: Direct `dotenv.config()` in each worker file
- **Script Override**: `DOTENV_CONFIG_PATH=../.env` in package.json scripts
- **Note**: Workers typically share same env as retail-api

### Validation
- **Type**: None (relies on retail-api validation if shared config)
- **Failure Behavior**: Workers may fail at runtime if required vars missing

### Required Variables
- Same as `apps/retail-api` (DATABASE_URL, JWT_SECRET, MITTO_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
- **Additional**: Worker-specific flags (QUEUE_*, WORKER_CONCURRENCY, etc.)

---

## apps/astronote-shopify-extension (Extension)

### Entrypoint
- **File**: Extension build process
- **Env Loading**: Build-time only (if needed)

### Validation
- **Type**: Build-time (if any)
- **Note**: Extension typically doesn't need runtime env vars

---

## Summary Table

| Workspace | Entrypoint | Env Loader | Validator | Failure Behavior |
|-----------|-----------|------------|-----------|------------------|
| `apps/web` | `main.jsx` | Vite (automatic) | None | Build errors |
| `apps/shopify-api` | `index.js` | `config/loadEnv.js` | `config/env-validation.js` | `process.exit(1)` |
| `apps/retail-api` | `src/server.js` | `src/config/env.js` (dotenv) | `src/config/env.js` (Zod) | `process.exit(1)` |
| `apps/retail-worker` | Various workers | `dotenv.config()` | None (inherits from retail-api) | Runtime errors |
| `apps/astronote-shopify-extension` | Build process | Build-time | Build-time | Build errors |

---

## Key Findings

1. **Retail API uses Zod validation** - Most strict, validates types and formats
2. **Shopify API uses custom validation** - Simpler, only checks presence
3. **Workers have no validation** - Rely on retail-api validation if shared
4. **Frontend has no validation** - Vite handles at build time
5. **URL_SHORTENER_TYPE mismatch**: 
   - Retail API schema: `['custom', 'bitly', 'tinyurl', 'none']`
   - Shopify API code: Supports `'backend'` but not validated
   - **Fix needed**: Update shopify-api env.example to use `'custom'` for backend redirects

