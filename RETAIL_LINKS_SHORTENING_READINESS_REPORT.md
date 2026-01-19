Retail Links Shortening Readiness
=================================

Checklist (Retail)
- [x] Offer link shortened before send (campaign + automation) via `renderMessageWithLinks` → `buildOfferShortUrl`.
- [x] Unsubscribe link shortened before send via `buildUnsubscribeShortUrl`; send aborts if shortening fails.
- [x] Public redirect route working (`/public/o/:code` + `/public/s/:code`) with click counters updated.
- [x] Eligibility respects unsubscribe (token-based, enforced in worker and api unsubscribe route).
- [x] “Claim Offer” copy applied in SMS assembly; preview helper text updated.
- [x] Guardrails: no double-send on retries, shortener failures mark message failed (no fallback send); idempotent short-link creation per owner/kind/hash.

Call-site inventory (Retail)
- Campaign send pipeline: `apps/retail-api/apps/api/src/services/campaignEnqueue.service.js` renders message, shortens freeform URLs, stores `trackingId`, enqueues `smsQueue`. Worker `processBatchJob` (apps/retail-api/apps/worker/src/sms.worker.js) claims messages → `renderMessageWithLinks` (generates unsubscribe token + shortens offer/unsub) → `finalizeMessageText` (removes old links, shortens other URLs, appends single “Claim Offer” + unsubscribe) → `sendBulkSMSWithCredits`.
- Single/automation sends: `automation.service.js` builds trackingId, shortens offer via `buildOfferShortUrl`, appends “Claim Offer”, sends through `sendSMSWithCredits`. `sendSMSWithCredits` shortens arbitrary URLs and appends shortened unsubscribe (fails fast on shortener error).
- Short-link resolution: `apps/retail-api/apps/api/src/routes/publicShort.routes.js` handles `/public/s/:shortCode` and `/public/o/:shortCode`, increments click + `lastUsedAt`, 302 to `targetUrl`.
- Short-link builder: `apps/retail-api/apps/api/src/services/publicLinkBuilder.service.js` centralizes `buildOffer|Unsubscribe` long URLs and strict shortening (force + require) with owner/campaign scoping.
- Shortener/idempotency: `apps/retail-api/apps/api/src/services/urlShortener.service.js` normalizes URLs, hashes (`ownerId` + `kind` + `longUrlHash` unique), caches in-memory, and stores mappings in `ShortLink`.

What changed (paths)
- Added hash/idempotent fields and unique index to `ShortLink` (schema + migration).
- Rebuilt url shortener service with normalization, hash-based lookups, memory cache, and strict failure signaling.
- Worker send flow now builds short links once per message, aborts on shortener failure, appends “Claim Offer” + unsubscribe exactly once, and logs appended links when debug is on.
- Automations use shared builder + “Claim Offer” copy; shortener failure blocks sends.
- SMS service (direct sends) now enforces shortened unsubscribe via builder and fails if unavailable.
- Retail campaign creation UI helper text explains auto-shortened offer/unsubscribe and “Claim Offer” label.
- Tests added for short-link idempotency, public redirect behavior, and unsubscribe builder options.

Verification
- Automated (ran locally):
  - npm -w @astronote/retail-api run test (PASS)
  - npm -w @astronote/retail-api run lint (PASS)
  - npm -w @astronote/retail-api run build (PASS)
  - npm -w @astronote/web-next run lint (PASS)
  - npm -w @astronote/web-next run build (PASS)
- Manual next steps:
  - Send a retail campaign to a single contact; SMS should include “Claim Offer: <short>” and “To unsubscribe, tap: <short>”.
  - Hit `https://astronote.onrender.com/o/<shortCode>` and `/s/<shortCode>` → expect 302 to offer/unsubscribe targets; invalid codes → 404 JSON or link-not-available page.
  - Confirm contact unsubscribes via short link and becomes ineligible for further sends.
  - Verify ShortLink rows include `longUrlHash`, `kind` (“offer”/“unsubscribe”), and reuse the same shortCode on repeat calls per owner.

Risks / rollback notes
- Shortener failures now block sends (error `SHORTENER_FAILED` in `CampaignMessage.error`); monitor logs for unexpected blocking. Revert by relaxing `requireShort` flags if provider outages occur.
- Unique index on (`ownerId`,`kind`,`longUrlHash`) may reject inconsistent seeds; backfill legacy rows with hashes if migration errors arise.
- External shortener modes (`URL_SHORTENER_TYPE=bitly|tinyurl`) still supported but prefer `custom` for resolver compatibility.
