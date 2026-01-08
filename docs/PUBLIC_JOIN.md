# Public Join (NFC / Shareable Link) – Contracts & UX

Canonical URL: `/retail/join/:token` (token = PublicLinkToken.token)

Backend endpoints
- GET `/public/join/:token`
  - Resolves token (isActive, type=signup). 404 if invalid.
  - Returns: `{ ok, branding: { storeName, logoUrl, primaryColor?, accentColor?, headline?, subheadline?, benefits?, incentiveText?, privacyUrl?, termsUrl? }, defaults: { phoneCountryCode: "+30" }, publicBase }`
  - Rate limit: per `ip:token`, 600 requests / 5 minutes; sets Retry-After on 429; Cache-Control: public, max-age=30.
- POST `/public/join/:token`
  - Body: `{ firstName, lastName?, email?, countryCode (default +30), phoneNational }`
  - Normalizes phone to E.164; upserts Contact scoped to ownerId from token.
  - Consent: `smsConsentStatus='opted_in'`, `smsConsentAt=now`, `smsConsentSource='public_signup'`, `gdprConsentAt=now`, `consentEvidence={ tokenId, ip, userAgent, url }`.
  - Rate limit: per `ip:token`, 120 requests / 10 minutes; Retry-After on 429.
  - Returns: `{ ok: true, status: 'ok', contactId, phone }`.
- Tokens & tenant safety: ownerId derived ONLY from token; ownerId is never accepted from client.

Frontend (astronote-web)
- Route: `app/(public)/join/[token]/page.tsx`
  - Mobile-first form; defaults country code to +30; persists in localStorage key `join_country_code`.
  - Hooks: `useJoinInfo` (enabled: !!token, retry: false, no refetch on focus/reconnect, staleTime: 60s), `useJoinSubmit` (retry: false).
  - Friendly 429 UI: “Πάρα πολλά αιτήματα. Δοκίμασε ξανά σε λίγα δευτερόλεπτα.”
  - Marketing copy defaults (Greek): headline “Πάρε πρώτος τις προσφορές μας”, subheadline, benefits list, incentive text, trust note “Unsubscribe οποιαδήποτε στιγμή”.
  - CTA: “Γίνε μέλος & πάρε προσφορές”; success: “Η εγγραφή ολοκληρώθηκε ✅”.
  - Footer: “Provided by Astronote” linking to LANDING_PAGE_URL.

Rate limits summary
- GET join: 600/5min per ip:token.
- POST join: 120/10min per ip:token.
- 429 response: `{ message: 'Too many requests', code: 'RATE_LIMITED' }` + Retry-After.

Notes
- Link rotation code exists but should be feature-flagged/hidden; canonical links remain stable.
- Apply DB migrations before live: `cd apps/retail-api && npm run prisma:migrate:deploy`.
