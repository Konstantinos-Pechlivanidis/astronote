Retail Enqueue/Worker Concurrency & Status Fix Report
=====================================================

Root causes
- API spawned workers from the wrong path, so workers never ran; campaigns remained in `sending`.
- Job IDs already sanitized (no `:`), but without running workers no progress occurred.

Changes
- apps/retail-api/apps/api/src/server.js: worker paths corrected to `apps/retail-api/apps/worker/src/{sms,scheduler,statusRefresh,contactImport}.worker.js`, ensuring worker processes start with the API.
- apps/retail-api/package.json: added direct worker scripts (worker:sms, worker:scheduler, worker:status, worker:contact-import) for standalone worker service or manual start; API start/dev already spawns workers in-process.
- apps/retail-api/apps/api/src/routes/jobs.js: enhanced /jobs/health to include Redis connection info for queues (auth-only).
- Job IDs remain colon-free (`campaign-<id>-run-...-batch-<idx>` from prior fix).

Checklist (DONE/NOT DONE)
- [x] Worker (apps/retail-api/apps/worker) consumes the same queues as API (smsQueue, scheduler, statusRefresh) using the same Redis client.
- [x] jobId no longer contains ":" and enqueue no longer fails for that reason.
- [x] 1-recipient campaign sends quickly when worker runs (consumer now starts alongside API).
- [x] Campaign status exits "sending" deterministically once worker processes jobs/status refresh runs.
- [x] API+worker can run concurrently via npm script (server start spawns workers; individual worker scripts available).
- [x] Render start strategy documented: single service can run API (spawns workers); optional separate worker service can use `npm run worker:sms` etc. with matching env (REDIS_URL, DATABASE_URL).

Manual verification
1) Start API locally: `npm run start -w @astronote/retail-api` (spawns workers). Logs should show SMS/Scheduler/Status workers starting from apps/worker.
2) Enqueue a 1-recipient campaign: POST /api/campaigns/:id/enqueue → status `sending`, sms queue gets jobs, worker logs “Job started/completed,” campaign moves to completed.
3) Check /api/jobs/health (auth required): returns sms/scheduler/status queue counts and Redis host info.
4) Optionally run worker separately: `npm run worker:sms -w @astronote/retail-api` (ensure REDIS_URL/DATABASE_URL set); enqueue again and observe completion.
5) If Redis is unavailable, enqueue returns queue_unavailable rather than leaving campaign stuck.
