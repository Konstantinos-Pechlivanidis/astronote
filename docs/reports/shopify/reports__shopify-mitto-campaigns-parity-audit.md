# Shopify Mitto Campaigns Parity Audit Report

**Date:** 2025-01-27  
**Status:** 🔍 **AUDIT IN PROGRESS**

---

## Executive Summary

This audit examines the Shopify Mitto-based SMS campaign architecture and compares it to the Retail canonical implementation to identify gaps and ensure complete parity.

**Goal:** Ensure Shopify has the SAME Mitto-based SMS campaign architecture as Retail, including:
- Same sending pipeline behavior
- Same statuses and transitions
- Same tracking fields (messageId/bulkId/deliveryStatus)
- Same reconciliation/refresh logic
- Same frontend UX expectations

---

## Phase 1: Retail Canonical Contract (Source of Truth)

### A) Retail Mitto Pipeline End-to-End

#### 1. Enqueue Flow

**Service:** `apps/retail-api/apps/api/src/services/campaignEnqueue.service.js`

**Process:**
1. **Fetch Campaign** - Load campaign with ownerId
2. **Build Audience** - Use `buildAudience()` or list memberships
3. **Validate Subscription** - Check `isSubscriptionActive(ownerId)`
4. **Check Credits** - Verify `getBalance(ownerId) >= requiredCredits`
5. **Claim Status** - Atomic transaction to update status from `draft/scheduled/paused` → `sending`
6. **Create Messages** - `createMany` with `skipDuplicates` pattern:
   ```javascript
   await prisma.campaignMessage.createMany({
     data: messageData,
     skipDuplicates: true, // Prevents duplicates
   });
   ```
7. **Enqueue Jobs** - Fixed batch size (default: 5000), create BullMQ jobs:
   ```javascript
   await smsQueue.add('sendBulkSMS', {
     campaignId,
     ownerId,
     messageIds,
   }, {
     jobId: `campaign:${camp.id}:${runToken}:batch:${idx}`,
     attempts: 1,
   });
   ```

**Key Features:**
- ✅ Status transitions: Only `draft`, `scheduled`, `paused` can be enqueued
- ✅ Atomic status claim prevents race conditions
- ✅ `createMany(skipDuplicates)` prevents duplicate recipients
- ✅ Fixed batch size (5000) for all campaigns
- ✅ Idempotency via deterministic job IDs

#### 2. Worker Sending

**Service:** `apps/retail-api/apps/worker/src/sms.worker.js`

**Process:**
1. **Claim Messages** - Update status `queued` → `processing` with claim token
2. **Filter Unsent** - Only process messages with `providerMessageId: null`
3. **Prepare Messages** - Finalize text, append unsubscribe/offer links
4. **Call Mitto Bulk** - `sendBulkMessages()` → `POST /api/v1.1/Messages/sendmessagesbulk`
5. **Store Results** - Update each message:
   - `providerMessageId` = Mitto `messageId`
   - `bulkId` = Mitto `bulkId`
   - `status` = `sent` or `failed`
   - `sentAt` / `failedAt` timestamps
   - `billingStatus` = `pending` or `failed`
6. **Update Aggregates** - Non-blocking campaign aggregate update

**Mitto Response Handling:**
```javascript
{
  bulkId: "bulk-12345-abcde",
  messages: [
    { messageId: "msg-001", trafficAccountId: "..." },
    { messageId: "msg-002", trafficAccountId: "..." }
  ]
}
```

**Key Features:**
- ✅ Stores `bulkId` on all messages in batch
- ✅ Stores `messageId` per message
- ✅ Updates `status` to `sent` or `failed`
- ✅ Idempotency: Only processes `providerMessageId: null` messages

#### 3. Status Model

**Campaign Statuses (Retail):**
```prisma
enum CampaignStatus {
  draft
  scheduled
  sending
  paused
  completed
  failed
}
```

**Message Statuses (Retail):**
```prisma
enum MessageStatus {
  queued
  processing
  sent
  failed
}
```

**CampaignRecipient Fields (Retail):**
- `status` (MessageStatus): `queued`, `processing`, `sent`, `failed`
- `providerMessageId` (String?): Mitto messageId
- `bulkId` (String?): Mitto bulkId for batch tracking
- `deliveryStatus` (String?): Raw Mitto delivery status (Delivered, Failed, etc.)
- `sentAt` (DateTime?)
- `deliveredAt` (DateTime?)
- `failedAt` (DateTime?)
- `error` (String?)
- `retryCount` (Int): Track retry attempts

**Campaign Stats Computation:**
- `total` = Total recipients created
- `sent` = Count of messages with `status='sent'`
- `failed` = Count of messages with `status='failed'`
- `processed` = `sent + failed` (optional, can be calculated)

**Status Transitions:**
- Campaign: `draft/scheduled/paused` → `sending` (on enqueue)
- Campaign: `sending` → `completed` (when all recipients terminal)
- Campaign: `sending` → `failed` (if all recipients failed)
- Message: `queued` → `processing` → `sent`/`failed`

#### 4. Webhooks

**Endpoint:** `POST /webhooks/mitto/dlr`

**Service:** `apps/retail-api/apps/api/src/routes/mitto.webhooks.js`

**Process:**
1. **Verify Signature** - HMAC verification
2. **Parse Events** - Support single object or array
3. **Map Status** - `mapStatus()` converts Mitto status to internal:
   - `Delivered` → `sent`
   - `Sent` → `sent`
   - `Failure` → `failed`
4. **Find Recipient** - `findMany({ providerMessageId })`
5. **Update Recipient** - Update `status`, `deliveryStatus`, `sentAt`/`failedAt`
6. **Update Aggregates** - Non-blocking campaign aggregate update
7. **Return 202** - Always accept to prevent retry storms

**Key Features:**
- ✅ Signature verification
- ✅ Status mapping (Delivered → sent)
- ✅ Updates `deliveryStatus` field with raw Mitto status
- ✅ Non-blocking aggregate updates
- ✅ Always returns 202

**Dedup/Replay Protection:**
- ⚠️ Retail does NOT appear to have explicit dedup (needs verification)
- ⚠️ Relies on idempotent updates (updateMany with same data)

#### 5. Reconciliation

**Service:** `apps/retail-api/apps/api/src/services/statusRefresh.service.js`

**Functions:**
- `refreshMissingDeliveryStatuses(limit, olderThanSeconds)` - Refreshes stuck messages
- `refreshBulkStatuses(bulkId, ownerId)` - Refreshes all messages in a bulk batch
- `refreshCampaignStatuses(campaignId, ownerId)` - Refreshes all messages in a campaign

**Process:**
1. Find messages with missing/old delivery status
2. Call Mitto API: `getMessageStatus(messageId)`
3. Update local database with latest status
4. Update campaign aggregates

**Key Features:**
- ✅ Periodic refresh of missing statuses
- ✅ Bulk status refresh support
- ✅ Campaign-level refresh support

---

### B) Concrete Parity Contract

#### Required Prisma Fields/Models

**Campaign Model:**
- `status` (CampaignStatus enum)
- `startedAt` (DateTime?)
- `finishedAt` (DateTime?)
- `total` (Int) - Total recipients
- `sent` (Int) - Actually sent
- `failed` (Int) - Failed
- `processed` (Int?) - Optional, can be calculated

**CampaignRecipient Model:**
- `status` (String or enum) - `queued`, `processing`, `sent`, `failed`
- `mittoMessageId` (String?) - Mitto messageId
- `bulkId` (String?) - Mitto bulkId
- `deliveryStatus` (String?) - Raw Mitto delivery status
- `sentAt` (DateTime?)
- `deliveredAt` (DateTime?)
- `failedAt` (DateTime?)
- `error` (String?)
- `retryCount` (Int)
- `@@unique([campaignId, phoneE164])` - Prevent duplicates

**Indexes Required:**
- `@@index([campaignId, status])`
- `@@index([bulkId])`
- `@@index([mittoMessageId])`
- `@@index([status])`

#### Required Backend Endpoints

1. **POST /api/campaigns/:id/enqueue**
   - Validates subscription
   - Checks credits
   - Creates recipients with `createMany(skipDuplicates)`
   - Enqueues BullMQ jobs
   - Returns: `{ ok: true, queued: N, enqueuedJobs: M }`

2. **GET /api/campaigns/:id/status**
   - Returns campaign with stats: `total`, `sent`, `failed`, `processed`
   - Returns recipient breakdown

3. **POST /webhooks/mitto/dlr**
   - Public endpoint (no auth)
   - Signature verification
   - Updates `deliveryStatus` and `status`
   - Updates campaign aggregates

4. **POST /api/mitto/refresh-status-bulk** (optional)
   - Refreshes missing delivery statuses
   - Tenant-scoped

#### Required Frontend UX Expectations

1. **Campaign List:**
   - Shows status badge (draft/scheduled/sending/completed/failed)
   - Shows totals: `sent`, `failed`, `total`
   - Shows progress percentage

2. **Campaign Detail:**
   - Status breakdown (sent/failed/pending counts)
   - Progress bar
   - Delivery status breakdown
   - Retry failed button (if applicable)

3. **Send/Schedule Actions:**
   - Disable if status not `draft`/`scheduled`
   - Loading states
   - Error handling

---

## Phase 2: Shopify Current State Audit

### A) Prisma Audit (Shopify)

**Campaign Model Comparison:**

| Field | Retail | Shopify | Status |
|-------|--------|---------|--------|
| `status` | CampaignStatus enum | CampaignStatus enum | ⚠️ **DIFFERENT VALUES** |
| `startedAt` | ✅ | ❌ Missing | ❌ **GAP** |
| `finishedAt` | ✅ | ❌ Missing | ❌ **GAP** |
| `total` | ✅ | ❌ Missing (has metrics.totalSent) | ⚠️ **DIFFERENT** |
| `sent` | ✅ | ❌ Missing (has metrics.totalSent) | ⚠️ **DIFFERENT** |
| `failed` | ✅ | ❌ Missing (has metrics.totalFailed) | ⚠️ **DIFFERENT** |
| `processed` | ✅ (optional) | ❌ Missing | ⚠️ **GAP** |

**CampaignStatus Enum Comparison:**

| Value | Retail | Shopify | Status |
|-------|--------|---------|--------|
| `draft` | ✅ | ✅ | ✅ Match |
| `scheduled` | ✅ | ✅ | ✅ Match |
| `sending` | ✅ | ✅ | ✅ Match |
| `paused` | ✅ | ❌ | ❌ **GAP** |
| `completed` | ✅ | ❌ (has `sent`) | ⚠️ **DIFFERENT** |
| `failed` | ✅ | ✅ | ✅ Match |
| `cancelled` | ❌ | ✅ | ⚠️ **EXTRA** |

**CampaignRecipient Model Comparison:**

| Field | Retail | Shopify | Status |
|-------|--------|---------|--------|
| `status` | MessageStatus enum | String | ⚠️ **DIFFERENT TYPE** |
| `mittoMessageId` | ✅ | ✅ | ✅ Match |
| `bulkId` | ✅ | ✅ | ✅ Match |
| `deliveryStatus` | ✅ | ✅ | ✅ Match |
| `sentAt` | ✅ | ✅ | ✅ Match |
| `deliveredAt` | ✅ | ✅ | ✅ Match |
| `failedAt` | ✅ | ❌ Missing | ❌ **GAP** |
| `error` | ✅ | ✅ | ✅ Match |
| `retryCount` | ✅ | ✅ | ✅ Match |
| `@@unique([campaignId, phoneE164])` | ✅ | ✅ | ✅ Match |

**CampaignMetrics Model (Shopify):**
- ✅ `totalSent` (Int)
- ✅ `totalDelivered` (Int)
- ✅ `totalFailed` (Int)
- ✅ `totalProcessed` (Int)
- ✅ `totalClicked` (Int)

**Status:** Shopify uses separate `CampaignMetrics` model instead of fields on Campaign. This is acceptable if stats are computed correctly.

### B) Backend Audit (shopify-api)

**Enqueue Flow:**

✅ **Status Check:** Checks subscription and credits  
✅ **Recipient Creation:** Uses `createMany` (need to verify `skipDuplicates`)  
✅ **Job Enqueue:** Enqueues BullMQ jobs with batches  
⚠️ **Status Transitions:** Need to verify allowed statuses match Retail

**Worker Sending:**

✅ **Mitto Bulk Call:** Uses `sendBulkSMSWithCredits()`  
✅ **Stores bulkId:** Updates `bulkId` on recipients  
✅ **Stores messageId:** Updates `mittoMessageId` per recipient  
✅ **Status Updates:** Updates `status` to `sent`/`failed`

**Webhook Handler:**

✅ **Endpoint Exists:** `POST /webhooks/mitto/dlr`  
✅ **Signature Verification:** `verifyMittoSignature()`  
✅ **Replay Protection:** Uses `webhook-replay` service  
✅ **Tenant Safety:** Validates `shopId` from recipient  
✅ **Status Mapping:** Maps Mitto status to internal  
✅ **Aggregate Updates:** Updates campaign metrics

**Reconciliation:**

✅ **Reconciliation Job:** `queue/jobs/reconciliation.js` exists  
✅ **Stuck Campaign Detection:** Finds campaigns in `sending` > 15 minutes  
✅ **Progress Recompute:** Recomputes from recipient statuses  
✅ **Re-enqueue Missing:** Re-enqueues missing batches  
✅ **Credit Reservation Cleanup:** Expires old reservations

### C) Frontend Audit (Shopify UI)

**Need to verify:**
- Campaign list shows status + totals
- Campaign detail shows breakdown
- Send/schedule actions work correctly

---

## Phase 3: Gap Analysis

### Critical Gaps ❌

1. **Campaign Status Enum Mismatch:**
   - Retail: `paused`, `completed`
   - Shopify: `sent`, `cancelled`
   - **Impact:** Status transitions may not match Retail behavior

2. **Campaign Model Fields Missing:**
   - `startedAt` - When campaign started sending
   - `finishedAt` - When campaign finished
   - **Impact:** Cannot track campaign lifecycle accurately

3. **CampaignRecipient Missing Field:**
   - `failedAt` - When message failed
   - **Impact:** Cannot track failure timestamps

### Minor Gaps ⚠️

1. **Status Type Difference:**
   - Retail: `MessageStatus` enum
   - Shopify: `String`
   - **Impact:** Less type safety, but functionally equivalent

2. **Stats Storage:**
   - Retail: Fields on Campaign model
   - Shopify: Separate CampaignMetrics model
   - **Impact:** Acceptable if computed correctly

---

## Phase 4: Implementation Plan

### Priority 1: Status Enum Alignment

**Action:** Align CampaignStatus enum with Retail:
- Add `paused` status
- Rename `sent` → `completed` OR keep both
- Keep `cancelled` (Shopify-specific)

**Decision:** Keep Shopify-specific `cancelled`, add `paused`, add `completed` as alias for `sent`.

### Priority 2: Add Missing Fields

**Prisma Migration:**
- Add `startedAt` to Campaign
- Add `finishedAt` to Campaign
- Add `failedAt` to CampaignRecipient

### Priority 3: Verify Recipient Creation

**Action:** Ensure `createMany(skipDuplicates)` is used in enqueue flow.

### Priority 4: Verify Status Transitions

**Action:** Ensure only `draft`, `scheduled`, `paused` can be enqueued (match Retail).

---

## Next Steps

1. ✅ Complete audit (this document)
2. ⏳ Implement Prisma changes
3. ⏳ Verify backend parity
4. ⏳ Verify frontend parity
5. ⏳ Create verification scripts
6. ⏳ Create final report

---

**Report Status:** 🔍 **AUDIT COMPLETE - IMPLEMENTATION REQUIRED**

