# Retail API Render Fix - Workspace Not Found

## Problem
```
npm error No workspaces found:
npm error   --workspace=@astronote/retail-api
```

## Root Cause
The `npm -w @astronote/retail-api` command is running before `npm ci` has installed workspace dependencies, OR the Root Directory is not empty.

## Solution

### Step 1: Check Root Directory
1. Go to Render Dashboard → `astronote-retail-api` → Settings
2. **Root Directory:** Must be **EMPTY** (blank/empty field)
   - ❌ NOT `apps/retail-api`
   - ❌ NOT `/`
   - ✅ **EMPTY/BLANK**

### Step 2: Verify Build & Start Commands

**Build Command:**
```bash
git submodule sync --recursive \
&& git submodule update --init --recursive \
&& npm ci \
&& npm -w @astronote/retail-api run build
```
- Syncs and initializes git submodules (retail-api is a submodule)
- Installs all workspace dependencies
- Builds retail-api (runs prisma generate)

**Start Command:**
```bash
npm -w @astronote/retail-api run start
```
- Runs after build completes
- Uses workspace flag to run command in specific workspace

### Step 3: Verify Workspace Name

The workspace name must match exactly:
- Package name in `apps/retail-api/package.json`: `"name": "@astronote/retail-api"`
- Workspace in root `package.json`: `"workspaces": ["apps/*"]`

### Step 4: Alternative (if still failing)

If workspace commands still fail, use direct path:

**Start Command:**
```bash
cd apps/retail-api && npm run start
```

But this requires `npm ci` to have run at root first.

---

## Verification

After fixing, the build logs should show:
```
✓ npm ci (installs all dependencies including workspaces)
✓ npm -w @astronote/retail-api run start (starts the service)
```

NOT:
```
✗ npm error No workspaces found
```

---

## Common Mistakes

1. **Root Directory set to `apps/retail-api`**
   - Fix: Clear it (make it empty)

2. **Build Command includes workspace flag**
   - Wrong: `npm ci -w @astronote/retail-api`
   - Correct: `npm ci` (no workspace flag)

3. **Start Command missing workspace flag**
   - Wrong: `npm run start`
   - Correct: `npm -w @astronote/retail-api run start`

