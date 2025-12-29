# Verification Commands

## Date
2025-01-23

## Overview
Commands to verify the monorepo is ready for Render deployment.

---

## Pre-Deployment Verification

### 1. Install Dependencies

```bash
# From repo root
npm ci
```

**Expected:** All dependencies install successfully  
**If fails:** Check `package-lock.json` is up to date

**Note:** In sandbox environments, `npm ci` may fail with EPERM errors. This is expected and can be ignored for verification purposes. The command will work in actual deployment environments.

---

### 2. Build Frontend

```bash
# From repo root
npm -w apps/web run build
```

**Expected:** Build completes, `apps/web/dist/` directory created  
**If fails:** Check for build errors, missing dependencies

**Note:** If build fails with "EPERM: operation not permitted" when reading `.env` file, this is expected in sandbox environments. Vite will use default values for `VITE_*` variables. The build will work correctly in deployment environments where `.env` files are accessible or env vars are set in Render dashboard.

**Verify output:**
```bash
ls -la apps/web/dist/
# Should show: index.html, assets/ directory
```

---

### 3. Lint & Format Check (Optional)

**Shopify API:**
```bash
npm -w apps/shopify-api run lint
npm -w apps/shopify-api run format
```

**Retail API:**
```bash
npm -w apps/retail-api run lint
npm -w apps/retail-api run format
```

**Web Frontend:**
```bash
npm -w apps/web run lint
npm -w apps/web run format
```

**Expected:** No linting errors, formatting is correct  
**If fails:** Run `lint:fix` and `format:write` to auto-fix

---

### 4. Prisma Validation

**Shopify API:**
```bash
cd apps/shopify-api
npm run prisma:validate
npm run prisma:generate
```

**Retail API:**
```bash
cd apps/retail-api
npm run prisma:validate
npm run prisma:generate
```

**Expected:** Schema is valid, Prisma client generates successfully  
**If fails:** Check Prisma schema for errors

**Note:** `prisma:validate` may fail with "Environment variable not found: DATABASE_URL" if `.env` file is not present. This is expected in development without env vars. The schema validation itself (syntax, types) will still work. In production, `DATABASE_URL` will be set in Render dashboard.

---

### 5. Test Scripts Exist

**Verify all services have required scripts:**

```bash
# Web
npm -w apps/web run build
npm -w apps/web run start

# Shopify API
npm -w apps/shopify-api run build
npm -w apps/shopify-api run start

# Retail API
npm -w apps/retail-api run start

# Retail Worker
npm -w apps/retail-worker run start
```

**Expected:** All scripts run without errors (may fail due to missing env vars, but scripts should exist)

---

## Post-Deployment Verification

### 1. Health Endpoints

**Retail API:**
```bash
curl https://astronote-retail.onrender.com/healthz
# Expected: {"status":"ok"}

curl https://astronote-retail.onrender.com/readiness
# Expected: {"status":"ready"}

curl https://astronote-retail.onrender.com/health/db
# Expected: {"status":"ok","database":"connected"}
```

**Shopify API:**
```bash
curl https://astronote-shopify.onrender.com/health
# Expected: {"ok":true,"t":<timestamp>}

curl https://astronote-shopify.onrender.com/health/full
# Expected: {"ok":true,"checks":{"db":{...},"redis":{...},"queue":{...}}}
```

**Web Frontend:**
```bash
curl https://astronote.onrender.com
# Expected: HTML page (200 OK)
```

---

### 2. API Endpoints (Requires Auth)

**Retail API:**
```bash
# Get auth token first (via login endpoint)
TOKEN="your_jwt_token"

curl -X GET https://astronote-retail.onrender.com/api/jobs/health \
  -H "Authorization: Bearer $TOKEN"
# Expected: JSON response with job health status
```

**Shopify API:**
```bash
curl https://astronote-shopify.onrender.com/health/config
# Expected: {"ok":true,"shopify":{...},"redis":{...},"mitto":{...}}
```

---

### 3. CORS Verification

**From browser console on `https://astronote.onrender.com`:**

```javascript
// Test Retail API
fetch('https://astronote-retail.onrender.com/healthz')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
// Expected: No CORS error, returns {"status":"ok"}

// Test Shopify API
fetch('https://astronote-shopify.onrender.com/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
// Expected: No CORS error, returns {"ok":true,...}
```

---

### 4. Frontend Routes

**Navigate in browser:**
- `https://astronote.onrender.com/` - Marketing landing page
- `https://astronote.onrender.com/retail/login` - Retail login
- `https://astronote.onrender.com/shopify/login` - Shopify login

**Expected:** All routes load without errors

---

### 5. Database Connectivity

**Check health endpoints:**
```bash
# Retail API
curl https://astronote-retail.onrender.com/readiness
# Should show: {"status":"ready"} (not "error")

# Shopify API
curl https://astronote-shopify.onrender.com/health/full | jq '.checks.db'
# Should show: {"status":"healthy","responseTime":"<X>ms"}
```

---

### 6. Redis Connectivity

**Check health endpoints:**
```bash
# Shopify API
curl https://astronote-shopify.onrender.com/health/full | jq '.checks.redis'
# Should show: {"status":"healthy"} or {"status":"unhealthy"} if not configured
```

---

### 7. Queue Processing (Worker)

**Check Render logs for retail-worker:**
- Should show worker started
- Should show jobs being processed
- No errors in logs

**Or check queue status via API:**
```bash
# If queue status endpoint exists
curl https://astronote-retail.onrender.com/api/jobs/health \
  -H "Authorization: Bearer $TOKEN"
```

---

## Environment Variable Verification

### Check Required Variables Are Set

**In Render dashboard, verify:**

**Web:**
- `VITE_APP_URL`
- `VITE_RETAIL_API_BASE_URL`
- `VITE_SHOPIFY_API_BASE_URL`

**Shopify API:**
- `DATABASE_URL`
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `STRIPE_SECRET_KEY`
- `CORS_ALLOWLIST`
- `HOST`

**Retail API:**
- `DATABASE_URL`
- `JWT_SECRET`
- `MITTO_API_KEY`
- `STRIPE_SECRET_KEY`
- `CORS_ALLOWLIST`
- `APP_PUBLIC_BASE_URL`

**Retail Worker:**
- Same as retail-api (shared config)

---

## Quick Verification Script

```bash
#!/bin/bash
# Quick verification script

echo "=== Health Checks ==="
echo "Retail API:"
curl -s https://astronote-retail.onrender.com/healthz | jq .

echo "Shopify API:"
curl -s https://astronote-shopify.onrender.com/health | jq .

echo "Web Frontend:"
curl -s -o /dev/null -w "%{http_code}" https://astronote.onrender.com
echo ""

echo "=== Full Health (Shopify) ==="
curl -s https://astronote-shopify.onrender.com/health/full | jq '.checks'

echo "=== Readiness (Retail) ==="
curl -s https://astronote-retail.onrender.com/readiness | jq .
```

---

## Summary

**Pre-Deployment:**
- ✅ `npm ci` succeeds
- ✅ `npm -w apps/web run build` succeeds
- ✅ Prisma validation passes
- ✅ All scripts exist

**Post-Deployment:**
- ✅ Health endpoints respond
- ✅ CORS works
- ✅ Frontend routes load
- ✅ Database connected
- ✅ Redis connected (if configured)
- ✅ Queue processing works (worker)

---

## Troubleshooting

### Build Fails

**Check:**
- Node version (should be >=18.0.0)
- npm version (should be >=8.0.0)
- Dependencies are up to date

### Health Check Fails

**Check:**
- Environment variables are set
- Database connection is valid
- Service is running (check Render logs)

### CORS Errors

**Check:**
- `CORS_ALLOWLIST` includes frontend URL
- Frontend URL matches exactly (no trailing slash)

### Database Connection Fails

**Check:**
- `DATABASE_URL` is correct
- Database is accessible from Render
- SSL is enabled (`?sslmode=require`)

