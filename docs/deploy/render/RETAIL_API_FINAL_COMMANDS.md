# Retail API - Final Render Deployment Commands

## ✅ Status: Converted from Git Submodule to Normal Workspace

The `apps/retail-api` has been successfully converted from a git submodule to a normal workspace directory, just like `shopify-api`.

---

## Render Service Configuration

### Service Settings

**Service Name:** `astronote-retail-api`  
**Service Type:** Web Service  
**Environment:** Node  
**Root Directory:** **(EMPTY - leave blank)**  
**Branch:** `main`

---

### Build & Start Commands

**Build Command:**
```bash
npm ci && npm -w @astronote/retail-api run build
```

**Start Command:**
```bash
npm -w @astronote/retail-api run start
```

---

## Environment Variables

See `docs/deploy/checklists/render-retail-api-env.md` for complete list.

**Critical Variables:**
- `DATABASE_URL` - Neon PostgreSQL connection
- `DIRECT_URL` - Neon direct connection (for migrations)
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_TLS`
- `JWT_SECRET` - Generate with: `openssl rand -base64 32`
- `MITTO_API_KEY` - From Mitto dashboard
- `STRIPE_SECRET_KEY` - From Stripe dashboard
- `WORKER_MODE=embedded` - Run workers embedded in API process

---

## Verification

After deployment, verify:

```bash
# Health check
curl https://astronote-retail.onrender.com/healthz

# Readiness check (includes DB, Redis, workers)
curl https://astronote-retail.onrender.com/readiness
```

---

## Benefits of This Change

1. ✅ **No submodule sync issues** - No git submodule commands needed
2. ✅ **Consistent with shopify-api** - Same deployment pattern
3. ✅ **Simpler deployment** - Standard npm workspace commands
4. ✅ **Automatic detection** - npm workspaces detect retail-api automatically

---

## Notes

- `apps/retail-api` is now a normal directory (not a submodule)
- All files are committed directly to the monorepo
- Future updates should be made directly in `apps/retail-api`
- No special git submodule handling required in CI/CD

