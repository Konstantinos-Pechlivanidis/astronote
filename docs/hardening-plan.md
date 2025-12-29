# Security & Reliability Hardening Plan

**Generated**: 2025-01-XX  
**Purpose**: Prioritized security, reliability, and performance improvements

## Priority Levels

- **P0**: Must fix before frontend integration (security vulnerabilities, data loss risks)
- **P1**: Should fix soon (reliability issues, performance problems)
- **P2**: Nice to have (optimizations, code quality)

---

## 1. Security Hardening

### 1.1 Tenant Isolation (P0)

#### ✅ Current State
- All store-scoped routes use `resolveStore` + `requireStore` middleware
- Database queries generally include `shopId` filter
- Prisma schema has proper foreign keys with `onDelete: Cascade`

#### ⚠️ Gaps Found

**Issue 1: Template Queries Not Shop-Scoped**
- **Location**: `controllers/templates.js`, `services/templates.js`
- **Risk**: Templates are global (intentional), but usage tracking should be shop-scoped
- **Status**: Low risk (templates are public, usage tracking is shop-specific)
- **Action**: Verify `TemplateUsage` queries always include `shopId`

**Issue 2: Potential Race Condition in Store Resolution**
- **Location**: `middlewares/store-resolution.js`
- **Risk**: Auto-creation of shops without proper validation
- **Status**: Medium risk (could allow shop creation with invalid domains)
- **Action**: Add domain validation before auto-creation

**Recommendations**:
1. ✅ **Already Implemented**: Most queries use `shopId` filter
2. **P0**: Add automated test to verify all store-scoped endpoints filter by `shopId`
3. **P1**: Add Prisma middleware to automatically inject `shopId` for store-scoped models
4. **P2**: Use `withStoreScope()` utility from `utils/store-scoping.js` consistently

### 1.2 Webhook Security (P0)

#### ✅ Current State
- Shopify webhooks: HMAC-SHA256 validation via `validateShopifyWebhook()`
- Stripe webhooks: Signature validation
- Mitto webhooks: HMAC validation
- Raw body preserved for signature verification

#### ⚠️ Gaps Found

**Issue 1: Webhook Replay Protection**
- **Location**: All webhook handlers
- **Risk**: Replay attacks if webhook is intercepted and replayed
- **Status**: Medium risk
- **Action**: Add idempotency keys based on webhook event ID

**Issue 2: Development Mode Bypass**
- **Location**: `middlewares/shopify-webhook.js:35-40`
- **Risk**: Webhook validation bypassed in development
- **Status**: Low risk (development only)
- **Action**: Add warning log, ensure production always validates

**Recommendations**:
1. **P0**: Add idempotency key storage for webhook events (use `EventProcessingState` or new table)
2. **P0**: Add timestamp validation (reject webhooks older than 5 minutes)
3. **P1**: Add rate limiting per webhook source (IP-based)
4. **P2**: Add webhook event logging for audit trail

### 1.3 Input Validation (P0)

#### ✅ Current State
- Zod schemas for all POST/PUT requests
- Request sanitization middleware
- Content-type validation
- Request size limits (5MB)

#### ⚠️ Gaps Found

**Issue 1: Query Parameter Validation**
- **Location**: Some GET endpoints
- **Risk**: SQL injection via query params (low risk with Prisma, but should validate)
- **Status**: Low risk (Prisma parameterizes queries)
- **Action**: Add query param validation for all list endpoints

**Issue 2: File Upload Validation**
- **Location**: CSV import endpoints
- **Risk**: Malicious CSV files, path traversal
- **Status**: Medium risk
- **Action**: Add CSV parsing validation, file size limits, content validation

**Recommendations**:
1. **P0**: Ensure all query params validated via Zod schemas
2. **P0**: Add CSV file validation (max size, row limits, column validation)
3. **P1**: Add rate limiting for file upload endpoints
4. **P2**: Add virus scanning for uploaded files (if storing files)

### 1.4 Sensitive Data Logging (P1)

#### ⚠️ Gaps Found

**Issue 1: PII in Logs**
- **Location**: `utils/logger.js`, various services
- **Risk**: Phone numbers, emails, tokens logged in plaintext
- **Status**: Medium risk
- **Action**: Redact PII in logs

**Issue 2: Error Messages Leak Secrets**
- **Location**: `utils/errors.js`
- **Risk**: Database errors, API keys in error messages
- **Status**: Low risk (errors sanitized in production)
- **Action**: Ensure production error messages don't leak stack traces

**Recommendations**:
1. **P1**: Add PII redaction utility (redact phone numbers, emails, tokens)
2. **P1**: Ensure production error responses don't include stack traces
3. **P2**: Add log rotation and retention policies
4. **P2**: Add structured logging with PII fields marked for redaction

### 1.5 CORS Policy (P0)

#### ✅ Current State
- CORS configured in `app.js`
- Allows Shopify admin domains
- Allows configured `ALLOWED_ORIGINS`
- Allows `myshopify.com` subdomains

#### ⚠️ Gaps Found

**Issue 1: Wildcard Subdomain Matching**
- **Location**: `app.js:107-109`
- **Risk**: Regex allows any subdomain of `myshopify.com` (intentional for Shopify)
- **Status**: Low risk (Shopify-controlled domains)
- **Action**: Verify regex is correct, add logging for blocked origins

**Recommendations**:
1. **P0**: Add CORS logging for blocked origins (already implemented)
2. **P1**: Add CORS preflight caching headers
3. **P2**: Consider CSP headers for embedded app

---

## 2. Reliability Hardening

### 2.1 Idempotency (P0)

#### ✅ Current State
- Campaign enqueue: Status check prevents double-enqueue
- SMS send: Unique constraint on `(campaignId, phoneE164)` prevents duplicates
- Webhook processing: `EventProcessingState` prevents duplicate events

#### ⚠️ Gaps Found

**Issue 1: Credit Transaction Idempotency**
- **Location**: `services/wallet.js`
- **Risk**: Double-debit if job retries after partial failure
- **Status**: High risk (financial impact)
- **Action**: Add idempotency keys to credit transactions

**Issue 2: Campaign Enqueue Race Condition**
- **Location**: `services/campaigns.js:enqueueCampaign()`
- **Risk**: Two simultaneous enqueue requests could both succeed
- **Status**: Medium risk
- **Action**: Use database advisory locks or unique constraint

**Issue 3: Queue Job Deduplication**
- **Location**: `queue/jobs/bulkSms.js`
- **Risk**: Same job processed twice if worker crashes mid-execution
- **Status**: Medium risk
- **Action**: Use BullMQ job IDs for deduplication

**Recommendations**:
1. **P0**: Add idempotency key to `CreditTransaction` meta field
2. **P0**: Check idempotency before credit debit/refund
3. **P0**: Use database advisory locks for campaign enqueue
4. **P1**: Add job deduplication via BullMQ job IDs
5. **P1**: Add idempotency key validation in all financial operations

### 2.2 Transaction Boundaries (P0)

#### ✅ Current State
- Credit reservation: Atomic transaction
- Campaign creation: Atomic transaction (campaign + metrics)
- Status update + recipient creation: Should be atomic

#### ⚠️ Gaps Found

**Issue 1: Campaign Enqueue Not Fully Atomic**
- **Location**: `services/campaigns.js:enqueueCampaign()`
- **Risk**: Status update, credit reservation, and recipient creation are separate operations
- **Status**: High risk (could create recipients without credits reserved)
- **Action**: Wrap entire enqueue in single transaction

**Issue 2: Credit Debit Not Atomic with Message Send**
- **Location**: `queue/jobs/bulkSms.js`
- **Risk**: Credits debited but message not sent (or vice versa)
- **Status**: Medium risk
- **Action**: Use transaction for debit + message log creation

**Recommendations**:
1. **P0**: Wrap campaign enqueue in single transaction:
   - Status update
   - Credit reservation
   - Recipient creation
   - Metrics initialization
2. **P0**: Make credit debit atomic with message log creation
3. **P1**: Add transaction retry logic for deadlock handling
4. **P2**: Add transaction timeout handling

### 2.3 Queue Reliability (P1)

#### ✅ Current State
- BullMQ with Redis backend
- Automatic retry with exponential backoff
- Dead letter queue for failed jobs

#### ⚠️ Gaps Found

**Issue 1: Job Uniqueness**
- **Location**: Queue job creation
- **Risk**: Duplicate jobs if enqueue called twice
- **Status**: Medium risk
- **Action**: Use BullMQ job IDs for deduplication

**Issue 2: Stuck Campaigns**
- **Location**: Campaigns with status `sending` but no active jobs
- **Risk**: Campaigns stuck in sending state
- **Status**: Medium risk
- **Action**: Add reconciliation job

**Issue 3: Credit Reservation Expiration**
- **Location**: `services/wallet.js:reserveCredits()`
- **Risk**: Reservations never released if campaign fails
- **Status**: Low risk (24h expiration exists)
- **Action**: Add periodic cleanup job for expired reservations

**Recommendations**:
1. **P0**: Add job deduplication via BullMQ job IDs
2. **P1**: Add reconciliation job to fix stuck campaigns:
   - Check campaigns with status `sending` for > 1 hour
   - Verify all recipients processed
   - Update status to `sent` or `failed`
3. **P1**: Add periodic cleanup for expired credit reservations
4. **P2**: Add job priority support for urgent campaigns
5. **P2**: Add job delay support for scheduled campaigns

### 2.4 Database Reliability (P1)

#### ⚠️ Gaps Found

**Issue 1: Connection Pooling**
- **Location**: `services/prisma.js`
- **Risk**: Connection exhaustion under load
- **Status**: Medium risk
- **Action**: Verify connection pool configuration

**Issue 2: Missing Indexes**
- **Location**: Prisma schema
- **Risk**: Slow queries on large datasets
- **Status**: Low risk (most indexes present)
- **Action**: Review query patterns, add indexes as needed

**Issue 3: N+1 Queries**
- **Location**: Various services
- **Risk**: Performance degradation
- **Status**: Low risk (Prisma includes relations)
- **Action**: Audit queries, use `include` or `select` appropriately

**Recommendations**:
1. **P1**: Verify Prisma connection pool settings (check `DATABASE_URL` params)
2. **P1**: Add database query performance monitoring
3. **P2**: Add indexes for common query patterns:
   - `CampaignRecipient(campaignId, status, sentAt)`
   - `MessageLog(shopId, createdAt, status)`
4. **P2**: Audit for N+1 queries, optimize with batch loading

---

## 3. Performance Optimization

### 3.1 Query Optimization (P1)

#### ⚠️ Gaps Found

**Issue 1: Large Audience Resolution**
- **Location**: `services/campaigns.js:resolveRecipients()`
- **Risk**: Loading all contacts into memory for large audiences
- **Status**: Medium risk
- **Action**: Use cursor-based pagination or streaming

**Issue 2: Campaign Metrics Aggregation**
- **Location**: `services/campaignAggregates.js`
- **Risk**: Expensive aggregations on large datasets
- **Status**: Low risk (metrics cached)
- **Action**: Ensure proper caching, consider materialized views

**Issue 3: Bulk Operations**
- **Location**: Contact import, recipient creation
- **Risk**: Slow bulk inserts
- **Status**: Low risk (using `createMany`)
- **Action**: Verify batch sizes, use `skipDuplicates` where appropriate

**Recommendations**:
1. **P1**: Use cursor-based pagination for large audience resolution
2. **P1**: Add pagination limits (max 10,000 recipients per campaign)
3. **P2**: Consider materialized views for campaign metrics
4. **P2**: Add query result caching for expensive aggregations

### 3.2 Caching Strategy (P1)

#### ✅ Current State
- Response caching for list endpoints
- Cache invalidation on writes
- Redis-backed cache

#### ⚠️ Gaps Found

**Issue 1: Cache Key Collision**
- **Location**: `middlewares/cache.js`
- **Risk**: Cache keys might collide between shops
- **Status**: Low risk (keys include shopId)
- **Action**: Verify cache keys are shop-scoped

**Issue 2: Cache Stampede**
- **Location**: Cache misses
- **Risk**: Multiple requests trigger same expensive query
- **Status**: Low risk
- **Action**: Add cache warming or mutex locks

**Recommendations**:
1. **P1**: Verify all cache keys include `shopId`
2. **P1**: Add cache TTL configuration per endpoint
3. **P2**: Add cache warming for frequently accessed data
4. **P2**: Add cache hit/miss metrics

### 3.3 Rate Limiting (P1)

#### ✅ Current State
- General API: 1000 req/15min
- Auth: 5 req/15min
- SMS: 10 req/min
- Webhooks: 100 req/min

#### ⚠️ Gaps Found

**Issue 1: Per-Tenant Rate Limiting**
- **Location**: Rate limiting middleware
- **Risk**: One tenant could exhaust global rate limit
- **Status**: Medium risk
- **Action**: Add per-tenant rate limiting

**Issue 2: Rate Limit Storage**
- **Location**: `middlewares/rateLimits.js`
- **Risk**: Memory-based rate limiting (lost on restart)
- **Status**: Low risk (Redis-backed in production)
- **Action**: Verify Redis-backed rate limiting

**Recommendations**:
1. **P1**: Add per-tenant rate limiting (shopId-based)
2. **P1**: Verify rate limiting uses Redis (not memory)
3. **P2**: Add rate limit headers to responses
4. **P2**: Add rate limit metrics

---

## 4. Implementation Priority

### Phase 1: P0 Items (Before Frontend Integration)

1. **Transaction Boundaries** (2-3 days)
   - Wrap campaign enqueue in single transaction
   - Make credit debit atomic with message send
   - Add transaction retry logic

2. **Idempotency** (2-3 days)
   - Add idempotency keys to credit transactions
   - Add job deduplication
   - Add idempotency checks before financial operations

3. **Webhook Security** (1-2 days)
   - Add idempotency keys for webhook events
   - Add timestamp validation
   - Add replay protection

4. **Input Validation** (1 day)
   - Ensure all query params validated
   - Add CSV file validation
   - Add file size limits

### Phase 2: P1 Items (Within 2 Weeks)

1. **Queue Reliability** (2-3 days)
   - Add reconciliation job for stuck campaigns
   - Add periodic cleanup for expired reservations
   - Add job priority support

2. **Performance** (3-4 days)
   - Optimize large audience resolution
   - Add pagination limits
   - Verify cache keys are shop-scoped

3. **Logging** (1-2 days)
   - Add PII redaction
   - Ensure production errors don't leak secrets
   - Add structured logging

4. **Rate Limiting** (1-2 days)
   - Add per-tenant rate limiting
   - Verify Redis-backed rate limiting
   - Add rate limit metrics

### Phase 3: P2 Items (Nice to Have)

1. **Database Optimization** (ongoing)
   - Add indexes for common queries
   - Audit for N+1 queries
   - Consider materialized views

2. **Monitoring** (ongoing)
   - Add query performance monitoring
   - Add cache hit/miss metrics
   - Add job processing metrics

---

## 5. Testing Requirements

### Security Tests
- [ ] Verify all store-scoped endpoints filter by `shopId`
- [ ] Test webhook replay protection
- [ ] Test input validation on all endpoints
- [ ] Test CORS policy

### Reliability Tests
- [ ] Test idempotency of credit transactions
- [ ] Test transaction rollback on failures
- [ ] Test queue job deduplication
- [ ] Test reconciliation job

### Performance Tests
- [ ] Load test large audience resolution
- [ ] Load test campaign enqueue
- [ ] Test cache hit rates
- [ ] Test rate limiting

---

## 6. Monitoring & Alerting

### Metrics to Add
1. **Security**
   - Failed authentication attempts
   - Webhook signature failures
   - CORS blocked requests

2. **Reliability**
   - Failed transactions
   - Stuck campaigns
   - Queue job failures
   - Credit reservation leaks

3. **Performance**
   - Slow queries (>1s)
   - Cache hit rates
   - Rate limit hits
   - Queue job processing time

### Alerts to Configure
1. **P0 Alerts**
   - Failed webhook signatures (immediate)
   - Transaction failures (immediate)
   - Stuck campaigns > 1 hour (15 min)

2. **P1 Alerts**
   - High error rate (5 min)
   - Slow queries (15 min)
   - Queue backlog (15 min)

---

## 7. Documentation Updates

1. **API Documentation**
   - Document idempotency requirements
   - Document rate limits
   - Document error codes

2. **Runbooks**
   - How to fix stuck campaigns
   - How to reconcile credits
   - How to handle webhook failures

3. **Architecture Diagrams**
   - Transaction boundaries
   - Queue job flow
   - Credit flow

