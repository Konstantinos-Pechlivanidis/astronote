# Retail Worker Overview

## Overview

The `apps/retail-api/apps/worker` package contains BullMQ workers for background job processing in the retail API. Workers are separate processes that consume jobs from Redis queues.

## Worker Files

### 1. `src/sms.worker.js`
- **Queue**: `smsQueue`
- **Purpose**: Process SMS sending jobs
- **Concurrency**: `process.env.WORKER_CONCURRENCY || 5`
- **Triggers**: 
  - Campaign enqueue creates SMS jobs
  - Jobs are added to `smsQueue` with batch data
- **Process**: 
  - Receives batch of messages
  - Calls Mitto bulk SMS API
  - Updates `CampaignMessage` status
  - Records delivery status

### 2. `src/scheduler.worker.js`
- **Queue**: `schedulerQueue`
- **Purpose**: Process scheduled campaign jobs
- **Concurrency**: `process.env.SCHEDULER_CONCURRENCY || 2`
- **Triggers**: 
  - Scheduled campaigns create delayed jobs
  - Jobs execute at scheduled time
- **Process**: 
  - Checks scheduled campaign time
  - Enqueues campaign for sending
  - Updates campaign status

### 3. `src/contactImport.worker.js`
- **Queue**: `contactImportQueue`
- **Purpose**: Process contact import jobs
- **Concurrency**: `process.env.CONTACT_IMPORT_CONCURRENCY || 1`
- **Triggers**: 
  - CSV import creates import job
  - Job processes CSV file
- **Process**: 
  - Parses CSV file
  - Validates contact data
  - Creates contacts in database
  - Updates import job status

### 4. `src/birthday.worker.js`
- **Queue**: `birthdayQueue` (via scheduler)
- **Purpose**: Process birthday automation messages
- **Concurrency**: 1 (single worker)
- **Triggers**: 
  - Scheduler creates daily birthday jobs
  - Runs at midnight UTC (configurable)
- **Process**: 
  - Finds contacts with birthdays today
  - Sends birthday automation messages
  - Records message logs

### 5. `src/statusRefresh.worker.js`
- **Queue**: `statusRefreshQueue`
- **Purpose**: Refresh pending message statuses
- **Concurrency**: `process.env.STATUS_REFRESH_CONCURRENCY || 1`
- **Triggers**: 
  - Repeatable job (every N minutes)
  - Configurable via `STATUS_REFRESH_INTERVAL`
- **Process**: 
  - Finds pending messages
  - Queries Mitto API for status
  - Updates message status in database

### 6. `src/deliveryStatusPoller.worker.js`
- **Queue**: `deliveryStatusPollerQueue`
- **Purpose**: Poll Mitto API for delivery status updates
- **Concurrency**: `process.env.DELIVERY_STATUS_POLLER_CONCURRENCY || 1`
- **Triggers**: 
  - Repeatable job (periodic polling)
- **Process**: 
  - Polls Mitto API for status updates
  - Updates message statuses
  - Handles bulk status updates

### 7. `src/piiRetention.worker.js`
- **Queue**: N/A (runs on schedule)
- **Purpose**: GDPR compliance - PII retention cleanup
- **Concurrency**: 1
- **Triggers**: 
  - Scheduled job (daily/weekly)
  - Can run on start if `RUN_PII_RETENTION_ON_START=1`
- **Process**: 
  - Finds contacts with expired PII retention
  - Anonymizes or deletes PII data
  - Records retention actions

### 8. `src/watchdog.worker.js`
- **Queue**: `watchdogQueue`
- **Purpose**: Monitor and fix stuck campaigns
- **Concurrency**: `process.env.WATCHDOG_CONCURRENCY || 1`
- **Triggers**: 
  - Repeatable job (every N minutes)
- **Process**: 
  - Finds campaigns stuck in "sending" status
  - Checks for missing batches
  - Re-enqueues missing batches
  - Handles expired credit reservations

## Queue Configuration

### Queue Definitions (in `apps/retail-api/apps/api/src/queues/`)

1. **smsQueue**: SMS sending jobs
   - Attempts: `QUEUE_ATTEMPTS || 1` (no retries by default)
   - Backoff: `QUEUE_BACKOFF_MS || 3000`
   - Rate Limit: `QUEUE_RATE_MAX || 20` per `QUEUE_RATE_DURATION_MS || 1000`

2. **schedulerQueue**: Scheduled campaign jobs
   - No retries (scheduled jobs)
   - Removes completed jobs

3. **contactImportQueue**: Contact import jobs
   - Keeps completed jobs for 1 hour
   - Keeps failed jobs for 24 hours

4. **statusRefreshQueue**: Status refresh jobs
   - Removes completed jobs
   - Repeatable job configuration

5. **deliveryStatusPollerQueue**: Delivery status polling
   - Attempts: 3
   - Exponential backoff: 5000ms
   - Keeps last 100 completed jobs

6. **watchdogQueue**: Watchdog jobs
   - Attempts: 3
   - Exponential backoff: 5000ms
   - Keeps last 100 completed jobs

## Worker Startup

### Development
```bash
# Individual workers
npm -w @astronote/worker run worker:sms
npm -w @astronote/worker run worker:scheduler
npm -w @astronote/worker run worker:contactImport
npm -w @astronote/worker run worker:birthday
npm -w @astronote/worker run worker:statusRefresh
npm -w @astronote/worker run worker:piiRetention

# Or via retail-api root
cd apps/retail-api
npm run worker:sms
npm run worker:scheduler
# etc.
```

### Production
- Workers can run as separate processes
- Or integrated into API server (if `START_WORKER=1`)
- API server can spawn worker processes on startup

## Environment Variables

### Worker-Specific
- `WORKER_CONCURRENCY`: SMS worker concurrency (default: 5)
- `SCHEDULER_CONCURRENCY`: Scheduler worker concurrency (default: 2)
- `CONTACT_IMPORT_CONCURRENCY`: Contact import concurrency (default: 1)
- `STATUS_REFRESH_CONCURRENCY`: Status refresh concurrency (default: 1)
- `DELIVERY_STATUS_POLLER_CONCURRENCY`: Delivery status poller concurrency (default: 1)
- `WATCHDOG_CONCURRENCY`: Watchdog concurrency (default: 1)

### Queue Configuration
- `QUEUE_DISABLED`: Disable all queues (`1` or `true`)
- `QUEUE_ATTEMPTS`: Job retry attempts (default: 5, but SMS uses 1)
- `QUEUE_BACKOFF_MS`: Retry backoff delay (default: 3000)
- `QUEUE_RATE_MAX`: Queue rate limit max (default: 20)
- `QUEUE_RATE_DURATION_MS`: Queue rate limit window (default: 1000)

### Worker Control
- `START_WORKER`: Start worker on API server (default: 1)
- `STATUS_REFRESH_ENABLED`: Enable status refresh (default: 1)
- `STATUS_REFRESH_INTERVAL`: Status refresh interval in ms (default: 600000)
- `RUN_BIRTHDAY_ON_START`: Run birthday worker on start (optional)
- `RUN_PII_RETENTION_ON_START`: Run PII retention on start (optional)

### Stuck Campaign Detection
- `STUCK_SENDING_MINUTES`: Minutes before campaign considered stuck (default: 10)
- `STUCK_LOCKED_MINUTES`: Minutes before job considered stuck (default: 5)

## Notes

- All workers require Redis connection
- Workers can be disabled via `QUEUE_DISABLED=1`
- Workers load environment from `../../.env` (parent directory)
- Workers use shared Prisma schema from `apps/retail-api/prisma/`
- Workers are idempotent (can handle retries safely)

