# Environment Variable Conflicts & Recommendations

## Critical Conflicts

### 1. Frontend URL Keys (HIGH PRIORITY)

**Conflict:** Multiple keys used for the same concept across services.

**Current State:**
- `FRONTEND_URL` - Used by retail-api, shopify-api
- `FRONTEND_BASE_URL` - Used by retail-api, shopify-api
- `WEB_APP_URL` - Used by shopify-api only
- `APP_PUBLIC_BASE_URL` - Used by retail-api only
- `APP_URL` - Used by retail-api (legacy)

**Recommendation:**
- **Canonical:** `FRONTEND_URL` (primary)
- **Fallback:** `FRONTEND_BASE_URL` → `WEB_APP_URL` → `APP_PUBLIC_BASE_URL` → `APP_URL`
- **Action:** Add backward compatibility fallbacks, standardize on `FRONTEND_URL`

---

### 2. CORS Configuration (MEDIUM PRIORITY)

**Conflict:** Different keys for same purpose.

**Current State:**
- `CORS_ALLOWLIST` - Used by retail-api
- `ALLOWED_ORIGINS` - Used by shopify-api

**Recommendation:**
- **Canonical:** `CORS_ALLOWLIST` (more descriptive)
- **Fallback:** `ALLOWED_ORIGINS` (for shopify-api compatibility)
- **Action:** Add fallback in shopify-api: `process.env.CORS_ALLOWLIST || process.env.ALLOWED_ORIGINS`

---

### 3. Database Direct Connection (LOW PRIORITY)

**Conflict:** Different naming for direct database URL.

**Current State:**
- `DIRECT_DATABASE_URL` - Used by retail-api
- `DIRECT_URL` - Used by shopify-api

**Recommendation:**
- **Canonical:** `DIRECT_URL` (shorter, Prisma standard)
- **Fallback:** `DIRECT_DATABASE_URL` (for retail-api compatibility)
- **Action:** Add fallback in retail-api: `process.env.DIRECT_URL || process.env.DIRECT_DATABASE_URL`

---

### 4. API Base URL (LOW PRIORITY)

**Conflict:** Multiple keys for API base URL.

**Current State:**
- `API_URL` - Used by retail-api
- `API_BASE_URL` - Used by retail-api
- `HOST` - Used by shopify-api (for backend URL)

**Recommendation:**
- **Canonical:** `HOST` for backend public URL (Shopify standard)
- **Alternative:** `API_URL` for retail-api (more explicit)
- **Action:** Keep both, document usage clearly

---

### 5. Public Base URL (LOW PRIORITY)

**Conflict:** Multiple keys for public base URL.

**Current State:**
- `PUBLIC_BASE_URL` - Used by shopify-api
- `APP_PUBLIC_BASE_URL` - Used by retail-api
- `HOST` - Used by shopify-api

**Recommendation:**
- **Canonical:** `PUBLIC_BASE_URL` (shorter)
- **Fallback:** `APP_PUBLIC_BASE_URL` → `HOST`
- **Action:** Add fallback in retail-api: `process.env.PUBLIC_BASE_URL || process.env.APP_PUBLIC_BASE_URL`

---

## Ambiguous Keys

### 1. HOST
**Issue:** Used differently in different contexts.
- **shopify-api:** Backend public URL (for OAuth/webhooks)
- **retail-api:** Not used directly (uses API_URL/API_BASE_URL)

**Recommendation:** Keep `HOST` for shopify-api, use `API_URL` for retail-api. Document clearly.

---

### 2. MITTO_SENDER vs MITTO_SENDER_NAME
**Issue:** Different naming for same concept.
- **retail-api:** `MITTO_SENDER`
- **shopify-api:** `MITTO_SENDER_NAME`

**Recommendation:**
- **Canonical:** `MITTO_SENDER_NAME` (more descriptive)
- **Fallback:** `MITTO_SENDER` (for retail-api compatibility)
- **Action:** Add fallback in retail-api

---

### 3. SMS_TRAFFIC_ACCOUNT_ID vs MITTO_TRAFFIC_ACCOUNT_ID
**Issue:** Different naming for same concept.
- **retail-api:** `SMS_TRAFFIC_ACCOUNT_ID` (primary), `MITTO_TRAFFIC_ACCOUNT_ID` (alias)
- **shopify-api:** `MITTO_TRAFFIC_ACCOUNT_ID`

**Recommendation:**
- **Canonical:** `MITTO_TRAFFIC_ACCOUNT_ID` (consistent with MITTO_ prefix)
- **Fallback:** `SMS_TRAFFIC_ACCOUNT_ID` (for retail-api compatibility)
- **Action:** Keep fallback in retail-api

---

## Recommendations Summary

### High Priority
1. ✅ Standardize frontend URL keys with fallbacks
2. ✅ Standardize CORS keys with fallbacks

### Medium Priority
3. ✅ Standardize database direct URL keys with fallbacks
4. ✅ Standardize public base URL keys with fallbacks

### Low Priority
5. ⚠️ Document HOST vs API_URL usage clearly
6. ⚠️ Standardize MITTO sender keys with fallbacks
7. ⚠️ Standardize traffic account ID keys (already has fallback)

---

## Migration Strategy

### Phase 1: Add Fallbacks (No Breaking Changes)
- Add backward-compatible fallbacks in code
- Support both old and new keys
- Document canonical keys

### Phase 2: Update Documentation
- Update all .env.example files
- Update deployment docs
- Update README files

### Phase 3: Gradual Migration (Optional)
- Update Render env vars to use canonical keys
- Keep old keys as fallbacks during transition
- Remove old keys after full migration

---

## Backward Compatibility Matrix

| Concept | Canonical Key | Fallback Keys | Services |
|---------|--------------|---------------|----------|
| Frontend URL | `FRONTEND_URL` | `FRONTEND_BASE_URL`, `WEB_APP_URL`, `APP_PUBLIC_BASE_URL`, `APP_URL` | retail-api, shopify-api |
| CORS Origins | `CORS_ALLOWLIST` | `ALLOWED_ORIGINS` | retail-api, shopify-api |
| Direct DB URL | `DIRECT_URL` | `DIRECT_DATABASE_URL` | retail-api, shopify-api |
| Public Base URL | `PUBLIC_BASE_URL` | `APP_PUBLIC_BASE_URL`, `HOST` | retail-api, shopify-api |
| API Base URL | `HOST` (shopify-api), `API_URL` (retail-api) | `API_BASE_URL` | retail-api, shopify-api |
| Mitto Sender | `MITTO_SENDER_NAME` | `MITTO_SENDER` | retail-api, shopify-api |
| Traffic Account | `MITTO_TRAFFIC_ACCOUNT_ID` | `SMS_TRAFFIC_ACCOUNT_ID` | retail-api, shopify-api |

