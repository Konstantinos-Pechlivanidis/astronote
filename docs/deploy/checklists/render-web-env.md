# Render Environment Variables Checklist - Web Frontend

## Date
2025-01-23

## Service
**Name:** `astronote-web`  
**Type:** Web Service  
**URL:** `https://astronote.onrender.com`

---

## Required Environment Variables

| Variable | Example Value | Notes |
|----------|---------------|-------|
| `VITE_APP_URL` | `https://astronote.onrender.com` | Public URL of frontend |
| `VITE_RETAIL_API_BASE_URL` | `https://astronote-retail.onrender.com` | Retail API base URL |
| `VITE_SHOPIFY_API_BASE_URL` | `https://astronote-shopify.onrender.com` | Shopify API base URL |

---

## Notes

### Vite Environment Variables
- Only variables prefixed with `VITE_` are exposed to the frontend
- Variables are embedded at **build time** (not runtime)
- Changes to env vars require **rebuild**

### Build Process
- Build command: `npm ci && npm run build`
- Output: `dist/` directory
- Start command: `npm run start` (serves `dist/` with `serve`)

### No Backend Dependencies
- No database connection needed
- No Redis connection needed
- No third-party API keys needed (APIs called from browser)

---

## Verification

After setting env vars, verify:
1. Build completes successfully
2. Frontend loads at root URL
3. API calls go to correct backends (check browser DevTools Network tab)

---

## Production Values

```bash
VITE_APP_URL=https://astronote.onrender.com
VITE_RETAIL_API_BASE_URL=https://astronote-retail.onrender.com
VITE_SHOPIFY_API_BASE_URL=https://astronote-shopify.onrender.com
```

