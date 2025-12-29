# Render Deployment Guide

This document provides exact build and start commands for deploying each service to Render.

## Overview

The monorepo contains three deployable services:
- **apps/web** → `https://astronote.onrender.com` (Frontend)
- **apps/shopify-api** → `https://astronote-shopify.onrender.com` (Shopify Backend API)
- **apps/retail-api** → `https://astronote-retail.onrender.com` (Retail Backend API - placeholder)

---

## A) Frontend (apps/web)

**Service Name:** `astronote-web`  
**URL:** `https://astronote.onrender.com`

### Build Command

```bash
npm ci && npm --workspace apps/web run build
```

**Alternative (if root install fails):**
```bash
cd apps/web && npm ci && npm run build
```

### Start Command

```bash
npx serve -s apps/web/dist -l $PORT
```

**Note:** Ensure `serve` is installed. Add to `apps/web/package.json` if needed:
```json
{
  "dependencies": {
    "serve": "^14.2.1"
  }
}
```

### Environment Variables

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_SHOPIFY_API_BASE_URL` | `https://astronote-shopify.onrender.com` | ✅ Yes |
| `VITE_APP_URL` | `https://astronote.onrender.com` | ✅ Yes |

### Render Settings

- **Build Command:** `npm ci && npm --workspace apps/web run build`
- **Start Command:** `npx serve -s apps/web/dist -l $PORT`
- **Node Version:** 18.x or higher
- **Auto-Deploy:** Enabled (on push to main branch)

---

## B) Shopify API (apps/shopify-api)

**Service Name:** `astronote-shopify-api`  
**URL:** `https://astronote-shopify.onrender.com`

### Build Command

```bash
npm ci && npm --workspace apps/shopify-api run prisma:generate && npm --workspace apps/shopify-api run prisma:migrate:deploy
```

**Breakdown:**
1. Install all dependencies (root + workspaces)
2. Generate Prisma Client
3. Deploy database migrations

### Start Command

```bash
npm --workspace apps/shopify-api run start
```

### Environment Variables

#### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Neon PostgreSQL pooled connection | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |
| `DIRECT_URL` | Neon PostgreSQL direct connection | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |
| `REDIS_URL` | Redis connection string | `redis://default:pass@host:port` |
| `HOST` | Public API base URL | `https://astronote-shopify.onrender.com` |
| `URL_SHORTENER_BASE_URL` | Backend short link base | `https://astronote-shopify.onrender.com` |
| `ALLOWED_ORIGINS` | CORS allowed origins (CSV) | `https://astronote.onrender.com,https://admin.shopify.com` |

#### Shopify Integration

| Variable | Description |
|----------|-------------|
| `SHOPIFY_API_KEY` | Shopify App API Key |
| `SHOPIFY_API_SECRET` | Shopify App API Secret |
| `SCOPES` | Comma-separated OAuth scopes |

#### SMS Provider (Mitto)

| Variable | Description |
|----------|-------------|
| `MITTO_API_BASE` | Mitto API base URL |
| `MITTO_API_KEY` | Mitto API key |
| `MITTO_WEBHOOK_SECRET` | Mitto webhook signature secret |

#### Payment (Stripe)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature |

#### Security

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | JWT signing secret |
| `SESSION_SECRET` | Express session secret |

### CORS Configuration

**Important:** `ALLOWED_ORIGINS` must include:
- `https://astronote.onrender.com` (frontend)
- `https://admin.shopify.com` (Shopify admin)

**Format:** Comma-separated list (no spaces, or spaces trimmed):
```
https://astronote.onrender.com,https://admin.shopify.com
```

**Note:** The code also hardcodes `https://astronote.onrender.com` in `app.js` for safety.

### Render Settings

- **Build Command:** `npm ci && npm --workspace apps/shopify-api run prisma:generate && npm --workspace apps/shopify-api run prisma:migrate:deploy`
- **Start Command:** `npm --workspace apps/shopify-api run start`
- **Node Version:** 18.x or higher
- **Health Check Path:** `/health/full`
- **Auto-Deploy:** Enabled (on push to main branch)

---

## C) Retail API (apps/retail-api)

**Service Name:** `astronote-retail-api`  
**URL:** `https://astronote-retail.onrender.com`

**Status:** Placeholder - To be implemented

### Build Command

```bash
npm ci && npm --workspace apps/retail-api run prisma:generate && npm --workspace apps/retail-api run prisma:migrate:deploy
```

### Start Command

```bash
npm --workspace apps/retail-api run start
```

### Environment Variables

Similar to `apps/shopify-api` (database, Redis, etc.)

---

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables set in Render dashboard
- [ ] Database migrations tested locally
- [ ] CORS origins verified
- [ ] Health check endpoints working (`/health/full`)

### Post-Deployment

- [ ] Frontend loads at `https://astronote.onrender.com`
- [ ] API health check passes: `GET https://astronote-shopify.onrender.com/health/full`
- [ ] Frontend can connect to API (check browser console)
- [ ] CORS allows frontend origin (check Network tab)
- [ ] Database migrations applied successfully
- [ ] Prisma Client generated

### Troubleshooting

#### Build Fails

1. Check Node version (must be 18+)
2. Verify `package.json` scripts exist
3. Check Render build logs for specific errors

#### Start Fails

1. Check environment variables are set
2. Verify database connection (`DATABASE_URL`, `DIRECT_URL`)
3. Check Redis connection (`REDIS_URL`)
4. Review application logs in Render dashboard

#### CORS Errors

1. Verify `ALLOWED_ORIGINS` includes frontend URL
2. Check `app.js` hardcoded origins
3. Ensure no trailing slashes in origin URLs

#### Database Migration Fails

1. Verify `DATABASE_URL` and `DIRECT_URL` are correct
2. Check Neon database is accessible
3. Review migration files in `prisma/migrations/`

---

## Monorepo-Specific Notes

### Workspace Commands

Render uses npm workspaces. Commands like:
- `npm --workspace apps/web run build` - Run script in specific workspace
- `npm -ws run build` - Run script in all workspaces (if present)

### Dependencies

All dependencies are installed at root via `npm ci`, which respects workspace configuration.

### Build Artifacts

- **Frontend:** `apps/web/dist/` (Vite output)
- **Backend:** No build artifacts (Node.js runtime)

---

## Health Checks

### Frontend

No health check endpoint (static site). Render monitors HTTP 200 responses.

### Backend APIs

**Health Check URL:** `GET /health/full`

**Expected Response:**
```json
{
  "ok": true,
  "checks": {
    "db": { "status": "healthy", "responseTime": "5ms" },
    "redis": { "status": "healthy", "responseTime": "2ms" },
    "queue": { "status": "healthy", "responseTime": "10ms" }
  },
  "timestamp": "2024-01-25T12:00:00.000Z"
}
```

**Render Health Check Path:** `/health/full`

---

## Environment Variable Reference

### Frontend (.env in apps/web)

```bash
VITE_SHOPIFY_API_BASE_URL=https://astronote-shopify.onrender.com
VITE_APP_URL=https://astronote.onrender.com
```

### Backend (.env in apps/shopify-api)

See `apps/shopify-api/env.example` for complete list.

**Critical Variables:**
- `DATABASE_URL` (Neon pooled)
- `DIRECT_URL` (Neon direct)
- `REDIS_URL`
- `HOST`
- `ALLOWED_ORIGINS` (must include `https://astronote.onrender.com`)

---

## Rollback Procedure

1. In Render dashboard, go to service → Deploys
2. Find last successful deploy
3. Click "Rollback to this deploy"
4. Verify health check passes after rollback

---

## Monitoring

- **Render Dashboard:** View logs, metrics, and deploy history
- **Health Endpoint:** `GET /health/full` (backend only)
- **Metrics Endpoint:** `GET /metrics` (Prometheus format, backend only)

---

## Support

For deployment issues:
1. Check Render build logs
2. Review application logs
3. Verify environment variables
4. Test health endpoints manually
5. Check CORS configuration

