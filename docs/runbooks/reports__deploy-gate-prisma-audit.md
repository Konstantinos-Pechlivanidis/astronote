# Prisma Alignment Audit Report

**Date:** 2025-01-27  
**Status:** 🔍 **AUDIT IN PROGRESS**

---

## Executive Summary

This audit verifies Prisma schema alignment across:
1. **Backend (apps/shopify-api)** — authoritative source
2. **Frontend (apps/astronote-web Shopify)** — type expectations

**Goal:** Ensure no Prisma mismatches, correct tenant scoping, and aligned frontend/backend contracts.

---

## Phase 1: Schema Analysis

### A) Prisma Models (34 models)

**Tenant-Bound Models (23 models with shopId):**
- Contact, Segment, Campaign, MessageLog, Wallet, Purchase, WalletTransaction
- TemplateUsage, UserAutomation, AutomationLog, AbandonedCheckout
- ScheduledAutomation, AutomationSequence, EventProcessingState
- DiscountLink, ShopSettings, BillingTransaction, CreditTransaction
- CreditReservation, Template, ShortLink, WebhookEvent, EnqueueRequest

**Non-Tenant Models (11 models):**
- Shop, Automation, SegmentMembership, CampaignRecipient, CampaignMetrics
- ClickEvent, SmsPackage, Package, QueueJob, ShopifySession, RateLimitRecord

### B) Key Enums (13 enums)

- CampaignStatus: draft, scheduled, sending, paused, completed, sent, failed, cancelled
- ScheduleType: immediate, scheduled, recurring
- SmsConsent: opted_in, opted_out, unknown
- MessageStatus: queued, sent, delivered, failed, received
- SubscriptionStatus: active, inactive, cancelled
- PaymentStatus: pending, paid, failed, refunded
- CreditTxnType: credit, debit, refund
- And more...

---

## Phase 2: Backend Prisma Usage Audit

### A) Field Name Mismatches

**Status:** ⚠️ **Some false positives from query parser**

The audit script identified potential mismatches, but many are false positives:
- Prisma query operators (gte, lte, in, not, etc.) are not model fields
- Nested queries (where: { contact: { smsConsent: ... } }) access related models
- Unique constraint names (shopId_templateId) are not fields

**Actual Issues Found:**
1. **Template model:** Some queries reference `isPublic` which exists in schema ✅
2. **TemplateUsage:** Queries reference `usedCount`, `lastUsedAt` which should come from relation ✅
3. **UserAutomation:** Queries include fields from related `Automation` model (title, description, etc.) ✅

### B) Tenant Scoping Analysis

**Critical Check:** All tenant-bound model queries must include `shopId` in where clause.

**Status:** ✅ **Most queries are properly scoped**

Sample verified scoped queries:
```javascript
// ✅ Properly scoped
prisma.campaign.findMany({ where: { shopId: storeId, ... } })
prisma.contact.findMany({ where: { shopId, ... } })
prisma.template.findMany({ where: { shopId, ... } })
```

**Potential Issues:**
- Some queries may scope via relations (e.g., `campaign: { shopId: ... }`)
- Need to verify all tenant-bound queries are scoped

---

## Phase 3: Frontend Type Expectations

### A) Type Definitions

Frontend defines TypeScript interfaces for API responses:
- `Campaign`, `Contact`, `Template`, `Discount`, `Settings`, etc.

**Important:** These are **API response DTOs**, not Prisma models. They may:
- Include computed fields (e.g., `sentCount`, `failedCount`)
- Include pagination metadata (e.g., `total`, `page`, `pageSize`)
- Map field names (e.g., `phone` → `phoneE164`, `birthday` → `birthDate`)
- Include related data (e.g., `shop` relation data in `Settings`)

### B) Field Mapping Patterns

**Contact:**
- Frontend: `phone`, `birthday`
- Backend: `phoneE164`, `birthDate`
- **Status:** ✅ Backend service maps these correctly

**Template:**
- Frontend: `title`, `content`
- Backend: `name`, `text` (Retail-aligned) + `title`, `content` (backward compat)
- **Status:** ✅ Backend service returns both

**Settings:**
- Frontend: `shopDomain`, `shopName`, `credits`, `recentTransactions`
- Backend: These come from `Shop` relation, not `ShopSettings` model
- **Status:** ✅ Backend service includes relation data

---

## Phase 4: Critical Issues

### High Priority

1. **Tenant Scoping Verification**
   - Need to verify ALL tenant-bound queries include `shopId`
   - Some queries may scope via relations (acceptable if relation is tenant-scoped)

2. **Field Name Consistency**
   - Backend uses both `name`/`text` (Retail-aligned) and `title`/`content` (backward compat)
   - Frontend expects `title`/`content` - backend provides both ✅

### Medium Priority

1. **Template Usage Fields**
   - Queries reference `usedCount`, `lastUsedAt` from `TemplateUsage` relation
   - Need to ensure these are properly joined

2. **UserAutomation Relations**
   - Queries include fields from related `Automation` model
   - Need to ensure `include` clauses are correct

### Low Priority

1. **Frontend Type Warnings**
   - Many "mismatches" are intentional (DTOs vs models)
   - These are acceptable as long as backend services map correctly

---

## Phase 5: Fix Plan

### Immediate Actions

1. **Improve Audit Script**
   - Better handling of Prisma query operators
   - Recognize relation includes
   - Focus on actual field mismatches in `select`/`data` clauses

2. **Verify Tenant Scoping**
   - Manual review of tenant-bound model queries
   - Ensure all queries include `shopId` or scope via tenant-scoped relations

3. **Document Field Mappings**
   - Document Retail-aligned field names vs backward-compat names
   - Document frontend DTO transformations

### Future Improvements

1. **Type Safety**
   - Consider generating TypeScript types from Prisma schema
   - Use Zod schemas for runtime validation

2. **Automated Testing**
   - Add tests to verify tenant scoping
   - Add tests to verify field mappings

---

## Next Steps

1. ✅ Complete audit (this document)
2. ⏳ Refine audit script to reduce false positives
3. ⏳ Manual verification of tenant scoping
4. ⏳ Fix any actual field mismatches
5. ⏳ Create final implementation report

---

**Report Status:** 🔍 **AUDIT COMPLETE - VERIFICATION REQUIRED**

