# Shopify Campaigns & Unsubscribe System - Audit Report

**Date:** 2025-01-27  
**Status:** 🔍 **AUDIT IN PROGRESS**

---

## Executive Summary

This audit examines the current state of Shopify campaigns and unsubscribe functionality, identifying gaps and ensuring complete isolation from Retail public pages.

---

## Phase 1: Retail Canonical Contract (Reference Only)

### Retail Campaign Endpoints (Behavior Reference)
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns` - List campaigns
- `GET /api/campaigns/:id` - Get campaign details
- `GET /api/campaigns/:id/preview` - Preview campaign
- `POST /api/campaigns/:id/enqueue` - Enqueue for sending
- `POST /api/campaigns/:id/schedule` - Schedule campaign
- `POST /api/campaigns/:id/unschedule` - Unschedule campaign
- `GET /api/campaigns/:id/status` - Get campaign status

**Note:** Retail unsubscribe routes are NOT a source for Shopify. Shopify must have its own isolated implementation.

---

## Phase 2: Shopify Current State Inventory

### A) Campaign Endpoints ✅ EXIST

**Backend Endpoints:**
- ✅ `GET /campaigns` - List campaigns (with filters)
- ✅ `GET /campaigns/:id` - Get campaign details
- ✅ `POST /campaigns` - Create campaign
- ✅ `PUT /campaigns/:id` - Update campaign
- ✅ `DELETE /campaigns/:id` - Delete campaign
- ✅ `POST /campaigns/:id/prepare` - Prepare campaign
- ✅ `POST /campaigns/:id/enqueue` - Enqueue campaign
- ✅ `GET /campaigns/:id/status` - Get campaign status

**Status:** Campaign endpoints exist and are tenant-scoped.

**Gaps Identified:**
- ⚠️ Schedule/unschedule endpoints may need verification
- ⚠️ Campaign preview endpoint needs verification

### B) Unsubscribe Implementation

**Backend:**
- ✅ `GET /api/unsubscribe/:token` - Get unsubscribe info
- ✅ `POST /api/unsubscribe/:token` - Process unsubscribe
- ✅ Routes are public (no auth required)

**Frontend:**
- ✅ `/shopify/unsubscribe/[token]/page.tsx` exists
- ❌ **CRITICAL:** Uses Retail components (`PublicLayout`, `PublicCard`, etc.)
- ❌ **VIOLATION:** Imports from `@/src/components/retail/public/*`

**Short Link Resolver:**
- ✅ `GET /r/:token` - Short link redirect exists
- ⚠️ Need to verify it redirects to `/shopify/unsubscribe/:token` for unsubscribe links

### C) Message Building

**Current Implementation:**
- ✅ Unsubscribe links are appended in `queue/jobs/bulkSms.js` via `appendUnsubscribeLink()`
- ✅ Unsubscribe URLs use format: `/shopify/unsubscribe/:token`
- ✅ URL shortening excludes unsubscribe URLs (correct behavior)

**Gaps:**
- ⚠️ Need to verify unsubscribe links are shortened correctly
- ⚠️ Need to verify short link resolver redirects to Shopify namespace

---

## Phase 3: Retail Unsubscribe Isolation Check ❌ FAIL

### Files Importing Retail Unsubscribe Components

**CRITICAL VIOLATIONS:**

1. **`apps/astronote-web/app/shopify/unsubscribe/[token]/page.tsx`**
   - ❌ Imports `PublicLayout` from `@/src/components/retail/public/PublicLayout`
   - ❌ Imports `PublicCard` from `@/src/components/retail/public/PublicCard`
   - ❌ Imports `PublicLoading` from `@/src/components/retail/public/PublicLoading`
   - ❌ Imports `PublicError` from `@/src/components/retail/public/PublicError`
   - ❌ Imports `PublicSuccess` from `@/src/components/retail/public/PublicSuccess`

**Action Required:** Create Shopify-specific public components.

### Shared Route Paths (Collision Risk)

**Retail Routes:**
- `/unsubscribe` (query param)
- `/unsubscribe/:token` (path param)

**Shopify Routes:**
- `/shopify/unsubscribe/:token` ✅ (isolated)

**Status:** Route paths are isolated (no collision), but components are shared (violation).

### Redirects to Retail Routes

**Short Link Resolver:**
- ⚠️ Need to verify `/r/:token` redirects to Shopify namespace for unsubscribe links
- ⚠️ Current implementation redirects to `destinationUrl` from database - need to verify it's correct

---

## Phase 4: Prisma Schema Check

### ShortLink Model ✅ EXISTS

```prisma
model ShortLink {
  id            String    @id @default(cuid())
  token         String    @unique
  destinationUrl String    @db.Text
  shopId        String?
  campaignId    String?
  contactId     String?
  clicks        Int       @default(0)
  createdAt     DateTime  @default(now())
  lastClickedAt DateTime?
  expiresAt     DateTime?
  meta          Json?
  shop          Shop?     @relation(fields: [shopId], references: [id], onDelete: Cascade)
  campaign      Campaign? @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  contact       Contact?  @relation(fields: [contactId], references: [id], onDelete: SetNull)

  @@index([shopId])
  @@index([campaignId])
  @@index([contactId])
  @@index([token])
  @@index([expiresAt])
}
```

**Status:** ✅ Model exists and is properly scoped.

---

## Phase 5: Frontend Campaign Pages

**Need to verify:**
- Campaign list page exists
- Campaign create/edit pages exist
- Campaign details page exists
- All use correct endpoints and headers

---

## Summary of Issues

### Critical Issues ❌

1. **Shopify unsubscribe page uses Retail components**
   - File: `apps/astronote-web/app/shopify/unsubscribe/[token]/page.tsx`
   - Impact: Violates isolation requirement
   - Fix: Create Shopify-specific public components

2. **Short link resolver verification needed**
   - Need to verify it redirects to `/shopify/unsubscribe/:token` for unsubscribe links
   - Need to ensure it never redirects to Retail routes

### Minor Issues ⚠️

1. Schedule/unschedule endpoints need verification
2. Campaign preview endpoint needs verification
3. Frontend campaign pages need verification

---

## Next Steps

1. ✅ Create Shopify-specific public components
2. ✅ Update Shopify unsubscribe page to use Shopify components
3. ✅ Verify short link resolver redirects correctly
4. ✅ Verify all campaign endpoints exist and work
5. ✅ Create verification gate scripts
6. ✅ Add contract tests

---

**Report Status:** 🔍 **AUDIT COMPLETE - IMPLEMENTATION REQUIRED**

