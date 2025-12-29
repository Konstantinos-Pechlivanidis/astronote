# Web Frontend Service (apps/web)

## Date
2025-01-23

## Overview
Production deployment configuration for the unified frontend service on Render.

---

## Service Configuration

**Render Service Type:** Web Service  
**Repository:** Monorepo root  
**Root Directory:** `apps/web`  
**Build Command:** `npm ci && npm run build`  
**Start Command:** `npm run start`

---

## Build Process

### Build Command
```bash
npm ci && npm run build
```

**What it does:**
1. Installs dependencies from root `package-lock.json`
2. Runs `vite build` which:
   - Compiles React app
   - Bundles assets
   - Outputs to `dist/` directory
   - Only exposes `VITE_*` environment variables

### Build Output
- **Directory:** `dist/`
- **Contents:**
  - `index.html` - Entry point
  - `assets/` - JS, CSS, images
  - Static files

---

## Start Command

### Production Start
```bash
npm run start
```

**What it does:**
- Runs `serve -s dist -l $PORT`
- `-s` flag: Single-page app mode (serves `index.html` for all routes)
- `-l $PORT`: Listens on Render-provided PORT
- Serves static files from `dist/` directory

### Alternative: Vite Preview
```bash
npm run preview
```
- Uses `vite preview --host 0.0.0.0 --port $PORT`
- Alternative option (not recommended for production)

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_APP_URL` | Public URL of frontend | `https://astronote.onrender.com` |
| `VITE_RETAIL_API_BASE_URL` | Retail API base URL | `https://astronote-retail.onrender.com` |
| `VITE_SHOPIFY_API_BASE_URL` | Shopify API base URL | `https://astronote-shopify.onrender.com` |

### Notes
- Only `VITE_*` prefixed variables are exposed to the frontend
- Variables are embedded at build time (not runtime)
- Changes to env vars require rebuild

---

## Render Configuration

### Service Settings

**Name:** `astronote-web`  
**Environment:** `Node`  
**Region:** Choose closest to users  
**Branch:** `main` (or your production branch)  
**Root Directory:** `apps/web`

### Build & Deploy

**Build Command:**
```bash
npm ci && npm run build
```

**Start Command:**
```bash
npm run start
```

**Auto-Deploy:** Yes (on push to main branch)

### Environment Variables

Set in Render dashboard:
```
VITE_APP_URL=https://astronote.onrender.com
VITE_RETAIL_API_BASE_URL=https://astronote-retail.onrender.com
VITE_SHOPIFY_API_BASE_URL=https://astronote-shopify.onrender.com
```

---

## Health Check

**Health Check Path:** `/`  
**Expected Response:** HTML page (200 OK)

**Note:** Frontend doesn't have a dedicated health endpoint. The root path serves the React app.

---

## Routing

The frontend uses client-side routing (`react-router-dom`). All routes are handled by the React app:

- `/` - Marketing landing page
- `/retail/*` - Retail app area
- `/shopify/*` - Shopify app area

The `serve -s` flag ensures all routes serve `index.html`, allowing React Router to handle routing.

---

## Verification

After deployment, verify:

1. **Root URL loads:**
   ```bash
   curl https://astronote.onrender.com
   # Should return HTML
   ```

2. **API calls work:**
   - Open browser DevTools
   - Navigate to `/retail/login` or `/shopify/login`
   - Check Network tab for API calls to correct backends

3. **Routes work:**
   - Navigate to `/` - Should show marketing page
   - Navigate to `/retail/dashboard` - Should show retail dashboard (after login)
   - Navigate to `/shopify/dashboard` - Should show shopify dashboard (after login)

---

## Troubleshooting

### Build Fails

**Issue:** Build command fails  
**Check:**
- Node version (should be >=18.0.0)
- npm version (should be >=8.0.0)
- Dependencies installed correctly

### Start Fails

**Issue:** Start command fails  
**Check:**
- `dist/` directory exists (build completed)
- `PORT` environment variable is set (Render sets this automatically)
- `serve` package is installed (already in dependencies)

### Routes Return 404

**Issue:** Direct URL access returns 404  
**Fix:** Ensure `serve -s` flag is used (single-page app mode)

### API Calls Fail

**Issue:** Frontend can't reach APIs  
**Check:**
- `VITE_RETAIL_API_BASE_URL` and `VITE_SHOPIFY_API_BASE_URL` are set correctly
- CORS is configured on backend APIs
- Backend APIs are running and accessible

---

## Summary

- ✅ Build: `npm ci && npm run build` (outputs to `dist/`)
- ✅ Start: `npm run start` (serves `dist/` with `serve`)
- ✅ Health: Root path serves React app
- ✅ Routing: Client-side routing with `serve -s` flag
- ✅ Env: Only `VITE_*` variables exposed

