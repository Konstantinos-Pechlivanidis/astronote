Retail Unsubscribe Fix (Retail only)
====================================

Root cause
- SMS still contained long `/unsubscribe/<jwt>` links (worker fallback), and the web had no public handler for those long tokens, so clicks landed on “Not Found”.
- Short unsubscribe links `/s/<code>` resolved strictly via ShortLink, but older messages never created short codes.

Changes made
- Web: Added public handler for long tokens so already-sent SMS unsubscribe links work:
  - `apps/astronote-web/app/unsubscribe/[token]/route.ts` calls Retail `/api/unsubscribe` (no auth) and redirects to `/unsubscribed` or `/link-not-available`.
  - Removed conflicting legacy page and added a lightweight fallback page at `app/(retail)/retail/unsubscribe/[token]/page.tsx` to prevent build collisions.
- Worker enforcement (previously in place, kept): Unsubscribe shortening uses `forceShort` and metadata; offer links unchanged.
- Shortener base defaults to `https://astronote.onrender.com`; public resolvers are strict 302/404 only (no fallback).

Verification (builds)
- `npm -w @astronote/retail-api run lint` (PASS)
- `npm -w @astronote/retail-api run build` (PASS)
- `npm -w @astronote/web-next run lint` (PASS)
- `npm -w @astronote/web-next run build` (PASS)

How to verify live (requires real tokens)
1) Old long link (already sent SMS):
   - `curl -i "https://astronote.onrender.com/unsubscribe/<REAL_JWT_TOKEN>"` → expect 200 or 302 to `/unsubscribed` (no 404).
2) New SMS (send 1 retail SMS now):
   - SMS should contain only `https://astronote.onrender.com/s/<code>` (no `/unsubscribe/`).
   - `curl -I "https://astronote.onrender.com/s/<code>"` → expect 302 + Location.
   - `curl -i "https://astronote.onrender.com/s/<code>?debug=1"` → JSON with final="redirected".
3) Invalid code: `curl -I "https://astronote.onrender.com/s/INVALID_123"` → 404 or `/link-not-available`.

Files changed
- `apps/astronote-web/app/unsubscribe/[token]/route.ts`
- `apps/astronote-web/app/(retail)/retail/unsubscribe/[token]/page.tsx`
(Worker and shortener enforcement were already in place from earlier fixes.)

Notes
- No commits made; Node version unchanged.
- Live token evidence still needed to mark final PASS (execute the curl checks above with real tokens).***
