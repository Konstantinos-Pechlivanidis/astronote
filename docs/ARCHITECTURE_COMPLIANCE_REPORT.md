# Retail Public Flows – Architecture Compliance Report

Status: **READY** (code-wise; static verification)

## Canonical URLs & Routes
- Offer: generated as `/retail/o/:trackingId`; frontend route `app/(retail)/retail/o/[trackingId]/page.tsx` (re-exports offer page); backend GET `/tracking/offer/:trackingId` (public).
- Unsubscribe: generated as `/retail/unsubscribe/:token` (often shortened to `/retail/s/:code`); frontend path route `app/(retail)/retail/unsubscribe/[token]/page.tsx` plus legacy `/unsubscribe` page; backend POST `/unsubscribe/:token?` aliasing `/contacts/unsubscribe`.
- Short links: generated as `/retail/s/:shortCode` (and `/s/:shortCode`); frontend resolvers at `app/(retail)/retail/s/[shortCode]/page.tsx` and `app/(retail)/s/[shortCode]/page.tsx`; backend GET `/public/s/:shortCode` (validates, increments, 302 redirect) backed by ShortLink model.
- Join (public signup/NFC/share): generated as `/retail/join/:token`; frontend route `app/(retail)/join/[token]/page.tsx`; backend GET `/public/join/:token` and POST `/public/join/:token/submit`.
- Redeem: QR from offer points to `/retail/tracking/redeem/:trackingId`; frontend route exists; backend POST `/tracking/redeem-public/:trackingId` (public, idempotent).

## Backend Endpoints (public) & Rate Limits
- Offer fetch: GET `/tracking/offer/:trackingId` (public).
- Short resolve: GET `/public/s/:shortCode` using `createLimiter` (300/60s default) keyed by client IP.
- Unsubscribe: POST `/unsubscribe/:token?` (alias `/contacts/unsubscribe`), rate-limited in contacts.js.
- Join info: GET `/public/join/:token` – limiter keyed per `ip:token` (300/60s), sets Retry-After on 429; light cache header `Cache-Control: public, max-age=30`.
- Join submit: POST `/public/join/:token/submit` – limiter keyed per `ip:token` (60/60s), Retry-After on 429.
- Redeem-public: POST `/tracking/redeem-public/:trackingId` – rate-limited via route limiter.

## Rate Limit Keying Summary
- Short: per IP (via shared createLimiter).
- NFC: per `ip:token`.
- Join view: per `ip:token` (300/min).
- Join submit: per `ip:token` (60/min).
- All 429s return `{ message: 'Too many requests', code: 'RATE_LIMITED' }` with Retry-After.

## Tokens & Tenant Safety
- trackingId (offer/redeem): unique per CampaignMessage; owner scoped in backend queries.
- unsubscribe token: decoded server-side to derive owner/contact; never client-provided ownerId.
- shortCode: resolves to ShortLink with optional owner/campaign linkage; redirect only.
- join token (PublicLinkToken): resolves to ownerId server-side; Contact upsert uses that ownerId; consent fields set; PublicSignupEvent logged.
- Owner/tenant is never accepted from client payload in public endpoints.

## Prisma Models / Migrations
- Contact: consent fields `smsConsentStatus`, `smsConsentAt`, `smsConsentSource`, `consentEvidence`, gdprConsent*; unique per owner (`@@unique([ownerId, phone])`).
- ShortLink: `shortCode` unique; fields `kind`, `targetUrl`, `originalUrl`, optional campaign/message links.
- PublicLinkToken: token unique, ownerId, type=signup, isActive.
- RetailBranding: per-owner branding.
- PublicSignupEvent: audit per token/owner/contact.
- Migrations present (apply before live): `20250302160000_public_link_and_branding`, `20250302161000_add_sms_consent_fields` (plus earlier shortlink/consent migrations).  
- Prisma checks: `npx prisma validate` and `npm run prisma:generate` (retail-api) pass.

## Frontend Hooks/Contracts (shapes aligned)
- useOffer, useRedeem, unsubscribe hooks align with backend responses.
- ShortLinkResolver calls `/public/s/:code` and redirects.
- useJoinInfo: `enabled: !!token`, `retry: false`, no refetch on focus/reconnect, `staleTime: 60s`; handles 429 with friendly message.
- useJoinSubmit: `retry: false`.
- Params normalized to `string | null`; no `undefined` passed into hooks.

## UX Checklist
- Offer page renders and includes QR to redeem; “Provided by Astronote” badge present in join flow.
- Join form is mobile-first, defaults country code to `+30`, persists in localStorage, no opt-in toggle (implicit consent).
- Unsubscribe path alias exists; short links resolve; no designed 404s on generated URLs.

## Critical Bug (429 loop) Status
- Fixed: join GET limiter now keyed per `ip:token` with higher allowance; frontend join fetch is single-shot (no auto-retries, no refetch on focus/reconnect) and friendly 429 UI. StrictMode double-render guarded by React Query settings.

## How to Live Test (manual)
1) Send a campaign; open offer link `/retail/o/{trackingId}` → offer loads; QR points to `/retail/tracking/redeem/{trackingId}`.  
2) Click unsubscribe `/retail/unsubscribe/{token}` (or short `/retail/s/{code}`) → success screen.  
3) Open short link `/retail/s/{code}` directly → resolves/redirects.  
4) From merchant UI, open “NFC / Share link” modal in Contacts → copy/open/QR/rotate works.  
5) Open join link `/retail/join/{token}` → submit first name + phone (+30 default/persist) → contact is created/upserted (opted in).  
6) Optional: Redeem public endpoint updates Redemption; aggregates update as configured.
