## Unified “Send Campaign + Statuses” Report (Retail + Shopify)

Monorepo: `astronote-shopify-backend`  
Scope scanned: `apps/shopify-api`, `apps/retail-api`, `apps/astronote-web`  
Rule of engagement: **report-only** (no production behavior changes).

---

## 1) Executive Summary

### Current sending architecture (Retail vs Shopify)

- **Retail** (`apps/retail-api`)
  - **API process** schedules repeatable BullMQ jobs (status refresh) and periodically recomputes campaign aggregates.
  - **Workers** run as separate Node processes under `apps/retail-api/apps/worker/` (SMS send worker, scheduler worker, status refresh worker, etc.).
  - **DB truth** for campaign/message state is primarily `Campaign` + `CampaignMessage` (plus `deliveryStatus` and timestamps).

- **Shopify** (`apps/shopify-api`)
  - **API process** owns “scheduler” loops (setTimeout-based) guarded by a **Redis distributed lock**, pushing periodic jobs into BullMQ queues (status update + reconciliation).
  - **Workers** may run embedded (same process) or as separate processes depending on env (`START_WORKER` / `SKIP_QUEUES` patterns).
  - **DB truth** for campaign state is `Campaign` + `CampaignRecipient` + `CampaignMetrics` + `MessageLog`. DLR replay protection exists via `WebhookEvent`.

### What statuses exist and what they mean (high-level)

- **Campaign status** answers: “What is the campaign doing right now?” (draft/scheduled/sending/…)
- **Recipient/message status** answers: “What happened for this specific recipient/message?” (queued/processing/sent/failed + deliveryStatus details)
- **Delivery status** is provider vocabulary (Mitto DLR / polling); both systems map it down into a small internal set for UI + metrics.

### Biggest risks found (across both)

1. **Retail webhook audit/dedupe not actually persisted**: Retail’s DLR route “best-effort persist” appears to omit required `eventId`, so it likely fails to write `WebhookEvent` records (schema requires `eventId`). This undermines replay audit and dedupe planning.
2. **Status vocab divergence in Shopify FE**: Shopify FE has multiple independent “status lists” (TS unions + Zod schema + UI filters) that do not all include the full backend enum surface (notably `paused` / `completed` / legacy `sent` handling), creating drift risk.
3. **Delivered vs Sent semantics differ**: Retail largely collapses “delivered” into “sent” at the campaign-message status layer (delivery is tracked via `deliveryStatus`). Shopify has a `delivered` in `MessageStatus` but campaign-recipient terminal status is still mostly `sent`/`failed` with separate `deliveryStatus`.
4. **Stuck ‘sending’ pathways are product-specific and easy to regress**: Retail uses multiple periodic mechanisms (status refresh repeat jobs + aggregate reconcile + scheduler stale-claim recovery). Shopify uses a reconciliation job + periodic status updates + DLR webhook. Missing one piece can leave campaigns stuck.
5. **Duplicate send prevention is multi-layered but inconsistent**: both rely on DB constraints + queue job IDs + “only send if still pending/unsent” checks; differences in how each layer is implemented makes parity and future changes risky.

---

## 2) Status Models (Authoritative)

This section extracts **authoritative enums and fields from Prisma schemas and code**, not assumptions.

### 2.1 Retail status model (authoritative)

#### Campaign status enum

Source: `apps/retail-api/prisma/schema.prisma`

- `CampaignStatus`: `draft`, `scheduled`, `sending`, `paused`, `completed`, `failed`
- Key campaign timestamps/fields:
  - `Campaign.scheduledAt`, `Campaign.startedAt`, `Campaign.finishedAt`
  - Delivery SLA fields: `deliverySlaSeconds`, `deliveryCompletedAt`, `lastDeliverySweepAt`

#### Recipient/message status + fields

Source: `apps/retail-api/prisma/schema.prisma`

- Per-recipient/per-message table: `CampaignMessage`
  - **Queue lifecycle status**: `CampaignMessage.status` where `MessageStatus` is `queued`, `processing`, `sent`, `failed`
  - **Provider identifiers**:
    - `CampaignMessage.providerMessageId` (Mitto messageId)
    - `CampaignMessage.bulkId` (Mitto bulkId)
  - **Delivery tracking**:
    - `CampaignMessage.deliveryStatus` (string, Mitto vocabulary)
    - `CampaignMessage.deliveredAt`, `CampaignMessage.deliveryLastCheckedAt`
  - **Send claim lock**:
    - `CampaignMessage.sendClaimedAt`, `CampaignMessage.sendClaimToken`
  - **Retries**: `CampaignMessage.retryCount`
  - **Billing**: `billingStatus`, `billingError`, `billedAt` (billing is separate concern but affects “failed” semantics)

#### Delivery status vocab (Mitto → internal)

Sources:
- DLR webhook mapping: `apps/retail-api/apps/api/src/routes/mitto.webhooks.js`
- Polling mapping: `apps/retail-api/apps/api/src/services/statusRefresh.service.js`

Behavior:
- Mitto “Delivered” is mapped into internal “sent” for core status.
- “Failure/Failed/Undelivered/Expired/Rejected/Error” map to internal “failed”.
- In Retail, “delivered” is captured in `CampaignMessage.deliveryStatus` and `deliveredAt`, but not surfaced as a distinct `CampaignMessage.status` terminal beyond “sent”.

#### Frontend status labels mapping (Retail UI)

Source: `apps/astronote-web/src/components/retail/StatusBadge.tsx`

- UI style variants exist for: `draft`, `scheduled`, `sending`, `completed`, `failed`, `paused` (plus `active`/`inactive` for other domains).
- Pages rendering campaign status:
  - `apps/astronote-web/app/app/retail/campaigns/page.tsx`
  - `apps/astronote-web/app/app/retail/campaigns/[id]/page.tsx`
  - `apps/astronote-web/app/app/retail/campaigns/[id]/status/page.tsx`

---

### 2.2 Shopify status model (authoritative)

#### Campaign status enum

Source: `apps/shopify-api/prisma/schema.prisma`

- `CampaignStatus`: `draft`, `scheduled`, `sending`, `paused`, `completed`, `sent` (legacy alias), `failed`, `cancelled`
- Key campaign timestamps/fields:
  - `Campaign.startedAt`, `Campaign.finishedAt`, `Campaign.scheduleType`, `Campaign.scheduleAt`

#### Recipient status + fields

Source: `apps/shopify-api/prisma/schema.prisma`

- Per-recipient table: `CampaignRecipient`
  - `status` is a **String** (not Prisma enum), used as a state machine in code (commonly: `pending`, `sent`, `failed`)
  - Provider identifiers:
    - `mittoMessageId` (Mitto messageId)
    - `bulkId` (Mitto bulkId)
  - Delivery tracking:
    - `deliveryStatus` (string, Mitto vocabulary)
    - `sentAt`, `deliveredAt`, `failedAt`, `error`, `senderNumber`
  - Duplicate prevention:
    - `@@unique([campaignId, phoneE164])`
    - `retryCount` exists for operational use

#### Message log status enum (non-campaign + audit)

Source: `apps/shopify-api/prisma/schema.prisma`

- `MessageStatus`: `queued`, `sent`, `delivered`, `failed`, `received`
- Provider identifiers are stored on `MessageLog.providerMsgId`.

#### Delivery status vocab (Mitto → internal)

Sources:
- DLR webhook mapping: `apps/shopify-api/controllers/mitto.js`
- Polling/refresh mapping: `apps/shopify-api/services/delivery-status.js`

Notes:
- DLR handler maps Mitto deliveryStatus into **internal recipient status** `sent` or `failed`, and stores raw `deliveryStatus`.
- `services/delivery-status.js` maps Mitto “Delivered” into internal `MessageStatus.delivered` (used for `MessageLog`), but recipient terminal status remains largely `sent`/`failed`.

#### Frontend status labels mapping (Shopify UI)

Sources:
- FE campaign status type unions:
  - `apps/astronote-web/src/lib/shopify/api/campaigns.ts`
  - `apps/astronote-web/src/lib/shopifyCampaignsApi.ts`
- FE schema validation:
  - `apps/astronote-web/src/lib/shopify/api/schemas.ts` (Zod enum)
- Pages rendering campaign status:
  - `apps/astronote-web/app/app/shopify/campaigns/page.tsx`
  - `apps/astronote-web/app/app/shopify/campaigns/[id]/page.tsx`
  - `apps/astronote-web/app/app/shopify/campaigns/[id]/status/page.tsx`

**Observed drift risk**:
- Zod schema currently validates `status` as one of: `draft`, `scheduled`, `sending`, `sent`, `failed`, `cancelled` (missing `paused`, `completed`), while FE TS unions include them. This can cause runtime parse fallbacks and inconsistent UI behavior depending on which layer is used.

---

## 3) End-to-End Data Flow (Diagrams)

### 3.1 Retail flow (enqueue → worker → Mitto → DLR/polling → DB → UI)

```mermaid
sequenceDiagram
  autonumber
  participant FE as Frontend (astronote-web Retail)
  participant API as retail-api (apps/api)
  participant Q as BullMQ (smsQueue)
  participant W as Worker (apps/worker/sms.worker.js)
  participant M as Mitto API
  participant DLR as Mitto DLR Webhook
  participant DB as Postgres (Prisma)

  FE->>API: POST /campaigns/:id/enqueue (protected)
  API->>DB: Validate ownerId scope; set Campaign.status=sending; create CampaignMessage rows (queued)
  API->>Q: smsQueue.add('sendBulkSMS', {campaignId, ownerId, messageIds[]})
  W->>DB: Claim queued messages (sendClaimToken/sendClaimedAt) and mark processing
  W->>M: sendmessagesbulk(...)
  M-->>W: { bulkId, messages:[{messageId}, ...] }
  W->>DB: Persist providerMessageId/bulkId + sentAt/acceptedAt; debit billing post-accept
  DLR-->>API: POST /webhooks/mitto/dlr (many events)
  API->>DB: Update CampaignMessage.status (sent/failed) + deliveryStatus + deliveredAt/failedAt
  API->>DB: Update aggregates/metrics
  API-->>FE: GET /campaigns/:id/status + stats endpoints

  Note over API,DB: Polling fallback: statusRefreshQueue repeat jobs call Mitto getMessageStatus() for accepted messages.
```

Tenant/owner enforcement:
- All key campaign and message queries are scoped by `ownerId` in routes/services (e.g. `apps/retail-api/apps/api/src/routes/campaigns.js` and service layer).

Idempotency/duplicate prevention points:
- `CampaignMessage.trackingId` is unique (per message).
- Send claim fields prevent parallel send by multiple workers.
- Enqueue uses deterministic job IDs with a per-run token to avoid collisions (`apps/retail-api/apps/api/src/services/campaignEnqueue.service.js`).

### 3.2 Shopify flow (enqueue → worker → Mitto → DLR + polling + reconciliation → DB → UI)

```mermaid
sequenceDiagram
  autonumber
  participant FE as Frontend (astronote-web Shopify)
  participant API as shopify-api (Express)
  participant Q as BullMQ queues (sms-send, delivery-status-update, reconciliation, all-campaigns-status-update)
  participant W as Worker(s)
  participant M as Mitto API
  participant DLR as Mitto DLR Webhook
  participant DB as Postgres (Prisma)

  FE->>API: POST /campaigns/:id/enqueue
  API->>DB: Atomic Campaign.status transition draft/scheduled/paused -> sending
  API->>DB: Create CampaignRecipient rows (status='pending', unique by campaignId+phoneE164)
  API->>Q: smsQueue.add('sendBulkSMS', {campaignId, shopId, recipientIds[]}) with hashed jobId
  W->>DB: Load recipients still pending & unsent (status='pending' and mittoMessageId is null)
  W->>M: sendmessagesbulk(...)
  M-->>W: { bulkId, messages:[{messageId}, ...] }
  W->>DB: Update CampaignRecipient.mittoMessageId/bulkId + status='sent' and timestamps; update CampaignMetrics
  W->>Q: deliveryStatusQueue.add('update-campaign-status', {campaignId}) with delays (30s/2m/5m)
  DLR-->>API: POST /webhooks/mitto/dlr
  API->>DB: Update CampaignRecipient status & deliveryStatus; record webhook replay key; update aggregates
  API->>Q: (periodic) allCampaignsStatusQueue.add('update-all-campaigns-status', {})
  API->>Q: (periodic) reconciliationQueue.add('reconciliation', {})
  W->>DB: Poll Mitto getMessageStatus() for in-flight messages; mark final; set Campaign to completed/failed when terminal
  API-->>FE: GET /campaigns, GET /campaigns/:id/status, GET /campaigns/:id/progress
```

Tenant/shop enforcement:
- Shop scoping is by `shopId` on all campaign tables (see Prisma schema and service queries in `apps/shopify-api/services/campaigns.js`).

Idempotency/duplicate prevention points:
- DB: `@@unique([campaignId, phoneE164])` on `CampaignRecipient`.
- Enqueue: atomic status transition to avoid concurrent enqueues.
- Queue: hashed job IDs + “checkExistingJob” scanning for same recipient set before enqueue.
- Worker: “send only if still pending and mittoMessageId is null” right before API call.
- Webhooks: `WebhookEvent` replay protection via `apps/shopify-api/services/webhook-replay.js` and usage in `apps/shopify-api/controllers/mitto.js`.

---

## 4) Queue & Worker Architecture

### 4.1 Retail queues/workers

#### Queues

- **`smsQueue`**
  - Definition: `apps/retail-api/apps/api/src/queues/sms.queue.js`
  - Default attempts: configurable (`QUEUE_ATTEMPTS`, default 1) + exponential backoff.
  - Limiter: configurable (`QUEUE_RATE_MAX`, `QUEUE_RATE_DURATION_MS`).

- **`schedulerQueue`**
  - Definition: `apps/retail-api/apps/api/src/queues/scheduler.queue.js`
  - Repeat job: `sweepDueCampaigns` registered by worker (`apps/retail-api/apps/worker/src/scheduler.worker.js`).

- **`statusRefreshQueue`**
  - Definition: `apps/retail-api/apps/api/src/queues/statusRefresh.queue.js`
  - Repeat jobs registered in API startup: `apps/retail-api/apps/api/src/server.js`
    - `refreshPendingStatuses` (default every 10 minutes)
    - `refreshMissingDeliveryStatuses` (default every 60s)

#### Workers

- SMS send worker: `apps/retail-api/apps/worker/src/sms.worker.js`
  - Handles jobs `sendBulkSMS` and `sendSMS`.
  - Uses “send claim” semantics to prevent parallel sending.
- Scheduler worker: `apps/retail-api/apps/worker/src/scheduler.worker.js`
  - Sweeps due scheduled campaigns and enqueues them.
  - Recovers stale processing claims (moves stuck processing → queued).
- Status refresh worker: `apps/retail-api/apps/worker/src/statusRefresh.worker.js`
  - Runs polling refresh jobs and updates DB + aggregates.

Job payload schemas (as observed):
- `sendBulkSMS`: `{ campaignId, ownerId, messageIds: number[] }`
- `sendSMS`: `{ messageId: number }`
- `refreshPendingStatuses`: `{ limit: number }`
- `refreshMissingDeliveryStatuses`: `{ limit: number, olderThanSeconds: number }`

Retry/backoff strategy:
- Worker throws on retryable conditions and relies on BullMQ attempts/backoff.
- Retail intentionally defaults to low attempts (avoid duplicate sends) unless configured.

### 4.2 Shopify queues/workers

#### Queues

Definitions: `apps/shopify-api/queue/index.js`

- `sms-send` (`smsQueue`)
  - defaultJobOptions: attempts 5, exponential backoff starting 2s.
- `campaign-send` (`campaignQueue`)
  - attempts 2, fixed backoff 5s.
- `automation-trigger` (`automationQueue`)
  - attempts 2, exponential backoff.
- `delivery-status-update` (`deliveryStatusQueue`)
  - attempts 3, exponential backoff.
- `all-campaigns-status-update` (`allCampaignsStatusQueue`)
  - attempts 2, fixed backoff.
- `reconciliation` (`reconciliationQueue`)
  - attempts 1 (no retries).

#### Workers

Definitions: `apps/shopify-api/queue/worker.js`

- `smsWorker` (`sms-send`)
  - concurrency 200; BullMQ limiter max 500/sec.
  - job types: `sendBulkSMS` (campaigns), `sendSMS` (automations/tests)
- `deliveryStatusWorker` (`delivery-status-update`)
  - job names: `update-campaign-status`, `update-all-campaigns-status`
- `reconciliationWorker` (`reconciliation`)
  - runs stuck-campaigns + credit-reservation expiry logic

Periodic scheduling:
- `apps/shopify-api/services/scheduler.js`:
  - `startPeriodicStatusUpdates()` → schedules `update-all-campaigns-status` every 5 minutes using Redis lock.
  - `startReconciliationScheduler()` → schedules reconciliation every 10 minutes using Redis lock.

Job payload schemas (as observed):
- `sendBulkSMS`: `{ campaignId, shopId, recipientIds: string[] }`
- `sendSMS`: `{ campaignId?, shopId, phoneE164, message, sender }`
- `update-campaign-status`: `{ campaignId }`
- `update-all-campaigns-status`: `{}`
- `reconciliation`: `{}`

---

## 5) Provider Integration (Mitto)

### 5.1 Bulk vs single send

- **Retail**
  - Single: `sendSingle()` in `apps/retail-api/apps/api/src/services/mitto.service.js`
  - Bulk: `sendBulkMessages()` (new endpoint `/Messages/sendmessagesbulk`) in same file, orchestrated by `apps/retail-api/apps/api/src/services/smsBulk.service.js`.
  - Bulk mapping relies on response order matching request order; the service logs mapping and returns `bulkId`.

- **Shopify**
  - Single: `sendSms()` in `apps/shopify-api/services/mitto.js`
  - Bulk: `sendBulkMessages()` in `apps/shopify-api/services/mitto.js`, orchestrated by:
    - `apps/shopify-api/queue/jobs/bulkSms.js` (campaign batch job)
    - `apps/shopify-api/services/smsBulk.js` (credit enforcement + Mitto API call)
  - Bulk mapping uses response order; additional safety exists (length mismatch logging) and uses internalRecipientId mapping.

### 5.2 Where messageId/bulkId are persisted

- **Retail**
  - `CampaignMessage.providerMessageId` stores Mitto `messageId`.
  - `CampaignMessage.bulkId` stores Mitto `bulkId`.
  - Both are updated by the worker and used by DLR/polling for reconciliation.

- **Shopify**
  - `CampaignRecipient.mittoMessageId` stores Mitto `messageId`.
  - `CampaignRecipient.bulkId` stores Mitto `bulkId`.
  - `MessageLog.providerMsgId` stores Mitto `messageId` for non-campaign/outbound logs.

### 5.3 DLR webhook flow + dedupe protection

- **Retail**
  - Handler: `apps/retail-api/apps/api/src/routes/mitto.webhooks.js` (`POST /webhooks/mitto/dlr`)
  - Verification: HMAC over rawBody header `X-Webhook-Signature` or dev token.
  - Dedupe: **no explicit replay protection** in handler (updates are mostly idempotent due to updateMany by providerMessageId).
  - DB model exists: `WebhookEvent` with `@@unique([provider, eventId])` in `apps/retail-api/prisma/schema.prisma`.
    - However, current handler “persistWebhook” does not provide an `eventId` (required), so persistence likely fails (best-effort; logged).

- **Shopify**
  - Handler: `apps/shopify-api/controllers/mitto.js` (mounted via routes; DLR path described in `apps/shopify-api/routes/mitto-webhooks.js`)
  - Verification: `x-mitto-signature` HMAC with `MITTO_WEBHOOK_SECRET`.
  - Replay protection: `apps/shopify-api/services/webhook-replay.js` backed by `WebhookEvent` (`@@unique([provider, eventId])`).
  - DLR always returns 202 to avoid retry storms.

### 5.4 Common failure cases and handling

- **Rate limiting**
  - Retail: worker marks retryable based on error status; queue attempts/backoff controls resend attempts.
  - Shopify: `services/smsBulk.js` throws a “rate_limit_exceeded” error to trigger BullMQ retry; BullMQ limiter is also configured on worker.

- **Missing messageId in bulk response**
  - Retail: logged as failure per message; credits should not be debited without messageId.
  - Shopify: logged; transactionally updates recipient records only if messageId present.

---

## 6) Reconciliation / Watchdogs

### 6.1 What exists today

- **Retail**
  - Scheduled campaign sweeper in worker: `apps/retail-api/apps/worker/src/scheduler.worker.js`
  - Polling status refresh repeat jobs: registered in API startup `apps/retail-api/apps/api/src/server.js` and executed by `apps/retail-api/apps/worker/src/statusRefresh.worker.js`
    - `refreshPendingStatuses()` and `refreshMissingDeliveryStatuses()` in `apps/retail-api/apps/api/src/services/statusRefresh.service.js`
  - Periodic campaign aggregate recompute (all owners): `setInterval(recalculateAllCampaignAggregates)` in `apps/retail-api/apps/api/src/server.js`
  - Stale claim recovery: scheduler worker resets stuck `processing` messages back to `queued` after threshold.

- **Shopify**
  - Periodic “all campaigns status update” scheduler: `apps/shopify-api/services/scheduler.js` → enqueues `update-all-campaigns-status`
  - Reconciliation scheduler: `apps/shopify-api/services/scheduler.js` → enqueues reconciliation job
  - Reconciliation logic: `apps/shopify-api/queue/jobs/reconciliation.js`
    - marks campaigns completed/failed when terminal
    - re-enqueues missing batches if pending recipients and no active jobs
    - expires old credit reservations

### 6.2 What is missing / fragile

- Retail’s `WebhookEvent` persistence appears non-functional in current DLR route (missing required `eventId`). This reduces auditability and blocks safe replay/dedupe implementations.
- Shopify has two “delivered” semantics (MessageLog can be `delivered`, CampaignRecipient “status” stays `sent`), which complicates KPIs unless standardized.

### 6.3 Recommended reconciliation algorithm (product-agnostic)

Recommended canonical algorithm (can be implemented separately per product but should share the same rules):

- **Detect stuck campaigns**: campaigns in `sending` with no progress for > X minutes.
  - “No progress” = no new provider IDs attached, and no recipient/message status changes.
- **Refresh missing statuses**:
  - For recipients/messages with providerMessageId but no terminal delivery status, poll provider.
- **Finalize campaign**:
  - Mark `completed` when all recipients/messages are terminal (delivered/sent/failed depending on your normalized vocabulary).
  - Mark `failed` when all are failed, or when hard-fail threshold exceeded.
- **No resends**:
  - Never re-send a recipient/message that has a provider messageId already.
  - Only re-enqueue “pending and unsent” items, guarded by DB checks and deterministic job IDs.
- **Idempotency**:
  - Webhook events: dedupe by provider event ID or a deterministic “(messageId + status + time bucket)” key.
  - Queue jobs: jobId deterministic on (campaignId + sorted IDs).

---

## 7) Duplicate Send Prevention

### Retail

Key layers:
- **DB-level**
  - `CampaignMessage.trackingId` unique, and message creation uses `createMany(... skipDuplicates: true)` in enqueue service.
- **Send-claim lock**
  - `CampaignMessage.sendClaimToken` + `sendClaimedAt` prevents multiple workers from sending the same message.
  - Stale-claim recovery resets stuck processing.
- **Queue-level**
  - Enqueue uses a per-run token in jobId (`campaign:{id}:{runToken}:batch:{idx}`) to avoid jobId collisions blocking batches.

Primary files:
- `apps/retail-api/apps/api/src/services/campaignEnqueue.service.js`
- `apps/retail-api/apps/worker/src/sms.worker.js`
- `apps/retail-api/apps/worker/src/scheduler.worker.js`

### Shopify

Key layers:
- **DB-level**
  - `CampaignRecipient` is unique per campaign+phone: `@@unique([campaignId, phoneE164])`
  - Recipient creation uses batched `createMany(... skipDuplicates: true)`
- **Atomic campaign status transition**
  - Enqueue transitions campaign to `sending` using conditional update semantics inside a transaction (blocks concurrent enqueues).
- **Queue-level**
  - Job IDs are derived from a hash of sorted recipient IDs; enqueue also checks for an existing job containing the same recipient set.
- **Worker-level**
  - Before calling Mitto: refetches recipients and filters to those still `pending` and `mittoMessageId == null`.

Primary files:
- `apps/shopify-api/services/campaigns.js` (enqueue)
- `apps/shopify-api/queue/jobs/bulkSms.js` (send batch)
- `apps/shopify-api/queue/jobs/reconciliation.js` (re-enqueue missing)

---

## 8) Metrics & Reporting

### Retail metrics

Authoritative computation:
- `apps/retail-api/apps/api/src/services/campaignMetrics.service.js`
  - `accepted` is “has providerMessageId”
  - `delivered` is “deliveryStatus in deliveredStatuses[]”
  - `deliveryFailed` is “deliveryStatus in failedDeliveryStatuses[]”
  - `pendingDelivery = accepted - delivered - deliveryFailed`
  - `processed = delivered + deliveryFailed`
- `apps/retail-api/apps/api/src/services/campaignStats.service.js`
  - returns `sent: metrics.delivered` (note: “sent” label is actually “delivered” by DLR vocabulary)

Discrepancy risk:
- UI/consumers may interpret “sent” as “accepted by provider” (has providerMessageId), but stats returns “delivered”.

### Shopify metrics

Authoritative computation:
- Table `CampaignMetrics` in `apps/shopify-api/prisma/schema.prisma` tracks `totalSent`, `totalDelivered`, `totalFailed`, `totalProcessed`.
- Aggregation updates occur in:
  - Worker send paths (`apps/shopify-api/queue/jobs/bulkSms.js`, `apps/shopify-api/queue/jobs/mittoSend.js`)
  - DLR webhook updates + `updateCampaignAggregates` (`apps/shopify-api/controllers/mitto.js`, `apps/shopify-api/services/campaignAggregates.js`)
  - Polling status update jobs: `apps/shopify-api/services/delivery-status.js` and queue job wrappers.

Recommendation:
- Define shared KPI names across products (e.g., `accepted`, `delivered`, `failed_delivery`, `processed`) and ensure UI labels match.

---

## 9) Findings & Action Plan

### Must fix (high risk)

1) **Retail DLR webhook event persistence is likely broken**
- **Evidence**:
  - Prisma schema requires `WebhookEvent.eventId` (`apps/retail-api/prisma/schema.prisma`)
  - DLR route calls `persistWebhook(provider, eventType, payload, providerMessageId)` without `eventId` (`apps/retail-api/apps/api/src/routes/mitto.webhooks.js`)
  - This likely causes `WebhookEvent.create` to fail (caught + logged), so audit/dedupe never records.
- **Suggested approach**:
  - Generate deterministic `eventId` per DLR event (e.g., `${providerMessageId}:${status}:${minuteBucket}`) and write it with `@@unique([provider,eventId])`.
  - Optionally store `payloadHash` for additional dedupe.
- **Tests to add**:
  - Unit test for “DLR handler persists WebhookEvent with dedupe on repeats”.

2) **Shopify FE schema drift around campaign status**
- **Evidence**:
  - Backend enum includes `paused` + `completed` (`apps/shopify-api/prisma/schema.prisma`)
  - FE Zod schema validates only a subset (`apps/astronote-web/src/lib/shopify/api/schemas.ts`)
- **Suggested approach**:
  - Single shared exported `CampaignStatus` list used by both Zod and TS unions (or generate from one source).
- **Tests to add**:
  - Lightweight static parity script (see optional script in this task).

3) **Sent vs Delivered vocabulary mismatch impacts KPIs**
- **Evidence**:
  - Retail `sent` in stats is `metrics.delivered` (`apps/retail-api/apps/api/src/services/campaignStats.service.js`)
  - Shopify has `MessageStatus.delivered` but campaign-recipient status is typically `sent`/`failed`.
- **Suggested approach**:
  - Standardize metric names and adjust UI labels to match actual meaning (accepted vs delivered).
- **Tests to add**:
  - Integration test that a campaign with deliveryStatus=Delivered increments the correct “delivered” counter.

### Should fix

4) **Cross-product reconciliation parity**
- **Evidence**: two different reconciliation models (Retail: repeated polling jobs + aggregate reconcile; Shopify: reconciliation queue + periodic jobs).
- **Suggested approach**:
  - Document a shared “campaign finalization contract” and ensure both implementations conform.
- **Tests to add**:
  - Simulation tests with partial DLR delivery and worker restarts.

5) **Webhook replay/dedupe alignment**
- **Evidence**:
  - Shopify has replay protection via `WebhookEvent` and `webhook-replay.js`.
  - Retail has `WebhookEvent` schema but does not apply it for DLR dedupe (and persistence likely fails).
- **Suggested approach**:
  - Adopt the same replay wrapper pattern across both products.
- **Tests to add**:
  - “same DLR payload twice does not double-increment aggregates”.

### Nice to have

6) **Shared provider status vocabulary module**
- Suggested: a shared mapping table MittoStatus → internal delivery outcomes + KPI classifications.

---

## 10) Appendix

### Key files scanned

#### Retail (backend + workers)

- Prisma:
  - `apps/retail-api/prisma/schema.prisma`
- Campaign routes/services:
  - `apps/retail-api/apps/api/src/routes/campaigns.js`
  - `apps/retail-api/apps/api/src/services/campaignEnqueue.service.js`
  - `apps/retail-api/apps/api/src/services/campaignMetrics.service.js`
  - `apps/retail-api/apps/api/src/services/campaignStats.service.js`
  - `apps/retail-api/apps/api/src/services/statusRefresh.service.js`
- Queues/workers:
  - `apps/retail-api/apps/api/src/queues/sms.queue.js`
  - `apps/retail-api/apps/api/src/queues/statusRefresh.queue.js`
  - `apps/retail-api/apps/api/src/queues/scheduler.queue.js`
  - `apps/retail-api/apps/worker/src/sms.worker.js`
  - `apps/retail-api/apps/worker/src/statusRefresh.worker.js`
  - `apps/retail-api/apps/worker/src/scheduler.worker.js`
- Mitto integration:
  - `apps/retail-api/apps/api/src/services/mitto.service.js`
  - `apps/retail-api/apps/api/src/services/smsBulk.service.js`
  - `apps/retail-api/apps/api/src/routes/mitto.webhooks.js`
  - `apps/retail-api/apps/api/src/routes/mitto.js`
- Scheduling entry points:
  - `apps/retail-api/apps/api/src/server.js`

#### Shopify (backend)

- Prisma:
  - `apps/shopify-api/prisma/schema.prisma`
- Campaign routes/services:
  - `apps/shopify-api/routes/campaigns.js`
  - `apps/shopify-api/services/campaigns.js`
  - `apps/shopify-api/services/campaignAggregates.js`
  - `apps/shopify-api/services/delivery-status.js`
- Queues/workers:
  - `apps/shopify-api/queue/index.js`
  - `apps/shopify-api/queue/worker.js`
  - `apps/shopify-api/queue/jobs/bulkSms.js`
  - `apps/shopify-api/queue/jobs/mittoSend.js`
  - `apps/shopify-api/queue/jobs/deliveryStatusUpdate.js`
  - `apps/shopify-api/queue/jobs/reconciliation.js`
- Mitto integration + webhook replay:
  - `apps/shopify-api/services/mitto.js`
  - `apps/shopify-api/services/smsBulk.js`
  - `apps/shopify-api/controllers/mitto.js`
  - `apps/shopify-api/services/webhook-replay.js`
  - `apps/shopify-api/routes/mitto-webhooks.js`
- Scheduler:
  - `apps/shopify-api/services/scheduler.js`

#### Frontend (Retail + Shopify)

- Shopify campaigns UI:
  - `apps/astronote-web/app/app/shopify/campaigns/page.tsx`
  - `apps/astronote-web/app/app/shopify/campaigns/[id]/page.tsx`
  - `apps/astronote-web/app/app/shopify/campaigns/[id]/status/page.tsx`
  - `apps/astronote-web/src/lib/shopify/api/campaigns.ts`
  - `apps/astronote-web/src/lib/shopifyCampaignsApi.ts`
  - `apps/astronote-web/src/lib/shopify/api/schemas.ts`
- Retail campaigns UI:
  - `apps/astronote-web/app/app/retail/campaigns/page.tsx`
  - `apps/astronote-web/app/app/retail/campaigns/[id]/page.tsx`
  - `apps/astronote-web/app/app/retail/campaigns/[id]/status/page.tsx`
  - `apps/astronote-web/src/components/retail/StatusBadge.tsx`

### Example payloads (redacted)

#### Retail `smsQueue` bulk job payload

```json
{ "campaignId": 123, "ownerId": 456, "messageIds": [1001, 1002, 1003] }
```

#### Shopify `sms-send` bulk job payload

```json
{ "campaignId": "cuid_xxx", "shopId": "cuid_shop", "recipientIds": ["cuid_r1", "cuid_r2"] }
```

#### DLR event (common Mitto shape)

```json
{ "messageId": "mitto_msg_123", "deliveryStatus": "Delivered", "updatedAt": "2026-01-01T00:00:00Z" }
```


