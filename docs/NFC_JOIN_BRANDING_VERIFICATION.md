# NFC Join + Branding Verification (Code-Only)

## ✅ Prisma / Schema Alignment
- **Contact consent fields present**: `smsConsentStatus`, `smsConsentAt`, `smsConsentSource`, `gdprConsentAt`, `gdprConsentSource`, `gdprConsentVersion`, `consentEvidence` in `apps/retail-api/prisma/schema.prisma` (Contact model).  
  - Unique constraint: `@@unique([ownerId, phone])` (owner‑scoped E.164).
- **Branding model**: `RetailBranding` exists and includes logo/colors/headline/subheadline/benefits/incentive/legal + `merchantBlurb` in `apps/retail-api/prisma/schema.prisma`.  
  - Migration: `apps/retail-api/prisma/migrations/20250302191000_add_merchant_blurb_to_retail_branding/migration.sql`.
- **Public join token model**: `PublicLinkToken` exists with owner scope, `isActive`, `rotationEnabled`.

⚠️ **Spec mismatch**: No separate `RetailJoinBranding` model. Join branding is stored in `RetailBranding` instead.  
If you must keep a distinct model name, add an alias model or migrate to `RetailJoinBranding` (TODO).

## ✅ Backend Routes / DTOs
- **Public join endpoint**: `GET /public/join/:token` and `POST /public/join/:token` in  
  `apps/retail-api/apps/api/src/routes/publicJoin.routes.js`  
  - Includes `branding` payload (logo/colors/headline/subheadline/benefits/incentive/legal/privacy/merchantBlurb).
  - Rate limiting uses `createLimiter` (no `rateLimitByIp` crash).
- **Join branding endpoints (auth)**:  
  `GET /api/retail/join-branding` and `PUT /api/retail/join-branding` in  
  `apps/retail-api/apps/api/src/routes/joinBranding.routes.js`  
  - Validates hex colors and logo URL format, caps merchantBlurb length.
- **Route registration**:  
  `apps/retail-api/apps/api/src/server.js` mounts join branding and public join routes.

## ✅ Frontend Routes / UI
- **Canonical public join route**:  
  `apps/astronote-web/app/(public)/join/[token]/page.tsx`  
  - English default, Greek toggle persisted via `join_language`.
  - Text inputs use `text-foreground placeholder:text-muted-foreground caret-foreground` for readability.
  - Branding colors applied via CSS vars (`--brand-primary`, `--brand-accent`).
- **No duplicate /join**: retail route removed; `/retail/join/[token]` redirects to `/join/[token]`.
- **Admin navigation**:  
  `apps/astronote-web/src/components/retail/RetailShell.tsx` includes “NFC / Join Page” -> `/app/retail/nfc`.
- **Admin NFC/Join page**:  
  `apps/astronote-web/app/(retail)/app/retail/nfc/page.tsx` (alias)  
  `apps/astronote-web/app/(retail)/app/retail/join/page.tsx`  
  - Copy link, QR, open link actions + branding editor with preview.
- **Rotate UI hidden**:  
  `NEXT_PUBLIC_JOIN_ROTATE_UI` gate in `apps/astronote-web/app/(retail)/app/retail/contacts/page.tsx`.

## ✅ Frontend ↔ Backend DTO Consistency
- `JoinInfoResponse` includes `merchantBlurb`, `subheadline`, `incentiveText`, `legalText` in  
  `apps/astronote-web/src/lib/retail/api/public.ts`.
- Public join hook uses `token: string | null` (no `string|undefined` leak):
  - `apps/astronote-web/src/features/retail/public/hooks/useJoinInfo.ts`
  - `apps/astronote-web/src/features/retail/public/hooks/useJoinSubmit.ts`

## ✅ Rate‑Limit / Retry Safety
- Join public endpoints: per ip+token limiter in  
  `apps/retail-api/apps/api/src/routes/publicJoin.routes.js`.
- Client does not retry on 429/404:
  `apps/astronote-web/src/features/retail/public/hooks/useJoinInfo.ts` (`retry: false`).

## ⚠️ Remaining TODO (if strict spec requires)
- **RetailJoinBranding model**: not present. Current implementation uses `RetailBranding` for join UI.  
  If you require a dedicated model, add it and adapt join payload accordingly.

## Files to Review (quick links)
- Prisma: `apps/retail-api/prisma/schema.prisma`
- Public join endpoint: `apps/retail-api/apps/api/src/routes/publicJoin.routes.js`
- Join branding endpoint: `apps/retail-api/apps/api/src/routes/joinBranding.routes.js`
- Join page (public): `apps/astronote-web/app/(public)/join/[token]/page.tsx`
- Join page (admin): `apps/astronote-web/app/(retail)/app/retail/join/page.tsx`
- Nav: `apps/astronote-web/src/components/retail/RetailShell.tsx`
