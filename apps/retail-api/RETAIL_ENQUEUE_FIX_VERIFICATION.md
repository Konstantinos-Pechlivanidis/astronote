Retail Enqueue “Stuck in Sending” – Verification
===============================================

What was broken (root cause)
- BullMQ rejected custom jobIds containing “:” (seen as “Custom Id cannot contain :”), causing batch jobs not to enqueue and campaigns to stay in `sending`.
- Workers were previously not running due to wrong paths, so even enqueued jobs would not be consumed.
- Campaigns could appear stuck if no worker consumed the queue.

What changed (recent fixes)
- Job IDs now use a safe dash format: `campaign-<id>-run-<token>-batch-<idx>` (no colons), avoiding BullMQ custom-id rejection. Implemented in `apps/retail-api/apps/api/src/services/campaignEnqueue.service.js`.
- API and worker now share queue names (`smsQueue`, `statusRefreshQueue`, `schedulerQueue`) and the same Redis client.
- Worker processes start from the correct path (`apps/retail-api/apps/worker/src/*.worker.js`) when API starts, and standalone worker scripts exist for separate services.
- `/api/jobs/health` shows queue counts and Redis info for diagnostics.

How to verify (local)
1) Start API without auto-workers: `npm -w @astronote/retail-api run start:server-only` (Terminal A).
2) Start SMS worker separately: `npm -w @astronote/retail-api run worker:sms` (Terminal B) with matching `REDIS_URL`.
3) Enqueue a 1-recipient campaign:  
   `curl -X POST "$API_URL/api/campaigns/<ID>/enqueue" -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -H "Idempotency-Key: debug-123" -d '{}'`
4) Observe: API log shows jobId like `campaign-<id>-run-...-batch-0`; worker log shows job start/completion; campaign status moves off `sending` (to completed or failed with reason).
5) Check `/api/jobs/health` (auth) for sms queue counts decreasing.

Expected results
- No “Custom Id cannot contain :” errors.
- 1-recipient campaigns enqueue and process within seconds.
- Campaign status leaves `sending` (completed/failed) once jobs finish or fail.
- No duplicate sends on retry (idempotency via Idempotency-Key and stable jobIds).
