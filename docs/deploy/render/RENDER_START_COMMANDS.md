# Render Start Commands - Universal Solution

## Problem
The `npm -w @astronote/<workspace>` command fails when:
- Root Directory is not empty (set to `apps/retail-api`, etc.)
- `npm ci` hasn't run at root
- Workspace dependencies not installed

## Solution: Use Wrapper Scripts

We've created wrapper scripts that work in **both scenarios**:
1. Root Directory = empty (monorepo root)
2. Root Directory = `apps/<service>` (subdirectory)

---

## Updated Render Settings

### Retail API

**Root Directory:** (empty - recommended) OR `apps/retail-api`

**Build Command:**
```bash
npm ci
```
- If Root Directory is empty: runs at root, installs all workspaces
- If Root Directory is `apps/retail-api`: runs in subdirectory (may need adjustment)

**Start Command:**
```bash
bash scripts/start-retail-api.sh
```
- Automatically detects location and runs correct command

---

### Shopify API

**Root Directory:** (empty - recommended) OR `apps/shopify-api`

**Build Command:**
```bash
npm ci && npm -w @astronote/shopify-api run build
```
- If Root Directory is empty: works correctly
- If Root Directory is `apps/shopify-api`: use `npm ci && npm run build`

**Start Command:**
```bash
bash scripts/start-shopify-api.sh
```
- Automatically detects location and runs correct command

---

### Web Frontend

**Root Directory:** (empty - recommended) OR `apps/web`

**Build Command:**
```bash
npm ci && npm -w @astronote/web run build
```
- If Root Directory is empty: works correctly
- If Root Directory is `apps/web`: use `npm ci && npm run build`

**Start Command:**
```bash
bash scripts/start-web.sh
```
- Automatically detects location and runs correct command

---

## Alternative: Direct Path (if scripts don't work)

If the wrapper scripts don't work, use direct path:

### Retail API
**Root Directory:** (empty)
**Start Command:**
```bash
cd apps/retail-api && npm run start
```

### Shopify API
**Root Directory:** (empty)
**Start Command:**
```bash
cd apps/shopify-api && npm run start
```

### Web Frontend
**Root Directory:** (empty)
**Start Command:**
```bash
cd apps/web && npm run start
```

---

## Recommended Setup (Best Practice)

**For all services:**
- **Root Directory:** (empty - leave blank)
- **Build Command:** `npm ci` (or `npm ci && npm -w @astronote/<service> run build` for services that need build)
- **Start Command:** `bash scripts/start-<service>.sh` (or direct path if scripts fail)

This ensures:
- ✅ `npm ci` runs at root, installing all workspace dependencies
- ✅ Start script automatically detects location
- ✅ Works regardless of Root Directory setting

---

## Verification

After deployment, check logs:
- ✅ `npm ci` completes successfully
- ✅ Start script detects location correctly
- ✅ Service starts without workspace errors

