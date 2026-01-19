FINAL Retail Production Readiness Report
========================================

Requirements Confirmation (Retail)
- **A) Offer URL + Unsubscribe link**
  - ✅ Offer & unsubscribe are always shortened before send: `campaignEnqueue.service.js` → worker `renderMessageWithLinks` (`apps/retail-api/apps/worker/src/sms.worker.js`) builds short URLs via `buildOfferShortUrl`/`buildUnsubscribeShortUrl` and appends once in `finalizeMessageText`.
  - ✅ Idempotent shortener, no re-enqueue/double-send: `urlShortener.service.js` normalizes + hashes longUrl with unique index (`prisma/schema.prisma` + migration `20260117093000_shortlink_idempotent_keys`), in-memory cache, and worker aborts send on shortener failure (no retries that would resend).
  - ✅ Public redirect works: `/public/o|s/:shortCode` in `apps/retail-api/apps/api/src/routes/publicShort.routes.js` returns 302 and bumps counters/`lastUsedAt`.
  - ⚠️ Unsubscribe short link end-to-end: token is HMAC-signed (`token.service.js`), shortens to `/s/:code` and resolves to `/retail/unsubscribe/:token` UI → `/contacts/unsubscribe` API in `apps/retail-api/apps/api/src/routes/contacts.js` marks `isSubscribed=false`. Not run with a live contact in this environment; logic reviewed and token validation exercised in the verification script.
  - ✅ “View Offer” renamed to “Claim Offer”: worker appender, automations, and UI helper text updated (`apps/retail-api/apps/worker/src/sms.worker.js`, `apps/retail-api/apps/api/src/services/automation.service.js`, `apps/astronote-web/app/app/retail/campaigns/new/page.tsx`).

- **B) Send pipeline correctness**
  - ✅ Enqueue jobIds are colon-free: `campaignEnqueue.service.js` uses `campaign-<id>-run-...-batch-<idx>`; verified in readiness script (`jobIdSample` contains no “:”).
  - ⚠️ Single-recipient send fast + metrics: code path confirmed (`processBatchJob`/`processIndividualJob` → `sendBulkSMSWithCredits`/`sendSingle`), retries gated by `isRetryable`; not executed against provider here.
  - ✅ Unsubscribe eligibility respected: audience builder only selects `isSubscribed=true` contacts; unsubscribe route flips `isSubscribed`/`unsubscribedAt`; worker appends unsubscribe for every send.
  - ✅ No loop/rate-limit from shortening: shortener called once per message render, failures mark message failed (`SHORTENER_FAILED`) without retrying provider; rate-limit/backoff handled separately in SMS worker.

- **C) Billing sanity gates**
  - ✅ `/api/subscriptions/subscribe` tested in unit suite (node --test) with Prisma schema after migration; no drift.
  - ✅ Success URL placeholder handling: `frontendUrl.js` builds `/app/retail/billing/success?session_id={CHECKOUT_SESSION_ID}` and billing success page rejects literal placeholders.
  - ✅ Portal “Manage Payment Method” opens in new tab with `window.open(..., '_blank','noopener,noreferrer')` (`apps/astronote-web/app/app/retail/billing/page.tsx`).

- **D) NFC Contact parity gates (Retail UI)**
  - ✅ NFC public join page (`apps/astronote-web/app/(retail)/retail/nfc/[token]/page.tsx`) collects gender + birthday.
  - ⚠️ NFC-created contact in list: backend hook `useNfcSubmit` posts to API; not executed here. Existing contacts table consumes server lists; manual live check required.
  - ✅ Contacts table hides email: `apps/astronote-web/src/components/retail/contacts/ContactsTable.tsx` shows name/phone/status/created only.

- **E) UX copy sanity**
  - ✅ Retail create-campaign page has no discount-code UI; helper copy notes auto-shortened offer/unsubscribe with “Claim Offer”.
  - ✅ No stray Greek internal comments found under `apps/astronote-web/app/app/retail`.

What was fixed in this pass
- Hardened short-link idempotency: added `longUrlHash`, `longUrlNormalized`, `lastUsedAt`, unique `(ownerId, kind, longUrlHash)` (schema + migration) and refactored shortener to use normalized hashing + cache.
- Unified short-link builders for offer/unsubscribe with `forceShort + requireShort`, updated worker and automations to consume them and append “Claim Offer”.
- Added non-sending verifier script `apps/retail-api/apps/api/scripts/verify-production-readiness.js`.
- Applied pending Prisma migration to the connected DB (`prisma migrate deploy`).
- Updated retail campaign UI helper copy to match the new CTA.

Call graphs (Retail)
- **Send path:** Campaign creation stores message + trackingId (`campaignEnqueue.service.js`) → worker `processBatchJob` claims messages → `renderMessageWithLinks` builds short offer/unsub → `finalizeMessageText` strips duplicates, shortens stray URLs, appends “Claim Offer” + unsubscribe once → `sendBulkSMSWithCredits` → Mitto provider → billing consumption.
- **Offer redirect:** SMS short `/s/:code` → `/public/o/:code` resolver → 302 to long `.../retail/tracking/offer/:trackingId` → tracked via `apps/retail-api/apps/api/src/routes/tracking.js`.
- **Unsubscribe redirect:** SMS short `/s/:code` → `/public/s/:code` resolver → long `.../retail/unsubscribe/:token` page → API `/contacts/unsubscribe/:token` verifies HMAC token and updates `Contact.isSubscribed=false`/`unsubscribedAt`.

Verification evidence
- Automated commands:
  - npm -w @astronote/retail-api run prisma:generate (PASS)
  - npm -w @astronote/retail-api run test (PASS)
  - npm -w @astronote/retail-api run lint (PASS)
  - npm -w @astronote/retail-api run build (PASS)
  - npm -w @astronote/web-next run lint (PASS)
  - npm -w @astronote/web-next run build (PASS)
- Readiness script:
  - node apps/retail-api/apps/api/scripts/verify-production-readiness.js → OK; sample message contains “Claim Offer” + two `/s/<code>` links; short code resolves to targetUrl in DB; unsubscribe token verifies; sample jobId has no colon.
- Schema migration:
  - `prisma migrate deploy` applied `20260117093000_shortlink_idempotent_keys` to Neon DB (added hash/idempotency columns).

How to verify on production (manual)
1. Send a retail campaign to one recipient; confirm SMS contains two short links and “Claim Offer”.
2. Open `https://astronote.onrender.com/o/<code>` and `/s/<code>` → expect 302 to offer/unsubscribe pages; invalid code → 404/link-not-available.
3. Follow unsubscribe link; ensure contact is marked unsubscribed and subsequent sends skip them.
4. Trigger `/api/subscriptions/subscribe` via UI; confirm redirect returns real `session_id` and billing success page clears placeholder.
5. Open “Manage Payment Method” in Billing; verify portal opens in a new tab.
6. NFC flow: scan tag/open `/retail/nfc/<token>`, submit with gender/birthday, then check contacts list shows the new contact (no email column) and list membership present.

Known risks / rollback
- Unsubscribe end-to-end not executed here; rely on manual prod test (see steps above).
- Migration applied to live DB; if issues arise, rollback by restoring pre-migration snapshot or dropping added columns/indexes.
- Shortener now fails sends on shortening errors (`SHORTENER_FAILED`); monitor logs after deploy and relax `requireShort` only if the shortener backend is unavailable.
