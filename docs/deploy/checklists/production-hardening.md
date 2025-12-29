# Production Hardening Checklist

## Date
2025-01-23

## Overview
Quick checklist for production security and reliability hardening. No refactoring required - these are configuration and verification steps.

---

## Rate Limiting

### Status: ✅ Enabled

**Shopify API:**
- ✅ General API: 1000 requests per 15 minutes per IP
- ✅ Auth endpoints: 5 requests per 15 minutes per IP
- ✅ SMS endpoints: 10 requests per minute per IP
- ✅ Webhook endpoints: 100 requests per minute per IP
- ✅ Database-backed rate limiting available (per-store)
- ✅ Redis-backed rate limiting for distributed systems

**Retail API:**
- ✅ Per-traffic-account limits: Configurable (default: 100 req/sec)
- ✅ Per-tenant limits: Configurable (default: 50 req/sec)
- ✅ Global limits: Configurable (default: 200 req/sec)
- ✅ Redis-backed rate limiting (distributed)
- ✅ In-memory fallback if Redis unavailable

**Verification:**
- [ ] Rate limiting middleware is applied to routes
- [ ] Redis is configured (required for distributed rate limiting)
- [ ] Rate limit headers are returned (`X-RateLimit-*`)

---

## Webhook Signature Verification

### Status: ✅ Enabled

**Stripe Webhooks:**
- ✅ Signature verification: `verifyWebhookSignature()` in `services/stripe.js`
- ✅ Uses `STRIPE_WEBHOOK_SECRET` env var
- ✅ Replay protection: Webhook replay service prevents duplicate processing
- ✅ Location: `apps/shopify-api/controllers/stripe-webhooks.js`

**Shopify Webhooks:**
- ✅ HMAC signature verification: `verifyShopifyWebhookSignature()` in `middlewares/shopify-webhook.js`
- ✅ Uses `SHOPIFY_WEBHOOK_SECRET` or `SHOPIFY_API_SECRET` env var
- ✅ Timing-safe comparison: `crypto.timingSafeEqual()`
- ✅ Location: `apps/shopify-api/middlewares/shopify-webhook.js`

**Mitto Webhooks:**
- ✅ Signature verification implemented
- ✅ Uses `MITTO_WEBHOOK_SECRET` env var

**Verification:**
- [ ] `STRIPE_WEBHOOK_SECRET` is set in production
- [ ] `SHOPIFY_WEBHOOK_SECRET` is set in production (or `SHOPIFY_API_SECRET`)
- [ ] `MITTO_WEBHOOK_SECRET` is set in production
- [ ] Webhook endpoints reject requests without valid signatures
- [ ] Test webhook signature verification (send invalid signature, should reject)

---

## Open Redirect Protection

### Status: ✅ Enabled

**Shopify API:**
- ✅ Redirect allowlist: `REDIRECT_ALLOWED_HOSTS` env var
- ✅ Supports wildcards: `*.myshopify.com`
- ✅ Location: `apps/shopify-api/controllers/shortLinks.js`
- ✅ Validation: Hostname validation before redirect

**Implementation:**
```javascript
const allowedHosts = process.env.REDIRECT_ALLOWED_HOSTS
  ? process.env.REDIRECT_ALLOWED_HOSTS.split(',').map(s => s.trim())
  : [];
// Validates destination URL hostname against allowlist
```

**Verification:**
- [ ] `REDIRECT_ALLOWED_HOSTS` is set in production
- [ ] Includes `*.myshopify.com` (for Shopify storefronts)
- [ ] Includes frontend URL if needed
- [ ] Test redirect to non-allowed host (should be blocked)
- [ ] Test redirect to allowed host (should work)

**Required Production Setting:**
```bash
REDIRECT_ALLOWED_HOSTS=*.myshopify.com,https://astronote.onrender.com
```

---

## Logging: Secret Redaction

### Status: ⚠️ Needs Verification

**Current State:**
- PII redaction may be implemented (needs verification)
- Secret masking may be implemented (needs verification)

**Verification:**
- [ ] Check logs for sensitive data (passwords, tokens, API keys)
- [ ] Verify PII is redacted in logs (if implemented)
- [ ] Verify secrets are masked in logs (if implemented)
- [ ] Set `LOG_LEVEL=info` in production (not `debug`)

**Recommendation:**
- Review log output for sensitive data
- Implement redaction if not present
- Use structured logging (Pino) which supports redaction

---

## Queue Separation

### Status: ✅ Recommended

**Current Setup:**
- ✅ Retail API: Can run workers in-process (`START_WORKER=1`) or separate service
- ✅ Retail Worker: Separate service recommended
- ✅ Shopify API: Workers run in-process (BullMQ)

**Recommendation:**
- ✅ **Retail API:** Set `START_WORKER=0` and use separate `retail-worker` service
- ✅ **Retail Worker:** Deploy as separate Render Background Worker service
- ⚠️ **Shopify API:** Workers run in-process (acceptable for current scale)

**Benefits:**
- Independent scaling
- Better resource isolation
- Easier monitoring
- Can restart workers without affecting API

**Verification:**
- [ ] `START_WORKER=0` in retail-api production env
- [ ] Retail worker deployed as separate service
- [ ] Worker processes jobs correctly
- [ ] API and worker can scale independently

---

## Additional Security Checks

### CORS Configuration
- [ ] `CORS_ALLOWLIST` is set correctly (no wildcards for production)
- [ ] Only required origins are allowed
- [ ] Shopify admin and storefront domains are allowed

### Environment Variables
- [ ] No secrets in code (all in env vars)
- [ ] `NODE_ENV=production` is set
- [ ] Default secrets are changed (e.g., `UNSUBSCRIBE_TOKEN_SECRET`)

### Database
- [ ] Connection strings use SSL (`?sslmode=require`)
- [ ] Database user has minimal required permissions
- [ ] Direct connection (`DIRECT_URL`) is separate from pooled (`DATABASE_URL`)

### Redis
- [ ] Eviction policy is `noeviction` (set in Redis provider)
- [ ] TLS is enabled (`REDIS_TLS=true`)
- [ ] Password is strong

### HTTPS
- [ ] All services use HTTPS (Render provides automatically)
- [ ] No HTTP-only endpoints (except health checks if needed)

### Headers
- [ ] Helmet.js is enabled (security headers)
- [ ] HPP (HTTP Parameter Pollution) protection enabled
- [ ] Trust proxy is enabled (`app.set('trust proxy', 1)`)

---

## Monitoring & Observability

### Logging
- [ ] Structured logging is enabled (Pino)
- [ ] Log level is appropriate (`info` for production)
- [ ] Logs are aggregated (Render provides log streaming)

### Error Tracking
- [ ] Sentry is configured (if using)
- [ ] `SENTRY_DSN` is set in production
- [ ] Errors are being tracked

### Health Checks
- [ ] Health endpoints are configured in Render
- [ ] Health checks are passing
- [ ] Full health checks include DB and Redis status

### Metrics
- [ ] Metrics endpoints exist (`/metrics` if using Prometheus)
- [ ] Key metrics are monitored (response times, error rates)

---

## Summary Checklist

### Security
- [ ] Rate limiting enabled and configured
- [ ] Webhook signature verification enabled
- [ ] Open redirect protection enabled (`REDIRECT_ALLOWED_HOSTS`)
- [ ] CORS configured correctly
- [ ] Secrets in env vars (not code)
- [ ] Default secrets changed
- [ ] HTTPS enforced
- [ ] Security headers enabled (Helmet)

### Reliability
- [ ] Queue separation (worker as separate service)
- [ ] Health checks configured
- [ ] Database connection pooling configured
- [ ] Redis eviction policy set to `noeviction`
- [ ] Graceful shutdown implemented

### Observability
- [ ] Structured logging enabled
- [ ] Log level appropriate (`info`)
- [ ] Error tracking configured (Sentry)
- [ ] Health endpoints monitored

### Configuration
- [ ] `NODE_ENV=production` set
- [ ] All required env vars set
- [ ] No development-only vars in production
- [ ] Database SSL enabled
- [ ] Redis TLS enabled

---

## Quick Verification Commands

```bash
# Rate limiting
curl -X POST https://astronote-shopify.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}' \
  --repeat 10
# Should return 429 after 5 attempts

# Webhook signature
curl -X POST https://astronote-shopify.onrender.com/webhooks/stripe \
  -H "stripe-signature: invalid" \
  -d '{}'
# Should return 401 Unauthorized

# Redirect protection
curl -X POST https://astronote-shopify.onrender.com/short-links \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"destinationUrl": "http://evil.com"}'
# Should be blocked if not in REDIRECT_ALLOWED_HOSTS

# Health checks
curl https://astronote-shopify.onrender.com/health/full
curl https://astronote-retail.onrender.com/readiness
# Should return healthy status
```

---

## Notes

- This checklist focuses on **configuration and verification**, not code changes
- All security features are already implemented in code
- Focus on **setting correct env vars** and **verifying behavior**
- For code-level security improvements, see Phase 4 hardening documentation

