Retail Shortlinks Gate Report
=============================

Scope
- Retail only: public shortlink resolution and unsubscribe shortening.

Automation checks (executed)
- Web lint/build: `npm -w @astronote/web-next run lint`, `npm -w @astronote/web-next run build` (PASS).
- Retail API lint/build: `npm -w @astronote/retail-api run lint`, `npm -w @astronote/retail-api run build` (PASS).

Static verification
- Retail API exposes public resolvers (no auth): `/public/o/:shortCode` and `/public/s/:shortCode` in `apps/retail-api/apps/api/src/routes/publicShort.routes.js`, now strict 302 → targetUrl, 404 if missing (no long-token fallback).
- Web route handlers: `apps/astronote-web/app/o/[shortCode]/route.ts` and `apps/astronote-web/app/s/[shortCode]/route.ts` call `/public/o|s/:code` (no /api prefix), try retail first then shopify, support `?debug=1` JSON, fallback to `/link-not-available`.
- Unsubscribe generation: retail enqueue (campaign messages) and worker send paths always shorten unsubscribe with `forceShort: true`, injecting only `/s/<shortCode>` in SMS (see `campaignEnqueue.service.js`, `sms.service.js`, `apps/retail-api/apps/worker/src/sms.worker.js`). Shortener now defaults to astronote.onrender.com base and supports forceShort.
- No lingering long-link fallbacks remain in resolvers; strict 404 for unknown shortCodes.

Manual verification (pending real tokens)
- Need real recent shortCodes to execute:
  - `curl -I "https://astronote.onrender.com/s/<shortCode>"` → expect 302 + Location.
  - `curl -I "https://astronote.onrender.com/o/<shortCode>"` → expect 302 + Location.
  - `curl -i "https://astronote.onrender.com/s/<shortCode>?debug=1"` → JSON attempts + `final="redirected"`.
  - `curl -i "https://astronote.onrender.com/s/INVALID_123?debug=1"` → `final="not_found"` (or link-not-available redirect).
- Also confirm a freshly sent retail SMS contains only `/s/<shortCode>` (no `/unsubscribe/<token>`), and ShortLink table has the code.

PASS/FAIL table (current state)
- Lint/build (web + retail API): PASS.
- Route handlers present and wired to `/public/*`: PASS.
- Resolver fallback removed, UTF-8 safe fallback page via link-not-available: PASS.
- Live redirect with real tokens: NOT RUN (tokens not available in this environment).
- Fresh campaign unsubscribe shortened: NOT RUN (requires live send).

Next steps to fully confirm
1) Send a retail campaign to 1 recipient, capture SMS:
   - Verify links: `.../o/<code>` and `.../s/<code>` only.
2) Run the curl commands above on those codes; expect 302 + Location.
3) Run invalid-token curl to confirm clean 404/fallback.

No commits made. Node version unchanged.
