# Go-Live Runbook - Render Deployment

## Date
2025-01-23

## Overview
Step-by-step guide for deploying all services to Render for the first time.

---

## Prerequisites

- [ ] Render account created
- [ ] GitHub repository connected to Render
- [ ] Neon PostgreSQL database created
- [ ] Redis instance created (Redis Cloud recommended)
- [ ] Stripe account configured
- [ ] Shopify Partners app created
- [ ] Mitto SMS account configured

---

## Service Creation Order

### 1. Database Setup (First)

**Neon PostgreSQL:**
1. Create Neon project
2. Create database
3. Get connection strings:
   - Pooled connection → `DATABASE_URL`
   - Direct connection → `DIRECT_URL`

**Redis:**
1. Create Redis Cloud instance
2. Set eviction policy to `noeviction` (critical!)
3. Get connection details:
   - `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_TLS`

---

### 2. Retail API (First Backend)

**Why first:** Other services depend on it.

1. **Create Web Service:**
   - Name: `astronote-retail-api`
   - Environment: `Node`
   - Region: Choose closest to users
   - Branch: `main`
   - Root Directory: **(EMPTY - leave blank)**

2. **Build & Start Commands:**
   - Build: `git submodule sync --recursive && git submodule update --init --recursive && npm ci && npm -w @astronote/retail-api run build`
   - Start: `npm -w @astronote/retail-api run start`

3. **Set Environment Variables:**
   - See `docs/deploy/checklists/render-retail-api-env.md`
   - **Critical:** Set `START_WORKER=0` (we'll create separate worker service)

4. **Run Prisma Migrations:**
   - Open Render Shell
   - Run:
     ```bash
     cd apps/retail-api
     npm run prisma:generate
     npm run prisma:migrate:deploy
     ```

5. **Verify:**
   - Health: `curl https://astronote-retail.onrender.com/healthz`
   - Readiness: `curl https://astronote-retail.onrender.com/readiness`

---

### 3. Retail Worker

1. **Create Background Worker:**
   - Name: `astronote-retail-worker`
   - Environment: `Node`
   - Region: Same as retail-api
   - Branch: `main`
   - Root Directory: `apps/retail-worker`

2. **Build & Start Commands:**
   - Build: `npm ci`
   - Start: `npm run start`

3. **Set Environment Variables:**
   - See `docs/deploy/checklists/render-retail-worker-env.md`
   - **Critical:** Use same `DATABASE_URL`, `REDIS_*`, `JWT_SECRET`, `MITTO_API_KEY`, `STRIPE_SECRET_KEY` as retail-api

4. **Verify:**
   - Check Render logs (should show worker started)
   - Check queue processing (jobs should be processed)

---

### 4. Shopify API

1. **Create Web Service:**
   - Name: `astronote-shopify-api`
   - Environment: `Node`
   - Region: Choose closest to users
   - Branch: `main`
   - Root Directory: `apps/shopify-api`

2. **Build & Start Commands:**
   - Build: `npm ci && npm run build`
   - Start: `npm run start`

3. **Set Environment Variables:**
   - See `docs/deploy/checklists/render-shopify-api-env.md`
   - **Critical:** Set `CORS_ALLOWLIST=https://astronote.onrender.com`
   - **Critical:** Set `HOST=https://astronote-shopify.onrender.com`
   - **Critical:** Set `URL_SHORTENER_TYPE=custom`
   - **Critical:** Set `START_WORKER=false` (workers run in separate service)

4. **Run Prisma Migrations:**
   - Open Render Shell
   - Run:
     ```bash
     cd apps/shopify-api
     npm run prisma:generate
     npm run prisma:migrate:deploy
     ```

5. **Verify:**
   - Health: `curl https://astronote-shopify.onrender.com/health`
   - Full health: `curl https://astronote-shopify.onrender.com/health/full`
   - Check logs: Should show "Workers disabled (START_WORKER=false) - API mode only"

6. **Configure Shopify OAuth:**
   - In Shopify Partners dashboard, set OAuth redirect URL:
     `https://astronote-shopify.onrender.com/auth/callback`

---

### 5. Shopify Worker

1. **Create Background Worker:**
   - Name: `astronote-shopify-worker`
   - Environment: `Node`
   - Region: Same as shopify-api
   - Branch: `main`
   - Root Directory: **(EMPTY - leave blank)**

2. **Build & Start Commands:**
   - Build: `npm ci` (no build step needed)
   - Start: `npm -w @astronote/shopify-worker run start`

3. **Set Environment Variables:**
   - Use **same env vars as shopify-api**:
     - `DATABASE_URL`, `DIRECT_URL`
     - `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_TLS`
     - `MITTO_API_KEY`, `MITTO_TRAFFIC_ACCOUNT_ID`, etc.
     - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
     - `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`
   - **Critical:** Set `START_WORKER=true` (or omit, defaults to true)
   - **Critical:** Set `RUN_SCHEDULER=true` (for schedulers)

4. **Verify:**
   - Check Render logs (should show "Shopify worker started successfully")
   - Check logs: Should show "Worker mode (no HTTP server)"
   - Verify workers are processing jobs (check queue stats if available)

---

### 6. Web Frontend (Last)

1. **Create Web Service:**
   - Name: `astronote-web`
   - Environment: `Node`
   - Region: Choose closest to users
   - Branch: `main`
   - Root Directory: **(EMPTY - leave blank)**

2. **Build & Start Commands:**
   - Build: `npm ci && npm -w @astronote/web run build`
   - Start: `npm -w @astronote/web run start`

3. **Set Environment Variables:**
   - See `docs/deploy/checklists/render-web-env.md`
   - `VITE_APP_URL=https://astronote.onrender.com`
   - `VITE_RETAIL_API_BASE_URL=https://astronote-retail.onrender.com`
   - `VITE_SHOPIFY_API_BASE_URL=https://astronote-shopify.onrender.com`

4. **Verify:**
   - Root URL: `curl https://astronote.onrender.com` (should return HTML)
   - Routes work: Navigate to `/`, `/retail/login`, `/shopify/login`

---

## Environment Variables Setup

### Quick Reference

**Retail API:**
- See `docs/deploy/checklists/render-retail-api-env.md`

**Retail Worker:**
- See `docs/deploy/checklists/render-retail-worker-env.md`

**Shopify API:**
- See `docs/deploy/checklists/render-shopify-api-env.md`

**Web Frontend:**
- See `docs/deploy/checklists/render-web-env.md`

### Common Variables (Set Once, Use Everywhere)

**Database:**
- `DATABASE_URL` - Neon pooled connection
- `DIRECT_URL` - Neon direct connection

**Redis:**
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_TLS`

**Secrets:**
- `JWT_SECRET` - Generate with: `openssl rand -base64 32`
- `STRIPE_SECRET_KEY` - From Stripe dashboard
- `STRIPE_WEBHOOK_SECRET` - From Stripe webhook config
- `MITTO_API_KEY` - From Mitto dashboard
- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` - From Shopify Partners

---

## Prisma Migration Strategy

### Option 1: Predeploy Script (Recommended)

Add to Render service settings:
- **Predeploy Command:** `npm run prisma:generate && npm run prisma:migrate:deploy`

**Pros:**
- Automatic migrations on deploy
- No manual steps

**Cons:**
- Migrations run on every deploy (may be slow)

### Option 2: Manual (First Time Only)

1. Open Render Shell
2. Run:
   ```bash
   cd apps/<service>
   npm run prisma:generate
   npm run prisma:migrate:deploy
   ```

**Pros:**
- Full control
- Can review migrations before applying

**Cons:**
- Manual step required

---

## Verification Steps

### 1. Health Checks

```bash
# Retail API
curl https://astronote-retail.onrender.com/healthz
curl https://astronote-retail.onrender.com/readiness

# Shopify API
curl https://astronote-shopify.onrender.com/health
curl https://astronote-shopify.onrender.com/health/full

# Web Frontend
curl https://astronote.onrender.com
```

### 2. API Endpoints

```bash
# Retail API - Test endpoint (requires auth)
curl -X GET https://astronote-retail.onrender.com/api/health \
  -H "Authorization: Bearer <token>"

# Shopify API - Test endpoint
curl https://astronote-shopify.onrender.com/health/config
```

### 3. Frontend Routes

1. Navigate to `https://astronote.onrender.com` - Should show marketing page
2. Navigate to `https://astronote.onrender.com/retail/login` - Should show retail login
3. Navigate to `https://astronote.onrender.com/shopify/login` - Should show shopify login

### 4. CORS Verification

Open browser console on `https://astronote.onrender.com`:
```javascript
fetch('https://astronote-retail.onrender.com/healthz')
  .then(r => r.json())
  .then(console.log);
```

Should succeed (no CORS error).

### 5. Database Connectivity

Check health endpoints:
- Retail API: `/readiness` should show `{ status: 'ready' }`
- Shopify API: `/health/full` should show `checks.db.status: 'healthy'`

### 6. Redis Connectivity

Check health endpoints:
- Shopify API: `/health/full` should show `checks.redis.status: 'healthy'`

### 7. Queue Processing

- Check Render logs for retail-worker
- Should show jobs being processed
- No errors in logs

---

## Rollback Steps

### If Deployment Fails

1. **Stop Auto-Deploy:**
   - In Render dashboard, disable auto-deploy for affected service

2. **Revert Code:**
   - Revert commit in GitHub
   - Or manually deploy previous version

3. **Check Logs:**
   - Review Render logs for errors
   - Check environment variables

4. **Fix Issues:**
   - Fix code/environment issues
   - Re-deploy

### If Service Won't Start

1. **Check Environment Variables:**
   - Verify all required vars are set
   - Check for typos

2. **Check Prisma:**
   - Run `prisma:generate` manually
   - Check migrations are applied

3. **Check Database:**
   - Verify `DATABASE_URL` is correct
   - Test connection manually

4. **Check Redis:**
   - Verify Redis connection details
   - Test connection manually

---

## Post-Deployment Checklist

- [ ] All services are running (green status in Render)
- [ ] Health endpoints respond correctly
- [ ] Frontend loads and routes work
- [ ] CORS is configured correctly
- [ ] Database connectivity verified
- [ ] Redis connectivity verified
- [ ] Queue processing verified (worker)
- [ ] API endpoints respond correctly
- [ ] Webhooks configured (Stripe, Shopify, Mitto)
- [ ] Monitoring set up (Sentry, logs)

---

## Troubleshooting

### Service Won't Start

**Check:**
- Environment variables are set
- Prisma client is generated
- Database connection is valid
- Port is not manually set (Render sets `PORT` automatically)

### Health Check Fails

**Check:**
- Database is accessible
- Redis is accessible (if configured)
- Environment variables are correct

### CORS Errors

**Check:**
- `CORS_ALLOWLIST` includes frontend URL
- Frontend URL matches exactly (no trailing slash)

### Database Migration Fails

**Check:**
- `DIRECT_URL` is set (for migrations)
- Database user has migration permissions
- No conflicting migrations

---

## Next Steps

After successful deployment:

1. **Set up monitoring:**
   - Configure Sentry (if using)
   - Set up log aggregation
   - Configure alerts

2. **Configure webhooks:**
   - Stripe webhooks
   - Shopify webhooks
   - Mitto webhooks

3. **Test end-to-end:**
   - Create test campaign
   - Send test SMS
   - Verify tracking works

4. **Document production URLs:**
   - Update documentation
   - Update frontend env vars if needed

---

## Summary

**Deployment Order:**
1. Database & Redis setup
2. Retail API
3. Retail Worker
4. Shopify API
5. Web Frontend

**Critical Steps:**
- Set `START_WORKER=0` in retail-api
- Run Prisma migrations before first start
- Set `CORS_ALLOWLIST` correctly
- Set `URL_SHORTENER_TYPE=custom`
- Verify health endpoints after each service

**Verification:**
- Health checks pass
- Frontend loads
- CORS works
- Database/Redis connected
- Queue processing works

