# Shopify Gate Run Guide

## Overview

The Shopify Gate (`npm run shopify:gate`) runs all checks for the Shopify stack (frontend + backend) in a deterministic order:

**Frontend (apps/astronote-web):**
- `lint` → `typecheck` → `tests` → `build`

**Backend (apps/shopify-api):**
- `lint` → `typecheck` (Prisma validate) → `tests` → `build`

## Usage

From the repository root:

```bash
npm run shopify:gate
```

The script will:
1. Run all frontend checks in order
2. Run all backend checks in order
3. Report a summary of PASS/FAIL for each check
4. Exit with code 0 if all checks pass, 1 if any check fails

## What Gets Checked

### Frontend Checks
- **lint**: ESLint validation (`next lint`)
- **typecheck**: TypeScript type checking (`tsc` or Next.js typecheck)
- **tests**: Unit/component tests (if present)
- **build**: Next.js production build (`next build`)

### Backend Checks
- **lint**: ESLint validation
- **typecheck**: Prisma schema validation (`prisma validate`)
- **tests**: Jest unit/integration tests
- **build**: Prisma client generation (`prisma generate`)

## Output

The script provides:
- Real-time output for each check
- Summary table showing PASS/FAIL for each check
- Exit code: 0 (all passed) or 1 (some failed)

## Integration

The Shopify Gate is separate from the full `release:gate` which includes:
- All audit scripts (tenant safety, Prisma alignment, UI parity, etc.)
- All builds (Shopify + Retail frontend + Retail backend)

Use `shopify:gate` for quick Shopify-specific validation during development.

Use `release:gate` for full release verification before deployment.

