# Messaging Gap Analysis & Phase Plan (Retail)

## Executive summary
- Current Retail messaging is production‑ready for campaigns/automations with consent fields, unsubscribe links, shortlinks, offers, and delivery tracking; however it operates as a single “marketing‑style” pipeline (unsubscribe + offer appended by default).
- Target architecture introduces a marketing vs service message split, a customer events layer, automation presets by business profile, and stricter multi‑tenant guarantees, which are not present today.
- The largest immediate risks against target: inbound STOP unsubscribes across all owners, no serviceAllowed flag, no event model, and shortlink resolution not explicitly scoped to owner context.

## 1) What we already have (mapped to target)
- Marketing message behaviors (partial)
  - Unsubscribe and offer links are appended at send time for campaigns (`apps/retail-api/apps/worker/src/sms.worker.js`) and automations (`apps/retail-api/apps/api/src/services/sms.service.js`).
  - Shortlinks and offer tracking are implemented (`apps/retail-api/apps/api/src/services/publicLinkBuilder.service.js`, `apps/retail-api/apps/api/src/routes/publicShort.routes.js`).
- Contacts consent (partial)
  - `isSubscribed` exists and gates campaigns/automations (`apps/retail-api/prisma/schema.prisma`, `apps/retail-api/apps/api/src/services/audience.service.js`).
  - Consent evidence exists for public join/NFC (`apps/retail-api/apps/api/src/routes/publicJoin.routes.js`, `apps/retail-api/apps/api/src/routes/publicNfc.routes.js`).
- Offer/claim layer (implemented)
  - Tracking endpoints and public UI for offer/claim + QR (`apps/retail-api/apps/api/src/routes/tracking.js`, `apps/astronote-web/app/(retail)/tracking/*`).
- Automation (limited)
  - System-defined welcome & birthday automations, daily scheduler (`apps/retail-api/apps/api/src/services/automation.service.js`, `apps/retail-api/apps/worker/src/scheduler.worker.js`).
- Multi‑tenant scoping (mostly in place)
  - `ownerId` scoping via `requireAuth` and Prisma relations (`apps/retail-api/apps/api/src/middleware/requireAuth.js`, `apps/retail-api/prisma/schema.prisma`).
- Billing gate (implemented)
  - Single rule: subscription must be active enforced in API enqueue + worker send (`apps/retail-api/apps/api/src/services/subscription.service.js`, `apps/retail-api/apps/worker/src/sms.worker.js`).

## 2) Gaps (what’s missing)
- Message type policy gaps
  - No explicit message type (marketing vs service) on campaigns/automations; unsubscribe/offer appended by default in both workers and service sends (`apps/retail-api/apps/worker/src/sms.worker.js`, `apps/retail-api/apps/api/src/services/sms.service.js`).
  - No policy engine to decide when to include unsubscribe/offer links or service links based on message type.
- Contacts consent gaps (serviceAllowed, consent evidence UX)
  - `serviceAllowed` does not exist in `Contact`; no UI or API for service consent capture beyond `isSubscribed` (marketing) (`apps/retail-api/prisma/schema.prisma`, `apps/astronote-web/app/app/retail/contacts/*`).
  - Consent evidence is captured in public join/NFC flows but not exposed in the Retail UI for review.
- Events layer gaps (models, ingestion, UI)
  - No `CustomerEvent` model or ingestion endpoints/UI for appointment/membership/stay/purchase/visit/custom; no event‑driven triggers in automations.
- Automation library gaps (types, triggers, UI)
  - Only welcome/birthday automations exist; no presets per business profile and no event‑based triggers.
- 1-to-1 messaging gaps (if any)
  - No Retail UI/API/model for direct (1‑to‑1) SMS; only campaign/automation pipelines found.
- Logging/auditing gaps (message-level logs, consent history)
  - No dedicated consent history table; no UI for message‑level log search beyond campaign stats.
- Public link policy gaps (when to include which link)
  - Shortlink resolution is global by `shortCode` and does not explicitly validate owner context (`apps/retail-api/apps/api/src/routes/publicShort.routes.js`, `apps/retail-api/prisma/schema.prisma` uses global unique shortCode).
  - Unsubscribe token includes storeId, but there’s no explicit policy defining when to include unsubscribe in service messages.
- Multi-tenant/security risks
  - Inbound STOP currently unsubscribes all contacts with the same phone across all owners (`apps/retail-api/apps/api/src/routes/mitto.webhooks.js`). This violates “no cross‑owner actions” and target requirement to remove STOP behavior.
  - Public shortlinks resolve to any target URL without owner scoping (acceptable today but not aligned with strict owner context policy).

## 3) Proposed phases (no code)

### Phase 0: Guardrails + repo checks (release gate)
- Objective
  - Ensure a reliable baseline and prevent regressions while refactoring messaging policies.
- Scope
  - Run release gate checks, lint, typecheck, and build for `apps/retail-api` and `apps/astronote-web`.
  - Confirm worker queues + webhook envs are set in non‑prod/prod.
- Likely impacted areas (paths only)
  - `scripts/`, root `package.json`, workspace `package.json` files.
- Risks + mitigations
  - Risk: hidden CI failures once messaging changes land.
  - Mitigation: formalize a single release gate script and document required envs.
- Definition of Done (DoD)
  - All checks green; release gate script documented; env requirements listed.

### Phase 1: Remove inbound STOP behavior
- Objective
  - Eliminate cross‑owner unsubscribe behavior; keep inbound STOP logged only.
- Scope
  - Change inbound webhook handler to accept/log only; no contact updates.
  - Ensure webhook events are stored for audit.
- Likely impacted areas (paths only)
  - `apps/retail-api/apps/api/src/routes/mitto.webhooks.js`
  - `apps/retail-api/apps/api/src/services/webhook-replay.service.js` (if used for audit)
- Risks + mitigations
  - Risk: behavioral change for stores relying on STOP to unsubscribe.
  - Mitigation: add explicit messaging in UI/docs; provide manual unsubscribe workflow.
- DoD
  - Inbound STOP does not update `Contact` state; webhook is stored/traceable; no cross‑owner updates.

### Phase 2: Unsubscribe token/shortlink audit + hardening
- Objective
  - Ensure unsubscribe/shortlink resolution is tenant‑safe and policy‑compliant.
- Scope
  - Audit unsubscribe token usage and shortlink generation across campaigns/automations.
  - Ensure shortlinks resolve within owner context and fallback to safe pages.
  - Verify public resolvers `/s` and `/o` behavior with correct API base URLs.
- Likely impacted areas (paths only)
  - `apps/retail-api/apps/api/src/services/token.service.js`
  - `apps/retail-api/apps/api/src/services/publicLinkBuilder.service.js`
  - `apps/retail-api/apps/api/src/routes/publicShort.routes.js`
  - `apps/astronote-web/app/s/[shortCode]/route.ts`
  - `apps/astronote-web/app/o/[shortCode]/route.ts`
  - `apps/retail-api/apps/worker/src/sms.worker.js`, `apps/retail-api/apps/api/src/services/sms.service.js`
- Risks + mitigations
  - Risk: breaking existing links if format changes.
  - Mitigation: keep legacy resolve paths with fallback to long URLs; staged rollout.
- DoD
  - Shortlink resolution is explicitly owner‑scoped or owner‑validated; unsubscribe remains functional; no cross‑tenant leakage.

### Phase 3: 1-to-1 SMS foundation (gated + logged + status)
- Objective
  - Add direct messaging with the same billing gate and logging as campaigns.
- Scope
  - New direct‑send API endpoint and UI entry (likely in Contact detail or Contacts list).
  - Store message records with delivery status, provider IDs, and billing status.
  - Reuse existing worker + Mitto DLR/refresh for status updates.
- Likely impacted areas (paths only)
  - Backend: `apps/retail-api/apps/api/src/routes/` (new route), `apps/retail-api/apps/api/src/services/sms.service.js`, `apps/retail-api/apps/worker/src/sms.worker.js`, `apps/retail-api/prisma/schema.prisma`.
  - Frontend: `apps/astronote-web/app/app/retail/contacts/*`, `apps/astronote-web/src/lib/retail/api/*`.
- Risks + mitigations
  - Risk: double‑billing or duplicate sends.
  - Mitigation: idempotency keys per message + reservation/commit flow reuse.
- DoD
  - Direct messages send only when subscription is active; message logs visible; delivery status updates propagate.

### Phase 4: Marketing vs Service message type policy
- Objective
  - Introduce explicit message type and enforce unsubscribe/offer inclusion rules.
- Scope
  - Add `messageType` to campaigns/automations/direct messages.
  - Enforce policy in enqueue + send layers (unsubscribe/offer only for marketing).
  - Add UI selection + defaults (marketing for campaigns, service for transactional flows).
- Likely impacted areas (paths only)
  - `apps/retail-api/prisma/schema.prisma`
  - `apps/retail-api/apps/api/src/routes/campaigns.js`
  - `apps/retail-api/apps/api/src/services/sms.service.js`
  - `apps/retail-api/apps/worker/src/sms.worker.js`
  - `apps/astronote-web/app/app/retail/campaigns/*`
  - `apps/retail-api/apps/api/src/services/automation.service.js` (automation policy)
- Risks + mitigations
  - Risk: misclassified messages without unsubscribe (compliance risk).
  - Mitigation: default to marketing until explicitly set; require explicit label in UI.
- DoD
  - Message type persisted; unsubscribe appended only for marketing; service messages send without unsubscribe by default.

### Phase 5: Offer/QR hardening (optional)
- Objective
  - Improve resiliency/traceability for offer/QR flows.
- Scope
  - Ensure redeem/offer endpoints are idempotent and logged; guard against stale links.
  - Validate QR generation flow and fallback paths.
- Likely impacted areas (paths only)
  - `apps/retail-api/apps/api/src/routes/tracking.js`
  - `apps/astronote-web/app/(retail)/tracking/*`
  - `apps/retail-api/apps/api/src/services/publicLinkBuilder.service.js`
- Risks + mitigations
  - Risk: legacy links break or duplicate redemptions.
  - Mitigation: maintain backward compatibility and idempotent redeem responses.
- DoD
  - Offer/claim links are durable; redemptions are idempotent; UI reflects accurate status.

### Phase 6: Events layer + automation library
- Objective
  - Add customer events model and automation presets/triggers per business profile.
- Scope
  - Introduce `CustomerEvent` model and ingestion API.
  - Build automation presets (Retail/Gym/Appointments/Hotel/Other) and trigger logic on events/inactivity.
  - Add admin UI for event imports and automation configuration.
- Likely impacted areas (paths only)
  - `apps/retail-api/prisma/schema.prisma`
  - `apps/retail-api/apps/api/src/routes/` (new events routes)
  - `apps/retail-api/apps/api/src/services/automation.service.js`
  - `apps/retail-api/apps/worker/src/scheduler.worker.js`
  - `apps/astronote-web/app/app/retail/automations/*`
- Risks + mitigations
  - Risk: increased complexity + unexpected message volume.
  - Mitigation: feature flags and per‑preset throttling; staged rollout.
- DoD
  - Events can be created/queried; automations trigger from events; presets visible in UI.

## 4) Open questions / unknowns to confirm
- Should service messages ever include unsubscribe links, or must they always exclude them?
- Should `serviceAllowed` default to true for existing contacts, or require explicit capture?
- Are we required to keep historical consent changes beyond current `Contact` fields?
- Do we need an operator UI for message‑level logs and consent history?
- What is the expected owner‑scoping behavior for shortlinks (global unique OK vs per‑owner enforcement)?
- Is 1‑to‑1 messaging part of the near‑term roadmap, and should it reuse CampaignMessage or a new model?

