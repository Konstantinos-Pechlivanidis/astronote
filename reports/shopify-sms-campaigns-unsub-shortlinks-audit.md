# Shopify SMS Campaigns, Unsubscribe & Short Links Audit Report

**Date:** 2025-01-27  
**Scope:** SMS Campaigns, Unsubscribe Flow, Short Links  
**Reference:** `apps/retail-api` (canonical) vs `apps/shopify-api` (target)  
**Frontend:** `apps/astronote-web/app/retail` (reference) vs `apps/astronote-web/app/app/shopify` (target)

---

## Executive Summary

This audit compares Shopify SMS functionality with the proven Retail implementation. Key findings:

- ✅ **Campaigns:** Shopify has good implementation but some response shape differences
- ✅ **Unsubscribe:** Backend correctly implemented, frontend page missing
- ✅ **Short Links:** Backend correctly implemented, matches Retail pattern
- ⚠️ **Status Machine:** Minor differences in field names (sent vs totalSent)
- ⚠️ **Frontend Pages:** Missing public unsubscribe page for Shopify

---

## Retail Canonical Contract

### Prisma Models

**Campaign:**
- `id` (Int, autoincrement)
- `ownerId` (Int) - Tenant scope
- `name` (String)
- `messageText` (String, Text) - Required message text
- `status` (CampaignStatus: draft/scheduled/sending/sent/failed)
- `scheduledAt` (DateTime?)
- `startedAt` (DateTime?)
- `finishedAt` (DateTime?)
- `total` (Int) - Total recipients
- `sent` (Int) - Actually sent
- `failed` (Int) - Failed
- `processed` (Int?) - Processed = sent + failed
- `conversions` (Int)

**CampaignMessage (Retail):**
- `id` (Int)
- `ownerId` (Int) - Tenant scope
- `campaignId` (Int)
- `contactId` (Int)
- `to` (String) - Phone number
- `text` (String, Text) - Full message text
- `trackingId` (String, unique) - Unique tracking ID
- `status` (MessageStatus: queued/processing/sent/failed)
- `providerMessageId` (String?)
- `bulkId` (String?) - Bulk SMS batch ID
- `deliveryStatus` (String?)
- `deliveredAt` (DateTime?)
- `billingStatus` (BillingStatus: pending/paid/failed)

**CampaignRecipient (Shopify equivalent):**
- Similar structure but uses `String` IDs (cuid)
- `status` (String) instead of enum
- `deliveryStatus` (String?)

**ShortLink:**
- `id` (Int)
- `shortCode` (String, unique)
- `kind` (String?) - unsubscribe, offer, etc.
- `targetUrl` (String, Text)
- `originalUrl` (String, Text)
- `ownerId` (Int?)
- `campaignId` (Int?)
- `clickCount` (Int)
- `lastClickedAt` (DateTime?)

### Backend Endpoints

#### Campaigns

**POST /api/campaigns** (protected)
- **Request:**
  ```json
  {
    "name": "Campaign Name",
    "messageText": "Message content",
    "filterGender": "male" | "female" | "other" | "prefer_not_to_say" | null,
    "filterAgeGroup": "18_24" | "25_39" | "40_plus" | null,
    "scheduledAt": "ISO date" | null,
    "scheduledDate": "YYYY-MM-DD",
    "scheduledTime": "HH:mm"
  }
  ```
- **Response:** `201` Campaign object
- **Status:** `draft` (default) or `scheduled` (if scheduledAt provided)

**GET /api/campaigns** (protected)
- **Query:** `page=1&pageSize=20`
- **Response:**
  ```json
  {
    "items": [Campaign...],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
  ```

**GET /api/campaigns/:id** (protected)
- **Response:** Campaign object with full details

**POST /api/campaigns/:id/enqueue** (protected)
- **Request:** No body
- **Response:**
  ```json
  {
    "ok": true,
    "queued": 1000,
    "enqueuedJobs": 1000,
    "campaignId": 123
  }
  ```
- **Error Codes:**
  - `INVALID_STATUS` (409) - Campaign not in draft/scheduled/paused
  - `NO_RECIPIENTS` (400) - No eligible recipients
  - `ALREADY_SENDING` (409) - Campaign already sending
  - `INSUFFICIENT_CREDITS` (402) - Not enough credits
  - `INACTIVE_SUBSCRIPTION` (402) - Subscription required
  - `QUEUE_UNAVAILABLE` (503) - Queue system unavailable

**PUT /api/campaigns/:id/schedule** (protected)
- **Request:**
  ```json
  {
    "scheduledAt": "ISO date",
    "scheduledDate": "YYYY-MM-DD",
    "scheduledTime": "HH:mm"
  }
  ```
- **Response:** Updated campaign

**Status Machine:**
- `draft` → `scheduled` (when scheduledAt set)
- `draft`/`scheduled`/`paused` → `sending` (when enqueued)
- `sending` → `sent` (when all messages sent)
- `sending` → `failed` (on error)
- `sending` → `cancelled` (manual cancel)

#### Unsubscribe (Public)

**POST /api/contacts/unsubscribe** (public)
- **Request:**
  ```json
  {
    "token": "<unsubscribe token>"
  }
  ```
  OR token in URL: `/api/contacts/unsubscribe/:token`
- **Response:**
  ```json
  {
    "ok": true,
    "status": "unsubscribed" | "already_unsubscribed",
    "message": "You are now unsubscribed...",
    "storeName": "Store Name"
  }
  ```
- **Security:** Token encodes `contactId` + `storeId` (tenant-safe)
- **Idempotent:** Returns success even if already unsubscribed

**Token Format:**
- HMAC-signed token with payload: `{contactId, storeId, timestamp}`
- Expires after 30 days
- Frontend route: `/unsubscribe/:token`

#### Short Links (Public)

**GET /public/s/:shortCode** (public)
- **Response:** `302` redirect to `targetUrl`
- **Side Effects:**
  - Increments `clickCount`
  - Updates `lastClickedAt`
- **Rate Limited:** 300 requests/minute per IP

---

## Shopify Current Implementation

### Prisma Models

**Campaign:**
- ✅ `id` (String, cuid) - Different from Retail (Int)
- ✅ `shopId` (String) - Tenant scope (equivalent to ownerId)
- ✅ `name` (String)
- ✅ `message` (String) - Message text (equivalent to messageText)
- ✅ `status` (CampaignStatus enum) - Same values
- ✅ `scheduleAt` (DateTime?) - Note: `scheduleAt` vs Retail `scheduledAt`
- ⚠️ `audience` (String) - Different from Retail (uses filters)
- ✅ `createdAt`, `updatedAt`

**CampaignRecipient:**
- ✅ `id` (String, cuid)
- ✅ `campaignId` (String)
- ✅ `contactId` (String?)
- ✅ `phoneE164` (String)
- ✅ `status` (String) - pending/sent/failed
- ✅ `mittoMessageId` (String?) - Provider message ID
- ✅ `bulkId` (String?) - Bulk SMS batch ID
- ✅ `deliveryStatus` (String?) - Delivery status
- ✅ `sentAt`, `deliveredAt` (DateTime?)
- ✅ `@@unique([campaignId, phoneE164])` - Prevents duplicates

**CampaignMetrics:**
- ✅ `campaignId` (String, unique)
- ✅ `totalSent` (Int) - Actually sent
- ✅ `totalDelivered` (Int)
- ✅ `totalFailed` (Int)
- ✅ `totalProcessed` (Int) - Processed = sent + failed
- ✅ `totalClicked` (Int)
- ⚠️ **Gap:** Campaign model doesn't have `sent`/`failed`/`processed` fields directly (uses metrics)

**ShortLink:**
- ✅ `id` (String, cuid)
- ✅ `token` (String, unique) - Equivalent to shortCode
- ✅ `destinationUrl` (String, Text)
- ✅ `shopId` (String?) - Tenant scope
- ✅ `campaignId` (String?)
- ✅ `clicks` (Int) - Equivalent to clickCount
- ✅ `lastClickedAt` (DateTime?)
- ✅ `expiresAt` (DateTime?)

### Backend Endpoints

#### Campaigns

**POST /api/campaigns** (protected)
- ✅ Exists
- ✅ Uses `resolveStore` + `requireStore` middleware
- ⚠️ **Gap:** Response shape uses `{success: true, data: {...}}` wrapper (Retail returns direct object)

**GET /api/campaigns** (protected)
- ✅ Exists
- ✅ Supports pagination (`page`, `pageSize`)
- ✅ Supports filtering (`status`)
- ⚠️ **Gap:** Response shape uses wrapper, Retail returns `{items, total, page, pageSize}`

**GET /api/campaigns/:id** (protected)
- ✅ Exists
- ✅ Returns campaign with metrics

**POST /api/campaigns/:id/enqueue** (protected)
- ✅ Exists
- ✅ Returns `{ok: true, queued: N, enqueuedJobs: N, campaignId}` (matches Retail)
- ✅ Error codes aligned with Retail
- ✅ Idempotency support (endpoint-level + service-level)

**PUT /api/campaigns/:id/schedule** (protected)
- ✅ Exists
- ✅ Supports `scheduleAt` (DateTime) or `scheduledDate` + `scheduledTime`
- ⚠️ **Gap:** Field name is `scheduleAt` in schema, but endpoint may use `scheduledAt`

#### Unsubscribe (Public)

**GET /api/unsubscribe/:token** (public)
- ✅ Exists
- ✅ No tenant middleware (correctly public)
- ✅ Token verification (HMAC-signed)
- ✅ Returns contact + shop info
- ✅ Tracks click events

**POST /api/unsubscribe/:token** (public)
- ✅ Exists
- ✅ No tenant middleware (correctly public)
- ✅ Token verification
- ✅ Updates `smsConsent` to `opted_out`
- ✅ Idempotent
- ✅ Tenant-safe (scopes by shopId from token)

**Token Format:**
- ✅ HMAC-signed: `{contactId, shopId, phoneE164, timestamp}`
- ✅ Expires after 30 days
- ✅ Frontend route: `/shopify/unsubscribe/:token` (generated by `generateUnsubscribeUrl`)

#### Short Links (Public)

**GET /r/:token** (public)
- ✅ Exists
- ✅ No tenant middleware (correctly public)
- ✅ Redirects to `destinationUrl`
- ✅ Increments `clicks`
- ✅ Updates `lastClickedAt`
- ✅ Rate limited (100 req/min per IP)
- ✅ URL validation and security checks

---

## Gap Analysis Matrix

| Feature | Retail Behavior | Shopify Current | Gap | Fix Plan | Files Involved |
|---------|----------------|-----------------|-----|----------|----------------|
| **CAMPAIGNS** |
| Create Campaign | `POST /campaigns` returns Campaign object | `POST /campaigns` returns `{success: true, data: {...}}` | Response wrapper | ✅ Keep wrapper (consistent with Shopify API) | `controllers/campaigns.js` |
| List Campaigns | `GET /campaigns` returns `{items, total, page, pageSize}` | `GET /campaigns` returns `{success: true, data: {items, pagination}}` | Response wrapper | ✅ Keep wrapper | `controllers/campaigns.js` |
| Campaign Stats | `total`, `sent`, `failed`, `processed` on Campaign model | `totalSent`, `totalFailed`, `totalProcessed` in CampaignMetrics | Field location | ✅ Keep metrics model (better separation) | `schema.prisma`, `services/campaigns.js` |
| Enqueue Response | `{ok: true, queued: N, enqueuedJobs: N}` | `{ok: true, queued: N, enqueuedJobs: N}` | ✅ Aligned | None | Already fixed |
| Status Machine | `draft` → `scheduled` → `sending` → `sent`/`failed` | Same | ✅ Aligned | None | Already aligned |
| Scheduled Send | Worker sweeper checks `scheduledAt` | Worker or repeatable job | ✅ Both valid | Verify worker exists | `queue/` or `workers/` |
| **UNSUBSCRIBE** |
| Backend Endpoint | `POST /contacts/unsubscribe` (public) | `GET/POST /api/unsubscribe/:token` (public) | Route format | ✅ Shopify format is better | Already correct |
| Token Format | `{contactId, storeId}` | `{contactId, shopId, phoneE164}` | Token payload | ✅ Shopify format is better (includes phoneE164) | Already correct |
| Frontend Page | `/unsubscribe/:token` (Retail) | ❌ **MISSING** | No frontend page | **CREATE** `/app/shopify/unsubscribe/[token]/page.tsx` | **NEW FILE** |
| Token Security | HMAC-signed, 30-day expiry | HMAC-signed, 30-day expiry | ✅ Aligned | None | Already correct |
| **SHORT LINKS** |
| Backend Endpoint | `GET /public/s/:shortCode` | `GET /r/:token` | Route format | ✅ Both valid | Already correct |
| Redirect Behavior | 302 redirect, increment clicks | 302 redirect, increment clicks | ✅ Aligned | None | Already correct |
| Rate Limiting | 300 req/min per IP | 100 req/min per IP | Different limits | ✅ Both reasonable | Already correct |
| **DELIVERY STATUS** |
| Provider IDs | `providerMessageId`, `bulkId` on CampaignMessage | `mittoMessageId`, `bulkId` on CampaignRecipient | ✅ Aligned | None | Already correct |
| Delivery Status | `deliveryStatus` (String) | `deliveryStatus` (String) | ✅ Aligned | None | Already correct |
| Status Updates | Webhook handlers or refresh jobs | Webhook handlers or refresh jobs | ✅ Aligned | Verify webhook handlers exist | `routes/mitto-webhooks.js` |

---

## Detailed Findings

### 1. Campaigns Implementation

**Strengths:**
- ✅ Campaign CRUD endpoints exist and work
- ✅ Enqueue flow is idempotent and safe
- ✅ Status machine matches Retail
- ✅ Metrics model provides better separation than Retail

**Gaps:**
- ⚠️ Response wrapper format differs (but this is intentional Shopify API convention)
- ⚠️ Field name: `scheduleAt` vs `scheduledAt` (minor inconsistency)
- ⚠️ Need to verify scheduled send worker exists

**Recommendations:**
- ✅ Keep response wrapper (consistent with Shopify API)
- ✅ Verify scheduled send worker/job exists
- ✅ Consider renaming `scheduleAt` → `scheduledAt` for consistency (low priority)

### 2. Unsubscribe Implementation

**Strengths:**
- ✅ Backend endpoints correctly implemented
- ✅ Token security is robust (HMAC-signed, tenant-safe)
- ✅ Public routes correctly don't require tenant middleware
- ✅ Idempotent behavior

**Gaps:**
- ❌ **CRITICAL:** Frontend unsubscribe page missing
  - Retail has: `/app/(retail)/unsubscribe/[token]/page.tsx`
  - Shopify needs: `/app/shopify/unsubscribe/[token]/page.tsx`
  - Backend generates URLs like: `${baseUrl}/shopify/unsubscribe/${token}`
  - Frontend route must exist to handle these URLs

**Recommendations:**
- **CREATE** frontend unsubscribe page for Shopify
- Use same pattern as Retail unsubscribe page
- Ensure it calls Shopify API public endpoint (not Retail API)

### 3. Short Links Implementation

**Strengths:**
- ✅ Backend endpoint correctly implemented
- ✅ Public route (no tenant middleware)
- ✅ Security checks (URL validation, rate limiting)
- ✅ Click tracking works

**Gaps:**
- None identified

**Recommendations:**
- ✅ Keep as-is

### 4. Prisma Schema Alignment

**Strengths:**
- ✅ Required models exist (Campaign, CampaignRecipient, ShortLink)
- ✅ Tenant scoping fields exist (`shopId`)
- ✅ Unique constraints prevent duplicates (`@@unique([campaignId, phoneE164])`)
- ✅ Indexes support efficient queries

**Gaps:**
- ⚠️ Field name: `scheduleAt` vs `scheduledAt` (minor)
- ⚠️ Campaign model doesn't have direct `sent`/`failed` fields (uses metrics model - this is actually better)

**Recommendations:**
- ✅ Keep metrics model approach (better separation)
- ⚠️ Consider renaming `scheduleAt` → `scheduledAt` (low priority, breaking change)

### 5. Frontend Pages

**Existing:**
- ✅ `/app/shopify/campaigns` - List campaigns
- ✅ `/app/shopify/campaigns/new` - Create campaign
- ✅ `/app/shopify/campaigns/[id]` - Campaign details
- ✅ `/app/shopify/campaigns/[id]/edit` - Edit campaign
- ✅ `/app/shopify/campaigns/[id]/stats` - Campaign stats

**Missing:**
- ❌ `/app/shopify/unsubscribe/[token]` - **CRITICAL GAP**

**Recommendations:**
- **CREATE** `/app/shopify/unsubscribe/[token]/page.tsx`
- Use Retail unsubscribe page as template
- Call Shopify API public endpoint (`/api/unsubscribe/:token`)

---

## Implementation Plan

### Phase 1: Critical Fixes (HIGH Priority)

1. **Create Frontend Unsubscribe Page**
   - File: `apps/astronote-web/app/shopify/unsubscribe/[token]/page.tsx` (NEW)
   - Pattern: Copy from Retail unsubscribe page, adapt for Shopify API
   - API: Call `GET /api/unsubscribe/:token` and `POST /api/unsubscribe/:token`
   - Styling: Use Retail styling patterns

### Phase 2: Verification (MEDIUM Priority)

2. **Verify Scheduled Send Worker**
   - Check if worker exists: `apps/shopify-api/queue/` or `apps/shopify-api/workers/`
   - Verify it checks `scheduleAt` and enqueues campaigns
   - If missing, implement minimal worker

3. **Verify Delivery Status Updates**
   - Check webhook handlers: `apps/shopify-api/routes/mitto-webhooks.js`
   - Verify they update `deliveryStatus` on CampaignRecipient
   - If missing, implement webhook handlers

### Phase 3: Optional Improvements (LOW Priority)

4. **Field Name Consistency**
   - Consider renaming `scheduleAt` → `scheduledAt` (breaking change, low priority)
   - Or document the difference

5. **Response Shape Documentation**
   - Document that Shopify API uses `{success, data}` wrapper
   - This is intentional and consistent with Shopify API conventions

---

## Files Requiring Changes

### Critical (Must Fix)

1. **NEW:** `apps/astronote-web/app/shopify/unsubscribe/[token]/page.tsx`
   - Create frontend unsubscribe page
   - Call Shopify API public endpoints
   - Use Retail unsubscribe page as template

### Verification (Check/Implement)

2. **CHECK:** `apps/shopify-api/queue/` or `apps/shopify-api/workers/`
   - Verify scheduled send worker exists
   - If missing, implement minimal worker

3. **CHECK:** `apps/shopify-api/routes/mitto-webhooks.js`
   - Verify delivery status webhook handlers exist
   - If missing, implement handlers

### Optional (Low Priority)

4. **CONSIDER:** `apps/shopify-api/prisma/schema.prisma`
   - Consider renaming `scheduleAt` → `scheduledAt` (breaking change)

---

## Testing Checklist

After implementation:

- [ ] Frontend unsubscribe page exists and works
- [ ] Unsubscribe page calls Shopify API (not Retail API)
- [ ] Unsubscribe flow is tenant-safe (no cross-tenant leakage)
- [ ] Short links work end-to-end
- [ ] Campaign enqueue works with idempotency
- [ ] Scheduled send worker enqueues campaigns at scheduled time
- [ ] Delivery status updates work via webhooks
- [ ] All public routes work without tenant headers
- [ ] All protected routes require tenant headers

---

**Report Generated:** 2025-01-27  
**Next Step:** Implement critical fixes (frontend unsubscribe page), then verify scheduled send worker and delivery status updates.

