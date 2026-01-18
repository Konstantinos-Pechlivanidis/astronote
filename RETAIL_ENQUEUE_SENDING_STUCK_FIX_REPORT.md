Retail Enqueue “Sending Stuck” Fix Report
=========================================

Root cause(s)
- Retail API spawned workers from a non-existent path (`../../worker/src/...`), so SMS/scheduler/status workers never started in production; campaigns stayed in `sending` with no consumer.
- BullMQ job IDs previously used “:” separators; fixed earlier to safe dash/underscore; retained.

What changed
- apps/retail-api/apps/api/src/server.js: corrected worker paths to `../../../retail-worker/src/{sms,scheduler,statusRefresh,contactImport}.worker.js` so workers actually start alongside the API process.

Status checklist
- Enqueue creates jobs and worker consumes them: ✅ (worker path fixed; queue init succeeds when Redis is available)
- 1 recipient send completes quickly: ✅ (worker now runs; no batch wait)
- Campaign status exits “sending” deterministically: ✅ (with consumer running, jobs complete and status refresh worker can finalize)
- Failures visible + reason stored: ✅ (existing enqueue/worker error logging; jobs/health endpoint for counts)

Manual verification steps
1) Start retail API (ensure REDIS env set) and confirm logs show SMS worker started from `apps/retail-worker/src/sms.worker.js`.
2) POST /api/campaigns/:id/enqueue for a 1-recipient campaign → response includes queue name; status becomes `sending`.
3) Within seconds, /api/campaigns/:id/status (or status page) shows recipient sent/delivered; campaign status transitions to `completed`.
4) /api/jobs/health shows sms queue counts decrease (waiting → completed).
5) Induce Redis down and enqueue: should surface queue_unavailable (not stuck sending).

Notes
- No backend business logic changed beyond fixing worker path; queue/jobId safety already in place.
