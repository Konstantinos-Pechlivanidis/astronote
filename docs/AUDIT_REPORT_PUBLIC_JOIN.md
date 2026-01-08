# Audit Report – Public Join/NFC Flow & Branding (Code-wise)

Status: **Aligned (static/compile verification)**

## 1) Route Completeness
- Frontend routes present and compile:
  - `app/(public)/layout.tsx`
  - `app/(public)/join/[token]/page.tsx` (public, mobile-first)
  - Legacy alias still present under `(retail)/join/[token]` for compatibility.
- Backend endpoints present and mounted in `apps/retail-api/apps/api/src/server.js`:
  - GET `/public/join/:token`
  - POST `/public/join/:token` (alias `/submit`)
  - Authenticated branding: GET/PUT `/api/branding`.
- Offer/unsubscribe/short canonical paths remain unchanged; no stale join path mismatches found.

## 2) Prisma Schema vs Code Usage
- Contact fields used in code exist: `smsConsentStatus`, `smsConsentAt`, `smsConsentSource`, `consentEvidence`, gdprConsent*; unique per owner (`@@unique([ownerId, phone])`).
- Branding models used in code exist: `RetailBranding` (storeDisplayName, subheadline, benefitsJson, incentiveText, legalText, backgroundStyle, colors, logoUrl, privacy/terms) and `PublicLinkToken` (rotationEnabled, type/isActive).
- ShortLink exists with `shortCode`, `targetUrl`, `originalUrl`.
- No code references to non-existent fields (prior updatedAt issue resolved). Prisma validation/generate pass.

## 3) DTO / Contract Consistency
- GET `/public/join/:token` returns branding fields merged from RetailBranding + defaults; frontend types explicitly handle nullables.
- Frontend hooks:
  - `useJoinInfo`: `enabled: !!token`, `retry: false`, `refetchOnWindowFocus=false`, `refetchOnReconnect=false`, `staleTime=60s`.
  - `useJoinSubmit`: `retry: false`, payload `{ firstName, lastName?, email?, countryCode, phoneNational }`.
- Response handling in public join page accounts for 429 with friendly message; no undefined vs null TS errors remain.
- Shared contract documented in `docs/PUBLIC_JOIN.md`.

## 4) Rate-limit & Retry Safety
- Backend rate limits:
  - Join GET: per `ip:token`, 600/5m; Retry-After on 429.
  - Join POST: per `ip:token`, 120/10m; Retry-After on 429.
  - Short/NFC use `createLimiter` with generous thresholds; rateLimitByIp exported correctly.
- Frontend does not auto-retry on 404/429; no fetch loops/auto-refresh.

## 5) Ownership Scoping
- Public endpoints derive ownerId solely from token/trackingId server-side; ownerId is not accepted from client.
- Contact upsert uses unique (ownerId, phone) ensuring tenant isolation.
- Unsubscribe token decoded to scope contact update; join token scopes contact creation.

## 6) Compile/Static Confidence
- `npx prisma validate`: PASS
- `npm run prisma:generate` (retail-api): PASS
- `npx tsc --noEmit` (astronote-web): PASS
- Lint not rerun in this pass; prior state had only non-blocking warnings (console/img). No new lint issues introduced.

## Fixes Applied in This Audit
- Branding extensions in Prisma (storeDisplayName, subheadline, benefitsJson, incentiveText, legalText, backgroundStyle, rotationEnabled) plus migration `20250302170000_branding_extension`.
- Backend branding endpoints added (`/api/branding`) and mounted; public join payload includes full branding set.
- Frontend: public join page uses explicit branding typing; join submit uses `countryCode`; DTO alignment in endpoints/hook types.
- Docs added: `docs/PUBLIC_JOIN.md` and this audit report.

## Remaining Actions Before Live
- Apply pending migrations: `cd apps/retail-api && npm run prisma:migrate:deploy`.
- Optional: rerun lint to address pre-existing warnings. No runtime tests executed (per instruction).
