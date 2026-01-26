# Current Messaging Implementation Report (Retail)

## Executive summary (what exists today, what’s missing for the planned architecture)
- The Retail messaging stack is fully implemented end‑to‑end: contacts (CRUD + import + consent fields), campaigns (create/schedule/enqueue/send + stats), automations (welcome + birthday), public links (join, unsubscribe, offer/claim), and delivery status tracking via Mitto webhooks + polling.
- Sending is gated by a single rule (subscription must be active) at both API enqueue and worker send time; credits are reserved/committed via a wallet ledger and credit reservations.
- Public flows are live for join/NFC, unsubscribe, and offer/claim (including QR redemption); short links are resolved through `/public/s` + `/public/o` and the Next.js `/s/:shortCode` and `/o/:shortCode` resolvers.
- Missing/unclear: no explicit 1‑to‑1 messaging features found; no dedicated consent history/audit log beyond fields on `Contact` and event tables; shortlink UI pages under `(retail)/s` and `(retail)/o` are empty (actual resolvers are in `app/s` + `app/o`).
- Some operational hooks exist (status refresh worker, webhook replay protection, queue jobs), but there is no visible “operator” UI for message logs beyond campaign stats.

## File map (grouped by feature: contacts/campaigns/automations/public links/billing gate)
- Contacts UI: `apps/astronote-web/app/app/retail/contacts/page.tsx`, `apps/astronote-web/src/components/retail/contacts/*`, `apps/astronote-web/app/app/retail/contacts/import/page.tsx`
- Contacts API client/hooks: `apps/astronote-web/src/lib/retail/api/contacts.ts`, `apps/astronote-web/src/features/retail/contacts/hooks/*`
- Contacts backend: `apps/retail-api/apps/api/src/routes/contacts.js`, `apps/retail-api/apps/api/src/services/contactImport.service.js`
- Campaigns UI: `apps/astronote-web/app/app/retail/campaigns/page.tsx`, `apps/astronote-web/app/app/retail/campaigns/new/page.tsx`, `apps/astronote-web/app/app/retail/campaigns/[id]/page.tsx`, `apps/astronote-web/app/app/retail/campaigns/[id]/stats/page.tsx`
- Campaigns API client/hooks: `apps/astronote-web/src/lib/retail/api/campaigns.ts`, `apps/astronote-web/src/features/retail/campaigns/*`
- Campaigns backend: `apps/retail-api/apps/api/src/routes/campaigns.js`, `apps/retail-api/apps/api/src/services/campaignEnqueue.service.js`, `apps/retail-api/apps/api/src/services/audience.service.js`, `apps/retail-api/apps/api/src/services/campaignStats.service.js`, `apps/retail-api/apps/api/src/services/campaignMetrics.service.js`
- Automations UI: `apps/astronote-web/app/app/retail/automations/page.tsx`, `apps/astronote-web/src/components/retail/automations/*`
- Automations backend: `apps/retail-api/apps/api/src/routes/automations.js`, `apps/retail-api/apps/api/src/services/automation.service.js`, `apps/retail-api/apps/api/src/services/automationStats.service.js`
- Public links (join/NFC/unsubscribe/offer):
  - Backend routes: `apps/retail-api/apps/api/src/routes/publicJoin.routes.js`, `apps/retail-api/apps/api/src/routes/publicNfc.routes.js`, `apps/retail-api/apps/api/src/routes/publicShort.routes.js`, `apps/retail-api/apps/api/src/routes/contacts.js` (unsubscribe/preferences/resubscribe), `apps/retail-api/apps/api/src/routes/tracking.js` (offer/redeem)
  - Frontend public pages: `apps/astronote-web/app/(public)/join/[token]/page.tsx`, `apps/astronote-web/app/(public)/join/[token]/JoinPageV2Client.tsx`, `apps/astronote-web/app/(retail)/unsubscribe/page.tsx`, `apps/astronote-web/app/(retail)/resubscribe/page.tsx`, `apps/astronote-web/app/(retail)/tracking/offer/[trackingId]/page.tsx`, `apps/astronote-web/app/(retail)/tracking/redeem/[trackingId]/page.tsx`, `apps/astronote-web/app/(retail)/retail/nfc/[token]/page.tsx`
  - Shortlink resolvers: `apps/astronote-web/app/s/[shortCode]/route.ts`, `apps/astronote-web/app/o/[shortCode]/route.ts`
- Billing gate (credits/subscription gating): `apps/astronote-web/src/features/retail/billing/hooks/useBillingGate.ts`, `apps/retail-api/apps/api/src/services/subscription.service.js`, `apps/retail-api/apps/api/src/services/wallet.service.js`, `apps/retail-api/apps/api/src/services/credit-reservation.service.js`, `apps/retail-api/apps/api/src/services/smsBulk.service.js`, `apps/retail-api/apps/worker/src/sms.worker.js`
- Queues/workers: `apps/retail-api/apps/api/src/queues/*`, `apps/retail-api/apps/worker/src/*`
- Prisma schema: `apps/retail-api/prisma/schema.prisma`

## 1) Contacts
- UI capabilities
  - List/search/filter/paginate contacts, add/edit/delete contacts; subscription toggle on contact form; list filter includes system-defined lists (age/gender/all). UI entry: `apps/astronote-web/app/app/retail/contacts/page.tsx`, `apps/astronote-web/src/components/retail/contacts/ContactsTable.tsx`, `apps/astronote-web/src/components/retail/contacts/ContactForm.tsx`.
  - Bulk import flow with template download, upload, job progress + results: `apps/astronote-web/app/app/retail/contacts/import/page.tsx`.
- Data model fields (Prisma)
  - `Contact`: `ownerId`, phone (E.164), email, firstName/lastName, gender, birthday, `isSubscribed`, `unsubscribeTokenHash`, `unsubscribedAt`, `gdprConsentAt/source/version`, `smsConsentStatus/At/Source`, `consentEvidence` (`apps/retail-api/prisma/schema.prisma`).
- Import flow + validation (E.164, dedupe)
  - Upload accepts `.xlsx` only; file parsed by `XLSX` and mapped/validated; phone normalized to E.164; email/gender/birthday validated; `subscribed` column maps to `isSubscribed` (`apps/retail-api/apps/api/src/services/contactImport.service.js`).
  - Import job queue: `contactImportQueue` job `importContacts` (`apps/retail-api/apps/api/src/routes/contacts.js`, `apps/retail-api/apps/worker/src/contactImport.worker.js`).
  - Deduping is enforced by `ownerId + phone` unique index in Prisma and “skip duplicates” option in import jobs.
- Consent handling today (what “Subscribed” means)
  - `isSubscribed` is the primary flag to include contacts in audiences (`apps/retail-api/apps/api/src/services/audience.service.js`).
  - Public join and NFC flows set `gdprConsent*` and `smsConsent*` fields and mark `isSubscribed = true` (`apps/retail-api/apps/api/src/routes/publicJoin.routes.js`, `apps/retail-api/apps/api/src/routes/publicNfc.routes.js`).
  - Unsubscribe/resubscribe flows toggle `isSubscribed` and `smsConsentStatus` (`apps/retail-api/apps/api/src/routes/contacts.js`).
  - Inbound STOP from Mitto unsubscribes by phone across all owners (`apps/retail-api/apps/api/src/routes/mitto.webhooks.js`).
- Gaps vs future (events/service vs marketing) — only identify, don’t propose fixes
  - No explicit consent history/audit trail beyond `Contact` fields and `PublicSignupEvent`/`NfcScan` entries. Unknown whether a dedicated consent audit log is required for the planned architecture.

## 2) Campaigns
- Create/edit/list UX and fields
  - Multi-step creation flow (Basics → Audience → Schedule → Review), message editor with template tokens and phone preview, audience preview panel; scheduling supports immediate or local date/time (`apps/astronote-web/app/app/retail/campaigns/new/page.tsx`).
  - Campaign list with status filter and live polling for active campaigns (`apps/astronote-web/app/app/retail/campaigns/page.tsx`).
  - Campaign detail shows status, preview, and send actions with confirmation; stats page shows delivered, conversions, unsubscribes (`apps/astronote-web/app/app/retail/campaigns/[id]/page.tsx`, `apps/astronote-web/app/app/retail/campaigns/[id]/stats/page.tsx`).
- Audience resolution logic (all/lists/segments/gender etc.)
  - Contacts must be `isSubscribed = true`; age filter requires birthdays and enforces 18+ even for “all ages” (`apps/retail-api/apps/api/src/services/audience.service.js`).
  - Supports system-defined virtual lists for gender and age segments (`apps/retail-api/apps/api/src/services/predefinedLists.service.js`).
  - Legacy list membership still supported when a campaign is tied to a list (`apps/retail-api/apps/api/src/services/campaignEnqueue.service.js`).
- Enqueue pipeline + queues/jobs + idempotency
  - `/api/campaigns/:id/enqueue` calls `enqueueCampaign` which: validates status, builds audience, checks subscription + credits, sets campaign to `sending`, creates `CampaignMessage` rows, reserves credits, and enqueues `sendBulkSMS` jobs on `smsQueue` (`apps/retail-api/apps/api/src/routes/campaigns.js`, `apps/retail-api/apps/api/src/services/campaignEnqueue.service.js`).
  - Campaign enqueue logs include `requestId` and optional `Idempotency-Key`, but no explicit idempotency store is visible in the enqueue route (only optimistic status lock + run token for job IDs).
- Message creation (templating variables, unsubscribe insertion, offer insertion)
  - Template rendering uses `render` from `lib/template` with contact data; URLs in message are shortened at enqueue time (`apps/retail-api/apps/api/src/services/campaignEnqueue.service.js`).
  - Offer/unsubscribe links are appended at send time in the worker, not at enqueue time; the worker removes any pre-existing offer/unsubscribe blocks and appends `Claim Offer` + `To unsubscribe` links (`apps/retail-api/apps/worker/src/sms.worker.js`).
- Delivery status updates (DLR webhook, reconciliation)
  - Mitto DLR webhook updates `CampaignMessage` status (`/webhooks/mitto/dlr`), with replay protection and aggregates refresh (`apps/retail-api/apps/api/src/routes/mitto.webhooks.js`).
  - Status refresh worker polls Mitto for pending/unknown statuses (`apps/retail-api/apps/api/src/services/statusRefresh.service.js`, `apps/retail-api/apps/worker/src/statusRefresh.worker.js`).
- Metrics exposed in UI (dashboard + campaign stats)
  - Campaign stats API returns delivered/sent, failed, conversions, unsubscribes, rates (`apps/retail-api/apps/api/src/services/campaignStats.service.js`); UI displays delivered, conversions, unsubscribes (`apps/astronote-web/app/app/retail/campaigns/[id]/stats/page.tsx`).

## 3) Automations
- Current automation types (welcome/birthday/others)
  - Two system-defined types: `welcome_message` and `birthday_message` (`apps/retail-api/prisma/schema.prisma`, `apps/retail-api/apps/api/src/services/automation.service.js`). No other automation types found.
- Trigger definitions and scheduling mechanism
  - Welcome automation triggers on contact creation and only if subscribed (`apps/retail-api/apps/api/src/routes/contacts.js` → `triggerWelcomeAutomation`).
  - Birthday automation runs daily via scheduler queue cron (`processBirthdayAutomations` scheduled in `apps/retail-api/apps/worker/src/scheduler.worker.js`).
- Enable/disable storage and enforcement
  - `Automation.isActive` governs whether messages are sent; UI toggles via `/api/automations/:type` (`apps/retail-api/apps/api/src/routes/automations.js`, `apps/astronote-web/app/app/retail/automations/page.tsx`).
- Message template + personalization
  - Templates allow `{{first_name}}`/`{{last_name}}` in `messageBody` and are rendered with contact data (`apps/retail-api/apps/api/src/services/automation.service.js`).
- Guardrails (consent check, billing gate, dedupe, rate limits)
  - Automation sends only to subscribed contacts and avoids duplicate welcome sends (`apps/retail-api/apps/api/src/services/automation.service.js`).
  - Billing gate is enforced during sending via `sms.service` and subscription checks in worker paths; automations use `sendSMSWithCredits` (`apps/retail-api/apps/api/src/services/sms.service.js`).

## 4) Unsubscribe flow
- How unsubscribe URL is generated and stored
  - Unsubscribe tokens are HMAC‑signed payloads with `contactId` + `storeId` + optional `campaignId` (`apps/retail-api/apps/api/src/services/token.service.js`).
  - Token hash is stored on `Contact` (`unsubscribeTokenHash`), but tokens are generated at send time and do not appear to be stored per message.
  - Short unsubscribe links are created via `buildUnsubscribeShortUrl` and stored in `ShortLink` (kind `unsubscribe`) (`apps/retail-api/apps/api/src/services/publicLinkBuilder.service.js`).
- Public endpoint/page route map
  - API: `/api/contacts/unsubscribe`, `/api/contacts/unsubscribe/:token`, `/api/unsubscribe`, `/api/unsubscribe/:token`, `/api/contacts/preferences/:pageToken`, `/api/contacts/resubscribe` (`apps/retail-api/apps/api/src/routes/contacts.js`).
  - Frontend: `/unsubscribe` (`apps/astronote-web/app/(retail)/unsubscribe/page.tsx`), `/resubscribe` (`apps/astronote-web/app/(retail)/resubscribe/page.tsx`).
  - Shortlink redirectors: `/s/:shortCode` and `/o/:shortCode` handled by Next.js routes (`apps/astronote-web/app/s/[shortCode]/route.ts`, `apps/astronote-web/app/o/[shortCode]/route.ts`) which call `/public/s/:shortCode` or `/public/o/:shortCode` on the API.
- What happens on unsubscribe (DB updates, logs, confirmations)
  - Sets `isSubscribed = false`, `unsubscribedAt = now`, and `smsConsentStatus = opted_out` for the contact; returns success even if already unsubscribed (`apps/retail-api/apps/api/src/routes/contacts.js`).
  - Frontend shows confirmation message and store name (`apps/astronote-web/app/(retail)/unsubscribe/page.tsx`).
- Edge cases (already unsubscribed, invalid token)
  - Invalid/expired tokens return 400; “already unsubscribed” returns success with status message (backend and frontend handle both) (`apps/retail-api/apps/api/src/routes/contacts.js`, `apps/astronote-web/app/(retail)/unsubscribe/page.tsx`).

## 5) Offer / Claim flow
- How offer URL is generated
  - Each `CampaignMessage` and `AutomationMessage` gets a `trackingId`. Offer URLs are built from `trackingId` and shortened into `ShortLink` records (`apps/retail-api/apps/api/src/services/publicLinkBuilder.service.js`).
- Public endpoint/page route map
  - API: `/tracking/offer/:trackingId`, `/tracking/redeem/:trackingId`, `/tracking/redeem-public/:trackingId` (`apps/retail-api/apps/api/src/routes/tracking.js`).
  - Frontend: `/tracking/offer/:trackingId`, `/tracking/redeem/:trackingId` with public UI and QR (`apps/astronote-web/app/(retail)/tracking/offer/[trackingId]/page.tsx`, `apps/astronote-web/app/(retail)/tracking/redeem/[trackingId]/page.tsx`).
- Redeem/claim behavior and what “conversion” means in DB
  - Redeems create `Redemption` (campaign) or `AutomationRedemption` (automation) records; offer views create `OfferViewEvent` (`apps/retail-api/apps/api/src/routes/tracking.js`, `apps/retail-api/prisma/schema.prisma`).
  - Conversions in campaign stats are derived from `Redemption` count (`apps/retail-api/apps/api/src/services/campaignStats.service.js`).
- QR generation/usage if present
  - Offer page generates a QR code via external QR API pointing to the redeem URL (`apps/astronote-web/app/(retail)/tracking/offer/[trackingId]/page.tsx`).

## 6) 1-to-1 messaging (if exists)
- No dedicated 1‑to‑1 messaging UI, routes, or models were found in the Retail code paths searched. Unknown if this feature is planned or exists in another package.

## 7) Billing & credits gating
- Where active subscription is enforced (frontend + backend)
  - Frontend gate: `useBillingGate` blocks automations and campaign send actions when subscription is not active (`apps/astronote-web/src/features/retail/billing/hooks/useBillingGate.ts`, `apps/astronote-web/app/app/retail/automations/page.tsx`, `apps/astronote-web/app/app/retail/campaigns/[id]/page.tsx`).
  - Backend gate: `canSendOrSpendCredits` in `subscription.service` blocks enqueue and send (`apps/retail-api/apps/api/src/services/subscription.service.js`, `apps/retail-api/apps/api/src/services/campaignEnqueue.service.js`, `apps/retail-api/apps/worker/src/sms.worker.js`).
- Credit wallet logic (reserve/debit/refund) and where it’s used
  - Wallet + ledger in `wallet.service`, reservations in `credit-reservation.service`; campaign enqueue reserves credits per message; worker commits on send (`apps/retail-api/apps/api/src/services/wallet.service.js`, `apps/retail-api/apps/api/src/services/credit-reservation.service.js`, `apps/retail-api/apps/worker/src/sms.worker.js`).
- How UI surfaces blocked states
  - Billing gate cards and CTAs link to Billing; send action is blocked in Campaign detail if inactive (`apps/astronote-web/app/app/retail/automations/page.tsx`, `apps/astronote-web/app/app/retail/campaigns/[id]/page.tsx`).

## 8) Multi-tenant + security
- How shop/owner context is resolved in retail
  - `requireAuth` extracts user ID from JWT and sets `req.user`; routes scope all data by `ownerId` (`apps/retail-api/apps/api/src/middleware/requireAuth.js`, `apps/retail-api/apps/api/src/lib/policies.js`).
  - Prisma schema enforces `ownerId` foreign keys across Contact, Campaign, CampaignMessage, Automation, etc. (`apps/retail-api/prisma/schema.prisma`).
- How access is protected for the above flows
  - Retail API endpoints use `requireAuth` and owner‑scoped queries; public endpoints are rate‑limited and token‑verified (unsubscribe, join, tracking) (`apps/retail-api/apps/api/src/routes/contacts.js`, `apps/retail-api/apps/api/src/routes/publicJoin.routes.js`, `apps/retail-api/apps/api/src/routes/tracking.js`).
- Admin-only endpoints (exports, etc.) if present
  - Billing exports are present but out of scope for messaging; no admin-only messaging endpoints found.

## 9) Key risks / unknowns
- 1‑to‑1 messaging: no evidence of UI/API/model support found (Unknown).
- Shortlink UI routes under `apps/astronote-web/app/(retail)/s` and `apps/astronote-web/app/(retail)/o` are empty; resolution is handled via `app/s` and `app/o` Next.js routes (potential duplication/unused folders; Unknown if intentional).
- Consent audit history: no separate consent history table beyond `Contact` fields and `PublicSignupEvent`/`NfcScan`/`WebhookEvent` (Unknown if compliance requirement is satisfied).
- No UI for message-level logs beyond campaign stats (Unknown if required).

## Developer appendix

### API endpoints inventory (Retail messaging only)
| Method | Path | Purpose | Evidence |
| --- | --- | --- | --- |
| GET | `/api/contacts` | List contacts (search/filter) | `apps/retail-api/apps/api/src/routes/contacts.js` |
| POST | `/api/contacts` | Create contact | `apps/retail-api/apps/api/src/routes/contacts.js` |
| GET | `/api/contacts/:id` | Contact detail | `apps/retail-api/apps/api/src/routes/contacts.js` |
| PUT | `/api/contacts/:id` | Update contact | `apps/retail-api/apps/api/src/routes/contacts.js` |
| DELETE | `/api/contacts/:id` | Delete contact | `apps/retail-api/apps/api/src/routes/contacts.js` |
| POST | `/api/contacts/import` | Upload contacts import file | `apps/retail-api/apps/api/src/routes/contacts.js` |
| GET | `/api/contacts/import/:jobId` | Import job status | `apps/retail-api/apps/api/src/routes/contacts.js` |
| GET | `/api/contacts/import/template` | Download Excel template | `apps/retail-api/apps/api/src/routes/contacts.js` |
| GET | `/api/contacts/preferences/:pageToken` | Public preferences lookup | `apps/retail-api/apps/api/src/routes/contacts.js` |
| POST | `/api/contacts/unsubscribe` | Public unsubscribe | `apps/retail-api/apps/api/src/routes/contacts.js` |
| POST | `/api/contacts/unsubscribe/:token` | Public unsubscribe (token in URL) | `apps/retail-api/apps/api/src/routes/contacts.js` |
| POST | `/api/unsubscribe` | Public unsubscribe alias | `apps/retail-api/apps/api/src/routes/contacts.js` |
| POST | `/api/unsubscribe/:token` | Public unsubscribe alias | `apps/retail-api/apps/api/src/routes/contacts.js` |
| POST | `/api/contacts/resubscribe` | Public resubscribe | `apps/retail-api/apps/api/src/routes/contacts.js` |
| GET | `/api/campaigns` | List campaigns | `apps/retail-api/apps/api/src/routes/campaigns.js` |
| POST | `/api/campaigns` | Create campaign | `apps/retail-api/apps/api/src/routes/campaigns.js` |
| GET | `/api/campaigns/:id` | Campaign detail | `apps/retail-api/apps/api/src/routes/campaigns.js` |
| PUT | `/api/campaigns/:id` | Update campaign | `apps/retail-api/apps/api/src/routes/campaigns.js` |
| POST | `/api/campaigns/:id/enqueue` | Enqueue send | `apps/retail-api/apps/api/src/routes/campaigns.js` |
| POST | `/api/campaigns/:id/schedule` | Schedule campaign | `apps/retail-api/apps/api/src/routes/campaigns.js` |
| POST | `/api/campaigns/:id/unschedule` | Unschedule campaign | `apps/retail-api/apps/api/src/routes/campaigns.js` |
| GET | `/api/campaigns/:id/status` | Campaign status/metrics | `apps/retail-api/apps/api/src/routes/campaigns.js` |
| GET | `/api/campaigns/:id/preview` | Render preview samples | `apps/retail-api/apps/api/src/routes/campaigns.js` |
| POST | `/api/campaigns/preview-audience` | Audience size preview | `apps/retail-api/apps/api/src/routes/campaigns.js` |
| GET | `/api/campaigns/:id/stats` | Campaign stats | `apps/retail-api/apps/api/src/routes/campaigns.js` |
| GET | `/api/automations` | List automations | `apps/retail-api/apps/api/src/routes/automations.js` |
| GET | `/api/automations/:type` | Automation detail | `apps/retail-api/apps/api/src/routes/automations.js` |
| PUT | `/api/automations/:type` | Update automation | `apps/retail-api/apps/api/src/routes/automations.js` |
| GET | `/api/automations/:type/stats` | Automation stats | `apps/retail-api/apps/api/src/routes/automations.js` |
| GET | `/public/join/:token` | Public join page config | `apps/retail-api/apps/api/src/routes/publicJoin.routes.js` |
| POST | `/public/join/:token` | Public join submit | `apps/retail-api/apps/api/src/routes/publicJoin.routes.js` |
| GET | `/public/nfc/:token` | Public NFC info | `apps/retail-api/apps/api/src/routes/publicNfc.routes.js` |
| POST | `/public/nfc/:token/submit` | Public NFC submit | `apps/retail-api/apps/api/src/routes/publicNfc.routes.js` |
| GET | `/public/s/:shortCode` | Short link resolver | `apps/retail-api/apps/api/src/routes/publicShort.routes.js` |
| GET | `/public/o/:shortCode` | Offer short link resolver | `apps/retail-api/apps/api/src/routes/publicShort.routes.js` |
| GET | `/tracking/offer/:trackingId` | Offer info | `apps/retail-api/apps/api/src/routes/tracking.js` |
| GET | `/tracking/redeem/:trackingId` | Redeem status | `apps/retail-api/apps/api/src/routes/tracking.js` |
| POST | `/tracking/redeem-public/:trackingId` | Public redeem | `apps/retail-api/apps/api/src/routes/tracking.js` |
| POST | `/tracking/redeem` | Authenticated redeem | `apps/retail-api/apps/api/src/routes/tracking.js` |
| POST | `/webhooks/mitto/dlr` | Mitto DLR webhook | `apps/retail-api/apps/api/src/routes/mitto.webhooks.js` |
| POST | `/webhooks/mitto/inbound` | Mitto inbound STOP | `apps/retail-api/apps/api/src/routes/mitto.webhooks.js` |
| GET | `/api/billing/summary` | Billing summary for gating | `apps/retail-api/apps/api/src/routes/billing.js` |

### Queue/jobs inventory (producer/consumer)
| Queue | Job type | Producer | Consumer |
| --- | --- | --- | --- |
| `smsQueue` | `sendBulkSMS` | `enqueueCampaign` in `apps/retail-api/apps/api/src/services/campaignEnqueue.service.js` | `apps/retail-api/apps/worker/src/sms.worker.js` |
| `schedulerQueue` | `sweepDueCampaigns` | `apps/retail-api/apps/worker/src/scheduler.worker.js` | same worker |
| `schedulerQueue` | `processBirthdayAutomations` | `apps/retail-api/apps/worker/src/scheduler.worker.js` | same worker (`processBirthdayAutomations`) |
| `schedulerQueue` | `reconcileCreditReservations` | `apps/retail-api/apps/worker/src/scheduler.worker.js` | same worker (`credit-reservation.service.js`) |
| `statusRefreshQueue` | `refreshPendingStatuses` | (producer not found in repo; Unknown) | `apps/retail-api/apps/worker/src/statusRefresh.worker.js` |
| `statusRefreshQueue` | `refreshMissingDeliveryStatuses` | (producer not found in repo; Unknown) | `apps/retail-api/apps/worker/src/statusRefresh.worker.js` |
| `contactImportQueue` | `importContacts` | `apps/retail-api/apps/api/src/routes/contacts.js` | `apps/retail-api/apps/worker/src/contactImport.worker.js` |

### Prisma models inventory (messaging‑relevant)
- `User` (subscription status/plan, senderName, billing hold, etc.)
- `Contact` (phone, consent fields, subscription status, unsubscribe hash)
- `List`, `ListMembership` (segments)
- `Campaign`, `CampaignMessage` (status, trackingId, providerMessageId, billingStatus)
- `Automation`, `AutomationMessage`, `AutomationRedemption`
- `ShortLink`, `PublicLinkToken`, `PublicSignupEvent`
- `Redemption`, `OfferViewEvent`, `ConversionEvent`
- `WebhookEvent` (webhook replay/audit)
- `Wallet`, `CreditTransaction`, `CreditReservation` (billing gate)

### Env vars referenced by these features
- Messaging/SMS: `MITTO_API_BASE`, `MITTO_API_KEY`, `MITTO_SENDER`, `SMS_TRAFFIC_ACCOUNT_ID`, `MITTO_TRAFFIC_ACCOUNT_ID`, `SMS_BATCH_SIZE`, `SMS_SEND_DEBUG`, `DEBUG_SEND_LOGS`
- Webhooks/Unsubscribe: `WEBHOOK_SECRET`, `UNSUBSCRIBE_TOKEN_SECRET`
- Public URLs/shortlinks: `PUBLIC_WEB_BASE_URL`, `PUBLIC_RETAIL_BASE_URL`, `FRONTEND_URL`, `RETAIL_API_BASE_URL`, `NEXT_PUBLIC_RETAIL_API_BASE_URL`, `NEXT_PUBLIC_PUBLIC_BASE_URL`
- Queues/Redis: `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_USERNAME`, `REDIS_TLS`, `QUEUE_DISABLED`, `QUEUE_RATE_MAX`, `QUEUE_RATE_DURATION_MS`, `QUEUE_ATTEMPTS`, `QUEUE_BACKOFF_MS`
- Scheduling: `SCHEDULE_SWEEP_INTERVAL_MS`, `SCHEDULE_SWEEP_LIMIT`, `SEND_CLAIM_STALE_MINUTES`, `SCHEDULER_CONCURRENCY`, `STATUS_REFRESH_CONCURRENCY`
- Billing gate: `CREDITS_INCLUDED_MONTHLY`, `CREDITS_INCLUDED_YEARLY`, `CREDIT_RESERVATION_TTL_MINUTES`, `CREDIT_RESERVATION_RECONCILE_CRON`, `CREDIT_PRICE_EUR`, `CREDIT_VAT_RATE`

