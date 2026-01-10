# Shopify Auth Redirect Loop Fix Report

Date: 2025-02-14

## Final Flow (fixed)

1) `/app/shopify/auth/login` prompts for shop domain (or reads it from query param) and starts OAuth:
   - `GET {SHOPIFY_API_BASE_URL}/auth/shopify?shop=<shop>.myshopify.com`
2) Shopify redirects to backend:
   - `GET /auth/callback?code=...&shop=...&hmac=...`
3) Backend exchanges code, persists store, generates app JWT, redirects to frontend:
   - `302 {WEB_APP_URL}/shopify/auth/callback?token=<jwt>&shop=<shop>.myshopify.com`
4) Frontend shim (`/shopify/auth/callback`) preserves all query params and forwards to handler:
   - `/app/shopify/auth/callback?token=...&shop=...`
5) Callback handler:
   - Stores `shopify_token`
   - Decodes JWT payload (base64url-safe) to persist `shopDomain`
   - Falls back to `shop`/`shop_domain` query params if needed
   - Redirects to `/app/shopify/dashboard`
6) Shopify layout verifies token via `/auth/verify` **with Authorization header** (no redirect loop)

## Changes Applied

### Backend (apps/shopify-api)
- `apps/shopify-api/routes/auth.js`
  - Redirect now includes `shop` query param for frontend fallback.
  - Error redirect corrected to `/app/shopify/auth/login`.

### Frontend (apps/astronote-web)
- `apps/astronote-web/src/lib/shopify/api/axios.ts`
  - `/auth/verify` and `/auth/refresh` are treated as protected (Authorization attached).
  - Shop domain is optional for verify/refresh to avoid blocking auth validation.
- `apps/astronote-web/src/lib/shopify/api/shop-domain.ts`
  - JWT payload decode updated for base64url tokens.
- `apps/astronote-web/app/app/shopify/auth/callback/page.tsx`
  - Base64url-safe token decode and `shop_domain` query param fallback.
- `apps/astronote-web/app/shopify/auth/callback/page.tsx`
  - Callback shim now preserves all query params.
- `apps/astronote-web/app/app/shopify/auth/login/page.tsx`
  - Prefills shop domain and error message from query params.

## Why the Loop Is Eliminated
- `/auth/verify` now receives Bearer token, so layout validation succeeds.
- `shopDomain` is reliably stored from the JWT payload or `shop` query param.
- Auth callback retains shop context even if token verification is deferred.

## Routes and Guard Behavior
- Protected routes: `/app/shopify/*` under `apps/astronote-web/app/app/shopify/*`
- Auth routes (public):
  - `/app/shopify/auth/login`
  - `/app/shopify/auth/callback`
  - `/shopify/auth/callback` (shim)
- axios interceptor enforces Authorization + tenant header for protected calls, but allows `/auth/verify` with Authorization even if shop domain is not yet available.

