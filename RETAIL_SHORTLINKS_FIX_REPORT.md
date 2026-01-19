Retail Shortlinks Fix (Offer + Unsubscribe)
===========================================

Root cause
- SMS could still emit long `/unsubscribe/<token>` URLs and offer links based on trackingId instead of stored shortCodes. Public resolvers allowed fallbacks, so valid short codes sometimes 404ed or fell back incorrectly.

What changed
- Shortening enforcement (Retail send paths):
  - `apps/retail-api/apps/api/src/services/sms.service.js`: Unsubscribe links always shortened with metadata (`forceShort`, type/kind set, base astronote.onrender.com).
  - `apps/retail-api/apps/worker/src/sms.worker.js`: Offer and unsubscribe links shortened with `forceShort` and metadata for every send batch; idempotent cache retained; no long links appended.
  - `apps/retail-api/apps/api/src/services/campaignEnqueue.service.js`: Removed unused shortlink vars; trackingId kept only for downstream processing.
  - `apps/retail-api/apps/api/src/services/urlShortener.service.js`: Shortener base defaults to astronote.onrender.com; added `forceShort` to bypass length heuristic.
- Public resolvers (Retail):
  - `apps/retail-api/apps/api/src/routes/publicShort.routes.js`: Strict shortCode lookup → 302 to target; 404 if missing; no fallback to long tokens/tracking.
- Web redirectors (astronote.onrender.com):
  - `apps/astronote-web/app/o/[shortCode]/route.ts` and `app/s/[shortCode]/route.ts`: Call Retail `/public/o|s/:code` only; debug=1 JSON preserved; fallback to UTF-8-safe `/link-not-available`.
  - Added `/link-not-available` page for friendly fallback.

Verification commands (use real shortCodes from a fresh Retail SMS)
1) `curl -I "https://astronote.onrender.com/o/<code>"` → expect `302` with `Location` to the full offer target.
2) `curl -I "https://astronote.onrender.com/s/<code>"` → expect `302` with `Location` to the unsubscribe target.
3) Debug:
   - `curl -s "https://astronote.onrender.com/o/<code>?debug=1"` → JSON `final="redirected"`, attempts include retail `/public/o/:code`.
   - `curl -s "https://astronote.onrender.com/s/<code>?debug=1"` → JSON `final="redirected"`.
4) Invalid:
   - `curl -I "https://astronote.onrender.com/o/INVALID_123"` → 404 or redirect to `/link-not-available`.
   - `curl -I "https://astronote.onrender.com/s/INVALID_123"` → 404 or `/link-not-available`.
5) Fresh SMS content: must contain ONLY `.../o/<code>` and `.../s/<code>`; no `/unsubscribe/<token>`.

Checks run
- `npm -w @astronote/retail-api run lint`
- `npm -w @astronote/retail-api run build`
- `npm -w @astronote/web-next run lint`
- `npm -w @astronote/web-next run build`

Current status
- Code and builds are ready; live token verification still required to mark final PASS (obtain new shortCodes from a freshly sent retail SMS and run the curl checks above).

No commits made. Node version unchanged.
