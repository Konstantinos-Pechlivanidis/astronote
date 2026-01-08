# Prisma ↔ Backend ↔ Frontend Association Report (Retail)

Status: **Aligned (code-wise, static verification)**

## Models & Fields vs Code
- **Contact**: consent fields present in schema and used in code (`smsConsentStatus`, `smsConsentAt`, `smsConsentSource`, `consentEvidence`, gdprConsent*). Unique per owner (`@@unique([ownerId, phone])`). Migration: `20250302161000_add_sms_consent_fields`.
- **ShortLink**: `shortCode` unique, `kind`, `targetUrl`, `originalUrl`, optional campaign/campaignMessage; used by urlShortener + `/public/s/:shortCode` resolver. Migrations include shortlink creation and target/kind extension.
- **PublicLinkToken / RetailBranding / PublicSignupEvent**: exist in schema, used by public join and branding endpoints. Migration: `20250302160000_public_link_and_branding`.
- **CampaignMessage/Redemption**: trackingId unique; referenced by offer/redeem paths. No code references to missing fields.
- **No dangling fields**: code no longer references non-existent columns (e.g., updatedAt on CampaignMessage or missing smsConsentStatus).

## Migrations Summary
- `20250302160000_public_link_and_branding`: adds PublicLinkToken, RetailBranding, PublicSignupEvent.
- `20250302161000_add_sms_consent_fields`: adds smsConsentStatus/At/Source, consentEvidence on Contact.
- Earlier shortlink/consent migrations present. **Action**: apply migrations before runtime (`npm run prisma:migrate:deploy` in apps/retail-api).
- Prisma checks: `npx prisma validate` / `npm run prisma:generate` (retail-api) pass.

## Backend Endpoints ↔ Frontend Hooks
- Offer: GET `/tracking/offer/:trackingId` (public) ↔ offer page; frontend route `/retail/o/[trackingId]`.
- Redeem: POST `/tracking/redeem-public/:trackingId` (public, rate-limited) ↔ frontend redeem page `/retail/tracking/redeem/[trackingId]`.
- Short resolve: GET `/public/s/:shortCode` (validate, increment, 302) ↔ frontend resolvers `/retail/s/[shortCode]` and `/s/[shortCode]`.
- Unsubscribe: POST `/unsubscribe/:token?` alias `/contacts/unsubscribe` (rate-limited, idempotent) ↔ frontend `/retail/unsubscribe/[token]` and legacy page; hooks accept string|null.
- Join (public signup): GET `/public/join/:token`, POST `/public/join/:token/submit`; frontend `/retail/join/[token]`; hooks use `enabled: !!token`, `retry: false`, no refetch on focus/reconnect; friendly 429 UI.
- Merchant links/branding: GET `/api/me/public-links`, POST `/api/me/public-links/rotate`, GET/PUT `/api/me/retail-branding`; frontend hooks usePublicLinks/useRotatePublicLinks; contacts modal surfaces joinUrl/QR/rotate.

## Route/Path Canonicalization
- Generated URLs: `/retail/o/:trackingId`, `/retail/unsubscribe/:token` (shortenable to `/retail/s/:code`), `/retail/s/:shortCode`, `/retail/join/:token`, `/retail/tracking/redeem/:trackingId`.
- Frontend routes exist for each; legacy `/s` also exists. No designed 404s for generated links.

## Rate Limits (public)
- Short: limiter via `createLimiter` (300/60s) per IP.
- Join view: per `ip:token` (300/60s), Retry-After + structured log; cache-control 30s.
- Join submit: per `ip:token` (60/60s), Retry-After + log.
- NFC: per `ip:token` (info 300/60s, submit 60/60s).
- 429 payload `{ message: 'Too many requests', code: 'RATE_LIMITED' }`.

## Tenant Safety
- OwnerId never accepted from client.  
- Offer/redeem scoped by trackingId → CampaignMessage owner.  
- Unsubscribe token decoded server-side; contact update scoped to storeId.  
- Join token (PublicLinkToken) resolves ownerId; Contact upsert uses ownerId+phone unique; consent evidence stored.  
- Short links redirect only; no data leakage.

## Frontend Types/Nullability
- Hooks accept `string | null`; no `undefined` passed.  
- useJoinInfo/useJoinSubmit: `enabled: !!token`, `retry: false`, no refetch on focus/reconnect, staleTime 60s.  
- Friendly 429 message on join page; no fetch loops.

## Checks & Scripts
- Prisma: `npx prisma validate`, `npm run prisma:generate` (PASS).  
- Typecheck (astronote-web): `npx tsc --noEmit` (PASS).  
- Lint: previously PASS with non-blocking warnings (console/img).  
- Script: `scripts/check-public-join.js` verifies presence of join route/backend mapping.

## Actions Before Live
- Apply DB migrations: `cd apps/retail-api && npm run prisma:migrate:deploy`.  
- Optionally rerun lint to address existing warnings.
