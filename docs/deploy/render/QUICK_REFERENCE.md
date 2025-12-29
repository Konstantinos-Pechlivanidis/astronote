# Quick Reference - Render Build & Start Commands

## Build & Start Commands per Service

| Service | Root Directory | Build Command | Start Command |
|---------|----------------|---------------|----------------|
| **Web Frontend** | `apps/web` | `npm ci && npm run build` | `npm run start` |
| **Retail API** | `apps/retail-api` | `npm ci` | `npm run start` |
| **Retail Worker** | `apps/retail-worker` | `npm ci` | `npm run start` |
| **Shopify API** | `apps/shopify-api` | `npm ci && npm run build` | `npm run start` |

---

## Environment Variables - Quick Checklist

### Web Frontend (3 variables)
```
VITE_APP_URL=https://astronote.onrender.com
VITE_RETAIL_API_BASE_URL=https://astronote-retail.onrender.com
VITE_SHOPIFY_API_BASE_URL=https://astronote-shopify.onrender.com
```

### Retail API (Minimum Required)
```
NODE_ENV=production
DATABASE_URL=<Neon PostgreSQL>
DIRECT_URL=<Neon Direct>
REDIS_HOST=<Redis host>
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=<Redis password>
REDIS_TLS=true
JWT_SECRET=<generate with: openssl rand -base64 32>
CORS_ALLOWLIST=https://astronote.onrender.com
```

### Retail Worker (Same as Retail API)
- Use same env vars as Retail API
- Same `DATABASE_URL`, `REDIS_*`, `JWT_SECRET`, etc.

### Shopify API (Minimum Required)
```
NODE_ENV=production
DATABASE_URL=<Neon PostgreSQL>
DIRECT_URL=<Neon Direct>
REDIS_HOST=<Redis host>
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=<Redis password>
REDIS_TLS=true
SHOPIFY_API_KEY=<Shopify key>
SHOPIFY_API_SECRET=<Shopify secret>
SESSION_SECRET=<generate with: openssl rand -base64 32>
CORS_ALLOWLIST=https://astronote.onrender.com
URL_SHORTENER_TYPE=custom
URL_SHORTENER_BASE_URL=https://astronote-shopify.onrender.com
```

---

## Prisma Migrations (After First Deploy)

### Retail API
```bash
cd apps/retail-api
npm run prisma:generate
npm run prisma:migrate:deploy
```

### Shopify API
```bash
cd apps/shopify-api
npm run prisma:generate
npm run prisma:migrate:deploy
```

**Run in Render Shell** (Dashboard → Service → Shell)

---

## Health Check URLs

| Service | Health Endpoint |
|---------|----------------|
| **Web** | `https://astronote.onrender.com` (root) |
| **Retail API** | `https://astronote-retail.onrender.com/healthz` |
| **Shopify API** | `https://astronote-shopify.onrender.com/health` |

---

## Service Creation Order (Recommended)

1. **Retail API** (first backend)
2. **Retail Worker** (depends on Retail API)
3. **Shopify API** (independent)
4. **Web Frontend** (depends on both APIs)

---

## Full Documentation

- **Simple Guide (Greek):** `docs/deploy/render/SIMPLE_DEPLOYMENT_GUIDE_GR.md`
- **Detailed Runbook:** `docs/deploy/render/go-live-runbook.md`
- **Env Checklists:** `docs/deploy/checklists/`

