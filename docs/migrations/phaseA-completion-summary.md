# Phase A: Flatten Retail Monorepo - Completion Summary

## ✅ All Path Updates Completed

All source code path references have been updated to work with the new flattened structure. The code is ready once the file moves are performed.

### Path Updates Applied

#### Server.js (`apps/retail-api/apps/api/src/server.js`)
- ✅ Worker paths: `../../worker/src/...` → `../../retail-worker/src/...` (7 workers)
- ✅ apiPath: `path.resolve(__dirname, '..')` → `path.resolve(__dirname, '../..')`
- ✅ Comment updated: "apps/api directory" → "apps/retail-api directory (after move)"

#### Worker Files (8 files total)
All `require('../../api/src/...')` → `require('../../retail-api/src/...')`:

1. ✅ `sms.worker.js` - 9 occurrences updated
2. ✅ `birthday.worker.js` - 2 occurrences updated
3. ✅ `contactImport.worker.js` - 2 occurrences updated
4. ✅ `scheduler.worker.js` - 3 occurrences updated
5. ✅ `statusRefresh.worker.js` - 2 occurrences updated
6. ✅ `deliveryStatusPoller.worker.js` - 3 occurrences updated
7. ✅ `piiRetention.worker.js` - 2 occurrences updated
8. ✅ `watchdog.worker.js` - 3 occurrences updated

### Package.json Updates

1. ✅ `apps/retail-api/package.json`:
   - Name: `"@astronote/retail-api"`
   - Scripts: All updated to use `DOTENV_CONFIG_PATH=../.env`
   - Dependencies: Complete

2. ✅ `apps/retail-api/apps/worker/package.json`:
   - Name: `"@astronote/retail-worker"`
   - Scripts: All updated to use `DOTENV_CONFIG_PATH=../.env`

3. ✅ `apps/retail-api/apps/web/package.json`:
   - Name: `"@astronote/retail-web-legacy"`

## ⚠️ File Moves Required

**CRITICAL**: The following file moves must be performed before the code will work:

```bash
# From repo root, run:
node scripts/do-flatten-moves.js

# OR manually:
mv apps/retail-api/apps/api/src apps/retail-api/src
# Merge scripts (if needed):
for f in apps/retail-api/apps/api/scripts/*; do [ -f "$f" ] && mv "$f" apps/retail-api/scripts/ 2>/dev/null || true; done
rmdir apps/retail-api/apps/api/scripts 2>/dev/null || true
mv apps/retail-api/apps/worker apps/retail-worker
mv apps/retail-api/apps/web apps/retail-web-legacy
rmdir apps/retail-api/apps/api 2>/dev/null || true
rmdir apps/retail-api/apps 2>/dev/null || true
```

## 🧹 Cleanup Required (After Moves)

```bash
# Delete nested install artifacts:
rm -rf apps/retail-api/node_modules/
rm -f apps/retail-api/package-lock.json
rm -rf apps/retail-api/apps/*/node_modules/  # After moves complete
rm -rf apps/retail-web-legacy/node_modules/  # After move complete
rm -rf apps/retail-worker/node_modules/  # If exists
```

## ✅ Workspace Configuration

Root `package.json` already uses `"workspaces": ["apps/*"]` which will automatically pick up:
- `apps/retail-api`
- `apps/retail-worker`
- `apps/retail-web-legacy`
- `apps/shopify-api`
- `apps/web`
- `apps/astronote-shopify-extension`

No changes needed to root workspace config.

## 🧪 Verification Steps

After moves and cleanup:

```bash
# 1. Clean install
npm ci

# 2. Verify each service
npm -w apps/retail-api run dev        # Should start on port 3001
npm -w apps/retail-worker run dev     # Should start worker
npm -w apps/shopify-api run dev       # Should start on port 3000
npm -w apps/web run dev               # Should start on port 5173
```

## 📊 Summary

- **Path Updates**: ✅ 100% Complete (all files updated)
- **Package.json Updates**: ✅ 100% Complete
- **File Moves**: ⚠️ Pending (script ready: `scripts/do-flatten-moves.js`)
- **Cleanup**: ⚠️ Pending (after moves)
- **Verification**: ⚠️ Pending (after moves + cleanup)

## 🎯 Next Action

**Run the file moves script:**
```bash
node scripts/do-flatten-moves.js
```

Then proceed with cleanup and verification.

