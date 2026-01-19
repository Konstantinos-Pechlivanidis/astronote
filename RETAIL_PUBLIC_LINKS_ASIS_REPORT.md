Retail Public Links – As-Is Report (Claim Offer + Unsubscribe)
==============================================================

Route map
- Express mounts (apps/retail-api/apps/api/src/server.js):
  - Public, no `/api` prefix: `/public/o/:shortCode` and `/public/s/:shortCode` → apps/retail-api/apps/api/src/routes/publicShort.routes.js; `/tracking/*` → apps/retail-api/apps/api/src/routes/tracking.js; `/public/join`, `/public/nfc`, `/public/assets` also mounted.
  - Auth-scoped API under `/api`: `/contacts` (public unsubscribe handlers included), `/campaigns`, `/automations`, `/billing`, etc.
  - Webhook mounts: `/mitto.webhooks`, `/stripe.webhooks` (no auth).
  - Public unsubscribe UI pages live in Next.js under `(retail)/retail/unsubscribe/[token]` and `/unsubscribe/[token]`.
  - Shortlink resolution on the web: Next route handlers `/o/[shortCode]/route.ts` and `/s/[shortCode]/route.ts` call the API `/public/o|s/:code` (no `/api` prefix) and fallback to `/link-not-available`.

Link generation pipeline
- Campaign sends (bulk) — apps/retail-api/apps/worker/src/sms.worker.js:
  - `renderMessageWithLinks` builds unsubscribe token (generateUnsubscribeToken) and shortens unsubscribe + offer via `buildUnsubscribeShortUrl` / `buildOfferShortUrl`.
  - `finalizeMessageText` strips any existing offer/unsub lines and appends exactly once:
    - `Claim Offer: <short>`
    - `To unsubscribe, tap: <short>`
  - Jobs go through `sendBulkSMSWithCredits` to provider.
- Single/automation sends — apps/retail-api/apps/api/src/services/automation.service.js:
  - Builds trackingId, shortens via `buildOfferShortUrl`, appends `Claim Offer: <short>`, sends through `sendSMSWithCredits`, which also appends a shortened unsubscribe line.
- Generic SMS service — apps/retail-api/apps/api/src/services/sms.service.js: Shortens freeform URLs, then appends a shortened unsubscribe (fails if shortener fails).
- Message text format (final in worker): base message (shortened URLs) + `Claim Offer: <short>` + `To unsubscribe, tap: <short>`.

Shortener storage
- Prisma model `ShortLink` (apps/retail-api/prisma/schema.prisma):
  - Fields: id, shortCode (unique), kind, targetUrl, originalUrl, longUrlHash, longUrlNormalized, ownerId (tenant), campaignId, campaignMessageId, clickCount, lastClickedAt, lastUsedAt, createdAt.
  - Constraints: unique(shortCode); unique(ownerId, kind, longUrlHash); indexes on ownerId, campaignId, campaignMessageId, longUrlHash.
- Generation: `urlShortener.service.js` uses nanoid(8) by default; normalizes URL, hashes with sha256 for idempotency, stores ownerId/kind/campaign metadata, in-memory cache to reuse existing short codes.
- External providers: Bitly/TinyURL supported via env but default is “custom” shortener backed by ShortLink table.

Public routes (as implemented)
- `/public/s/:shortCode` and `/public/o/:shortCode` in apps/retail-api/apps/api/src/routes/publicShort.routes.js:
  - No auth; rate-limited; find ShortLink by shortCode, increment clickCount/lastUsedAt, 302 to targetUrl/originalUrl; 404 JSON if missing/invalid code.
- `/tracking/offer/:trackingId` and `/tracking/redeem/:trackingId` in apps/retail-api/apps/api/src/routes/tracking.js:
  - No auth; resolve trackingId to CampaignMessage or AutomationMessage; returns offer metadata (JSON) and records offer view events; redeem endpoint reports existence/redeemed state.
- Unsubscribe:
  - Public routes in apps/retail-api/apps/api/src/routes/contacts.js: `/contacts/unsubscribe` (POST body token), `/contacts/unsubscribe/:token` (POST), `/unsubscribe/:token` (GET info). Token verified via HMAC in token.service.js (fields: contactId, storeId=ownerId, campaignId, exp).
  - Next.js UI pages: `(retail)/retail/unsubscribe/[token]/page.tsx` and `/unsubscribe/[token]/route.ts` (proxy POST to API).
- Next shortlink resolvers:
  - `/o/[shortCode]/route.ts`, `/s/[shortCode]/route.ts`: fetch `${RETAIL_API_BASE}/public/o|s/:code`, manual redirect; debug=1 returns attempts JSON; fallback to `/link-not-available`.

Tenant scoping
- ShortLink rows store ownerId/kind/longUrlHash; resolver does not re-check owner, it trusts the stored targetUrl.
- Unsubscribe tokens: HMAC-signed payload includes storeId (ownerId) and contactId; handler verifies signature/expiry, then updates that contact under the token’s store only — prevents cross-tenant unsubscribe.
- Offer tracking: trackingId lookup pulls CampaignMessage/AutomationMessage with embedded ownerId; data returned is scoped to that record; no cross-tenant mutation happens on tracking GET.
- Public short resolver: no extra tenant validation; isolation relies on the shortCode → targetUrl mapping created with ownerId metadata.

Root cause of “Not Found” for short links (as-is)
- Public short endpoints are mounted at `/public/o|s/:shortCode` with no `/api` prefix. Frontend resolvers call `${RETAIL_API_BASE}/public/...`. If RETAIL_API_BASE is misconfigured (e.g., pointed at the web host or missing `/api` proxy) the fetch returns 404 and the Next handler falls back to `/link-not-available`, surfacing “Not Found.” 
- Additionally, short codes must exist in the ShortLink table. If no ShortLink row was created for the campaign/automation (or shortening is disabled), the resolver will 404. Owner scoping does not affect the lookup; absence of the shortCode is the direct cause of 404.

Next implementation plan (high level)
- Validate RETAIL_API_BASE in the web env points to the API host that serves `/public/o|s/:shortCode` without `/api`.
- Ensure campaigns/workers always persist ShortLink rows for both offer and unsubscribe (forceShort) before sending.
- Add monitoring for public short 404s with shortCode payload, and surface a support-friendly fallback page.

C) Gap matrix (current state)
- Claim Offer public page works: Partial — depends on RETAIL_API_BASE correctness and presence of ShortLink row.
- Unsubscribe public page works: Partial — token validation solid; 404 if shortCode missing or API base misrouted.
- Shortening on both: OK in code path (worker/automation/sms.service) with idempotent storage.
- Owner scoping: Partial — unsubscribe token scoped; shortLink resolver trusts stored target without owner check but mapping is created per-owner.
- Conversion tracking: OK — `/tracking/offer/:trackingId` records offer view events; redeem endpoint returns status.
- GDPR opt-out: OK — unsubscribe routes mark contact unsubscribed; inbound STOP webhook also updates.
- Styling matches public pages: OK — Next public pages under `(retail)/retail/*` use shared PublicLayout components.

Verification steps
- Curl short resolver: `curl -i "https://<api-host>/public/s/<shortCode>"` (expect 302 Location or 404 JSON); same for `/public/o/<shortCode>`.
- Curl claim page (tracking): `curl -i "https://<api-host>/tracking/offer/<trackingId>"` (expect 200 JSON or 404).
- Curl unsubscribe: `curl -i -X POST "https://<api-host>/api/contacts/unsubscribe" -H "Content-Type: application/json" -d '{"token":"<token>"}'` (expect JSON status; no auth).
- Browser manual (placeholders):
  - Open `https://astronote.onrender.com/o/<shortCode>` and `https://astronote.onrender.com/s/<shortCode>`; add `?debug=1` to see resolver attempts.
  - Open `https://astronote.onrender.com/retail/unsubscribe/<token>` to view unsubscribe UI; submit to confirm success message.
  - Open `https://astronote.onrender.com/retail/tracking/redeem/<trackingId>` to check redeem status page.

Shortener model summary
- Model: `ShortLink` with unique `shortCode` and unique `(ownerId, kind, longUrlHash)`; fields: id, shortCode, kind, targetUrl, originalUrl, longUrlHash, longUrlNormalized, ownerId, campaignId, campaignMessageId, clickCount, lastClickedAt, lastUsedAt, createdAt.
- Generation: nanoid(8), stored via `urlShortener.service.js` with normalization + sha256 hash; ownerId/kind persisted for scoping/analytics; in-memory cache to avoid duplicate records.

Link generation functions (paths)
- Worker bulk send: `renderMessageWithLinks` and `finalizeMessageText` in apps/retail-api/apps/worker/src/sms.worker.js — final SMS includes “Claim Offer” and unsubscribe short links.
- Automations: `triggerWelcomeAutomation` / `processBirthdayMessages` in apps/retail-api/apps/api/src/services/automation.service.js — append “Claim Offer” with short offer; sms.service adds unsubscribe short link.
- Generic SMS helper: `sendSMSWithCredits` in apps/retail-api/apps/api/src/services/sms.service.js — shortens message URLs and appends shortened unsubscribe.

Tenant scoping details
- Shortener stores ownerId on ShortLink; resolver doesn’t cross-check owner, but creation is per-owner.
- Unsubscribe token encodes `storeId` (ownerId) and `contactId` with HMAC; handler rejects invalid signature/expiry and only updates that contact record.
- Offer tracking uses trackingId lookup in CampaignMessage/AutomationMessage tied to ownerId; no write operations exposed on public routes beyond analytics.

Root cause (likely) for Not Found
- Misaligned host/prefix: web resolvers call `${RETAIL_API_BASE}/public/...`; if RETAIL_API_BASE points at the frontend or includes `/api`, the API route isn’t reached → 404 and “link-not-available”.
- Missing ShortLink rows: if shortening failed or was skipped, `/public/o|s/:code` has no match → 404. Both conditions produce “Not Found” symptoms even though routes exist.
