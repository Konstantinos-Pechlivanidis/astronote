# Backend Services (shopify-api & retail-api)

## Date
2025-01-23

## Overview
Production deployment configuration for backend API services on Render.

---

## Shopify API Service

### Service Configuration

**Render Service Type:** Web Service  
**Repository:** Monorepo root  
**Root Directory:** `apps/shopify-api`  
**Build Command:** `npm ci && npm run build`  
**Start Command:** `npm run start`

### Build Process

**Build Command:**
```bash
npm ci && npm run build
```

**What it does:**
1. Installs dependencies from root `package-lock.json`
2. Runs `prisma generate` to generate Prisma client

### Start Command

**Production Start:**
```bash
npm run start
```

**What it does:**
- Runs `node index.js`
- Server binds to `0.0.0.0` (default Express behavior)
- Uses `process.env.PORT` (defaults to 8080 if not set)
- Render automatically sets `PORT` environment variable

### Server Binding

**Code:**
```javascript
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  // Server listens on 0.0.0.0 by default (all interfaces)
});
```

**Verification:**
- ✅ Binds to `0.0.0.0` (default Express behavior)
- ✅ Uses `process.env.PORT` (Render sets this)
- ✅ Trusts proxy: `app.set('trust proxy', 1)`

### Health Endpoints

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/health` | GET | Basic health check | `{ ok: true, t: <timestamp> }` |
| `/health/full` | GET | Comprehensive health check | `{ ok: true, checks: { db, redis, queue }, ... }` |
| `/health/config` | GET | Configuration check | `{ ok: true, shopify: {...}, redis: {...}, mitto: {...} }` |

**Health Check Path for Render:** `/health`

### Prisma Migration

**Predeploy Script (Recommended):**
```bash
npm run prisma:generate && npm run prisma:migrate:deploy
```

**Or manually in Render Shell:**
```bash
cd apps/shopify-api
npm run prisma:generate
npm run prisma:migrate:deploy
```

**Note:** Run migrations before first deployment and after schema changes.

---

## Retail API Service

### Service Configuration

**Render Service Type:** Web Service  
**Repository:** Monorepo root  
**Root Directory:** `apps/retail-api`  
**Build Command:** `npm ci` (no build step needed)  
**Start Command:** `npm run start`

### Build Process

**Build Command:**
```bash
npm ci
```

**What it does:**
- Installs dependencies only
- No build step required (pure JavaScript)

### Start Command

**Production Start:**
```bash
npm run start
```

**What it does:**
- Runs `node src/server.js`
- Server binds to `0.0.0.0` (default Express behavior)
- Uses `env.PORT` from config (defaults to 3001 if not set)
- Render automatically sets `PORT` environment variable

### Server Binding

**Code:**
```javascript
const port = env.PORT;
const server = app.listen(port, () => {
  // Server listens on 0.0.0.0 by default (all interfaces)
});
```

**Verification:**
- ✅ Binds to `0.0.0.0` (default Express behavior)
- ✅ Uses `env.PORT` from config (Render sets this)
- ✅ Trusts proxy: `app.set('trust proxy', true)`

### Health Endpoints

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/healthz` | GET | Basic liveness check | `{ status: 'ok' }` |
| `/readiness` | GET | Readiness check with DB ping | `{ status: 'ready' }` or `{ status: 'error', ... }` |
| `/health/db` | GET | Database connectivity check | `{ status: 'ok', database: 'connected' }` |

**Health Check Path for Render:** `/healthz` or `/readiness`

### Prisma Migration

**Predeploy Script (Recommended):**
```bash
npm run prisma:generate && npm run prisma:migrate:deploy
```

**Or manually in Render Shell:**
```bash
cd apps/retail-api
npm run prisma:generate
npm run prisma:migrate:deploy
```

**Note:** Run migrations before first deployment and after schema changes.

---

## Environment Variables

Both services require environment variables. See:
- `docs/deploy/checklists/render-shopify-api-env.md`
- `docs/deploy/checklists/render-retail-api-env.md`

---

## Render Configuration

### Shopify API Settings

**Name:** `astronote-shopify-api`  
**Environment:** `Node`  
**Region:** Choose closest to users  
**Branch:** `main`  
**Root Directory:** `apps/shopify-api`

**Build Command:**
```bash
npm ci && npm run build
```

**Start Command:**
```bash
npm run start
```

**Health Check Path:** `/health`

### Retail API Settings

**Name:** `astronote-retail-api`  
**Environment:** `Node`  
**Region:** Choose closest to users  
**Branch:** `main`  
**Root Directory:** `apps/retail-api`

**Build Command:**
```bash
npm ci
```

**Start Command:**
```bash
npm run start
```

**Health Check Path:** `/healthz` or `/readiness`

---

## Verification

After deployment, verify:

1. **Health endpoints respond:**
   ```bash
   # Shopify API
   curl https://astronote-shopify.onrender.com/health
   curl https://astronote-shopify.onrender.com/health/full
   
   # Retail API
   curl https://astronote-retail.onrender.com/healthz
   curl https://astronote-retail.onrender.com/readiness
   ```

2. **Server logs show correct port:**
   - Check Render logs
   - Should show: "Server started" with correct port

3. **Database connectivity:**
   - Check `/health/full` (shopify-api) or `/readiness` (retail-api)
   - Should show database as "healthy" or "ready"

---

## Troubleshooting

### Server Won't Start

**Issue:** Server fails to start  
**Check:**
- Environment variables are set correctly
- Database connection string is valid
- Prisma client is generated (`npm run prisma:generate`)

### Health Check Fails

**Issue:** Health endpoint returns error  
**Check:**
- Database is accessible
- Redis is accessible (if configured)
- Environment variables are set

### Port Already in Use

**Issue:** Port binding error  
**Fix:** Render sets `PORT` automatically. Don't override it.

---

## Summary

### Shopify API
- ✅ Build: `npm ci && npm run build` (Prisma generate)
- ✅ Start: `npm run start` (binds to 0.0.0.0, uses PORT)
- ✅ Health: `/health`, `/health/full`
- ✅ Prisma: Run `prisma:generate` and `prisma:migrate:deploy`

### Retail API
- ✅ Build: `npm ci` (no build step)
- ✅ Start: `npm run start` (binds to 0.0.0.0, uses PORT)
- ✅ Health: `/healthz`, `/readiness`, `/health/db`
- ✅ Prisma: Run `prisma:generate` and `prisma:migrate:deploy`

