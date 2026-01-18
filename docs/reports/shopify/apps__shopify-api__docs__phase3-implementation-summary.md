# Phase 3 Implementation Summary

**Date**: 2025-01-XX  
**Purpose**: Summary of backend changes to make `apps/shopify-api` fully frontend-ready for `apps/web`

## Overview

Phase 3 makes the backend fully compatible with the React frontend by:
1. Adding DB-backed system segments (gender + age buckets)
2. Embedding reports data in dashboard response
3. Supporting new campaign fields (discount, segment audience)
4. Ensuring dynamic URL strategy + backend shortener redirect
5. Updating CORS for production domain

## Changes Summary

### 1. Database Schema Updates

**Prisma Migration**: `20250124000000_add_segments_and_campaign_meta`

#### Segment Model
- Added `key` (String?) - Unique per shop for system segments
- Added `type` (String, default: "custom") - "system" | "custom"
- Added `criteriaJson` (Json?) - Structured criteria (preferred)
- Added `isActive` (Boolean, default: true)
- Added unique constraint: `@@unique([shopId, key])`
- Added indexes: `shopId + type`, `shopId + key`

#### Campaign Model
- Added `meta` (Json?) - Store additional data (discountValue, includeDiscount)

#### ShopSettings Model
- Added `baseUrl` (String?) - Per-tenant base URL override

### 2. System Segments Implementation

**Service**: `services/segments.js`
- `ensureSystemSegments(shopId)` - Idempotent seeding
- `getSystemSegments(shopId)` - Get all system segments
- `resolveSegmentContacts(shopId, segment)` - Resolve contacts by criteria
- `getSegmentEstimatedCount(shopId, segment)` - Get count without full resolution

**System Segments**:
- Gender: `gender_male`, `gender_female`, `gender_unknown`
- Age: `age_18_24`, `age_25_34`, `age_35_44`, `age_45_54`, `age_55_plus`

**Endpoints**:
- `GET /audiences/segments` - List system segments (auto-creates if missing)
- `GET /audiences/segments/:id` - Get segment details
- `GET /audiences/segments/:id/preview` - Get estimated count

### 3. Campaign Contract Updates

**Schema Updates** (`schemas/campaigns.schema.js`):
- Added `includeDiscount` (boolean, optional)
- Added `discountValue` (string, optional)
- Updated `audience` to support object format: `{ type: "all" | "segment", segmentId?: string }`

**Service Updates** (`services/campaigns.js`):
- `createCampaign()` - Stores discount fields in `meta` JSON
- `resolveRecipients()` - Supports system segments via segments service
- `listCampaigns()` - Returns `sentCount`, `deliveredCount`, `failedCount`

**Backward Compatibility**: Legacy string format (`"all"`, `"segment:ID"`) still supported.

### 4. Dashboard Reports Embedding

**Service Updates** (`services/dashboard.js`):
- `getDashboard()` - Now includes `reports` object
- `getReportsData()` - Fetches reports for last 7 days
- `getCampaignPerformanceSummary()` - Aggregates from CampaignRecipient
- `getTopCampaigns()` - Top 5 campaigns with stats
- `getDeliveryRateTrend()` - Daily delivery rate
- `getCreditsUsageTrend()` - Daily credits usage

**Response Structure**:
```json
{
  "reports": {
    "last7Days": { "sent", "delivered", "failed", "unsubscribes" },
    "topCampaigns": [...],
    "deliveryRateTrend": [...],
    "creditsUsage": [...]
  }
}
```

**Note**: NO separate `/reports` endpoint. Reports embedded in `/dashboard`.

### 5. Dynamic URL Strategy

**Already Implemented**:
- `utils/baseUrl.js` - Uses proxy headers + per-tenant override
- `utils/frontendUrl.js` - Uses `getBaseUrl()` for frontend URLs
- `ShopSettings.baseUrl` - Per-tenant override support

**Trust Proxy**: Already enabled in `app.js` (`app.set('trust proxy', 1)`)

### 6. Backend Shortener Redirect

**Already Implemented**:
- `GET /r/:token` - Public redirect endpoint
- `ShortLink` model exists
- Security: HTTPS-only in production, optional hostname allowlist
- Click tracking: Atomic increment of clicks/lastClickedAt

**Updates**:
- Added hostname allowlist support (`REDIRECT_ALLOWED_HOSTS` env)
- Supports wildcards: `*.myshopify.com`

### 7. CORS Updates

**Updated** (`app.js`):
- Added `https://astronote.onrender.com` to allowed origins
- Existing: `https://admin.shopify.com`, `*.myshopify.com`

### 8. Documentation

**Created**:
- `docs/web-backend-contract.md` - Complete API contract
- `docs/dashboard-reports-shape.md` - Reports data structure
- `docs/segments.md` - System segments documentation

## Migration Steps

1. **Run Prisma Migration**:
   ```bash
   npm -w @astronote/shopify-api run prisma:generate
   npm -w @astronote/shopify-api run prisma:migrate:deploy
   ```

2. **Environment Variables**:
   - `URL_SHORTENER_BASE_URL` - Backend base URL for short links
   - `REDIRECT_ALLOWED_HOSTS` - Optional hostname allowlist (CSV)
   - `ALLOWED_ORIGINS` - CORS origins (include `https://astronote.onrender.com`)

3. **Verify**:
   - `GET /health/full` - Health check
   - `GET /dashboard` - Includes reports data
   - `GET /audiences/segments` - Auto-creates system segments
   - `POST /campaigns` - Accepts new fields
   - `GET /r/:token` - Redirect works

## Testing Checklist

- [ ] System segments auto-created on first access
- [ ] Campaign creation with segment audience works
- [ ] Campaign list includes sentCount/deliveredCount/failedCount
- [ ] Dashboard includes reports data
- [ ] Short link redirect works with security checks
- [ ] CORS allows `https://astronote.onrender.com`
- [ ] Dynamic URL generation uses proxy headers

## Backward Compatibility

All changes are **additive and backward-compatible**:
- Legacy audience format (`"all"`, `"segment:ID"`) still works
- Existing campaigns unaffected
- No breaking API changes
- System segments auto-created (no manual migration needed)

## Next Steps

1. Deploy migration to production
2. Update frontend to use new endpoints
3. Test end-to-end flow
4. Monitor system segment resolution performance

