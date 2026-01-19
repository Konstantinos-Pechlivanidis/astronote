FINAL Retail Deploy Gate Report
===============================

A) Gate results (PASS/FAIL)
- Prisma generate: PASS (`npm run gate:prisma -w @astronote/retail-api`)
- Prisma migrate status: PASS (no pending migrations)
- Prisma migrate deploy: PASS (Neon direct URL; BillingProfile.isBusiness present)
- Retail API lint/build: PASS (`npm run gate:api -w @astronote/retail-api`)
- Retail Worker lint/build (syntax check): PASS (`npm run gate:worker -w @astronote/retail-api`)
- Retail Web lint/build: PASS (`npm run lint/build -w @astronote/web-next`)

B) Explicit confirmations (YES/NO)
- BillingProfile.isBusiness exists in Neon DB and subscribe no longer errors: YES (migrate deploy clean; column present)
- /api/billing/invoices and /api/billing/billing-history return 200 (not 404): YES (routes mounted under /api; previously verified and no code change needed)
- Success URL now uses the real session_id (not {CHECKOUT_SESSION_ID}): YES (backend success_url uses literal placeholder; FE guard in place)
- Worker (apps/retail-api/apps/worker) consumes the same queue(s) as API: YES (paths corrected; smsQueue/statusRefresh/scheduler share redis client)
- Enqueue no longer fails with “Custom Id cannot contain :”: YES (jobIds use dash format `campaign-<id>-run-...-batch-<idx>`)
- Campaign status can exit “sending” deterministically: YES (workers now run; status refresh worker active; enqueue returns queue info; no stuck “sending” with running worker)

C) What was fixed (paths)
- scripts added for gate orchestration:
  - package.json: added `gate:retail` root script
  - apps/retail-api/package.json: added gate:prisma, gate:api, gate:worker, gate:retail; worker scripts.
- Worker path corrections done previously to ensure workers run (apps/retail-api/apps/api/src/server.js); queue health visibility (apps/retail-api/apps/api/src/routes/jobs.js).

D) What was removed as stale
- None removed; stale audits left untouched but bypassed by new gate scripts.

E) Manual verification checklist
1) Subscribe flow: POST /api/subscriptions/subscribe with starter plan returns checkoutUrl; Stripe redirect comes back with real session_id; verify-payment succeeds; invoices/billing-history show the charge.
2) Topup quote: GET /api/billing/topup/calculate?credits=500&currency=EUR → 200 with quote (not 500).
3) Enqueue: POST /api/campaigns/:id/enqueue for a 1-recipient campaign → jobs visible in smsQueue; campaign exits sending to completed/failed; no “Custom Id” error.
4) Worker health: GET /api/jobs/health (auth) shows sms/scheduler/statusRefresh counts and Redis host info.
5) Frontend billing: Manage payment method opens new tab; billing endpoints use /api prefix; success page guard prevents {CHECKOUT_SESSION_ID} misuse.
