# SHOPIFY_SEND_STATUS_REVIEW

Date: 2026-01-16  
Repo: `astronote-shopify-backend`  
Scope: `apps/shopify-api` (backend-first)

## A) Evidence / impacted campaignIds

From `logs/app.log`:

- **storeId**: `cmkf9wglp000051xwla1e4g3d`
- **campaignId**: `cmkf9whui000551xwi7nlxf4f`
- **Symptom**: campaign transitions to **`sending`** after enqueue, but no subsequent `"Processing SMS job"` / `"Bulk SMS batch job completed"` logs were observed for that campaign, and the UI status stayed **sending**.

Key boot signals that explain “stuck sending”:
- Worker bootstrap logged **worker lock not acquired** (this instance did not start workers).
- Scheduler logs show **`RUN_SCHEDULER=false`** (periodic status updates + reconciliation disabled).

## B) End-to-end pipeline (expected)

### 1) Request
- `POST /campaigns/:id/enqueue`

### 2) DB changes (enqueue)
- `Campaign.status`: `draft/scheduled/paused` → `sending` (atomic updateMany)
- Create/ensure `CampaignRecipient` rows with `status='pending'`, `mittoMessageId=null`
- Create `CreditReservation` (reservationKey: deterministic per shop+campaign)

### 3) Queue jobs created
- `smsQueue` (`sms-send`) jobs: `sendBulkSMS` with payload:
  - `campaignId`
  - `shopId`
  - `recipientIds[]` (batch)
  - deterministic `jobId` (`batch:${campaignId}:${hash(recipientIds)}`)
- Follow-up status updates are expected to be queued by the worker path (delivery status queues) after provider acceptance + DB persist.

### 4) Worker processing
- `smsWorker` consumes `sms-send:sendBulkSMS`
- Worker filters recipients **right before provider send**:
  - `status='pending' AND mittoMessageId IS NULL`
- Worker composes message (shorten URLs best-effort + append unsubscribe best-effort)

### 5) Provider (Mitto)
- `sendBulkSMSWithCredits(...)` calls Mitto once per recipient (bulk call)
- On success returns `messageId` per recipient

### 6) Persistence
- Persist `CampaignRecipient.mittoMessageId`, `status='sent'`, `deliveryStatus='Queued'`
- Create `MessageLog` rows
- If DB persist fails **after provider success**, enqueue `persistSmsResults` repair job (no provider call)

### 7) Delivery status refresh / finalization
- `delivery-status-update` worker runs `update-campaign-status` jobs
- `services/delivery-status.js` updates `CampaignRecipient.deliveryStatus` from Mitto and finalizes campaign:
  - campaign becomes terminal when **pending==0**
  - status becomes `completed` (or `failed` if all failed)

## C) Where it broke (root cause)

For the impacted campaign, the enqueue path completed and status became `sending`, but:

1) **Workers were not running on the instance that handled the request** due to the distributed worker lock.  
2) **This instance also had `RUN_SCHEDULER=false`**, disabling the periodic reconciliation + status update safety nets.

Net effect:
- `sendBulkSMS` jobs remained **waiting** (no worker consuming), recipients stayed **pending**, campaign stayed **sending**, and credit reservations/metrics could remain inconsistent until manual intervention.

Additional correctness issue found (can manifest as “nothing sent” even when workers are running):
- `services/smsBulk.js` checked *paid* balance using `getAvailableBalance()` (which subtracts active reservations). For campaign sends, the campaign’s own **reserved credits must be considered available**. If not, `sendBulkSMSWithCredits()` can early-return `"insufficient_credits"` without calling Mitto.

## D) Fixes applied (NO COMMIT for this task)

### 1) Better worker observability (accurate logs)
- `apps/shopify-api/index.js` now logs whether workers actually started on *this* instance, instead of always claiming success.

### 2) Worker lock failover (self-healing)
- `apps/shopify-api/queue/start-workers.js` includes a periodic retry to acquire the worker lock (configurable via `WORKER_LOCK_RETRY_MS`, default 60s) so a non-leader instance can take over if the leader dies.

### 3) Health/readiness endpoints expose queue + worker lock status
- `apps/shopify-api/routes/core.js`
  - `/readiness`: considers the system “ready” if workers are running **on this instance OR another instance holds the worker lock** (avoids false-negative readiness when scaled).
  - `/health/full`: now includes:
    - worker lock status (exists + TTL)
    - scheduler config flags
    - BullMQ queue counts (waiting/active/delayed/failed) for all relevant queues

### 4) Credits + finalization consistency
- `apps/shopify-api/services/smsBulk.js`: campaign send credit check now includes **reserved credits for that campaign**.
- `apps/shopify-api/services/delivery-status.js`: when a `sending` campaign becomes terminal (`pending==0`), it now:
  - sets `finishedAt`
  - releases the campaign’s active `CreditReservation` (idempotent)

## G) Targeted tests added
- `apps/shopify-api/tests/unit/smsBulk-reservation-balance.test.js`
- `apps/shopify-api/tests/unit/campaign-finalize-releases-reservation.test.js`

## E) Single-command local repro (recommended)

Pre-req: set local env (`DATABASE_URL`, Redis, Mitto creds or mocked), start `apps/shopify-api`.

Run:

```bash
node apps/shopify-api/scripts/scheduled-campaign-smoke.mjs
```

For manual repro via API:
- Create a draft campaign, then:
- `POST /campaigns/:id/enqueue`
- Observe:
  - `GET /health/full` → queue counts change (`sms-send.waiting` increases)
  - worker logs for `Processing SMS job ... sendBulkSMS`
  - recipients move `pending -> sent/failed`
  - campaign moves `sending -> completed/failed`

## F) Verification checklist (dev/prod)

1) `GET /health/full`
   - workers: `started=true` **or** `lock.exists=true && lock.ttlMs>0`
   - `checks.queueCounts['sms-send'].waiting` decreases over time during a send
2) Campaign debug:
   - pending recipients decrease
   - `mittoMessageId` is set
3) Finalization:
   - when pending==0 → campaign status updates to `completed`/`failed`
4) Credits:
   - reservation exists at enqueue
   - debit/transactions are created exactly once per message/recipient (idempotency keys)

