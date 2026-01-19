Shortlinks Root Cause Report
============================

Generation
- Offer links: built during campaign enqueue with `trackingId = newTrackingId()` and offerUrl = `/o/<trackingId>` (no short code). File: `apps/retail-api/apps/api/src/services/campaignEnqueue.service.js` (messagesData creation).
- Unsubscribe links: generated as `/unsubscribe/<token>` (not via short code). Same file; shortener is invoked but not used in message text.

Persistence
- Short links stored in Prisma model `ShortLink` via `urlShortener.service` when shortenUrl is called. Those shortCodes are random and NOT the trackingId, so `/o/<trackingId>` was never in ShortLink table.

Resolution
- Web route handlers initially only looked up `/api/public/o/:token` which hit ShortLink rows. Since tokens were trackingIds (not shortCodes), resolvers returned 404 and “link not available”.

Root cause
- Mismatch: SMS links use `/o/<trackingId>` while the public resolver only handled shortCode-based lookups.

Fix applied
- Retail API `/public/o/:shortCode`: now falls back to treating the token as a trackingId and redirects to `/tracking/offer/<token>` when ShortLink row missing (`apps/retail-api/apps/api/src/routes/publicShort.routes.js`). `/public/s/:shortCode` now falls back to `/unsubscribe/<token>`.
- Web (Next.js) redirect handlers:
  - `apps/astronote-web/app/o/[trackingId]/route.ts` now supports debug mode and, if both resolvers fail, falls back to `/tracking/offer/<token>` before the not-available page.
  - `apps/astronote-web/app/s/[shortCode]/route.ts` debug mode + fallback to `/unsubscribe/<token>`.
  - Added UTF-8 fallback page `app/link-not-available/page.tsx`.
  - Removed conflicting legacy retail shortlink pages to avoid build conflicts.

Debug mode
- /o/<token>?debug=1 or /s/<token>?debug=1 returns JSON with attempts [{service,url,status,location,bodySnippet}] and final state.

Verification steps
1) Create/send a campaign (1 recipient) → capture link `/o/<trackingId>` and `/unsubscribe/<token>` if present.
2) `curl -I https://astronote.onrender.com/o/<trackingId>` → expect 302 to `/tracking/offer/<trackingId>` (or target); debug=1 shows attempts/final=redirected.
3) `curl -I https://astronote.onrender.com/s/<token>` → expect 302 to `/unsubscribe/<token>` (or target); debug=1 shows attempts/final=redirected.
4) Invalid token → 302 to `/link-not-available?...` (UTF-8-safe page).

Notes
- No Node/version changes. No commits made.
