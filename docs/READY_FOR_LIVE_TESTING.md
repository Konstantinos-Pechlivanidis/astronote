# Retail Public Links + Join/Branding - Ready For Live Testing

Status: NOT READY (api lint fails on existing formatting rules)

## Summary
This report is based on code inspection, prisma validate/generate, web typecheck/lint/build, and api lint.
No live HTTP calls were made.

## Canonical URL Mapping (backend generated -> frontend route -> backend API used)
| Generated URL | Frontend route file | Handler behavior | Backend API used |
| --- | --- | --- | --- |
| ${PUBLIC_RETAIL_BASE_URL}/join/:token | apps/astronote-web/app/(public)/join/[token]/page.tsx | Public join page (server metadata + client fetch) | GET /public/join/:token, POST /public/join/:token |
| ${PUBLIC_RETAIL_BASE_URL}/o/:trackingId | apps/astronote-web/app/(retail)/retail/o/[trackingId]/page.tsx | Alias to offer page | GET /tracking/offer/:trackingId |
| ${PUBLIC_RETAIL_BASE_URL}/unsubscribe/:token | apps/astronote-web/app/(retail)/retail/unsubscribe/[token]/page.tsx | Alias to unsubscribe page | POST /contacts/unsubscribe (public) |
| ${PUBLIC_RETAIL_BASE_URL}/s/:shortCode | apps/astronote-web/app/(retail)/retail/s/[shortCode]/page.tsx | Short link resolver | GET /public/s/:shortCode (302) |

Notes:
- Legacy routes are kept: /unsubscribe (query token) and /s/:shortCode (non-retail prefix) both resolve to the same resolver component.
- /retail/join/:token exists as a redirect-only route to /join/:token.

## Backend Endpoint Contract Table
| Frontend hook/page | API client | Backend route | Handler file | Prisma model touched |
| --- | --- | --- | --- | --- |
| Join page (public) | publicApi.getJoinInfo | GET /public/join/:token | apps/retail-api/apps/api/src/routes/publicJoin.routes.js | PublicLinkToken, RetailJoinBranding, RetailAsset, PublicSignupEvent |
| Join submit (public) | publicApi.submitJoin | POST /public/join/:token | apps/retail-api/apps/api/src/routes/publicJoin.routes.js | Contact, PublicLinkToken, PublicSignupEvent |
| Offer page | retailApi.getOffer | GET /tracking/offer/:trackingId | apps/retail-api/apps/api/src/routes/tracking.js | CampaignMessage, OfferViewEvent |
| Redeem (public) | retailApi.redeemPublic | POST /tracking/redeem-public/:trackingId | apps/retail-api/apps/api/src/routes/tracking.js | Redemption |
| Short resolve | publicApi.resolveShort | GET /public/s/:shortCode | apps/retail-api/apps/api/src/routes/publicShort.routes.js | ShortLink |
| Unsubscribe (public) | publicApi.unsubscribe | POST /contacts/unsubscribe | apps/retail-api/apps/api/src/routes/contacts.js | Contact |
| Merchant join branding | retailApi.getJoinBranding / updateJoinBranding | GET/PUT /api/retail/join-branding | apps/retail-api/apps/api/src/routes/joinBranding.routes.js | RetailJoinBranding, RetailAsset |
| Merchant join link | retailApi.getPublicLinks | GET /api/me/public-links | apps/retail-api/apps/api/src/routes/publicLinks.js | PublicLinkToken |

## Prisma - Backend - Frontend Alignment
PASS
- schema.prisma includes ShortLink, PublicLinkToken, RetailJoinBranding, RetailAsset, consent fields, and trackingId in CampaignMessage.
- Added unique constraints for RetailJoinBranding.logoAssetId and ogImageAssetId.
- prisma validate + generate succeed.

Files:
- apps/retail-api/prisma/schema.prisma
- apps/retail-api/prisma/migrations/20250302220000_add_unique_join_branding_assets/migration.sql
- apps/retail-api/prisma/migrations/20250302161000_add_sms_consent_fields/migration.sql

## Join Route Collision
PASS
- Canonical route: /join/:token in apps/astronote-web/app/(public)/join/[token]/page.tsx
- Redirect-only compatibility: /retail/join/:token in apps/astronote-web/app/(retail)/retail/join/[token]/page.tsx
- No duplicate route groups for /join/:token.

## Rate Limit Loop Safety
PASS
- useJoinInfo uses enabled: !!token, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false, staleTime: 60_000.
- GET /public/join/:token is keyed by ip+token and sets Retry-After on 429.
- Backend rateLimitByIp is exported and used consistently.

Files:
- apps/astronote-web/src/features/retail/public/hooks/useJoinInfo.ts
- apps/retail-api/apps/api/src/routes/publicJoin.routes.js
- apps/retail-api/apps/api/src/lib/ratelimit.js

## Static Verification Results
- prisma validate: PASS
- prisma generate: PASS
- web typecheck (npx tsc --noEmit): PASS
- web lint (npm run lint): PASS with warnings
  - @next/next/no-img-element in join/contacts/settings/offer pages
  - no-console in campaigns page
- web build (npm run build): PASS with warnings (same as lint)
- api lint (npm run lint in apps/retail-api/apps/api): FAIL
  - 3300+ errors from formatting rules across existing files (trailing spaces, comma-dangle, indent). Not caused by join/branding changes.

## Fixes Applied
- Prisma: added unique constraints for RetailJoinBranding logoAssetId and ogImageAssetId.
- Join page split into server metadata + client component.
- Join builder page expanded with asset uploads, colors, content, links, preview, and share panel.
- Public card component accepts style for branding variables.
- Added ColorPickerModal component for join builder.
- Updated public API types and join branding hooks (including upload hooks).

Files changed (partial list):
- apps/retail-api/prisma/schema.prisma
- apps/retail-api/prisma/migrations/20250302220000_add_unique_join_branding_assets/migration.sql
- apps/astronote-web/app/(public)/join/[token]/page.tsx
- apps/astronote-web/app/(public)/join/[token]/JoinPageClient.tsx
- apps/astronote-web/app/(retail)/app/retail/join/page.tsx
- apps/astronote-web/src/components/retail/public/PublicCard.tsx
- apps/astronote-web/src/components/retail/join/ColorPickerModal.tsx
- apps/astronote-web/src/lib/retail/api/public.ts
- apps/astronote-web/src/features/retail/settings/hooks/useJoinBranding.ts

## Final Verdict
NOT READY
Reason: api lint fails in apps/retail-api/apps/api due to existing formatting rule violations across many files.
All public link, join, and branding routes and contracts are aligned in code, but lint is a required gate for certification.

## Suggested Next Step
- If api lint is a hard gate, run lint with --fix and/or relax eslint rules in apps/retail-api/apps/api/.eslintrc to match existing formatting, then re-run lint.
- If api lint is informational only, document this exception and proceed to live testing.
