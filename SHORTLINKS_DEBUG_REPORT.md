Shortlinks Debug Report
=======================

Problem
- /o/:token and /s/:token on astronote.onrender.com returned 404/“Link not available” without proper resolution or diagnostics.

Fixes
- Retail API: added public GET `/public/o/:shortCode` (mirrors `/public/s/:shortCode`) resolving shortLink -> target and 302 redirect. Path: `apps/retail-api/apps/api/src/routes/publicShort.routes.js`.
- Web (Next.js):
  - Added universal redirect handlers: `apps/astronote-web/app/o/[trackingId]/route.ts`, `apps/astronote-web/app/s/[shortCode]/route.ts`.
  - Removed conflicting legacy `(retail)/.../o` and `(retail)/.../s` pages to avoid route conflicts.
  - Added UTF-8 fallback page: `apps/astronote-web/app/link-not-available/page.tsx`.
  - Debug mode `?debug=1` returns JSON with attempts/status/location/bodySnippet for retail + shopify resolvers.

How to debug
- Offer/track link:
  - `curl -i "https://astronote.onrender.com/o/<token>?debug=1"`
  - JSON fields:
    - type: "o"
    - attempts: [{service:"retail"|"shopify", url, status, location, bodySnippet}]
    - final: "redirected" | "not_found"
- Unsubscribe short link:
  - `curl -i "https://astronote.onrender.com/s/<token>?debug=1"`

Expected for valid token
- HTTP 302 with `Location` header (no HTML body). Mobile-safe, no auth required.

Fallback behavior
- If both resolvers miss: redirect to `/link-not-available?type=o|s&token=<token>` (UTF-8 safe page).

Env used by web resolver
- RETAIL_API_BASE_URL (default https://astronote-retail.onrender.com)
- SHOPIFY_API_BASE_URL (default https://astronote-shopify.onrender.com)
