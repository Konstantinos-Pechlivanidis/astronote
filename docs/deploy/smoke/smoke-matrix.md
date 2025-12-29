# Production Smoke Test Matrix

## Date
2025-01-23

## Overview
End-to-end smoke test plan for production deployment verification on Render.

**Production URLs:**
- WEB: `https://astronote.onrender.com`
- SHOPIFY_API: `https://astronote-shopify.onrender.com`
- RETAIL_API: `https://astronote-retail.onrender.com`

---

## Test Cases

### A) Web Landing Page

| Test Case | Endpoint/URL | Expected Result | How to Verify |
|-----------|--------------|-----------------|---------------|
| **A1: Marketing Landing** | `GET /` | HTML page loads (200 OK) | `curl https://astronote.onrender.com` or open in browser |
| **A2: React Router Works** | Navigate to `/retail/login` | Page loads without 404 | Browser navigation, check Network tab |
| **A3: Dark Mode Styles** | `GET /` | Dark mode CSS applied | Visual inspection, check computed styles |

**Verification:**
```bash
curl -I https://astronote.onrender.com
# Expected: HTTP/1.1 200 OK
# Content-Type: text/html
```

---

### B) Web Retail Area

| Test Case | Endpoint/URL | Expected Result | How to Verify |
|-----------|--------------|-----------------|---------------|
| **B1: Retail Login Page** | `GET /retail/login` | Login page renders (200 OK) | Browser: Navigate to URL, check page loads |
| **B2: Retail Dashboard** | `GET /retail/dashboard` | Dashboard page loads (requires auth) | After login, navigate to dashboard |
| **B3: Retail API Calls** | Browser DevTools Network | API calls go to `VITE_RETAIL_API_BASE_URL` | Check Network tab, verify base URL |

**Verification:**
```bash
# Check page loads (will redirect if not authenticated)
curl -I https://astronote.onrender.com/retail/login
# Expected: HTTP/1.1 200 OK
```

**Browser Verification:**
1. Open `https://astronote.onrender.com/retail/login`
2. Open DevTools → Network tab
3. Check API calls use `https://astronote-retail.onrender.com` as base URL

---

### C) Web Shopify Area

| Test Case | Endpoint/URL | Expected Result | How to Verify |
|-----------|--------------|-----------------|---------------|
| **C1: Shopify Login Page** | `GET /shopify/login` | Login page renders (200 OK) | Browser: Navigate to URL, check page loads |
| **C2: Shopify Dashboard** | `GET /shopify/dashboard` | Dashboard page loads (requires auth) | After login, navigate to dashboard |
| **C3: Shopify API Calls** | Browser DevTools Network | API calls go to `VITE_SHOPIFY_API_BASE_URL` | Check Network tab, verify base URL |

**Verification:**
```bash
# Check page loads (will redirect if not authenticated)
curl -I https://astronote.onrender.com/shopify/login
# Expected: HTTP/1.1 200 OK
```

**Browser Verification:**
1. Open `https://astronote.onrender.com/shopify/login`
2. Open DevTools → Network tab
3. Check API calls use `https://astronote-shopify.onrender.com` as base URL

---

### D) API Health Endpoints

| Test Case | Endpoint/URL | Expected Result | How to Verify |
|-----------|--------------|-----------------|---------------|
| **D1: Shopify API Basic Health** | `GET /health` | `{ "ok": true, "t": <timestamp> }` | `curl https://astronote-shopify.onrender.com/health` |
| **D2: Shopify API Full Health** | `GET /health/full` | `{ "ok": true, "checks": { "db": {...}, "redis": {...}, "queue": {...} } }` | `curl https://astronote-shopify.onrender.com/health/full` |
| **D3: Retail API Liveness** | `GET /healthz` | `{ "status": "ok" }` | `curl https://astronote-retail.onrender.com/healthz` |
| **D4: Retail API Readiness** | `GET /readiness` | `{ "status": "ready" }` (or error if DB down) | `curl https://astronote-retail.onrender.com/readiness` |
| **D5: Retail API DB Health** | `GET /health/db` | `{ "status": "ok", "database": "connected" }` | `curl https://astronote-retail.onrender.com/health/db` |

**Verification Commands:**
```bash
# Shopify API
curl https://astronote-shopify.onrender.com/health
curl https://astronote-shopify.onrender.com/health/full | jq '.checks'

# Retail API
curl https://astronote-retail.onrender.com/healthz
curl https://astronote-retail.onrender.com/readiness
curl https://astronote-retail.onrender.com/health/db
```

**Expected:**
- All endpoints return 200 OK
- Health checks show `status: "healthy"` or `status: "ok"`
- Database connectivity confirmed

---

### E) CORS Preflight

| Test Case | Endpoint/URL | Expected Result | How to Verify |
|-----------|--------------|-----------------|---------------|
| **E1: Shopify API CORS** | `OPTIONS /health` with `Origin: https://astronote.onrender.com` | `Access-Control-Allow-Origin: https://astronote.onrender.com` | `curl -X OPTIONS -H "Origin: https://astronote.onrender.com" -v https://astronote-shopify.onrender.com/health` |
| **E2: Retail API CORS** | `OPTIONS /healthz` with `Origin: https://astronote.onrender.com` | `Access-Control-Allow-Origin: https://astronote.onrender.com` | `curl -X OPTIONS -H "Origin: https://astronote.onrender.com" -v https://astronote-retail.onrender.com/healthz` |

**Verification:**
```bash
# Shopify API
curl -X OPTIONS \
  -H "Origin: https://astronote.onrender.com" \
  -H "Access-Control-Request-Method: GET" \
  -v https://astronote-shopify.onrender.com/health 2>&1 | grep -i "access-control"

# Retail API
curl -X OPTIONS \
  -H "Origin: https://astronote.onrender.com" \
  -H "Access-Control-Request-Method: GET" \
  -v https://astronote-retail.onrender.com/healthz 2>&1 | grep -i "access-control"
```

**Expected:**
- `Access-Control-Allow-Origin: https://astronote.onrender.com` in response headers
- `Access-Control-Allow-Methods` includes GET, POST, etc.
- `Access-Control-Allow-Credentials: true` (if applicable)

---

### F) Authentication (401 Behavior)

| Test Case | Endpoint/URL | Expected Result | How to Verify |
|-----------|--------------|-----------------|---------------|
| **F1: Shopify API Protected Route** | `GET /dashboard` (no token) | `401 Unauthorized` with JSON error | `curl https://astronote-shopify.onrender.com/dashboard` |
| **F2: Retail API Protected Route** | `GET /api/dashboard/kpis` (no token) | `401 Unauthorized` with JSON error | `curl https://astronote-retail.onrender.com/api/dashboard/kpis` |

**Verification:**
```bash
# Shopify API
curl https://astronote-shopify.onrender.com/dashboard
# Expected: {"success":false,"error":"unauthorized","message":"Authentication required"}

# Retail API
curl https://astronote-retail.onrender.com/api/dashboard/kpis
# Expected: {"error":"Unauthorized","message":"Authentication required"}
```

**Expected:**
- Status code: `401 Unauthorized`
- Response body: JSON error object
- No HTML redirect (API returns JSON)

---

### G) Dashboard Contract (Reports Embedded)

| Test Case | Endpoint/URL | Expected Result | How to Verify |
|-----------|--------------|-----------------|---------------|
| **G1: Shopify Dashboard** | `GET /dashboard` (with auth token) | Returns `{ "success": true, "data": { "credits": ..., "reports": { "last7Days": {...}, "topCampaigns": [...], ... } } }` | `curl -H "Authorization: Bearer <token>" https://astronote-shopify.onrender.com/dashboard` |
| **G2: Retail Dashboard** | `GET /api/dashboard/kpis` (with auth token) | Returns `{ "totalCampaigns": ..., "sent": ..., "delivered": ..., ... }` | `curl -H "Authorization: Bearer <token>" https://astronote-retail.onrender.com/api/dashboard/kpis` |

**Verification:**
```bash
# Shopify API (requires valid JWT token)
curl -H "Authorization: Bearer <token>" \
  https://astronote-shopify.onrender.com/dashboard | jq '.data.reports'

# Retail API (requires valid JWT token)
curl -H "Authorization: Bearer <token>" \
  https://astronote-retail.onrender.com/api/dashboard/kpis | jq '.'
```

**Expected:**
- Status code: `200 OK`
- Response includes reports data (Shopify) or KPIs (Retail)
- No separate `/reports` endpoint needed (reports embedded in dashboard)

---

### H) Segments Endpoint

| Test Case | Endpoint/URL | Expected Result | How to Verify |
|-----------|--------------|-----------------|---------------|
| **H1: Shopify Segments** | `GET /audiences/segments` (with auth token) | Returns `{ "success": true, "data": { "segments": [...], "total": <number> } }` with system segments (gender_male, gender_female, age_18_24, etc.) | `curl -H "Authorization: Bearer <token>" https://astronote-shopify.onrender.com/audiences/segments` |
| **H2: Retail Lists** | `GET /api/lists` (with auth token) | Returns lists/segments | `curl -H "Authorization: Bearer <token>" https://astronote-retail.onrender.com/api/lists` |

**Verification:**
```bash
# Shopify API (requires valid JWT token)
curl -H "Authorization: Bearer <token>" \
  https://astronote-shopify.onrender.com/audiences/segments | jq '.data.segments[] | {key, name, type}'

# Retail API (requires valid JWT token)
curl -H "Authorization: Bearer <token>" \
  https://astronote-retail.onrender.com/api/lists | jq '.'
```

**Expected:**
- Status code: `200 OK`
- Shopify: System segments include `gender_male`, `gender_female`, `age_18_24`, etc.
- Segments have `type: "system"` or `type: "custom"`

---

### I) Campaign Create → Enqueue (Safe Mode)

| Test Case | Endpoint/URL | Expected Result | How to Verify |
|-----------|--------------|-----------------|---------------|
| **I1: Create Campaign** | `POST /campaigns` (with auth token, safe test data) | Returns `{ "success": true, "data": { "id": "...", "status": "draft", ... } }` | `curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"name":"Test","message":"Test","audience":{"type":"all"}}' https://astronote-shopify.onrender.com/campaigns` |
| **I2: Enqueue Campaign** | `POST /campaigns/:id/enqueue` (with auth token, idempotency key) | Returns `{ "success": true, "data": { "id": "...", "status": "queued", ... } }` | `curl -X POST -H "Authorization: Bearer <token>" -H "Idempotency-Key: test-$(date +%s)" https://astronote-shopify.onrender.com/campaigns/<id>/enqueue` |

**Verification (SAFE MODE - Use test data):**
```bash
# 1. Create campaign (draft, no sending)
TOKEN="<your_jwt_token>"
IDEMPOTENCY_KEY="smoke-test-$(date +%s)"

# Create campaign
RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "name": "Smoke Test Campaign",
    "message": "Test message - do not send",
    "audience": { "type": "all" },
    "scheduleType": "immediate"
  }' \
  https://astronote-shopify.onrender.com/campaigns)

CAMPAIGN_ID=$(echo $RESPONSE | jq -r '.data.id')
echo "Created campaign: $CAMPAIGN_ID"

# 2. Enqueue campaign (will queue but not send if no contacts)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: enqueue-$IDEMPOTENCY_KEY" \
  https://astronote-shopify.onrender.com/campaigns/$CAMPAIGN_ID/enqueue
```

**Expected:**
- Campaign created with `status: "draft"`
- Enqueue returns `status: "queued"` or `status: "sending"`
- No actual SMS sent (safe test data)

**Note:** Use test shop with no real contacts to prevent accidental sends.

---

### J) Shortener Redirect

| Test Case | Endpoint/URL | Expected Result | How to Verify |
|-----------|--------------|-----------------|---------------|
| **J1: Short Link Redirect** | `GET /r/:token` (public, no auth) | `302 Found` redirect to destination URL, click count incremented | `curl -I -L https://astronote-shopify.onrender.com/r/<test_token>` |
| **J2: Click Tracking** | Check database/logs | Click count incremented for short link | Verify in database or logs after redirect |

**Verification:**
```bash
# First, create a test short link (requires auth token)
TOKEN="<your_jwt_token>"
SHORT_LINK=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"destinationUrl": "https://example.com"}' \
  https://astronote-shopify.onrender.com/short-links)

TOKEN_FROM_RESPONSE=$(echo $SHORT_LINK | jq -r '.data.token')
SHORT_URL=$(echo $SHORT_LINK | jq -r '.data.shortUrl')

# Test redirect (follow redirects)
curl -I -L "$SHORT_URL" 2>&1 | head -20

# Or just check redirect header
curl -I "$SHORT_URL" 2>&1 | grep -i "location\|302"
```

**Expected:**
- Status code: `302 Found`
- `Location` header points to destination URL
- Click count incremented in database

---

### K) Worker Queue Processing

| Test Case | Endpoint/URL | Expected Result | How to Verify |
|-----------|--------------|-----------------|---------------|
| **K1: Queue Health** | `GET /api/jobs/health` (retail-api, with auth token) | Returns queue stats | `curl -H "Authorization: Bearer <token>" https://astronote-retail.onrender.com/api/jobs/health` |
| **K2: Worker Logs** | Render logs for retail-worker service | Shows jobs being processed, no errors | Check Render dashboard logs |
| **K3: Queue Stats** | `GET /campaigns/queue/stats` (shopify-api, with auth token) | Returns queue statistics | `curl -H "Authorization: Bearer <token>" https://astronote-shopify.onrender.com/campaigns/queue/stats` |

**Verification:**
```bash
# Retail API queue health
curl -H "Authorization: Bearer <token>" \
  https://astronote-retail.onrender.com/api/jobs/health | jq '.'

# Shopify API queue stats
curl -H "Authorization: Bearer <token>" \
  https://astronote-shopify.onrender.com/campaigns/queue/stats | jq '.'
```

**Expected:**
- Queue health endpoint returns stats
- Worker logs show processing (check Render dashboard)
- No errors in worker logs

---

## Test Execution Order

1. **Health Checks (D1-D5)** - Verify services are running
2. **CORS (E1-E2)** - Verify frontend can call APIs
3. **Web Pages (A1-A3, B1-B3, C1-C3)** - Verify frontend loads
4. **Auth (F1-F2)** - Verify protected routes require auth
5. **Dashboard (G1-G2)** - Verify dashboard data structure
6. **Segments (H1-H2)** - Verify system segments exist
7. **Campaign (I1-I2)** - Safe test campaign creation
8. **Shortener (J1-J2)** - Test redirect functionality
9. **Worker (K1-K3)** - Verify queue processing

---

## Success Criteria

**All tests must pass:**
- ✅ Health endpoints return 200 OK
- ✅ CORS allows frontend origin
- ✅ Web pages load without errors
- ✅ Protected routes return 401 without token
- ✅ Dashboard returns expected data structure
- ✅ Segments endpoint returns system segments
- ✅ Campaign creation works (safe mode)
- ✅ Shortener redirect works (302)
- ✅ Worker processes jobs (log confirmation)

---

## Failure Scenarios

### If Health Checks Fail
- Check service is running in Render
- Check environment variables are set
- Check database/Redis connectivity

### If CORS Fails
- Verify `CORS_ALLOWLIST` includes `https://astronote.onrender.com`
- Check CORS middleware is applied

### If Dashboard Fails
- Verify auth token is valid
- Check database has data
- Verify reports data is embedded (not separate endpoint)

### If Worker Fails
- Check worker service is running
- Verify Redis connection
- Check queue configuration

---

## Notes

- **Safe Mode:** Campaign tests use test data to prevent accidental SMS sends
- **Auth Tokens:** Required for protected endpoints (get from login flow)
- **Idempotency:** Use idempotency keys for campaign operations
- **Logs:** Check Render dashboard logs for worker confirmation

