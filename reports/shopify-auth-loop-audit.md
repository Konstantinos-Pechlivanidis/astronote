# Shopify Auth Redirect Loop Audit

Date: 2025-02-14

## Current Intended Flow (from code)

1) User opens `/app/shopify/auth/login` (Next.js route: `apps/astronote-web/app/app/shopify/auth/login/page.tsx`).
2) “Login with Shopify” sends the browser to backend OAuth start:
   - `GET {SHOPIFY_API_BASE_URL}/auth/shopify?shop=<shop>.myshopify.com`
3) Shopify redirects back to backend:
   - `GET /auth/callback?code=...&shop=...&hmac=...`
4) Backend exchanges token, creates/updates Shop, generates app JWT, then redirects to frontend:
   - `302 {WEB_APP_URL}/shopify/auth/callback?token=<jwt>`
5) Frontend shim at `/shopify/auth/callback` forwards to actual handler:
   - `/app/shopify/auth/callback?token=<jwt>`
6) Callback handler stores token + shop info in localStorage and redirects to `/app/shopify/dashboard`.
7) Shopify layout (`apps/astronote-web/app/app/shopify/layout.tsx`) verifies token via `/auth/verify` before rendering app.

## Where the Loop Happens

**Loop trigger:** Shopify layout performs `verifyToken()` which uses `shopifyApi` axios instance. In `apps/astronote-web/src/lib/shopify/api/axios.ts`, all `/auth/*` endpoints are treated as public, so **Authorization header is NOT attached**.

Result:
- `/auth/verify` returns 401 (missing Bearer token)
- Layout clears localStorage token and redirects to `/app/shopify/auth/login`
- User sees login page again, despite successful OAuth

## Contributing Issues

1) **Auth header stripped for `/auth/verify`**
   - `shopifyApi` skips tenant headers for any URL containing `/auth/`.
   - `/auth/verify` is protected and requires Bearer token, so verification always fails.

2) **JWT payload decode uses `atob` without base64url handling**
   - Both `apps/astronote-web/src/lib/shopify/api/shop-domain.ts` and the callback handler decode JWT payload using `atob(tokenParts[1])`.
   - JWT payload is base64url; `atob` can fail, preventing `shopDomain` from being stored.
   - If verification fails, callback tries to fall back to `shop` query param, but backend redirect does not include `shop`.

3) **Callback shim drops extra params**
   - `apps/astronote-web/app/shopify/auth/callback/page.tsx` only forwards `token` and `error` params. `shop` is not preserved.

## Evidence (files)
- `apps/astronote-web/src/lib/shopify/api/axios.ts` → `isPublicEndpoint` includes `/auth/`
- `apps/astronote-web/app/app/shopify/layout.tsx` → calls `verifyToken()` and redirects on failure
- `apps/astronote-web/app/app/shopify/auth/callback/page.tsx` → attempts token decode with `atob`, fallback `shop` param
- `apps/astronote-web/src/lib/shopify/api/shop-domain.ts` → base64url decode missing
- `apps/shopify-api/routes/auth.js` → redirect to `/shopify/auth/callback?token=...` (no `shop` param)
- `apps/astronote-web/app/shopify/auth/callback/page.tsx` → forwarding shim only preserves `token`/`error`

## Root Cause
Primary cause is missing Authorization header on `/auth/verify` due to `shopifyApi` interceptor treating all `/auth/*` endpoints as public. This makes verification fail and triggers the login redirect.

Secondary issues (not strictly required to loop, but make flow brittle):
- JWT payload decode fails for base64url tokens, preventing `shopDomain` storage.
- Callback shim does not preserve `shop` param, removing a fallback for shop context.

