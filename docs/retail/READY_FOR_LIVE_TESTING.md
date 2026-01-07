# Retail Public Flows – Ready for Live Testing

Status: **READY** (static/compile verification)

## Checklist
- **Routes (frontend)**: PASS  
  - `/retail/o/[trackingId]` (offer page alias), `/retail/s/[shortCode]` and `/s/[shortCode]` (resolver + redirect), `/retail/unsubscribe/[token]` (path param alias), `/retail/join/[token]` (public signup). Params normalized to `string | null`.
- **APIs (backend)**: PASS  
  - Offer: GET `/tracking/offer/:trackingId` (public).  
  - Short resolver: GET `/public/s/:shortCode` (validates, increments, 302).  
  - Unsubscribe: POST `/contacts/unsubscribe` + alias `/unsubscribe/:token?` (rate-limited, idempotent).  
  - Join: GET `/public/join/:token`, POST `/public/join/:token/submit` (implicit opt-in, owner derived from token, rate-limited).  
  - Merchant links/branding: `/api/me/public-links`, `/api/me/public-links/rotate`, `/api/me/retail-branding`. Mounted in server.js.
- **Prisma/DB contract**: PASS  
  - Models present: ShortLink, PublicLinkToken (token unique, owner scoped), RetailBranding, PublicSignupEvent, Contact consent fields, CampaignMessage/Redemption unchanged.  
  - Uniques/indexes: Contact `@@unique([ownerId, phone])`, ShortLink shortCode unique, PublicLinkToken token unique, Redemption PK=messageId.  
  - `npx prisma validate` + `npm run prisma:generate` (retail-api) succeed.  
  - Pending migrations applied in codebase: `20250302160000_public_link_and_branding` (plus earlier consent/shortlink migrations) – **run migrate deploy before live**.
- **Contracts (frontend↔backend)**: PASS  
  - API client types match JSON shapes for offer, short resolve, unsubscribe, join info/submit, public links/branding.  
  - Hooks accept `string | null` params; no `undefined` TS errors.  
  - Join info returns branding + defaults, submit returns `{ok,status,contactId,phone}`.
- **Security/tenant isolation**: PASS  
  - Public ownerId is never client-provided.  
  - Join token → ownerId lookup only; Contact upsert uses that ownerId; consent evidence stored.  
  - Unsubscribe token verified server-side; short/offer/track use unique ids; no cross-owner payloads.
- **Static quality gates**: PASS  
  - Typecheck web: `npx tsc --noEmit` ✅  
  - Prisma validate/generate: ✅  
  - Lint web: passes with existing non-blocking warnings (console/img).  
  - Backend/worker JS (no TS) – no type gate.  
  - No automated tests were added; flows verified via static/compile checks.

## Generated URL → Frontend Route
| Generated URL | Route File | Behavior |
| --- | --- | --- |
| `/retail/o/:trackingId` | `app/(retail)/retail/o/[trackingId]/page.tsx` | Renders offer via existing offer page |
| `/retail/s/:shortCode` and `/s/:shortCode` | `app/(retail)/retail/s/[shortCode]/page.tsx`, `app/(retail)/s/[shortCode]/page.tsx` | Resolves via backend `/public/s`, redirects |
| `/retail/unsubscribe/:token` | `app/(retail)/retail/unsubscribe/[token]/page.tsx` | Unsubscribe flow (alias of main page) |
| `/retail/join/:token` | `app/(retail)/join/[token]/page.tsx` | Public signup (implicit opt-in) |

## Frontend Hook → Backend Route Mapping
| Hook / Client | Backend Route | Service/Model |
| --- | --- | --- |
| useOffer | GET `/tracking/offer/:trackingId` | CampaignMessage lookup |
| ShortLinkResolver | GET `/public/s/:shortCode` | ShortLink find/update |
| Unsubscribe (path alias) | POST `/unsubscribe` (alias `/contacts/unsubscribe`) | Contact token verify/update |
| useJoinInfo | GET `/public/join/:token` | PublicLinkToken + RetailBranding |
| useJoinSubmit | POST `/public/join/:token/submit` | Contact upsert (owner from token), PublicSignupEvent |
| usePublicLinks | GET `/api/me/public-links` | PublicLinkToken ensure |
| useRotatePublicLinks | POST `/api/me/public-links/rotate` | PublicLinkToken rotate |
| Branding fetch/save | GET/PUT `/api/me/retail-branding` | RetailBranding upsert |

## Remaining Risks
- Lint warnings (console in campaign page, `<img>` warning in offer/join) are non-blocking; keep or clean later.
- Ensure migrations are applied in target DB before live tests.

## How to Live Test (manual)
1. Send a campaign to your phone; open offer link `/retail/o/{id}` → offer page loads.  
2. Click unsubscribe link `/retail/unsubscribe/{token}` (or short `/s/{code}`) → success/confirmation screen.  
3. Open the short link `/retail/s/{code}` directly → resolves/redirects correctly.  
4. From merchant UI Contacts, open “NFC / Share link” modal → copy/open link works, QR renders, rotate regenerates.  
5. Open join link `/retail/join/{token}` on mobile → submit first name + phone (+30 default/persist) → contact is created/upserted (opted in).  
6. (Optional) Verify branding fields in join page reflect merchant branding settings, and Astronote footer is visible.
