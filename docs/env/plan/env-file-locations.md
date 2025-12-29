# Environment File Locations Plan

## Date
2025-01-23

## Standardized .env File Locations

### Development (Local)

| Workspace | Dev File | Example File | Notes |
|-----------|----------|--------------|-------|
| `apps/web` | `.env.local` | `.env.example` | Vite loads `.env.local` automatically (gitignored) |
| `apps/shopify-api` | `.env` | `.env.example` | Loaded by `config/loadEnv.js` (gitignored) |
| `apps/retail-api` | `.env` | `.env.example` | Loaded by `src/config/env.js` (gitignored) |
| `apps/retail-worker` | `.env` | `.env.example` | Shares with retail-api or uses `DOTENV_CONFIG_PATH=../.env` |
| `apps/astronote-shopify-extension` | N/A | N/A | No runtime env vars needed |

### Root Level
- **`.env.example`** - Shared example (no secrets)
- **`.env`** - Optional shared vars (gitignored, for convenience)

---

## Loading Priority (Development)

### apps/web (Frontend)
1. `apps/web/.env.local` (highest priority, gitignored)
2. `apps/web/.env` (if exists)
3. Vite only exposes `VITE_*` prefixed variables

### apps/shopify-api (Backend)
1. Root `.env` (shared vars)
2. `apps/shopify-api/.env` (app-specific, overrides root)
3. `apps/shopify-api/.env.local` (local overrides, gitignored, highest priority)

### apps/retail-api (Backend)
1. `apps/retail-api/.env` (primary)
2. Scripts use `DOTENV_CONFIG_PATH=../.env` to also load root `.env` (if exists)

### apps/retail-worker (Worker)
1. `apps/retail-worker/.env` (if exists)
2. Scripts use `DOTENV_CONFIG_PATH=../.env` to load root `.env` or `apps/retail-api/.env`

---

## Production (Render)

### Environment Variables
- **No .env files** - All vars set via Render dashboard
- Each service has its own environment variable set in Render
- Variables are injected at runtime

### Service Mapping
- **Web Frontend**: `astronote.onrender.com` - Uses Render env vars
- **Shopify API**: `astronote-shopify.onrender.com` - Uses Render env vars
- **Retail API**: `astronote-retail.onrender.com` - Uses Render env vars
- **Retail Worker**: Separate Render service - Uses Render env vars

---

## File Structure

```
monorepo/
├── .env.example                    # Root shared example (optional)
├── .env                            # Root shared (gitignored, optional)
├── apps/
│   ├── web/
│   │   ├── .env.example           # Frontend example
│   │   └── .env.local             # Frontend dev (gitignored)
│   ├── shopify-api/
│   │   ├── .env.example           # Shopify API example
│   │   ├── .env                   # Shopify API dev (gitignored)
│   │   └── .env.local             # Shopify API local overrides (gitignored)
│   ├── retail-api/
│   │   ├── .env.example           # Retail API example
│   │   └── .env                   # Retail API dev (gitignored)
│   └── retail-worker/
│       ├── .env.example           # Retail worker example
│       └── .env                   # Retail worker dev (gitignored, or symlink to retail-api/.env)
```

---

## Gitignore Rules

All `.env` and `.env.local` files should be gitignored:
- `**/.env`
- `**/.env.local`
- `.env` (root)

Only `.env.example` files should be committed.

---

## Summary

- **Dev**: Each service reads its own `.env` file (or `.env.local` for frontend)
- **Production**: Render dashboard env vars (no files)
- **Examples**: All services have `.env.example` files (committed to git)

