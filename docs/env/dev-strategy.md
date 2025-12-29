# Environment Variable Loading Strategy

## Overview
This document describes how environment variables are loaded in development and production environments.

---

## Development Strategy

### Option A: Per-Service .env Files (RECOMMENDED)

**Approach:** Each service has its own `.env` file in its directory.

**Structure:**
```
.env                          # Root shared vars (optional, for convenience)
apps/retail-api/.env          # Retail API vars
apps/retail-worker/.env       # Retail worker vars (or symlink to retail-api/.env)
apps/shopify-api/.env         # Shopify API vars
apps/web/.env.local          # Web frontend vars (VITE_ only)
```

**Loading Order:**
1. Root `.env` (if exists, for shared vars)
2. Service `.env` (service-specific vars, overrides root)
3. Service `.env.local` (local overrides, gitignored)

**Implementation:**
- **retail-api:** Uses `dotenv` in `src/config/env.js` (loads from `apps/retail-api/.env`)
- **retail-worker:** Uses `DOTENV_CONFIG_PATH=../.env` in scripts (loads from `apps/retail-api/.env` or root)
- **shopify-api:** Uses `config/loadEnv.js` (loads root `.env` → app `.env` → app `.env.local`)
- **web:** Vite automatically loads `apps/web/.env.local` (only `VITE_` vars exposed)

**Scripts:**
```json
{
  "dev": "DOTENV_CONFIG_PATH=../.env node -r dotenv/config --watch src/server.js",
  "start": "DOTENV_CONFIG_PATH=../.env node -r dotenv/config src/server.js"
}
```

**Pros:**
- ✅ Clear separation of concerns
- ✅ Service-specific overrides easy
- ✅ No path confusion
- ✅ Works with existing scripts

**Cons:**
- ⚠️ Some duplication (shared vars in multiple files)
- ⚠️ Need to keep shared vars in sync

---

## Current Implementation

### Retail API
**File:** `apps/retail-api/src/config/env.js`
```javascript
require('dotenv').config(); // Loads from apps/retail-api/.env
```

**Scripts:** Use `DOTENV_CONFIG_PATH=../.env` to load from parent directory (root `.env`)

**Status:** ✅ Works correctly

---

### Retail Worker
**Scripts:** Use `DOTENV_CONFIG_PATH=../.env` to load from parent directory

**Status:** ✅ Works correctly (shares env with retail-api)

**Note:** Worker can use same `.env` as retail-api or have its own. Current setup uses shared root `.env`.

---

### Shopify API
**File:** `apps/shopify-api/config/loadEnv.js`
```javascript
// Loads in priority order:
// 1. Root .env
// 2. App .env
// 3. App .env.local
```

**Status:** ✅ Works correctly

---

### Web Frontend
**Vite Configuration:** Automatically loads `apps/web/.env.local`

**Status:** ✅ Works correctly

**Note:** Only `VITE_` prefixed variables are exposed to frontend code.

---

## Production Strategy (Render)

### Environment Variables in Render

**Approach:** All environment variables are set in Render dashboard (no `.env` files).

**Services:**
- `web` - Static site service
- `shopify-api` - Web service
- `retail-api` - Web service
- `retail-worker` - Background worker

**Configuration:**
1. Set env vars in Render dashboard for each service
2. Render injects env vars at runtime
3. No `.env` files needed in production

**Shared Variables:**
- Variables shared across services (DATABASE_URL, REDIS_*, etc.) should be set in each service's env config
- Render supports environment groups for sharing (optional)

---

## Recommended Setup

### Development

1. **Root `.env` (optional, for convenience):**
   ```env
   # Shared vars
   DATABASE_URL=postgresql://...
   REDIS_HOST=localhost
   JWT_SECRET=...
   ```

2. **Service `.env` files:**
   - `apps/retail-api/.env` - Retail API specific + shared vars
   - `apps/shopify-api/.env` - Shopify API specific + shared vars
   - `apps/web/.env.local` - Frontend VITE_ vars only

3. **Service `.env.local` (gitignored, for local overrides):**
   - Override any vars for local testing

### Production

1. Set all env vars in Render dashboard
2. No `.env` files in production
3. Use Render environment groups for shared vars (optional)

---

## Migration Notes

### Current State
- ✅ retail-api: Uses `DOTENV_CONFIG_PATH=../.env` (loads from root)
- ✅ retail-worker: Uses `DOTENV_CONFIG_PATH=../.env` (loads from root)
- ✅ shopify-api: Uses `loadEnv.js` (loads root → app → app.local)
- ✅ web: Uses Vite auto-loading (`.env.local`)

### Recommended Changes
**None required** - Current setup works correctly.

**Optional Improvements:**
1. Create per-service `.env.example` files (done)
2. Document which vars are shared vs service-specific (done)
3. Consider using root `.env` for shared vars only (current approach)

---

## Troubleshooting

### Issue: Env vars not loading
**Solution:** Check `DOTENV_CONFIG_PATH` in scripts matches actual `.env` file location.

### Issue: Frontend can't access env vars
**Solution:** Ensure variables are prefixed with `VITE_` and in `apps/web/.env.local`.

### Issue: Worker can't access env vars
**Solution:** Ensure `DOTENV_CONFIG_PATH=../.env` points to correct `.env` file (root or retail-api).

---

## Best Practices

1. ✅ **Never commit `.env` files** - Use `.env.example` instead
2. ✅ **Use `.env.local` for local overrides** - Gitignored automatically
3. ✅ **Document all env vars** - See `docs/env/standard-keys.md`
4. ✅ **Use canonical keys** - See `docs/env/standard-keys.md`
5. ✅ **Support fallbacks** - See `docs/env/backward-compat.md`
6. ✅ **Validate on startup** - Both retail-api and shopify-api validate env vars

