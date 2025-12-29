# Build Verification Guide

This document explains how to verify that both frontend and backend build commands work correctly.

## Build Commands

### Frontend (`apps/web`)
- **Build Command**: `npm run build`
- **What it does**: Runs Vite build to create production-ready static files in `apps/web/dist/`
- **Output**: `apps/web/dist/` directory with optimized HTML, CSS, and JavaScript

### Backend (`apps/shopify-api`)
- **Build Command**: `npm run build`
- **What it does**: Generates Prisma client (`prisma generate`)
- **Why**: The backend is a Node.js JavaScript application that doesn't need compilation, but Prisma client must be generated before running
- **Output**: Generated Prisma client in `node_modules/.prisma/client/`

## Verification Methods

### Method 1: Run Individual Builds

```bash
# Frontend build
cd apps/web
npm run build

# Backend build (Prisma generation)
cd apps/shopify-api
npm run build
```

### Method 2: Run Root Build (All Workspaces)

```bash
# From repo root
npm run build
```

This will run `build` for all workspaces that have a `build` script (using `--if-present`).

### Method 3: Use Verification Script

```bash
# From repo root
node scripts/verify-builds.js
```

This script will:
1. Build the frontend (Vite)
2. Generate Prisma client for backend
3. Report success/failure for each

## Expected Results

### Frontend Build Success
- Creates `apps/web/dist/` directory
- Contains `index.html`, `assets/` folder with JS/CSS bundles
- No build errors in console

### Backend Build Success
- Prisma client generated successfully
- No errors in console
- `node_modules/.prisma/client/` contains generated files

## Common Issues

### Frontend Build Issues
- **Missing dependencies**: Run `npm install` in `apps/web`
- **Vite config errors**: Check `apps/web/vite.config.js`
- **Import errors**: Verify all imports are correct and dependencies installed

### Backend Build Issues
- **Prisma schema errors**: Run `npx prisma validate` in `apps/shopify-api`
- **Missing Prisma**: Ensure `prisma` is in `devDependencies`
- **Database connection**: Build doesn't require DB connection, but migrations do

## CI/CD Integration

For Render deployment:

**Frontend:**
- Build: `npm ci && npm --workspace apps/web run build`
- Start: `npx serve -s apps/web/dist -l $PORT`

**Backend:**
- Build: `npm ci && npm --workspace apps/shopify-api run prisma:generate && npm --workspace apps/shopify-api run prisma:migrate:deploy`
- Start: `npm --workspace apps/shopify-api run start`

## Notes

- The backend doesn't need TypeScript compilation (it's plain JavaScript)
- Prisma client generation is the only "build" step needed for backend
- Frontend build is required for production deployment
- Both builds should complete without errors before deployment

