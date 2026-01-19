Retail Public Links Live Verification (Claim Offer + Unsubscribe)
================================================================

Env checks (expected)
- WEB (astronote-web): `NEXT_PUBLIC_RETAIL_API_BASE_URL=https://astronote-retail.onrender.com`, `RETAIL_API_BASE_URL=https://astronote-retail.onrender.com` (no `/api`, no trailing slash).
- RETAIL API: `PUBLIC_WEB_BASE_URL=https://astronote.onrender.com` (no `/api`, no trailing slash).
- Note: live env values not directly readable here; ensure they match above when deploying.

API public routes (live curl)
- `curl -i https://astronote-retail.onrender.com/public/o/doesnotexist` → 404 JSON `{"message":"Short link not found","code":"NOT_FOUND"}` (PASS).
- `curl -i https://astronote-retail.onrender.com/public/s/doesnotexist` → 404 JSON `{"message":"Short link not found","code":"NOT_FOUND"}` (PASS).
- `curl -i https://astronote-retail.onrender.com/api/public/o/doesnotexist` → 404 JSON `{"message":"Endpoint not found","code":"RESOURCE_NOT_FOUND"}` (route not mounted under /api) (PASS). Same for `/api/public/s/...`.

Web resolver debug (manual instructions)
- Open `https://astronote.onrender.com/o/doesnotexist?debug=1` and `https://astronote.onrender.com/s/doesnotexist?debug=1`.
  - Expect debug JSON with base `https://astronote-retail.onrender.com`, status 404 from API, and fallback to `/link-not-available`.
- Open `https://astronote.onrender.com/link-not-available` to confirm branded PublicLayout/CTA.

Shortener behavior
- Backend shortener builds URLs on `PUBLIC_WEB_BASE_URL` (strips `/api`); offer/unsubscribe builders require ownerId and log `shortlink_fallback_used:*` if falling back to long public URLs.

Tenant safety
- Unsubscribe tokens remain HMAC-signed with storeId (ownerId) + contactId; public resolver uses stored targetUrl, and unsubscribe API enforces token ownership.

Real SMS flow (pending live run)
- Send a test SMS (campaign/automation/manual) and confirm body contains:
  - `Claim Offer: https://astronote.onrender.com/o/<code>`
  - `To unsubscribe, tap: https://astronote.onrender.com/s/<code>`
  - Both links resolve without Not Found; unsubscribe completes for the correct tenant.

Log/metric check (to do on prod)
- Inspect retail API logs for `shortlink_fallback_used:*` and resolver warnings about stripping `/api`. If present, verify fallback URLs point to `https://astronote.onrender.com/retail/tracking/offer/<trackingId>` or `/retail/unsubscribe/<token>` and are reachable.
