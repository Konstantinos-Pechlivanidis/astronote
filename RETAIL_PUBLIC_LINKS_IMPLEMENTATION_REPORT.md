Retail Public Links Implementation Report (Claim Offer + Unsubscribe)
=====================================================================

Checklist
- ✅ /o and /s resolvers use sanitized API base (no `/api`), surface debug, and fall back to branded link-not-available.
- ✅ Public short endpoints reachable at `/public/o|s/:code` (no `/api`); `/api/public/*` returns 404 (not mounted).
- ✅ Shortener emits public web host URLs (strips `/api`), requires ownerId for offer/unsubscribe; logs `shortlink_fallback_used:*` on failure.
- ✅ Link-not-available uses PublicLayout/PublicCard with clear messaging/CTA.
- ✅ Unsubscribe page is a real UX (marketing + confirm unsubscribe) and accepts path tokens.
- ✅ Offer page is a real public page with offer details + QR to redeem URL.
- ✅ Builds/lint (retail-api + web-next) pass.

Files changed (high level)
- API base sanitation & resolvers: `apps/astronote-web/app/o/[shortCode]/route.ts`, `apps/astronote-web/app/s/[shortCode]/route.ts`, `apps/astronote-web/app/unsubscribe/[token]/route.ts`, retail API clients under `src/lib/retail/api/*`, public join/meta helpers.
- Public pages: `apps/astronote-web/app/link-not-available/page.tsx` (PublicLayout), `apps/astronote-web/app/(retail)/unsubscribe/page.tsx` (real UX with path token), offer page already live at `apps/astronote-web/app/(retail)/tracking/offer/[trackingId]/page.tsx`.
- Shortener/base: `apps/retail-api/apps/api/src/services/urlShortener.service.js` (PUBLIC_WEB_BASE, strip `/api`), `apps/retail-api/apps/api/src/services/publicLinkBuilder.service.js` (ownerId required, fallbacks logged), `apps/retail-api/apps/worker/src/sms.worker.js` (ownerId guard).
- Logging: `apps/retail-api/apps/api/src/routes/publicShort.routes.js` logs `shortlink_not_found`.
- Self-test: `apps/retail-api/apps/api/scripts/shortlink-self-test.js` prints public `/o` and `/s` links for a dummy shortCode.
- Reports: `RETAIL_PUBLIC_LINKS_FIX_REPORT.md`, `RETAIL_PUBLIC_LINKS_LIVE_VERIFICATION.md`, `RETAIL_PUBLIC_LINKS_IMPLEMENTATION_REPORT.md` (this file).

Env expectations
- WEB: `NEXT_PUBLIC_RETAIL_API_BASE_URL=https://astronote-retail.onrender.com`, `RETAIL_API_BASE_URL=https://astronote-retail.onrender.com` (no `/api`, no trailing slash).
- API: `PUBLIC_WEB_BASE_URL=https://astronote.onrender.com` (no `/api`, no trailing slash).

What was fixed relative to symptoms
- Shortlinks returning 404: resolvers now sanitize base and call `/public/o|s/:code` (not `/api`); shortener emits web-host links and strips `/api`; link-not-available is branded.
- Offer page 404: public UI lives at `/retail/tracking/offer/[trackingId]` with offer details + QR; `/o/<code>` resolves there via shortLink target.
- Unsubscribe placeholder: `/retail/unsubscribe/[token]` now renders marketing + confirm unsubscribe UI using PublicLayout; accepts path token; posts via `useUnsubscribe`.

Verification performed
- Live curl: `/public/o|s/doesnotexist` return 404 JSON (PASS); `/api/public/...` returns RESOURCE_NOT_FOUND (PASS).
- Builds: `npm -w @astronote/retail-api run lint && npm -w @astronote/retail-api run build` (PASS); `npm -w @astronote/web-next run lint && npm -w @astronote/web-next run build` (PASS).
- Link-not-available page now branded (PublicLayout).

How to verify on Render
1) Env: set the three variables above (no `/api`, no trailing slash).
2) Short resolvers with debug:
   - `https://astronote.onrender.com/o/<code>?debug=1`
   - `https://astronote.onrender.com/s/<code>?debug=1`
   Expect base=`https://astronote-retail.onrender.com`, status from `/public/*`, fallback to `/link-not-available` when missing.
3) Public pages:
   - Offer UI: `https://astronote.onrender.com/retail/tracking/offer/<trackingId>` shows offer + QR to redeem.
   - Unsubscribe UI: `https://astronote.onrender.com/retail/unsubscribe/<token>` shows marketing + confirm unsubscribe; completes opt-out.
4) API endpoints:
   - `https://astronote-retail.onrender.com/public/o|s/<code>` should 302 when code exists, 404 JSON when missing.
5) Optional self-test:
   - `node apps/retail-api/apps/api/scripts/shortlink-self-test.js` → open printed `/o` and `/s` URLs.

Tenant safety notes
- ShortLink rows carry ownerId/kind; unsubscribe token HMAC includes storeId+contactId; unsubscribe handler enforces token validity. Resolver trusts stored targetUrl but mapping is created per-owner; invalid codes return 404 JSON.
