# Phase A Flatten - Status Report

## ✅ Completed

### 1. Package Renames ✓
- `apps/retail-api/apps/web/package.json`: `name` → `"@astronote/retail-web-legacy"`
- `apps/retail-api/package.json`: `name` → `"@astronote/retail-api"`
- `apps/retail-api/apps/worker/package.json`: `name` → `"@astronote/retail-worker"`

### 2. Package.json Scripts Updated ✓
- `apps/retail-api/package.json`: All scripts updated to run directly with `DOTENV_CONFIG_PATH=../.env`
- `apps/retail-api/apps/worker/package.json`: Env paths updated to `../.env`

### 3. Path Updates Completed ✓
All path references updated in source files:

**Server.js (`apps/retail-api/apps/api/src/server.js`):**
- Worker paths: `../../worker/src/...` → `../../retail-worker/src/...` (7 occurrences)
- apiPath: Updated to point to `apps/retail-api` directory

**Worker Files (all 8 workers):**
- `../../api/src/...` → `../../retail-api/src/...` (all occurrences)
- Files updated:
  - `sms.worker.js`
  - `birthday.worker.js`
  - `contactImport.worker.js`
  - `scheduler.worker.js`
  - `statusRefresh.worker.js`
  - `deliveryStatusPoller.worker.js`
  - `piiRetention.worker.js`
  - `watchdog.worker.js`

## ⚠️ Pending (Requires File System Moves)

### File Moves Required
Due to terminal limitations, these moves need to be performed:

**Option 1: Run the Node.js script**
```bash
node scripts/do-flatten-moves.js
```

**Option 2: Manual moves**
```bash
# From repo root:
mv apps/retail-api/apps/api/src apps/retail-api/src
mv apps/retail-api/apps/api/scripts/* apps/retail-api/scripts/  # Merge
rmdir apps/retail-api/apps/api/scripts
mv apps/retail-api/apps/worker apps/retail-worker
mv apps/retail-api/apps/web apps/retail-web-legacy
rmdir apps/retail-api/apps/api
rmdir apps/retail-api/apps
```

### Cleanup Required (After Moves)
```bash
# Delete nested install artifacts:
rm -rf apps/retail-api/node_modules/
rm -f apps/retail-api/package-lock.json
rm -rf apps/retail-api/apps/*/node_modules/  # After moves
rm -rf apps/retail-web-legacy/node_modules/  # After move
```

### Root Workspace Config
Root `package.json` already uses `"workspaces": ["apps/*"]` which will automatically pick up the new structure.

Optional: Add explicit entries for clarity (not required).

## 📝 Next Steps

1. **Run file moves** (script or manual)
2. **Clean up nested installs**
3. **Run `npm ci` from root**
4. **Verify services start:**
   - `npm -w apps/retail-api run dev`
   - `npm -w apps/retail-worker run dev`
   - `npm -w apps/shopify-api run dev`
   - `npm -w apps/web run dev`

## 📄 Files Created

- `scripts/do-flatten-moves.js` - Node.js script to perform moves
- `scripts/do-flatten-moves.py` - Python alternative
- `docs/migrations/phaseA-flatten-retail.md` - Full migration documentation

