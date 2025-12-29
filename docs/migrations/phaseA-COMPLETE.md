# Phase A: Flatten Retail Monorepo - COMPLETE STATUS

## ✅ COMPLETED (100% of Code Changes)

### 1. Package Renames ✓
- ✅ `apps/retail-api/apps/web/package.json`: `name` → `"@astronote/retail-web-legacy"`
- ✅ `apps/retail-api/package.json`: `name` → `"@astronote/retail-api"`
- ✅ `apps/retail-api/apps/worker/package.json`: `name` → `"@astronote/retail-worker"`

### 2. Package.json Scripts Updated ✓
- ✅ `apps/retail-api/package.json`: All scripts updated to use `DOTENV_CONFIG_PATH=../.env`
- ✅ `apps/retail-api/apps/worker/package.json`: All scripts updated to use `DOTENV_CONFIG_PATH=../.env`

### 3. Path Updates ✓ (30+ references across 9 files)
- ✅ **Server.js** (`apps/retail-api/apps/api/src/server.js`):
  - 7 worker paths: `../../worker/src/...` → `../../retail-worker/src/...`
  - apiPath: `path.resolve(__dirname, '..')` → `path.resolve(__dirname, '../..')`
  
- ✅ **All 8 Worker Files**:
  - `sms.worker.js`: 9 occurrences updated
  - `birthday.worker.js`: 2 occurrences updated
  - `contactImport.worker.js`: 2 occurrences updated
  - `scheduler.worker.js`: 3 occurrences updated
  - `statusRefresh.worker.js`: 2 occurrences updated
  - `deliveryStatusPoller.worker.js`: 3 occurrences updated
  - `piiRetention.worker.js`: 2 occurrences updated
  - `watchdog.worker.js`: 3 occurrences updated
  - All: `require('../../api/src/...')` → `require('../../retail-api/src/...')`

### 4. Move Scripts Created ✓
- ✅ `scripts/do-flatten-moves.js` - Node.js script (ready to execute)
- ✅ `scripts/do-flatten-moves.py` - Python alternative

## ⚠️ REQUIRES MANUAL EXECUTION (File System Operations)

Due to terminal limitations, the following must be executed manually:

### Step 1: Execute File Moves
```bash
# From repo root:
node scripts/do-flatten-moves.js
```

**OR manually:**
```bash
mv apps/retail-api/apps/api/src apps/retail-api/src
for f in apps/retail-api/apps/api/scripts/*; do [ -f "$f" ] && mv "$f" apps/retail-api/scripts/ 2>/dev/null || true; done
rmdir apps/retail-api/apps/api/scripts 2>/dev/null || true
mv apps/retail-api/apps/worker apps/retail-worker
mv apps/retail-api/apps/web apps/retail-web-legacy
rmdir apps/retail-api/apps/api 2>/dev/null || true
rmdir apps/retail-api/apps 2>/dev/null || true
```

### Step 2: Cleanup
```bash
rm -rf apps/retail-api/node_modules
rm -f apps/retail-api/package-lock.json
rm -rf apps/retail-api/apps/*/node_modules 2>/dev/null || true
rm -rf apps/retail-web-legacy/node_modules
```

### Step 3: Root Install
```bash
npm ci
```

### Step 4: Verification
```bash
npm -w apps/retail-api run dev        # Port 3001
npm -w apps/retail-worker run dev     # Worker
npm -w apps/shopify-api run dev       # Port 3000
npm -w apps/web run dev               # Port 5173
```

## 📊 Final Status

| Task | Status | Notes |
|------|--------|-------|
| Package Renames | ✅ Complete | All 3 packages renamed |
| Script Updates | ✅ Complete | All env paths fixed |
| Path Updates | ✅ Complete | 30+ references updated |
| File Moves | ⚠️ Manual Required | Script ready: `scripts/do-flatten-moves.js` |
| Cleanup | ⏳ Pending | After moves |
| Verification | ⏳ Pending | After moves + cleanup |

## 🎯 Next Action

**Execute the file moves script:**
```bash
node scripts/do-flatten-moves.js
```

Then proceed with cleanup, install, and verification.

**All code is ready - once file moves complete, everything should work immediately.**

