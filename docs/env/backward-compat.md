# Backward Compatibility: Environment Variable Fallbacks

## Overview
This document lists all backward-compatible fallbacks for environment variables. Code supports both old and new keys during migration.

---

## Frontend URL Keys

### Canonical: `FRONTEND_URL`
**Fallbacks:**
- `FRONTEND_BASE_URL`
- `WEB_APP_URL` (shopify-api only)
- `APP_PUBLIC_BASE_URL` (retail-api only)
- `APP_URL` (retail-api legacy)

**Implementation:**
```javascript
// shopify-api/utils/frontendUrl.js
const frontendUrl = 
  process.env.FRONTEND_URL ||
  process.env.FRONTEND_BASE_URL ||
  process.env.WEB_APP_URL ||
  baseUrl;

// retail-api/src/lib/public-url-resolver.js
const frontendUrl = 
  process.env.FRONTEND_URL || 
  process.env.FRONTEND_BASE_URL ||
  process.env.APP_PUBLIC_BASE_URL ||
  process.env.APP_URL;
```

**Status:** ✅ Already implemented

---

## CORS Configuration Keys

### Canonical: `CORS_ALLOWLIST`
**Fallback:** `ALLOWED_ORIGINS`

**Implementation Required:**
```javascript
// shopify-api/app.js (needs update)
const corsList = process.env.CORS_ALLOWLIST || process.env.ALLOWED_ORIGINS;
```

**Status:** ⚠️ Needs implementation in shopify-api

---

## Database Direct URL Keys

### Canonical: `DIRECT_URL`
**Fallback:** `DIRECT_DATABASE_URL`

**Implementation:**
```javascript
// retail-api/src/config/env.js (needs update)
DIRECT_URL: z.string().optional(),
// Then in code:
const directUrl = process.env.DIRECT_URL || process.env.DIRECT_DATABASE_URL;
```

**Status:** ⚠️ Needs implementation in retail-api

---

## Public Base URL Keys

### Canonical: `PUBLIC_BASE_URL`
**Fallback:** `APP_PUBLIC_BASE_URL` → `HOST`

**Implementation:**
```javascript
// retail-api/src/lib/public-url-resolver.js (needs update)
const publicBaseUrl = 
  process.env.PUBLIC_BASE_URL || 
  process.env.APP_PUBLIC_BASE_URL ||
  process.env.HOST;
```

**Status:** ⚠️ Needs implementation in retail-api

---

## Mitto Sender Keys

### Canonical: `MITTO_SENDER_NAME`
**Fallback:** `MITTO_SENDER`

**Implementation:**
```javascript
// retail-api/src/services/mitto.service.js (needs update)
const sender = process.env.MITTO_SENDER_NAME || process.env.MITTO_SENDER;
```

**Status:** ⚠️ Needs implementation in retail-api

---

## Traffic Account ID Keys

### Canonical: `MITTO_TRAFFIC_ACCOUNT_ID`
**Fallback:** `SMS_TRAFFIC_ACCOUNT_ID`

**Implementation:**
```javascript
// retail-api/src/services/smsBulk.service.js (already implemented)
const trafficAccountId = 
  process.env.MITTO_TRAFFIC_ACCOUNT_ID || 
  process.env.SMS_TRAFFIC_ACCOUNT_ID;
```

**Status:** ✅ Already implemented

---

## Summary of Required Changes

### High Priority (Breaking Risk)
1. ✅ **CORS keys** - Add fallback in shopify-api
2. ✅ **Direct URL keys** - Add fallback in retail-api

### Medium Priority (Consistency)
3. ⚠️ **Public base URL** - Add fallback in retail-api
4. ⚠️ **Mitto sender** - Add fallback in retail-api

### Low Priority (Already Working)
5. ✅ **Traffic account ID** - Already has fallback
6. ✅ **Frontend URL** - Already has fallbacks

---

## Migration Timeline

### Phase 1: Add Fallbacks (No Breaking Changes)
- Add backward-compatible fallbacks in code
- Support both old and new keys
- Update documentation

### Phase 2: Update Examples
- Update all `.env.example` files
- Update deployment documentation
- Update README files

### Phase 3: Gradual Migration (Optional)
- Update Render env vars to use canonical keys
- Keep old keys as fallbacks during transition
- Remove old keys after full migration (future)

---

## Code Changes Required

### 1. shopify-api/app.js
```javascript
// Current:
const allowedOrigins = process.env.ALLOWED_ORIGINS ? ... : [];

// Update to:
const corsList = process.env.CORS_ALLOWLIST || process.env.ALLOWED_ORIGINS;
const allowedOrigins = corsList ? corsList.split(',').map(s => s.trim()) : [];
```

### 2. retail-api/src/config/env.js
```javascript
// Add DIRECT_URL with fallback:
DIRECT_URL: z.string().optional(),
// Then in prisma.js:
const directUrl = process.env.DIRECT_URL || process.env.DIRECT_DATABASE_URL;
```

### 3. retail-api/src/lib/public-url-resolver.js
```javascript
// Add PUBLIC_BASE_URL support:
const publicBaseUrl = 
  process.env.PUBLIC_BASE_URL || 
  process.env.APP_PUBLIC_BASE_URL ||
  process.env.HOST;
```

### 4. retail-api/src/services/mitto.service.js
```javascript
// Add MITTO_SENDER_NAME with fallback:
const sender = process.env.MITTO_SENDER_NAME || process.env.MITTO_SENDER;
```

---

## Testing Fallbacks

### Test Cases
1. ✅ Set only canonical key → Should work
2. ✅ Set only fallback key → Should work
3. ✅ Set both keys → Should use canonical key
4. ✅ Set neither key → Should use default (if exists)

### Verification
Run verification script: `node scripts/verify-env.js` (to be created)

---

## Notes

- All fallbacks are **additive** - no breaking changes
- Old keys continue to work during migration
- New keys are preferred going forward
- Documentation updated to show canonical keys

