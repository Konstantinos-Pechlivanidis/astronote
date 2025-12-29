# API Smoke Tests

## Date
2025-01-23

## Note
**BLOCKER**: Cannot execute HTTP requests in sandbox environment (network access blocked). This document outlines expected API behavior.

## Expected Health Endpoints

### Retail API
- **Base URL**: `http://localhost:3001` (default) or `VITE_RETAIL_API_BASE_URL`
- **Endpoints**:
  - `GET /healthz` → `{ status: 'ok' }` (200)
  - `GET /readiness` → `{ status: 'ready' }` (200) or 500 if DB unavailable
  - `GET /health/db` → `{ status: 'ok', database: 'connected' }` (200) or 500

### Shopify API
- **Base URL**: `http://localhost:3000` (default) or `VITE_SHOPIFY_API_BASE_URL`
- **Endpoints**:
  - `GET /health` → `{ ok: true, t: Date.now() }` (200)
  - `GET /health/full` → Comprehensive health object (200)

## Test Commands (Manual)
```bash
# Retail API
curl http://localhost:3001/healthz
curl http://localhost:3001/readiness

# Shopify API
curl http://localhost:3000/health
curl http://localhost:3000/health/full
```

## Verdict
**BLOCKER** - Cannot verify API endpoints in automated environment. Manual verification required.

