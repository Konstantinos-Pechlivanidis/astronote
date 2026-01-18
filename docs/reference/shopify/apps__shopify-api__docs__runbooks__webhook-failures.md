# Runbook: Webhook Failures

## Symptoms
- Webhook events not being processed
- Duplicate webhook processing
- Webhook events marked as "failed" in `WebhookEvent` table

## Root Causes
1. **Replay attacks**: Same event processed multiple times
2. **Processing errors**: Handler throws exception
3. **Timeout**: Event processing takes too long
4. **Invalid payload**: Webhook payload doesn't match expected format

## Detection
Check `WebhookEvent` table:
```sql
SELECT provider, status, COUNT(*) as count
FROM "WebhookEvent"
WHERE "receivedAt" > NOW() - INTERVAL '1 hour'
GROUP BY provider, status;
```

Check metrics: `webhook_events_failed_total`

## Resolution

### Automatic (Replay Protection)
The webhook replay protection service (`services/webhook-replay.js`) automatically:
1. Detects duplicate events by `provider` + `eventId`
2. Returns 200 OK for duplicates (prevents retries)
3. Validates event timestamp (rejects events > 5 minutes old)
4. Records all events in `WebhookEvent` table

### Manual Resolution

#### Step 1: Identify Failed Events
```sql
SELECT id, provider, "eventId", status, error, "receivedAt"
FROM "WebhookEvent"
WHERE status = 'failed'
  AND "receivedAt" > NOW() - INTERVAL '24 hours'
ORDER BY "receivedAt" DESC
LIMIT 50;
```

#### Step 2: Check Error Details
```sql
SELECT error, payload
FROM "WebhookEvent"
WHERE id = '<event-id>';
```

#### Step 3: Retry Failed Events (if safe)
**WARNING**: Only retry if idempotent and safe to reprocess

For Stripe events:
```javascript
// Manually trigger webhook handler
const event = { id: 'evt_xxx', type: 'checkout.session.completed', data: { object: {...} } };
await handleStripeWebhook(event);
```

For Mitto DLR events:
- Usually safe to retry (idempotent recipient updates)
- Check if recipient already has correct status before retrying

#### Step 4: Mark as Processed (if already handled)
```sql
UPDATE "WebhookEvent"
SET status = 'processed', "processedAt" = NOW()
WHERE id = '<event-id>'
  AND status = 'failed';
```

## Prevention
1. **Idempotency**: All webhook handlers must be idempotent
2. **Timeout handling**: Set appropriate timeouts for webhook processing
3. **Error logging**: Log full error details for debugging
4. **Monitoring**: Alert on `webhook_events_failed_total` rate increase

## Webhook-Specific Issues

### Stripe Webhooks
- **Signature verification**: Ensure `STRIPE_WEBHOOK_SECRET` is correct
- **Event age**: Stripe retries events for 3 days
- **Idempotency**: Use `stripeEvent.id` as idempotency key

### Mitto DLR Webhooks
- **Shop scoping**: Validate recipient belongs to correct shop
- **Status mapping**: Ensure status values match expected format
- **Bulk events**: Handle array of events correctly

### Shopify Webhooks
- **HMAC verification**: Verify webhook signature
- **Event deduplication**: Use `EventProcessingState` table
- **Rate limiting**: Respect Shopify rate limits

## Metrics to Monitor
- `webhook_events_failed_total` (counter): Failed webhook events
- `webhook_events_processed_total` (counter): Successfully processed events
- `webhook_events_duplicate_total` (counter): Duplicate events detected

