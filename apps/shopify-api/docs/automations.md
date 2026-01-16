# Automations (Shopify API)

This document explains how Shopify automations work end-to-end in `@astronote/shopify-api`: how they trigger, how we prevent duplicates, and how to test locally.

## Supported automations (high level)

Automations are stored as `userAutomation` records for a `shopId`. Each has:
- a **trigger** (what event causes it),
- a **message template** (SMS text + variables),
- a **status** (active/paused/draft),
- **tenant scoping** (always per shop).

Common trigger names you will see:
- `welcome`
- `order_placed` (order created)
- `order_fulfilled` (fulfillment created/fulfilled)
- `abandoned_cart` / abandoned checkout
- post‑purchase follow-ups like `review_request`
- `cross_sell`

## Trigger sources (webhook vs poller vs internal scheduler)

### 1) Webhooks (real-time)
Routes:
- `POST /automation-webhooks/shopify/orders/create` → order placed / confirmation
- `POST /automation-webhooks/shopify/orders/fulfilled` → fulfillment updates
- `POST /automation-webhooks/shopify/checkout/abandoned` (and legacy `/cart/abandoned`) → abandoned checkout flow

Implementation: `apps/shopify-api/controllers/automation-webhooks.js`

Notes:
- Webhooks use signature validation via `validateShopifyWebhook` (where applicable).
- Webhooks also use `services/webhook-replay.js` to avoid replay/duplicate processing.
- Webhooks enqueue work to BullMQ `automation-trigger` queue (see **Idempotency** below).

### 2) Event poller (fallback / reconciliation)
Worker: `apps/shopify-api/workers/event-poller.js`

The poller queries Shopify Events API for subject types/actions and maps them to automation triggers.

Why it exists:
- Some stores may not reliably deliver certain webhook events.
- Polling provides resilience and catches missed events.

### 3) Internal schedulers (delayed follow-ups)
Some automations are scheduled after an initial event:
- abandoned checkout reminders (delayed)
- post‑purchase sequences (review request, cross‑sell, etc.)

Implementation examples:
- `services/automation-scheduler.js`
- logic in `controllers/automation-webhooks.js` (delayed queue jobs)

## Requirements for sending

An automation will only send if:
- **Contact has a valid phone number** (stored as E.164 in `contact.phoneE164`)
- **Contact has SMS consent** (`smsConsent: opted_in`) when required by the trigger logic
- **Shop has subscription/credits** (credits are validated/consumed in job handlers)

## Dedupe / idempotency (important)

We protect against duplicate sends in multiple layers:

### A) Webhook replay protection
`services/webhook-replay.js` records incoming webhook payload hashes and event IDs.
If Shopify retries the same event, we return success but do not enqueue again.

### B) Deterministic queue job IDs (BullMQ)
When enqueueing automation jobs we use **deterministic `jobId`s**, so the same logical event can’t enqueue multiple queue entries.

Examples:
- `order-confirmation-${shopId}-${orderId}`
- `order-fulfilled-${shopId}-${orderId}`
- `abandoned-cart-${shopId}-${checkoutId}`
- `cross-sell-${shopId}-${orderId}`

If BullMQ throws “already exists”, we treat that as **idempotent success**.

### C) Poller dedupe (EventProcessingState)
`services/event-deduplication.js` stores an `EventProcessingState` per `(shopId, automationType)`:
- `lastEventId`
- `lastProcessedAt`

The poller queries with a small overlap window to avoid missing events; we dedupe by:
- event ID (fast-path)
- **event occurredAt <= lastProcessedAt** (prevents reprocessing overlap windows across restarts)

## Personalization variables (frontend + backend)

Message templates typically support:
- `{{firstName}}`
- `{{lastName}}`
- `{{discountCode}}` (when a discount applies / is configured)

The exact available variables may vary per automation type depending on what event data is available.

## How to test locally

### 1) Start dependencies
- Ensure Redis is available (BullMQ queues).
- Ensure DB is migrated (`prisma migrate` as needed).

### 2) Trigger via webhook route (recommended)
Send a test request to the webhook route (use a dev store / mocked payload).

Useful endpoints:
- `POST /automation-webhooks/trigger` (manual trigger for testing)

### 3) Observe jobs
Use existing debug/queue endpoints or logs to confirm:
- a job was enqueued in `automation-trigger`
- the handler processed it once
- credits were consumed once

### 4) Poller testing
Enable event polling and shorten interval:
- `EVENT_POLLING_ENABLED=true`
- `EVENT_POLLING_INTERVAL=1`

Then watch logs from `workers/event-poller.js` to confirm events are discovered and queued once.

## Logic discrepancy checklist (quick)

When reviewing or adding new automations, verify:
- **Tenant scoping**: every query and job includes the correct `shopId`
- **Correct event mapping**: `orders/create` vs `orders/fulfilled` vs fulfillment sub-events
- **Deduping**: deterministic `jobId` and poller `EventProcessingState` usage
- **Retries**: queue retries must not cause duplicate sends (job handler must be safe / idempotent)
- **Consent/phone checks**: enforce `phoneE164` and consent before sending
- **Template variables**: only expose variables that are present for that trigger type

