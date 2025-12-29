# Render Deployment Fixes

## Problem 1: Retail API - Workspace Not Found

**Error:**
```
npm error No workspaces found:
npm error   --workspace=@astronote/retail-api
```

**Solution:**
1. Go to Render Dashboard → `astronote-retail-api` → Settings
2. **Root Directory:** Make sure it's **EMPTY** (not `apps/retail-api`)
3. **Build Command:** `npm ci` (no workspace flag needed)
4. **Start Command:** `npm -w @astronote/retail-api run start`

**Why:** The `npm ci` must run at the root to install all workspace dependencies. Then we use `npm -w` to run commands in specific workspaces.

---

## Problem 2: Shopify API - Worker Lock Already Held

**Error:**
```
[ERROR] Worker lock already held by another process
[ERROR] CRITICAL: Workers failed to start in production. Exiting.
```

**Causes:**
- Stale lock from previous deploy (lock wasn't released)
- Duplicate service running
- Another instance starting at the same time

**Solution (Code Fix Applied):**
The code now handles this gracefully:
- If lock is held, workers won't start but API will continue
- No crash - API serves requests even without workers
- Lock will expire after 60 seconds if stale

**Manual Fix (if needed):**
1. Connect to Redis (Redis Cloud dashboard or CLI)
2. Delete the lock key: `locks:workers:shopify-api:production`
3. Redeploy the service

**Prevention:**
- Ensure only ONE service has `WORKER_MODE=embedded` for shopify-api
- If using separate worker service, set `WORKER_MODE=separate` in API

---

## Correct Render Settings

### Retail API
- **Root Directory:** (empty)
- **Build Command:** `npm ci`
- **Start Command:** `npm -w @astronote/retail-api run start`

### Shopify API
- **Root Directory:** (empty)
- **Build Command:** `npm ci && npm -w @astronote/shopify-api run build`
- **Start Command:** `npm -w @astronote/shopify-api run start`

### Web Frontend
- **Root Directory:** (empty)
- **Build Command:** `npm ci && npm -w @astronote/web run build`
- **Start Command:** `npm -w @astronote/web run start`

---

## Verification

After fixes, check logs:
- ✅ `npm ci` runs successfully (installs all dependencies)
- ✅ Workspace commands work (`npm -w @astronote/...`)
- ✅ Workers start OR gracefully skip if lock held
- ✅ API starts successfully even if workers don't

---

## Redis Lock Management

If you need to manually clear locks:

```bash
# Connect to Redis (via Redis Cloud dashboard or CLI)
redis-cli -h <REDIS_HOST> -p <REDIS_PORT> -a <REDIS_PASSWORD>

# List all worker locks
KEYS locks:workers:*

# Delete specific lock
DEL locks:workers:shopify-api:production
DEL locks:workers:retail-api:production
```

**Note:** Locks expire automatically after 60 seconds if not refreshed.

