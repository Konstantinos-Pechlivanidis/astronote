# Retail Send Pipeline Fix Report

## Pipeline map (API → Queue → Worker → Provider)
- API enqueue: `POST /api/campaigns/:id/enqueue` calls `services/campaignEnqueue.service.js`.
- Producer: uses `sms.queue` (BullMQ) with Redis from `lib/redis.js`; writes `CampaignMessage` rows in DB, then enqueues batch jobs.
- Worker: retail workers consume `smsQueue` (check deployed worker service entrypoint; queue name “smsQueue”).
- Provider send: worker dispatches to Mitto (provider layer in worker code) per batch/message.
- Status updates: webhook/status refresh via `statusRefresh.queue` and `statusRefresh.service` update `CampaignMessage` and campaign aggregates.
- Monitoring: `/api/jobs/health` now reports sms/scheduler/statusRefresh queue counts.

## Fixes applied
- BullMQ jobId safety: `services/campaignEnqueue.service.js` now uses colon-free jobIds (`campaign-<id>-<run>-batch-<idx>`) to avoid “Custom Id cannot contain :”.
- Queue health visibility: `/api/jobs/health` includes `statusRefresh` queue counts; existing sms/scheduler info preserved.
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
