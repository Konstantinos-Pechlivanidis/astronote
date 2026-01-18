# Retail Send Pipeline Fix Report

## Pipeline map (API → Queue → Worker → Provider)
- API enqueue: `POST /api/campaigns/:id/enqueue` → `services/campaignEnqueue.service.js`.
- Producer: writes `CampaignMessage` rows, then enqueues bulk jobs to `smsQueue` (BullMQ) using Redis from `lib/redis.js`.
- Workers: started from API (`server.js` spawns `../../worker/src/sms.worker.js`, scheduler/statusRefresh/contactImport). sms worker consumes `smsQueue`; statusRefresh worker handles status updates.
- Provider: sms worker sends via Mitto (provider layer) per batch/message.
- Status: webhook + `statusRefresh.queue` / `statusRefresh.service` update `CampaignMessage` + campaign aggregates.
- Monitoring: `/api/jobs/health` reports sms/scheduler/statusRefresh queue counts.

## Fixes applied
- BullMQ jobId safety: `services/campaignEnqueue.service.js` now uses colon-free jobIds (`campaign-<id>-<run>-batch-<idx>`) to avoid “Custom Id cannot contain :”; logs include queue name.
- Enqueue response now includes queue name to aid tracing.
- Queue health visibility: `/api/jobs/health` includes `statusRefresh` queue counts; sms/scheduler info preserved.
- Prisma/tooling stable at v6.17.1; migrations applied (BillingProfile.isBusiness present) to avoid P2022 that blocked enqueue/send.

## Verification steps (send flow)
1) Start API + worker pointing to same Redis (check Redis host logs at startup).
2) Create a campaign with 1 recipient; call `POST /api/campaigns/:id/enqueue` → expect 200 with queued count and no jobId errors.
3) In Redis/BullMQ UI or `/api/jobs/health`, see smsQueue waiting/active counts > 0.
4) Worker processes job → Mitto called; campaign/recipient status moves to sent/delivered quickly; `/api/campaigns/:id/status` (or detail endpoint) reflects updates.
5) If queue unavailable, API returns `queue_unavailable` reason (no generic 500).

## Remaining risks / notes
- Ensure worker service is running in production with identical Redis env as API.
- If sends stall, check Redis availability and Mitto provider responses; use `/api/jobs/health` for queue visibility.
- Batch size default still large; for very small campaigns the batches will be tiny and should execute immediately now that jobIds are valid.
