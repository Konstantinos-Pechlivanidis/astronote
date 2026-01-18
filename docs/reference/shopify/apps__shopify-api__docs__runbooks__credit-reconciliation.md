# Runbook: Credit Reconciliation

## Symptoms
- Credit reservations never released
- Wallet balance doesn't match actual credits used
- Campaigns completed but credits still reserved

## Root Causes
1. **Campaign stuck**: Campaign never transitions to final status
2. **Reconciliation job failure**: Job crashes before releasing reservation
3. **Manual intervention**: Campaign status changed manually without releasing reservation
4. **Expired reservations**: Reservations past expiration date not released

## Detection
Check active reservations:
```sql
SELECT cr.id, cr."shopId", cr."campaignId", cr.amount, cr.status, cr."createdAt", cr."expiresAt"
FROM "CreditReservation" cr
WHERE cr.status = 'active'
  AND (cr."expiresAt" < NOW() OR cr."createdAt" < NOW() - INTERVAL '48 hours');
```

Check metrics: `credit_reservations_expired`

## Resolution

### Automatic (Reconciliation Job)
The reconciliation job automatically:
1. Expires reservations older than 48 hours
2. Releases reservations when campaigns complete
3. Releases reservations when campaigns fail

### Manual Resolution

#### Step 1: Identify Leaked Reservations
```sql
-- Active reservations for completed/failed campaigns
SELECT cr.id, cr."shopId", cr."campaignId", cr.amount, c.status as campaign_status
FROM "CreditReservation" cr
LEFT JOIN "Campaign" c ON c.id = cr."campaignId"
WHERE cr.status = 'active'
  AND c.status IN ('sent', 'failed');
```

#### Step 2: Check Campaign Status
```sql
SELECT id, name, status, "updatedAt"
FROM "Campaign"
WHERE id = '<campaign-id>';
```

#### Step 3: Release Reservation
**Option A: Via API** (if available)
```bash
curl -X POST http://localhost:8080/api/internal/release-reservation \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"reservationId": "<reservation-id>"}'
```

**Option B: Direct SQL** (use with caution)
```sql
UPDATE "CreditReservation"
SET status = 'released',
    "releasedAt" = NOW(),
    meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{releaseReason}', '"manual_reconciliation"')
WHERE id = '<reservation-id>'
  AND status = 'active';
```

#### Step 4: Verify Wallet Balance
```sql
SELECT w."shopId", w.balance, 
       COALESCE(SUM(cr.amount), 0) as reserved,
       w.balance - COALESCE(SUM(cr.amount), 0) as available
FROM "Wallet" w
LEFT JOIN "CreditReservation" cr ON cr."shopId" = w."shopId" AND cr.status = 'active'
WHERE w."shopId" = '<shop-id>'
GROUP BY w."shopId", w.balance;
```

## Prevention
1. **Transaction boundaries**: Ensure reservation release is in same transaction as campaign completion
2. **Reconciliation job**: Ensure it runs every 10 minutes
3. **Expiration**: Set reasonable expiration times (24-48 hours)
4. **Monitoring**: Alert on `credit_reservations_expired > 10`

## Credit Balance Reconciliation

### Full Reconciliation Query
```sql
-- Compare wallet balance vs actual usage
SELECT 
  w."shopId",
  w.balance as wallet_balance,
  COALESCE(SUM(CASE WHEN cr.status = 'active' THEN cr.amount ELSE 0 END), 0) as reserved,
  COALESCE(SUM(CASE WHEN ct.type = 'debit' THEN ct.amount ELSE 0 END), 0) as total_debited,
  COALESCE(SUM(CASE WHEN ct.type = 'credit' THEN ct.amount ELSE 0 END), 0) as total_credited,
  w.balance - COALESCE(SUM(CASE WHEN cr.status = 'active' THEN cr.amount ELSE 0 END), 0) as available_balance
FROM "Wallet" w
LEFT JOIN "CreditReservation" cr ON cr."shopId" = w."shopId"
LEFT JOIN "CreditTransaction" ct ON ct."shopId" = w."shopId"
WHERE w."shopId" = '<shop-id>'
GROUP BY w."shopId", w.balance;
```

### Expected Balance Calculation
```
Expected Balance = Total Credited - Total Debited
Actual Balance = Wallet.balance
Difference = Actual - Expected
```

If difference > 0, investigate:
- Unreleased reservations
- Failed debit transactions
- Manual balance adjustments

## Metrics to Monitor
- `credit_reservations_active` (gauge): Active reservations
- `credit_reservations_expired` (gauge): Expired but not released
- `wallet_balance` (gauge): Per-shop wallet balances
- `credit_transactions_total` (counter): Transaction volume

