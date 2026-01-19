Retail Unsubscribe Shortlink Fix
================================

What was wrong
- Retail web resolver called `/api/public/s` while the API exposes `/public/s`, so short codes always 404ed and fell back to long unsubscribe URLs.
- Public resolver for `/public/s` fell back to the long token when a shortCode was missing, so SMS could still contain or resolve to `/unsubscribe/<token>`.
- Unsubscribe shortening could fall back to the long URL (no force) and the shortener base default was not the universal host.

Changes made
- apps/astronote-web/app/o/[shortCode]/route.ts and apps/astronote-web/app/s/[shortCode]/route.ts now call `/public/o|s/:code` (no /api prefix), keep debug=1 JSON, and drop the long-token fallback.
- apps/retail-api/apps/api/src/routes/publicShort.routes.js now strictly redirects shortCode → targetUrl (302) and returns 404 when missing (no long-token fallback), with warn logs.
- apps/retail-api/apps/api/src/services/urlShortener.service.js adds `forceShort` support and defaults to astronote.onrender.com base.
- Unsubscribe shortening now always forces a short code and stores metadata:
  - apps/retail-api/apps/api/src/services/sms.service.js
  - apps/retail-api/apps/worker/src/sms.worker.js
- Cleaned unused shortlink generation noise in campaignEnqueue.service.js (trackingId kept, offer/unsub short vars removed).

Verification steps
1) Create a retail campaign to 1 recipient. Confirm the SMS body shows ONLY `https://astronote.onrender.com/s/<shortCode>` (no `/unsubscribe/` token).
2) Resolve short code:
   - `curl -I "https://astronote.onrender.com/s/<shortCode>"` → `302` with `Location` pointing to the long unsubscribe target.
   - `curl -i "https://astronote.onrender.com/s/<shortCode>?debug=1"` → JSON with attempts and `final="redirected"`.
3) Invalid code: `curl -I "https://astronote.onrender.com/s/notreal"` → `404` JSON (Next) after both resolvers miss.
4) Confirm ShortLink table has a row for the shortCode immediately after enqueue.

Commands run
- npm -w @astronote/retail-api run lint
- npm -w @astronote/retail-api run build
- npm -w @astronote/web-next run lint
- npm -w @astronote/web-next run build

Notes / edge cases
- Shortener now forces shortening for unsubscribe links; if URL_SHORTENER_TYPE=none is set, links will remain long by configuration.
- Public resolvers are unauthenticated, rate-limited via existing limiter, and return 404 when the shortCode is unknown.
