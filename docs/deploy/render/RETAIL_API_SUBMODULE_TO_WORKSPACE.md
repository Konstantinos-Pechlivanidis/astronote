# Convert Retail API from Git Submodule to Normal Workspace

## Current State

- `apps/retail-api` is a **git submodule** (mode 160000)
- This causes issues in Render deployment (submodule sync failures)
- Need to convert it to a normal workspace directory like `shopify-api`

## Solution: Vendor Retail API

### Step 1: Remove Submodule

```bash
# From monorepo root
cd /Users/konstantinos/Documents/GitHub/astronote-shopify-backend

# Deinitialize submodule
git submodule deinit -f apps/retail-api

# Remove from git index
git rm -f apps/retail-api

# Remove submodule metadata (if exists)
rm -rf .git/modules/apps/retail-api

# Remove from .gitmodules (if exists)
# If .gitmodules exists, edit it to remove retail-api entry
```

### Step 2: Clone Retail API Repository

```bash
# Clone to temporary location
cd /tmp
rm -rf retail-api-temp
git clone https://github.com/Konstantinos-Pechlivanidis/astronote-retail-backend.git retail-api-temp

# Remove .git folder (make it a normal directory)
cd retail-api-temp
rm -rf .git

# Verify package.json exists and has correct name
cat package.json | grep '"name"'
# Should show: "name": "@astronote/retail-api"
```

### Step 3: Move to Monorepo

```bash
# From monorepo root
cd /Users/konstantinos/Documents/GitHub/astronote-shopify-backend

# Remove old submodule directory (if still exists)
rm -rf apps/retail-api

# Move cloned directory
mv /tmp/retail-api-temp apps/retail-api

# Verify structure
ls -la apps/retail-api
cat apps/retail-api/package.json | grep '"name"'
```

### Step 4: Add to Git

```bash
# Add retail-api as normal directory
git add apps/retail-api

# Commit
git commit -m "Convert retail-api from git submodule to normal workspace directory

- Remove retail-api git submodule
- Vendor retail-api as normal directory under apps/retail-api
- This eliminates submodule issues in Render deployment
- retail-api is now a regular npm workspace like shopify-api"
```

### Step 5: Verify

```bash
# Check npm workspaces
npm -ws --json | grep -A 3 "retail-api"

# Should show retail-api in workspaces

# Test build
npm ci
npm -w @astronote/retail-api run build
```

---

## Final Render Commands (After Conversion)

### Retail API Service

**Root Directory:** (EMPTY - leave blank)

**Build Command:**
```bash
npm ci && npm -w @astronote/retail-api run build
```

**Start Command:**
```bash
npm -w @astronote/retail-api run start
```

**Note:** Same as shopify-api - no git submodule commands needed!

---

## Benefits

1. ✅ No submodule sync issues in Render
2. ✅ Consistent with shopify-api implementation
3. ✅ Simpler deployment (no special git commands)
4. ✅ npm workspaces detect retail-api automatically

---

## Important Notes

- After conversion, `apps/retail-api` will be a normal directory (not a submodule)
- All files will be committed directly to the monorepo
- Future updates to retail-api code should be made directly in `apps/retail-api`
- If you need to sync with the original retail-api repo, you'll need to manually copy changes

