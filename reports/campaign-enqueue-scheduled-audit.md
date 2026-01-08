# Campaign Enqueue + Scheduled Send Audit

## Current Flow Diagram

### Manual enqueue (API)
```
POST /api/campaigns/:id/enqueue
  -> apps/retail-api/apps/api/src/routes/campaigns.js
     - auth + requestId
     - enqueueCampaign(campaignId, correlationId)
  -> apps/retail-api/apps/api/src/services/campaignEnqueue.service.js
     - load campaign
     - resolve audience
     - check subscription + credits
     - claim status (updateMany -> sending)
     - create campaignMessage rows
     - enqueue smsQueue batch jobs
  -> response { queued, enqueuedJobs, status, requestId }
```

### Scheduled send (worker sweeper)
```
apps/retail-api/apps/worker/src/scheduler.worker.js
  -> repeatable job every 60s (sweepDueCampaigns)
     - query campaigns: status='scheduled' AND scheduledAt <= now
     - acquire Redis lock per campaign
     - enqueueCampaign(...) (same flow as manual enqueue)
```

### Worker queue flow (SMS)
```
apps/retail-api/apps/api/src/queues/sms.queue.js
  -> BullMQ smsQueue
  -> apps/retail-api/apps/worker/src/sms.worker.js
     - sendBulkSMS -> provider -> update message/campaign status
```

## Files Involved

- apps/retail-api/apps/api/src/routes/campaigns.js
- apps/retail-api/apps/api/src/services/campaignEnqueue.service.js
- apps/retail-api/apps/api/src/lib/redis.js
- apps/retail-api/apps/api/src/queues/sms.queue.js
- apps/retail-api/apps/worker/src/scheduler.worker.js
- apps/retail-api/apps/api/src/server.js

## Failure Points + Evidence

- Redis/BullMQ not ready: `campaignEnqueue.service.js` returns `queue_unavailable` when `sms.queue` is null or `waitUntilReady` fails; prior failures can surface as enqueue failures when queue add rejects.
- Enqueue batching errors: `smsQueue.add()` failures are logged per batch; if all batches fail, service logs "No jobs enqueued for campaign" and returns `enqueue_failed` (maps to `ENQUEUE_FAILED`).
- Audience resolution: `buildAudience()`/list queries can throw; now logged with step `resolve_audience` and correlationId.
- Credits/subscription: `getBalance()` or `isSubscriptionActive()` failures/insufficient values block enqueue; logged at steps `check_credits`/`check_subscription`.
- Prisma transaction/schema mismatches: `campaign.updateMany` or `campaignMessage.createMany` exceptions throw and bubble to 500; now logged with step `create_messages` and full stack.

## Fixes Applied

- Added step-level logging with `correlationId` across enqueue steps and structured error logging (campaignId/ownerId/step/stack) in `campaignEnqueue.service.js`.
- Enqueue endpoint now includes `requestId` in success and error responses and passes it into enqueue for correlation.
- Hardened Redis config to enable TLS automatically when `REDIS_URL` starts with `rediss://`.
- Queue init safety: `sms.queue` no longer throws on init failure; enqueue returns `QUEUE_UNAVAILABLE` instead of crashing the request.
- Scheduled send is now a single worker-run sweeper (repeatable job registered in worker). API no longer schedules delayed enqueue jobs.
- Added per-campaign Redis lock in sweeper to prevent double-enqueue when multiple sweeps overlap.
- API worker auto-spawn defaults to disabled in production; worker service should own background loops.

## Remaining TODOs / Deployment Notes

- Render env: ensure `REDIS_URL` uses `rediss://` and that Redis is reachable from both API and worker services.
- API service: set `START_WORKER=0` (or leave unset in production) to avoid spawning workers in the web process.
- Worker service: run the worker scripts (sms.worker.js + scheduler.worker.js) with the same DB/Redis env.
- Optional: move status refresh and campaign reconcile scheduling out of API into worker service for full separation.
- Tune if needed: `SCHEDULE_SWEEP_INTERVAL_MS`, `SCHEDULE_SWEEP_LIMIT`, `ENQUEUE_LOCK_TTL_SEC`.
