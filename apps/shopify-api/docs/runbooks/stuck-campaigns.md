# Runbook: Stuck Campaigns

## Symptoms
- Campaigns remain in "sending" status for extended periods (> 15 minutes)
- No progress updates on campaign recipients
- Campaigns never transition to "sent" or "failed" status

## Root Causes
1. **Worker crash/restart**: Jobs were in-flight when worker restarted
2. **Queue backlog**: Too many jobs queued, processing delayed
3. **Job failures**: Jobs failed but weren't retried properly
4. **Credit reservation leak**: Reservation exists but campaign is stuck

## Detection
The reconciliation job runs every 10 minutes and automatically detects stuck campaigns:
- Campaigns in "sending" status with `updatedAt` > 15 minutes ago
- Check metrics: `campaigns_stuck` gauge

## Resolution

### Automatic (Reconciliation Job)
The reconciliation job (`queue/jobs/reconciliation.js`) automatically:
1. Finds stuck campaigns (sending > 15 minutes)
2. Recomputes progress from recipient statuses
3. Marks campaigns as completed if all recipients are terminal
4. Re-enqueues missing batches if jobs don't exist
5. Releases expired credit reservations

### Manual Resolution

#### Step 1: Identify Stuck Campaigns
```sql
SELECT id, "shopId", name, status, "updatedAt"
FROM "Campaign"
WHERE status = 'sending'
  AND "updatedAt" < NOW() - INTERVAL '15 minutes';
```

#### Step 2: Check Recipient Status
```sql
SELECT status, COUNT(*) as count
FROM "CampaignRecipient"
WHERE "campaignId" = '<campaign-id>'
GROUP BY status;
```

#### Step 3: Check for Active Jobs
Check BullMQ dashboard or Redis:
```bash
# Check waiting jobs
redis-cli LLEN bull:sms-send:waiting

# Check active jobs
redis-cli LLEN bull:sms-send:active
```

#### Step 4: Manual Fix Options

**Option A: Mark as Completed** (if all recipients are terminal)
```sql
UPDATE "Campaign"
SET status = 'sent', "updatedAt" = NOW()
WHERE id = '<campaign-id>'
  AND status = 'sending';
```

**Option B: Re-enqueue Missing Batches**
1. Find pending recipients:
```sql
SELECT id FROM "CampaignRecipient"
WHERE "campaignId" = '<campaign-id>'
  AND status = 'pending'
  AND "mittoMessageId" IS NULL;
```

2. Manually trigger reconciliation:
```bash
curl -X POST http://localhost:8080/api/internal/reconciliation \
  -H "Authorization: Bearer <admin-token>"
```

**Option C: Release Credit Reservation**
```sql
UPDATE "CreditReservation"
SET status = 'released', "releasedAt" = NOW()
WHERE "campaignId" = '<campaign-id>'
  AND status = 'active';
```

## Prevention
1. **Monitor reconciliation job**: Ensure it runs every 10 minutes
2. **Set alerts**: Alert on `campaigns_stuck > 0` for > 30 minutes
3. **Worker health**: Monitor worker uptime and restart frequency
4. **Queue depth**: Alert on `queue_sms_waiting > 10000`

## Metrics to Monitor
- `campaigns_stuck` (gauge): Number of stuck campaigns
- `queue_sms_waiting` (gauge): Jobs waiting in queue
- `reconciliation_jobs_completed` (counter): Reconciliation job success rate

