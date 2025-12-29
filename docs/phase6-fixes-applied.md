# Phase 6: Fixes Applied

## Issues Fixed

### 1. Missing Prettier Dependency

**Problem:** `apps/web` was missing `prettier` in `devDependencies`, causing `npm run format` to fail.

**Fix:** Added `prettier: "^3.1.0"` to `apps/web/package.json` devDependencies.

### 2. Missing ESLint and Prettier in Retail API

**Problem:** `apps/retail-api` (placeholder) didn't have ESLint/Prettier as devDependencies, causing scripts to fail.

**Fix:** Added `eslint` and `prettier` to `apps/retail-api/package.json` devDependencies.

### 3. Missing Serve Package

**Problem:** `apps/web` needed `serve` package for Render deployment.

**Fix:** Added `serve: "^14.2.1"` to `apps/web/package.json` dependencies.

## Files Modified

1. `apps/web/package.json` - Added prettier and serve
2. `apps/retail-api/package.json` - Added eslint and prettier
3. `package.json` - Added axios for smoke test script

## Verification

All configurations are now in place:

✅ ESLint configs exist in all workspaces
✅ Prettier config exists at root
✅ All workspaces have required devDependencies
✅ Path aliases configured in Vite (`@/*` → `src/*`)
✅ Smoke test script uses axios from root

## Commands to Run

After running `npm install` to install new dependencies:

```bash
# 1. Install dependencies (if not done)
npm install

# 2. Test linting
npm run lint

# 3. Test formatting
npm run format

# 4. Test build
npm run build

# 5. Full CI check
npm run check

# 6. Development (run separately)
npm run dev:web        # In one terminal
npm run dev:shopify    # In another terminal

# 7. Smoke test (requires API running)
npm run smoke:api
```

## Expected Behavior

### npm run lint
- Runs ESLint on all workspaces
- `apps/web`: React + JSX linting
- `apps/shopify-api`: Node.js linting
- `apps/retail-api`: Node.js linting (may have no files, uses `|| echo` fallback)

### npm run format
- Checks Prettier formatting in all workspaces
- Uses root `.prettierrc` config
- Respects `.prettierignore` patterns

### npm run build
- Builds `apps/web` (Vite build → `dist/`)
- Skips `apps/shopify-api` (no build step, Node.js runtime)
- Skips `apps/retail-api` (placeholder, echoes message)

### npm run check
- Runs: `lint` → `format` → `build`
- Exits with code 0 if all pass
- Exits with code 1 if any fail

## Notes

- All root scripts use `--if-present` flag for graceful handling
- Retail API is a placeholder, so some commands echo messages
- Smoke test requires API to be running (`npm run dev:shopify`)
- Path aliases (`@/*`) are configured in both `jsconfig.json` and `vite.config.js`

## Next Steps

1. Run `npm install` to install new dependencies
2. Test each command individually
3. Verify all commands work as expected
4. Set up CI/CD pipeline using these commands

