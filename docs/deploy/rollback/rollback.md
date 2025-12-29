# Rollback Checklist

## Date
2025-01-23

## Overview
Step-by-step rollback procedures for production deployment on Render.

---

## Rollback Scenarios

### 1. Web Frontend Rollback

**Scenario:** Frontend deployment causes issues (broken routes, API errors, etc.)

**Steps:**

1. **Stop Auto-Deploy:**
   - Go to Render dashboard → `astronote-web` service
   - Settings → Auto-Deploy → Disable

2. **Revert Code:**
   - Option A: Revert commit in GitHub
     ```bash
     git revert <commit-hash>
     git push origin main
     ```
   - Option B: Manual deploy previous version
     - Render dashboard → Manual Deploy → Select previous commit

3. **Verify Rollback:**
   ```bash
   curl -I https://astronote.onrender.com
   # Should return 200 OK
   ```

4. **Re-enable Auto-Deploy:**
   - After fixing issues, re-enable auto-deploy

**Time to Rollback:** ~2-5 minutes

---

### 2. Backend API Rollback (Shopify API or Retail API)

**Scenario:** Backend deployment causes API errors, database issues, etc.

**Steps:**

1. **Stop Auto-Deploy:**
   - Go to Render dashboard → Service (e.g., `astronote-shopify-api`)
   - Settings → Auto-Deploy → Disable

2. **Revert Code:**
   - Option A: Revert commit in GitHub
     ```bash
     git revert <commit-hash>
     git push origin main
     ```
   - Option B: Manual deploy previous version
     - Render dashboard → Manual Deploy → Select previous commit

3. **Verify Health:**
   ```bash
   # Shopify API
   curl https://astronote-shopify.onrender.com/health
   
   # Retail API
   curl https://astronote-retail.onrender.com/healthz
   ```

4. **Check Logs:**
   - Render dashboard → Logs
   - Verify no errors after rollback

5. **Re-enable Auto-Deploy:**
   - After fixing issues, re-enable auto-deploy

**Time to Rollback:** ~2-5 minutes

**Note:** Database migrations are NOT automatically rolled back. See "Database Migration Rollback" section below.

---

### 3. Worker Service Rollback

**Scenario:** Worker deployment causes queue processing issues

**Steps:**

1. **Stop Worker:**
   - Go to Render dashboard → `astronote-retail-worker` service
   - Settings → Suspend Service (or disable auto-deploy)

2. **Revert Code:**
   - Option A: Revert commit in GitHub
   - Option B: Manual deploy previous version

3. **Restart Worker:**
   - Render dashboard → Restart Service

4. **Verify Queue Processing:**
   - Check Render logs for worker
   - Verify jobs are being processed
   - Check queue stats via API (if available)

**Time to Rollback:** ~2-5 minutes

**Note:** In-flight jobs may be lost. Check queue for stuck jobs after rollback.

---

### 4. Environment Variable Rollback

**Scenario:** Environment variable change causes issues (CORS, URL shortener, etc.)

#### 4.1. CORS Allowlist Rollback

**Issue:** Frontend can't call APIs due to CORS

**Steps:**

1. **Revert CORS_ALLOWLIST:**
   - Render dashboard → Service → Environment
   - Edit `CORS_ALLOWLIST` to previous value
   - Save (service will restart automatically)

2. **Verify CORS:**
   ```bash
   curl -X OPTIONS \
     -H "Origin: https://astronote.onrender.com" \
     -H "Access-Control-Request-Method: GET" \
     -v https://astronote-shopify.onrender.com/health 2>&1 | grep -i "access-control"
   ```

**Time to Rollback:** ~1-2 minutes (service restart)

---

#### 4.2. URL Shortener Type Rollback

**Issue:** URL shortener stops working

**Steps:**

1. **Revert URL_SHORTENER_TYPE:**
   - Render dashboard → Service → Environment
   - Edit `URL_SHORTENER_TYPE` to previous value (e.g., `custom` → `none` or vice versa)
   - Save (service will restart automatically)

2. **Verify Shortener:**
   - Test short link creation (if applicable)
   - Test redirect (if applicable)

**Time to Rollback:** ~1-2 minutes (service restart)

---

#### 4.3. Public URL Rollback

**Issue:** Public URLs are incorrect (OAuth callbacks, webhooks fail)

**Steps:**

1. **Revert HOST/PUBLIC_BASE_URL:**
   - Render dashboard → Service → Environment
   - Edit `HOST` or `PUBLIC_BASE_URL` to previous value
   - Save (service will restart automatically)

2. **Verify URLs:**
   - Check health endpoint response
   - Test OAuth callback (if applicable)
   - Test webhook delivery (if applicable)

**Time to Rollback:** ~1-2 minutes (service restart)

---

### 5. Database Migration Rollback

**Scenario:** Database migration causes data issues or breaks application

**⚠️ WARNING:** Database migrations are NOT automatically rolled back. Manual intervention required.

**Steps:**

1. **Assess Impact:**
   - Check if migration is destructive (drops columns, tables)
   - Check if migration can be safely reversed
   - Review migration file: `prisma/migrations/<timestamp>_<name>/migration.sql`

2. **Create Rollback Migration:**
   ```bash
   cd apps/shopify-api  # or apps/retail-api
   
   # Create a new migration that reverses changes
   npm run prisma:migrate:dev -- --name rollback_<original_migration_name>
   
   # Edit the migration file to reverse changes
   # Example: If original added a column, rollback removes it
   ```

3. **Apply Rollback Migration:**
   ```bash
   # In Render Shell or locally
   npm run prisma:migrate:deploy
   ```

4. **Verify Database:**
   - Check database schema matches previous state
   - Verify application works with rolled-back schema

**Time to Rollback:** ~10-30 minutes (depending on migration complexity)

**Note:** 
- Some migrations cannot be safely rolled back (data loss)
- Always backup database before applying migrations
- Test rollback migrations in staging first

---

### 6. Multiple Service Rollback

**Scenario:** Multiple services need to be rolled back

**Steps:**

1. **Prioritize Rollback Order:**
   - Frontend first (if frontend issue)
   - Backend APIs (if API issue)
   - Worker last (if worker issue)

2. **Rollback Each Service:**
   - Follow individual rollback procedures above
   - Verify each service after rollback

3. **End-to-End Verification:**
   - Run smoke tests: `scripts/smoke-prod.sh`
   - Verify frontend can call APIs
   - Verify worker processes jobs

**Time to Rollback:** ~10-15 minutes (all services)

---

## Rollback Verification Checklist

After any rollback, verify:

- [ ] Service is running (green status in Render)
- [ ] Health endpoints respond correctly
- [ ] Frontend loads (if frontend rolled back)
- [ ] API endpoints work (if API rolled back)
- [ ] CORS works (if CORS vars changed)
- [ ] Database connectivity (if DB migration rolled back)
- [ ] Queue processing works (if worker rolled back)
- [ ] No errors in logs

---

## Prevention

### Before Deployment

- [ ] Test changes in staging/local first
- [ ] Review migration files for destructive changes
- [ ] Backup database before migrations
- [ ] Document rollback procedure for complex changes

### During Deployment

- [ ] Monitor health endpoints during deploy
- [ ] Watch Render logs for errors
- [ ] Have rollback plan ready

### After Deployment

- [ ] Run smoke tests immediately
- [ ] Monitor error rates
- [ ] Check queue processing
- [ ] Verify critical user flows

---

## Quick Rollback Commands

### Disable Auto-Deploy (All Services)
```bash
# Manual: Use Render dashboard UI
# Or use Render CLI if available
```

### Revert Git Commit
```bash
git revert <commit-hash>
git push origin main
```

### Check Service Status
```bash
# Health checks
curl https://astronote-shopify.onrender.com/health
curl https://astronote-retail.onrender.com/healthz
curl -I https://astronote.onrender.com
```

### View Logs
```bash
# Use Render dashboard → Logs
# Or Render CLI if available
```

---

## Emergency Procedures

### Complete Service Outage

1. **Check Render Status:**
   - Render dashboard → Status page
   - Check for Render-wide issues

2. **Restart Services:**
   - Render dashboard → Service → Restart

3. **Rollback if Needed:**
   - Follow rollback procedures above

4. **Contact Support:**
   - Render support (if Render issue)
   - Team lead (if application issue)

### Database Corruption

1. **Stop All Services:**
   - Suspend services in Render dashboard

2. **Restore from Backup:**
   - Use Neon backup restore (if available)
   - Or restore from manual backup

3. **Verify Database:**
   - Run Prisma migrations
   - Verify schema is correct

4. **Restart Services:**
   - Restart services one by one
   - Verify each service works

---

## Summary

**Rollback Time Estimates:**
- Frontend: ~2-5 minutes
- Backend API: ~2-5 minutes
- Worker: ~2-5 minutes
- Environment Variables: ~1-2 minutes
- Database Migration: ~10-30 minutes
- Multiple Services: ~10-15 minutes

**Key Principles:**
- Always disable auto-deploy before rollback
- Verify health after rollback
- Check logs for errors
- Test end-to-end after rollback
- Re-enable auto-deploy after fixing issues

