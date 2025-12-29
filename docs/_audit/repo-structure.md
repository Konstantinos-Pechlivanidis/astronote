# Repository Structure Analysis

## Overview

This monorepo contains multiple applications and services for the Astronote SMS marketing platform. The structure includes a root-level monorepo with npm workspaces, and a nested monorepo within `apps/retail-api`.

## High-Level Structure

```
astronote-shopify-backend/
├── apps/
│   ├── astronote-shopify-extension/  # Shopify Extension App (Remix/TypeScript)
│   ├── retail-api/                    # Retail Backend (NESTED MONOREPO)
│   │   └── apps/
│   │       ├── api/                   # Retail API server
│   │       ├── web/                   # Retail frontend (React)
│   │       └── worker/                # Retail workers
│   ├── shopify-api/                   # Shopify Backend (Express/Prisma)
│   └── web/                           # Unified Web Frontend (React/Vite)
├── packages/
│   └── shared/                        # Shared packages (placeholder)
├── docs/                              # Documentation
└── scripts/                           # Root-level scripts
```

## Package Manager & Workspace Setup

### Root Level
- **Package Manager**: npm
- **Workspace Config**: `package.json` defines workspaces: `["apps/*", "packages/*"]`
- **Lock File**: `package-lock.json` (root level)
- **Workspace Type**: npm workspaces

### Nested Workspace (apps/retail-api)
- **Package Manager**: npm
- **Workspace Config**: `apps/retail-api/package.json` defines workspaces: `["apps/*"]`
- **Lock File**: `apps/retail-api/package-lock.json`
- **Workspace Type**: npm workspaces (nested)
- **Issue**: This creates a nested monorepo structure, which can cause dependency resolution issues

## Application Descriptions

### 1. `apps/shopify-api`
- **Type**: Node.js/Express backend API
- **Purpose**: Shopify SMS marketing extension backend
- **Tech Stack**: Express, Prisma, BullMQ, Redis
- **Database**: PostgreSQL (Neon)
- **Entry Point**: `index.js`
- **Port**: `process.env.PORT || 8080`
- **Status**: Production-ready, fully implemented

### 2. `apps/retail-api` (Nested Monorepo)
- **Type**: Nested monorepo containing 3 sub-apps
- **Purpose**: Retail SMS marketing platform backend
- **Tech Stack**: Express, Prisma, BullMQ, Redis
- **Database**: PostgreSQL (shared Prisma schema at `apps/retail-api/prisma/`)
- **Status**: Production-ready, fully implemented

#### 2.1 `apps/retail-api/apps/api`
- **Type**: Node.js/Express backend API
- **Entry Point**: `src/server.js`
- **Port**: `process.env.PORT || 3001` (from env config)
- **Purpose**: Main retail API server

#### 2.2 `apps/retail-api/apps/web`
- **Type**: React frontend (Vite)
- **Entry Point**: `src/main.jsx`
- **Port**: `5173` (Vite dev server)
- **Purpose**: Retail frontend dashboard

#### 2.3 `apps/retail-api/apps/worker`
- **Type**: BullMQ workers
- **Entry Points**: Multiple worker files in `src/`
- **Purpose**: Background job processing (SMS, scheduler, contact import, etc.)

### 3. `apps/web`
- **Type**: React frontend (Vite)
- **Purpose**: Unified web frontend (currently Shopify-focused)
- **Tech Stack**: React, Vite, TailwindCSS, shadcn/ui
- **Entry Point**: `src/main.jsx`
- **Port**: `5173` (Vite dev server)
- **Status**: Partially implemented (Shopify pages only)

### 4. `apps/astronote-shopify-extension`
- **Type**: Shopify Extension App (Remix)
- **Purpose**: Shopify admin extension
- **Tech Stack**: Remix, TypeScript, Shopify Polaris
- **Entry Points**: `app/entry.client.tsx`, `app/entry.server.tsx`
- **Status**: Active Shopify extension

## Duplicated Dependencies

### node_modules Occurrences
1. **Root**: `/node_modules/` - Shared dependencies for root workspace
2. **apps/shopify-api**: `/apps/shopify-api/node_modules/` - App-specific dependencies
3. **apps/retail-api**: `/apps/retail-api/node_modules/` - Retail monorepo root dependencies
4. **apps/retail-api/apps/api**: `/apps/retail-api/apps/api/node_modules/` - API-specific dependencies
5. **apps/retail-api/apps/web**: `/apps/retail-api/apps/web/node_modules/` - Web-specific dependencies
6. **apps/web**: `/apps/web/node_modules/` - Web app dependencies
7. **apps/astronote-shopify-extension**: `/apps/astronote-shopify-extension/node_modules/` - Extension dependencies

### package-lock.json Occurrences
1. **Root**: `/package-lock.json`
2. **apps/shopify-api**: `/apps/shopify-api/package-lock.json`
3. **apps/retail-api**: `/apps/retail-api/package-lock.json`
4. **apps/astronote-shopify-extension**: `/apps/astronote-shopify-extension/package-lock.json`
5. **apps/astronote-shopify-extension/checkout-sms-opt-in.disabled**: `/apps/astronote-shopify-extension/checkout-sms-opt-in.disabled/package-lock.json`

## Key Findings

### ✅ Strengths
- Clear separation of concerns (shopify-api, retail-api, web)
- Root-level workspace configuration is correct
- Each app has its own package.json with appropriate scripts

### ⚠️ Issues
1. **Nested Monorepo**: `apps/retail-api` contains its own workspace configuration, creating a nested monorepo structure
2. **Duplicate node_modules**: Multiple `node_modules/` directories increase disk usage and potential version conflicts
3. **Duplicate package-lock.json**: Multiple lock files can lead to dependency resolution inconsistencies
4. **Inconsistent Structure**: `retail-api` uses nested `apps/` structure while other apps are flat

## Recommendations

### P0 (Must Fix)
1. **Flatten retail-api structure**: Move `apps/retail-api/apps/*` to root `apps/` level
   - `apps/retail-api/apps/api` → `apps/retail-api` (or `apps/retail-api-server`)
   - `apps/retail-api/apps/web` → `apps/retail-web` (or merge with `apps/web`)
   - `apps/retail-api/apps/worker` → `apps/retail-worker`
2. **Remove nested workspace config**: Delete `apps/retail-api/package.json` workspaces field
3. **Consolidate Prisma schema**: Move `apps/retail-api/prisma/` to appropriate location or keep at `apps/retail-api/prisma/` if retail-api becomes a single app

### P1 (Should Fix)
1. **Consolidate node_modules**: Use npm workspaces hoisting to reduce duplicate dependencies
2. **Standardize package-lock.json**: Consider using a single lock file at root (if compatible with npm workspaces)

### P2 (Nice to Have)
1. **Unify frontend apps**: Consider merging `apps/web` and `apps/retail-api/apps/web` into a single unified frontend
2. **Shared packages**: Populate `packages/shared/` with common utilities, types, and schemas

