Retail Public Links Fix Report (Retail Only)
============================================

What was broken
- Web resolvers `/o/:shortCode` and `/s/:shortCode` relied on `RETAIL_API_BASE_URL` and returned “Not Found” when the base pointed to the web host or included `/api`; they didn’t expose the resolved base in debug and fell back to generic pages.
- Short links could emit API-host bases (`/api`) because the shortener base didn’t strip `/api`, risking invalid URLs.
- Link-not-available page was off-brand and not using the shared PublicLayout.

Fixes implemented
- Sanitized all retail API base usages to strip trailing slashes and any `/api` suffix (axios/public clients, public join page, retail dashboard meta, ShortLinkResolver, `/o` and `/s` resolvers, unsubscribe proxy route). Resolvers now warn once if `/api` is present.
- `/o` and `/s` route handlers now:
  - use sanitized base,
  - request `${base}/public/o|s/:code` with no auth headers,
  - include base + status/body snippets in `?debug=1`,
  - redirect on 3xx Location or fall back to branded `/link-not-available`.
- Shortener now builds short URLs on the public web host (strips `/api` automatically). `buildOfferShortUrl`/`buildUnsubscribeShortUrl` require ownerId, log `shortlink_fallback_used:*` on failure, and fall back to long public URLs.
- Link-not-available page now uses `PublicLayout`/`PublicCard` with clear copy and a homepage button.
- Added `apps/retail-api/apps/api/scripts/shortlink-self-test.js` to insert a dummy ShortLink and print public `/o` and `/s` URLs (safe/local).

Environment requirements
- `NEXT_PUBLIC_RETAIL_API_BASE_URL` (frontend) must be the API host **without** `/api`, e.g., `https://astronote-retail.onrender.com`.
- `RETAIL_API_BASE_URL` (Next route handlers) same as above.
- `PUBLIC_WEB_BASE_URL` (backend shortener) set to the public web host, e.g., `https://astronote.onrender.com`.

Verification (local)
- npm -w @astronote/retail-api run test / lint / build (PASS).
- npm -w @astronote/web-next run lint / build (PASS).
- Self-test: `node apps/retail-api/apps/api/scripts/shortlink-self-test.js` → prints shortCode + `https://astronote.onrender.com/o/<code>` and `/s/<code>`.
- Resolver debug: `https://astronote.onrender.com/o/<code>?debug=1` now returns base + attempts JSON; `/s/<code>` similar.

Manual runtime checks (Render)
- Ensure envs above are set (no `/api` in base).
- Hit real short links:
  - `https://astronote.onrender.com/o/<shortCode>`
  - `https://astronote.onrender.com/s/<shortCode>`
  - With debug: `...?debug=1` to verify base + status.
- Unsubscribe flow: `https://astronote.onrender.com/retail/unsubscribe/<token>` → should unsubscribe and respect owner scoping.
- Offer tracking: `https://astronote.onrender.com/retail/tracking/offer/<trackingId>` returns JSON page; view tracking recorded by API.

Next steps
- Monitor API logs for `shortlink_fallback_used:*` and resolver 404s after deploy.
- Validate one live SMS: verify “Claim Offer: <short>” and “To unsubscribe, tap: <short>” both resolve without Not Found.
