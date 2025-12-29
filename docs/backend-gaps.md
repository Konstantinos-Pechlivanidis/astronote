# Backend Gaps & Missing Endpoints

This document lists endpoints that the frontend expects but may be missing, mismatched, or need enhancement.

## Status: ✅ Most Endpoints Implemented

The frontend was built to match the existing backend API. Most endpoints are implemented and working.

---

## Potential Gaps / Enhancements

### 1. Settings Endpoint

**Frontend Expectation:**
- `GET /settings` - Get all settings
- `PUT /settings` - Update settings

**Backend Status:** ✅ Implemented
- `GET /settings` exists
- `PUT /settings` exists

**Note:** Frontend may need to handle cases where settings object structure differs.

---

### 2. Automation Status Toggle

**Frontend Expectation:**
- `PUT /automations/:id/status` with `{ active: boolean }`

**Backend Status:** ✅ Implemented
- `PUT /automations/:id/status` exists
- Fallback: `PUT /automations/:id` with `{ active }` also works

**Note:** Frontend hook handles both endpoints gracefully.

---

### 3. Segment Preview Counts

**Frontend Expectation:**
- `GET /audiences/segments/:id/preview` - Get estimated contact count

**Backend Status:** ✅ Implemented
- Endpoint exists
- Returns `estimatedCount` in segment response

**Note:** Frontend displays count if available, shows "not available" otherwise.

---

### 4. Campaign Enqueue Idempotency

**Frontend Expectation:**
- `POST /campaigns/:id/enqueue` with optional `Idempotency-Key` header

**Backend Status:** ✅ Implemented (Phase 4)
- Endpoint supports `Idempotency-Key` header
- Idempotency tracking via `EnqueueRequest` table

**Note:** Frontend can generate idempotency keys for "Create & Send Now" flow.

---

### 5. Dashboard Reports Embedding

**Frontend Expectation:**
- `GET /dashboard` includes `reports` object with:
  - `last7Days`
  - `topCampaigns`
  - `deliveryRateTrend`
  - `creditsUsage`

**Backend Status:** ✅ Implemented (Phase 3)
- Dashboard service includes embedded reports
- Reports widgets consume this data

**Note:** No separate `/reports` page needed (as designed).

---

### 6. Contacts Import Response

**Frontend Expectation:**
- `POST /contacts/import` returns:
  - `imported: number`
  - `skipped: number`
  - `invalid: number`

**Backend Status:** ⚠️ Needs Verification
- Endpoint exists
- Response format may need verification

**Recommendation:** Verify response format matches frontend expectations.

---

### 7. Campaign List Response Fields

**Frontend Expectation:**
- `GET /campaigns` returns:
  - `campaigns[]` with `sentCount`, `deliveredCount`, `failedCount`
  - `total: number`

**Backend Status:** ✅ Implemented
- Response includes all required fields

---

### 8. Segments Grouping

**Frontend Expectation:**
- `GET /audiences/segments` returns segments with:
  - `key` (e.g., `gender_male`, `age_25_34`)
  - `type` (`system` | `custom`)
  - `criteriaJson`
  - `estimatedCount`

**Backend Status:** ✅ Implemented
- System segments seeded automatically
- Frontend groups by `key` prefix (gender_*, age_*)

---

## Recommended Next Actions

### High Priority

1. **Verify Contacts Import Response**
   - Test `POST /contacts/import` with CSV
   - Ensure response includes `imported`, `skipped`, `invalid` counts
   - Update frontend if format differs

2. **Test Settings Update**
   - Verify `PUT /settings` accepts all fields frontend sends
   - Ensure response matches frontend expectations

### Medium Priority

3. **Add Segment Preview Endpoint Enhancement**
   - Consider caching estimated counts
   - Add pagination if counts are expensive to compute

4. **Enhance Error Messages**
   - Ensure all endpoints return consistent error format
   - Include actionable error messages

### Low Priority

5. **Add API Versioning**
   - Consider `/api/v1/` prefix for future breaking changes
   - Document versioning strategy

6. **Add Rate Limit Headers**
   - Include `X-RateLimit-*` headers in responses
   - Help frontend handle rate limits gracefully

---

## Testing Checklist

- [ ] Test all frontend pages with real backend
- [ ] Verify contacts import returns expected format
- [ ] Test settings update with all fields
- [ ] Verify segment preview counts are accurate
- [ ] Test campaign enqueue idempotency
- [ ] Verify dashboard reports data structure
- [ ] Test error handling for all endpoints
- [ ] Verify CORS allows frontend origin

---

## Notes

- Most gaps are minor and can be handled with frontend fallbacks
- Backend is production-ready (Phase 4 hardening complete)
- Frontend was built to match existing backend contract
- No breaking changes needed

---

## Future Enhancements

1. **GraphQL API** (optional)
   - Consider GraphQL for more flexible queries
   - Reduce over-fetching

2. **WebSocket Support** (optional)
   - Real-time campaign progress updates
   - Live delivery status updates

3. **Bulk Operations** (optional)
   - Bulk contact updates
   - Bulk campaign operations

4. **Advanced Filtering** (optional)
   - More complex segment criteria
   - Advanced campaign filters

