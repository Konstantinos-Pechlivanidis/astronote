Shortlinks Live Confirmation (Retail)
=====================================

Issue
- https://astronote.onrender.com/o/<token> and /s/<token> returned 404 or “Link not available” because the web app lacked redirect handlers and retail public resolvers only covered `/public/s`.

Changes
- Retail API: `apps/retail-api/apps/api/src/routes/publicShort.routes.js`
  - Added public GET `/public/o/:shortCode` mirroring `/public/s/:shortCode`, resolving `shortLink` to targetUrl/originalUrl and 302 redirecting.
- Web (Next.js): Added route handlers
  - `apps/astronote-web/app/o/[trackingId]/route.ts`
  - `apps/astronote-web/app/s/[shortCode]/route.ts`
  - Removed conflicting legacy alias pages under `(retail)/.../o` and `(retail)/.../s`.
  - Behavior: Try retail resolver first (`RETAIL_API_BASE_URL`), then shopify (`SHOPIFY_API_BASE_URL`); on 3xx with Location, respond 302 to Location; if both fail, return friendly 404 message.

Verification commands (expected 302 + Location)
- `curl -I https://astronote.onrender.com/o/<token>`
- `curl -I https://astronote.onrender.com/s/<token>`
Expect: HTTP/1.1 302 Found with Location header from retail/shopify resolver (no HTML 404).

Env expectations
- Web uses `RETAIL_API_BASE_URL` (default https://astronote-retail.onrender.com) and `SHOPIFY_API_BASE_URL` (default https://astronote-shopify.onrender.com).
- Retail API routes are public and require no auth; rate-limited via existing limiter.

Notes
- Works on mobile/SMS because redirects are plain 302 with no auth headers.
- No Node/version changes. No commits made.
