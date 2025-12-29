# Workspaces Inventory

## Overview

This document catalogs all workspaces in the monorepo, including their scripts, entry points, ports, and Prisma usage.

## Workspace Inventory Table

| Workspace Path | Package Name | Dev Command | Build Command | Start Command | Port | Prisma Schema | Notes |
|---------------|--------------|-------------|---------------|---------------|------|---------------|-------|
| **Root** | `astronote-monorepo` | `npm run dev` (concurrently) | `npm run build` | N/A | N/A | N/A | Root workspace orchestrator |
| `apps/shopify-api` | `@astronote/shopify-api` | `npm run dev` (nodemon) | `npm run build` (prisma generate) | `npm start` | `process.env.PORT \|\| 8080` | `apps/shopify-api/prisma/schema.prisma` | Shopify backend API |
| `apps/retail-api` | `astronote-retail-backend` | `npm run dev` (dev-all.js) | `npm run build` (ws) | `npm start` (api) | N/A | `apps/retail-api/prisma/schema.prisma` | **NESTED MONOREPO** - orchestrates sub-apps |
| `apps/retail-api/apps/api` | `@astronote/api` | `npm run dev` (node --watch) | `echo 'No build'` | `npm start` | `process.env.PORT \|\| 3001` | Uses parent Prisma | Retail API server |
| `apps/retail-api/apps/web` | `@astronote/web` | `npm run dev` (vite) | `npm run build` (vite build) | N/A | `5173` (Vite) | N/A | Retail frontend |
| `apps/retail-api/apps/worker` | `@astronote/worker` | `npm run dev` (sms.worker.js) | `echo 'No build'` | N/A | N/A | Uses parent Prisma | Background workers |
| `apps/web` | `@astronote/web` | `npm run dev` (vite) | `npm run build` (vite build) | N/A | `5173` (Vite) | N/A | Unified web frontend (Shopify-focused) |
| `apps/astronote-shopify-extension` | `astronote-sms-marketing-extension` | `npm run dev` (shopify app dev) | `npm run build` (shopify app build) | N/A | N/A | N/A | Shopify extension app |

## Detailed Workspace Information

### Root (`/`)

**Package Name**: `astronote-monorepo`

**Scripts**:
- `dev`: Runs `shopify-api` and `web` concurrently
- `dev:shopify`: `npm -w @astronote/shopify-api run dev`
- `dev:retail`: `npm -w @astronote/retail-api run dev`
- `dev:web`: `npm -w @astronote/web run dev`
- `build`: `npm -ws --if-present run build`
- `lint`: `npm -ws --if-present run lint`
- `format`: `npm -ws --if-present run format`
- `test`: `npm -ws --if-present run test`
- `check`: Runs lint, format, and build
- `verify:builds`: Verifies all builds
- `smoke:api`: Smoke tests for API

**Entry Point**: N/A (orchestrator only)

**Port**: N/A

**Prisma**: N/A

---

### `apps/shopify-api`

**Package Name**: `@astronote/shopify-api`

**Scripts**:
- `start`: `node index.js`
- `dev`: `nodemon index.js`
- `build`: `prisma generate`
- `lint`: `eslint .`
- `format`: `prettier --check .`
- `prisma:generate`: `prisma generate`
- `prisma:migrate:deploy`: `prisma migrate deploy`
- `test`: Jest tests

**Entry Point**: `index.js` → loads `app.js`

**Port**: `process.env.PORT || 8080` (default: 8080)

**Prisma**:
- Schema: `apps/shopify-api/prisma/schema.prisma`
- Migrations: `apps/shopify-api/prisma/migrations/`
- Generate: `prisma generate`
- Deploy: `prisma migrate deploy`

**Notes**:
- Production-ready
- Uses BullMQ for queues
- Requires Redis
- Multi-tenant (Shop-based)

---

### `apps/retail-api` (Nested Monorepo Root)

**Package Name**: `astronote-retail-backend`

**Scripts**:
- `dev`: `node scripts/dev-all.js` (starts all sub-apps)
- `dev:api`: `npm -w @astronote/api run dev`
- `dev:web`: `npm -w @astronote/web run dev`
- `dev:worker`: `npm -w @astronote/worker run dev`
- `build`: `npm -ws run build`
- `start`: `npm -w @astronote/api run start`
- `prisma:generate`: `prisma generate`
- `prisma:migrate:deploy`: `prisma migrate deploy`
- Worker scripts: `worker:sms`, `worker:scheduler`, etc.

**Entry Point**: N/A (orchestrates sub-apps)

**Port**: N/A

**Prisma**:
- Schema: `apps/retail-api/prisma/schema.prisma`
- Migrations: `apps/retail-api/prisma/migrations/`
- Shared by all sub-apps (api, web, worker)

**Notes**:
- **NESTED MONOREPO** - contains its own workspace config
- Prisma schema is shared at this level
- Orchestrates 3 sub-applications

---

### `apps/retail-api/apps/api`

**Package Name**: `@astronote/api`

**Scripts**:
- `dev`: `DOTENV_CONFIG_PATH=../../.env node -r dotenv/config --watch src/server.js`
- `start`: `DOTENV_CONFIG_PATH=../../.env node -r dotenv/config src/server.js`
- `build`: `echo 'No build step required - pure JavaScript'`
- `lint`: `eslint . --ext .js`
- Worker scripts: `worker:sms`, `worker:scheduler`, `worker:contactImport`
- Docs: `docs:openapi`, `docs:postman`

**Entry Point**: `src/server.js`

**Port**: `process.env.PORT` (default: 3001, from env config)

**Prisma**: Uses parent Prisma schema at `apps/retail-api/prisma/`

**Notes**:
- Loads env from `../../.env` (parent directory)
- Pure JavaScript (no build step)
- Express server with multiple route modules

---

### `apps/retail-api/apps/web`

**Package Name**: `@astronote/web`

**Scripts**:
- `dev`: `vite`
- `build`: `vite build`
- `preview`: `vite preview`
- `lint`: `eslint . --ext js,jsx`
- `test`: `vitest run`

**Entry Point**: `src/main.jsx` → `App.jsx`

**Port**: `5173` (Vite dev server, configured in `vite.config.js`)

**Prisma**: N/A (frontend only)

**Notes**:
- React frontend with Vite
- Uses React Router for routing
- Full retail dashboard implementation
- Proxy configured for `/api` → `http://localhost:3001`

---

### `apps/retail-api/apps/worker`

**Package Name**: `@astronote/worker`

**Scripts**:
- `build`: `echo 'No build step required - pure JavaScript'`
- `dev`: `DOTENV_CONFIG_PATH=../../.env node -r dotenv/config src/sms.worker.js`
- Worker scripts:
  - `worker:sms`: SMS worker
  - `worker:scheduler`: Scheduler worker
  - `worker:contactImport`: Contact import worker
  - `worker:birthday`: Birthday automation worker
  - `worker:statusRefresh`: Status refresh worker
  - `worker:piiRetention`: PII retention worker

**Entry Points**: Multiple worker files:
- `src/sms.worker.js`
- `src/scheduler.worker.js`
- `src/contactImport.worker.js`
- `src/birthday.worker.js`
- `src/statusRefresh.worker.js`
- `src/deliveryStatusPoller.worker.js`
- `src/piiRetention.worker.js`
- `src/watchdog.worker.js`

**Port**: N/A (background workers)

**Prisma**: Uses parent Prisma schema at `apps/retail-api/prisma/`

**Notes**:
- BullMQ workers for background processing
- Loads env from `../../.env`
- Pure JavaScript

---

### `apps/web`

**Package Name**: `@astronote/web`

**Scripts**:
- `dev`: `vite`
- `build`: `vite build`
- `preview`: `vite preview`
- `lint`: `eslint . --ext js,jsx`
- `format`: `prettier --check .`

**Entry Point**: `src/main.jsx` → `App.jsx`

**Port**: `5173` (Vite dev server, configured in `vite.config.js`)

**Prisma**: N/A (frontend only)

**Notes**:
- React frontend with Vite
- Currently Shopify-focused (dashboard, campaigns, contacts, etc.)
- Uses React Query, Redux Toolkit
- TailwindCSS + shadcn/ui

---

### `apps/astronote-shopify-extension`

**Package Name**: `astronote-sms-marketing-extension`

**Scripts**:
- `dev`: `shopify app dev`
- `build`: `shopify app build`
- `deploy`: `shopify app deploy`
- `generate`: `shopify app generate`
- `typecheck`: `tsc`

**Entry Points**:
- `app/entry.client.tsx` (client-side)
- `app/entry.server.tsx` (server-side)

**Port**: N/A (Shopify CLI manages port)

**Prisma**: N/A (Shopify extension, uses Shopify API)

**Notes**:
- Remix-based Shopify extension
- TypeScript
- Shopify Polaris UI components
- Deployed via Shopify CLI

---

## Port Conflicts & Resolution

### Potential Port Conflicts

1. **Port 5173**: Used by both `apps/web` and `apps/retail-api/apps/web`
   - **Resolution**: Run only one at a time, or configure different ports
   - **Recommendation**: Merge into single unified frontend

2. **Port 3001**: Used by `apps/retail-api/apps/api`
   - **Status**: No conflict (shopify-api uses 8080)

3. **Port 8080**: Used by `apps/shopify-api`
   - **Status**: No conflict

### Port Configuration

| App | Default Port | Env Variable | Notes |
|-----|--------------|--------------|-------|
| shopify-api | 8080 | `PORT` | Can be overridden |
| retail-api/api | 3001 | `PORT` | From env config (default) |
| web (unified) | 5173 | Vite config | Hardcoded in vite.config.js |
| retail-web | 5173 | Vite config | Hardcoded in vite.config.js |

---

## Prisma Usage Summary

### Prisma Schemas

1. **shopify-api**: `apps/shopify-api/prisma/schema.prisma`
   - Independent schema
   - Migrations: `apps/shopify-api/prisma/migrations/`

2. **retail-api**: `apps/retail-api/prisma/schema.prisma`
   - Shared by `api`, `web`, and `worker` sub-apps
   - Migrations: `apps/retail-api/prisma/migrations/`

### Prisma Commands

**shopify-api**:
```bash
npm -w @astronote/shopify-api run prisma:generate
npm -w @astronote/shopify-api run prisma:migrate:deploy
```

**retail-api**:
```bash
cd apps/retail-api
npm run prisma:generate
npm run prisma:migrate:deploy
```

---

## Script Conflicts

### Naming Conflicts

1. **`@astronote/web`**: Used by both:
   - `apps/web` (unified frontend)
   - `apps/retail-api/apps/web` (retail frontend)
   - **Issue**: Same package name in different locations
   - **Impact**: npm workspace resolution may be ambiguous

2. **`@astronote/api`**: Used by:
   - `apps/retail-api/apps/api`
   - **Status**: No conflict (only one instance)

### Build Script Conflicts

- **shopify-api**: `build` = `prisma generate`
- **retail-api/api**: `build` = `echo 'No build step'`
- **retail-api/web**: `build` = `vite build`
- **retail-api/worker**: `build` = `echo 'No build step'`
- **web**: `build` = `vite build`
- **extension**: `build` = `shopify app build`

**Status**: No conflicts (different implementations)

---

## Recommendations

### P0 (Must Fix)
1. **Resolve package name conflict**: Rename `apps/retail-api/apps/web` package to `@astronote/retail-web`
2. **Flatten retail-api structure**: Move sub-apps to root level to eliminate nested monorepo

### P1 (Should Fix)
1. **Standardize port configuration**: Use environment variables consistently
2. **Document port requirements**: Add port documentation to each app's README

### P2 (Nice to Have)
1. **Unify frontend apps**: Merge `apps/web` and `apps/retail-api/apps/web` into single app with route-based separation
2. **Consolidate Prisma**: Consider if both schemas can share common models via packages/shared

