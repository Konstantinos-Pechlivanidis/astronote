# Command Verification Guide

This guide helps verify all commands work correctly after Phase 6 setup.

## Prerequisites

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Verify Node version**:
   ```bash
   node --version  # Should be >= 18.0.0
   ```

## Command Tests

### 1. Linting

```bash
# Lint all workspaces
npm run lint

# Expected: Should run ESLint on all workspaces
# - apps/web: React + JSX linting
# - apps/shopify-api: Node.js linting
# - apps/retail-api: Node.js linting (may have no files)
```

**If errors occur:**
- Check that ESLint configs exist in each workspace
- Verify `eslint` is installed in each workspace's `node_modules`
- Run `npm install` in root to ensure dependencies are installed

### 2. Formatting

```bash
# Check formatting
npm run format

# Fix formatting issues
npm run format:write
```

**If errors occur:**
- Verify `prettier` is installed in workspaces that need it
- Check `.prettierrc` exists at root
- Check `.prettierignore` exists at root

### 3. Build

```bash
# Build all workspaces
npm run build

# Expected:
# - apps/web: Vite build (creates dist/)
# - apps/shopify-api: No build step (Node.js runtime)
# - apps/retail-api: No build step (placeholder)
```

**If errors occur:**
- Check `apps/web/package.json` has `build` script
- Verify Vite is installed
- Check for TypeScript errors (if any TS files exist)

### 4. Full Check (CI-style)

```bash
# Run all checks: lint → format → build
npm run check
```

**Expected:** Should run all checks in sequence and exit with code 0 if successful.

### 5. Development

```bash
# Run shopify-api + web together
npm run dev

# Run web only
npm run dev:web

# Run shopify-api only
npm run dev:shopify
```

**Expected:**
- `dev:web`: Starts Vite dev server (usually on port 5173)
- `dev:shopify`: Starts nodemon with Express server (usually on port 3001)

### 6. Smoke Test

```bash
# Test API health (requires API running)
npm run smoke:api

# Or with custom API URL:
API_BASE_URL=http://localhost:3001 npm run smoke:api
```

**Expected:**
- Tests `GET /health/full`
- Tests `GET /health`
- Exits with code 0 if all tests pass

## Troubleshooting

### Issue: "Command not found" or "Script not found"

**Solution:**
1. Verify script exists in `package.json`
2. Run `npm install` to ensure dependencies are installed
3. Check workspace names match (`@astronote/web`, `@astronote/shopify-api`)

### Issue: ESLint errors

**Solution:**
1. Check `.eslintrc.cjs` exists in workspace
2. Verify ESLint plugins are installed
3. Run `npm run lint:fix` to auto-fix issues
4. Check `ignorePatterns` in ESLint config

### Issue: Prettier errors

**Solution:**
1. Verify `.prettierrc` exists at root
2. Check `prettier` is in `devDependencies`
3. Run `npm run format:write` to auto-fix
4. Check `.prettierignore` excludes build artifacts

### Issue: Build fails

**Solution:**
1. Check for syntax errors in source files
2. Verify all imports are correct
3. Check Vite config (`vite.config.js`)
4. Verify path aliases (`@/*`) are configured in `jsconfig.json` and `vite.config.js`

### Issue: Workspace command fails

**Solution:**
1. Verify workspace name matches (`-w @astronote/web`)
2. Check script exists in workspace `package.json`
3. Use `--if-present` flag to handle missing scripts gracefully

## Manual Verification Steps

1. **Check ESLint configs:**
   ```bash
   ls apps/*/.eslintrc.cjs
   # Should show: apps/web/.eslintrc.cjs, apps/shopify-api/.eslintrc.cjs, apps/retail-api/.eslintrc.cjs
   ```

2. **Check Prettier config:**
   ```bash
   ls .prettierrc .prettierignore
   # Both should exist
   ```

3. **Check EditorConfig:**
   ```bash
   ls .editorconfig
   # Should exist
   ```

4. **Verify package.json scripts:**
   ```bash
   cat package.json | grep -A 15 '"scripts"'
   # Should show all root scripts
   ```

5. **Test individual workspace:**
   ```bash
   cd apps/web
   npm run lint
   npm run format
   npm run build
   ```

## Expected Output Examples

### Successful lint:
```
> @astronote/web@1.0.0 lint
> eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0

> @astronote/shopify-api@1.0.0 lint
> eslint .
```

### Successful format check:
```
> @astronote/web@1.0.0 format
> prettier --check .

Checking formatting...
All matched files use Prettier code style!
```

### Successful build:
```
> @astronote/web@1.0.0 build
> vite build

vite v5.0.8 building for production...
✓ built in 2.34s
```

## Next Steps

After verifying all commands work:

1. **Set up CI/CD** (GitHub Actions, etc.)
2. **Add pre-commit hooks** (husky + lint-staged)
3. **Test in production environment** (Render deployment)
4. **Monitor and iterate** based on feedback

## Notes

- All commands use `--if-present` flag to gracefully handle missing scripts
- Retail API is a placeholder, so some commands may echo messages
- Smoke test requires API to be running (use `npm run dev:shopify` first)

