# Monorepo Structure

**Date**: 2025-01-XX  
**Status**: Phase 1 Complete - Structure and Tooling

## Overview

This repository has been restructured into a monorepo containing:
- `apps/shopify-api` - Shopify SMS Marketing Extension Backend
- `apps/retail-api` - Retail Backend (placeholder, to be migrated)
- `apps/web` - Web Frontend (placeholder, Phase 2+)
- `packages/shared` - Shared packages (placeholder)

## Directory Structure

```
astronote-shopify-backend/
├── apps/
│   ├── shopify-api/          # Shopify backend (migrated)
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── prisma/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── index.js
│   │   ├── app.js
│   │   └── package.json
│   ├── retail-api/           # Retail backend (placeholder)
│   │   └── README.md
│   └── web/                  # Web frontend (placeholder)
│       └── README.md
├── packages/
│   └── shared/               # Shared packages (placeholder)
├── docs/                     # Documentation
├── package.json              # Root package.json with workspaces
├── .env.example              # Root shared env vars
└── .gitignore
```

## Running Apps Locally

### Prerequisites

1. **Node.js**: >=18.0.0
2. **npm**: >=8.0.0
3. **Database**: PostgreSQL (Neon recommended)
4. **Redis**: For queues and caching

### Installation

```bash
# Install all dependencies (from root)
npm install
```

### Environment Setup

1. **Root `.env`** (shared variables):
   ```bash
   cp .env.example .env
   # Edit .env with shared values
   ```

2. **App-specific `.env`** files:
   ```bash
   # Shopify API
   cp apps/shopify-api/env.example apps/shopify-api/.env
   # Edit apps/shopify-api/.env with app-specific values
   
   # Retail API (when migrated)
   # cp apps/retail-api/env.example apps/retail-api/.env
   ```

3. **Local overrides** (gitignored):
   ```bash
   # Create apps/shopify-api/.env.local for local-only overrides
   ```

### Environment Loading Order

Environment variables are loaded in this priority order (later overrides earlier):

1. **Root `.env`** - Shared variables across all apps
2. **App `.env`** - App-specific variables
3. **App `.env.local`** - Local overrides (gitignored)

This is handled by `apps/shopify-api/config/loadEnv.js` which must be imported FIRST in the entrypoint.

### Running Apps

#### Run All Apps (in parallel)
```bash
npm run dev
```

#### Run Individual Apps
```bash
# Shopify API only
npm run dev:shopify

# Retail API only (when implemented)
npm run dev:retail
```

#### Other Commands
```bash
# Build all apps
npm run build

# Lint all apps
npm run lint

# Format all apps
npm run format

# Run tests
npm run test

# Check (lint + build + test)
npm run check
```

## Ports

| App | Port | Environment Variable |
|-----|------|---------------------|
| Shopify API | 3001 | `PORT` (default: 3001) |
| Retail API | TBD | TBD |
| Web | TBD | TBD |

## Prisma Commands

Prisma commands should be run from within each app directory:

```bash
# From apps/shopify-api/
cd apps/shopify-api

# Generate Prisma Client
npm run prisma:generate
# or
npm run db:generate

# Run migrations
npm run prisma:migrate:deploy
# or
npm run db:migrate

# Open Prisma Studio
npm run db:studio
```

Or from root using workspace commands:
```bash
# Generate Prisma Client for shopify-api
npm -w @astronote/shopify-api run prisma:generate

# Run migrations
npm -w @astronote/shopify-api run prisma:migrate:deploy
```

## Workspace Package Names

- `@astronote/shopify-api` - Shopify backend
- `@astronote/retail-api` - Retail backend (when migrated)
- `@astronote/web` - Web frontend (when implemented)

## Migration Status

### ✅ Completed (Phase 1)
- [x] Monorepo structure created
- [x] Shopify API moved to `apps/shopify-api`
- [x] Root package.json with workspaces
- [x] Environment loading strategy implemented
- [x] Prisma paths verified
- [x] Placeholders for retail-api and web

### ⏳ Pending
- [ ] Migrate retail backend from `../Astronote/astronote-retail` to `apps/retail-api`
- [ ] Implement retail-api env loading
- [ ] Test retail-api integration
- [ ] Implement web frontend (Phase 2+)

## File Moves Summary

### Shopify API
All files from root moved to `apps/shopify-api/`:
- `app.js` → `apps/shopify-api/app.js`
- `index.js` → `apps/shopify-api/index.js`
- `package.json` → `apps/shopify-api/package.json`
- All directories (`config/`, `controllers/`, `prisma/`, etc.) → `apps/shopify-api/`

### New Files Created
- Root `package.json` - Monorepo workspace configuration
- `apps/shopify-api/config/loadEnv.js` - Environment loading utility
- `apps/retail-api/package.json` - Placeholder
- `apps/web/package.json` - Placeholder
- `docs/monorepo-structure.md` - This file

### Modified Files
- `apps/shopify-api/index.js` - Updated to use `loadEnv()` instead of `dotenv.config()`
- `apps/shopify-api/package.json` - Updated name to `@astronote/shopify-api`, added Prisma scripts
- `.gitignore` - Updated for monorepo (added `apps/**/.env`, `apps/**/.env.local`)

## Next Steps

1. **Migrate Retail Backend**:
   - Copy `../Astronote/astronote-retail` to `apps/retail-api`
   - Update package.json name to `@astronote/retail-api`
   - Implement env loading (see `apps/shopify-api/config/loadEnv.js`)
   - Test with `npm run dev:retail`

2. **Implement Web Frontend** (Phase 2+):
   - Set up frontend framework
   - Configure build tools
   - Integrate with APIs

3. **Shared Packages** (Future):
   - Move common utilities to `packages/shared`
   - Create shared types/constants
   - Set up internal package publishing

## Troubleshooting

### Issue: `npm run dev:shopify` fails
**Check**:
1. Environment variables loaded correctly
2. Database connection working
3. Redis connection working
4. Prisma Client generated: `npm -w @astronote/shopify-api run prisma:generate`

### Issue: Prisma commands fail
**Check**:
1. Run from app directory: `cd apps/shopify-api && npm run prisma:generate`
2. Or use workspace command: `npm -w @astronote/shopify-api run prisma:generate`
3. Ensure `DATABASE_URL` and `DIRECT_URL` are set in `.env`

### Issue: Environment variables not loading
**Check**:
1. `loadEnv()` imported FIRST in entrypoint (`index.js`)
2. `.env` files exist (root and app-specific)
3. Check `apps/shopify-api/config/loadEnv.js` paths

## References

- [npm workspaces](https://docs.npmjs.com/cli/v9/using-npm/workspaces)
- [Prisma in monorepos](https://www.prisma.io/docs/guides/other/monorepo)

