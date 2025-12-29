# Frontend Readiness Checklist

**Generated**: 2025-01-XX  
**Purpose**: Verify backend readiness for frontend integration and identify missing endpoints/fields

## Frontend Contract

### Required Endpoints by Page

#### 1. Dashboard Page

**Endpoint**: `GET /dashboard`

**Required Response Fields**:
```json
{
  "success": true,
  "data": {
    "credits": 1000,
    "totalCampaigns": 25,
    "totalContacts": 500,
    "totalMessagesSent": 10000,
    "recentCampaigns": [...],
    "recentActivity": [...]
  }
}
```

**Status**: ✅ **READY**
- Endpoint exists: `GET /dashboard`
- Response includes required fields
- Cached for performance

**Additional Endpoints**:
- `GET /dashboard/overview` - Detailed overview
- `GET /dashboard/quick-stats` - Quick stats

---

#### 2. Contacts Page

**Endpoints**:
- `GET /contacts` - List contacts
- `GET /contacts/stats` - Contact statistics
- `POST /contacts` - Create contact
- `PUT /contacts/:id` - Update contact
- `DELETE /contacts/:id` - Delete contact
- `POST /contacts/import` - Import CSV

**Required Query Params** (for `GET /contacts`):
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `search`: Search term (phone, email, name)
- `smsConsent`: Filter by consent (`opted_in`, `opted_out`, `unknown`)
- `gender`: Filter by gender (`male`, `female`)
- `tags`: Filter by tags (array)

**Required Response**:
```json
{
  "success": true,
  "data": {
    "contacts": [
      {
        "id": "contact123",
        "firstName": "John",
        "lastName": "Doe",
        "phoneE164": "+1234567890",
        "email": "john@example.com",
        "smsConsent": "opted_in",
        "gender": "male",
        "tags": ["vip", "newsletter"],
        "hasPurchased": true,
        "firstPurchaseAt": "2024-01-01T00:00:00Z",
        "lastOrderAt": "2024-12-01T00:00:00Z",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-12-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 500,
      "totalPages": 25
    }
  }
}
```

**Status**: ✅ **READY**
- All endpoints exist
- Pagination supported
- Filtering supported
- Search supported

**Missing Fields** (if needed):
- ❓ `fullName` computed field (can compute from `firstName` + `lastName` in frontend)
- ❓ `segmentMemberships` array (can fetch separately if needed)

---

#### 3. Lists/Audiences Page

**Endpoints**:
- `GET /audiences` - List audiences
- `GET /audiences/:audienceId/details` - Audience details with contacts
- `POST /audiences/validate` - Validate audience selection

**Required Response** (for `GET /audiences`):
```json
{
  "success": true,
  "data": [
    {
      "id": "all",
      "name": "All Contacts",
      "count": 500,
      "type": "predefined"
    },
    {
      "id": "segment:abc123",
      "name": "VIP Customers",
      "count": 50,
      "type": "segment"
    }
  ]
}
```

**Status**: ✅ **READY**
- Endpoints exist
- Response includes count

**Missing Features** (if needed):
- ❓ Create/edit/delete segments (not in current API)
- ❓ Segment builder UI endpoints (not in current API)

**Recommendation**: Add segment CRUD endpoints if needed:
- `POST /audiences/segments` - Create segment
- `PUT /audiences/segments/:id` - Update segment
- `DELETE /audiences/segments/:id` - Delete segment

---

#### 4. Templates Page

**Endpoints**:
- `GET /templates` - List templates
- `GET /templates/:id` - Get template
- `GET /templates/:id/track` - Track template usage

**Required Response** (for `GET /templates`):
```json
{
  "success": true,
  "data": [
    {
      "id": "template123",
      "title": "Welcome Message",
      "category": "welcome",
      "content": "Welcome {{firstName}}!",
      "tags": ["welcome", "greeting"],
      "isPublic": true,
      "conversionRate": 33.5,
      "clickThroughRate": 15.2,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Status**: ✅ **READY**
- Endpoints exist
- Response includes required fields

**Missing Features** (if needed):
- ❓ Create/edit/delete templates (admin only, not in public API)
- ❓ Template categories list (can filter by category)

---

#### 5. Campaigns Page

**Endpoints**:
- `GET /campaigns` - List campaigns
- `GET /campaigns/:id` - Get campaign
- `POST /campaigns` - Create campaign
- `PUT /campaigns/:id` - Update campaign
- `DELETE /campaigns/:id` - Delete campaign
- `POST /campaigns/:id/enqueue` - Send campaign
- `PUT /campaigns/:id/schedule` - Schedule campaign
- `POST /campaigns/:id/cancel` - Cancel campaign
- `GET /campaigns/:id/metrics` - Get metrics
- `GET /campaigns/:id/status` - Get status
- `GET /campaigns/:id/preview` - Get preview
- `GET /campaigns/:id/progress` - Get progress

**Required Query Params** (for `GET /campaigns`):
- `page`: Page number
- `limit`: Items per page
- `status`: Filter by status (`draft`, `scheduled`, `sending`, `sent`, `failed`, `cancelled`)
- `search`: Search by name

**Required Response** (for `GET /campaigns`):
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "id": "campaign123",
        "name": "Black Friday Sale",
        "message": "Get 50% off!",
        "audience": "all",
        "status": "sent",
        "scheduleType": "immediate",
        "scheduleAt": null,
        "priority": "normal",
        "createdAt": "2024-11-01T00:00:00Z",
        "updatedAt": "2024-11-25T00:00:00Z",
        "metrics": {
          "totalSent": 1000,
          "totalDelivered": 950,
          "totalFailed": 50,
          "totalClicked": 100
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "totalPages": 2
    }
  }
}
```

**Status**: ✅ **READY**
- All endpoints exist
- Pagination supported
- Filtering supported
- Metrics included

**Missing Fields** (if needed):
- ❓ `recipientCount` in list response (can fetch via preview endpoint)
- ❓ `estimatedCost` in list response (can fetch via preview endpoint)

---

#### 6. Automations Page

**Endpoints**:
- `GET /automations` - List user automations
- `GET /automations/defaults` - List system defaults
- `POST /automations` - Create automation
- `PUT /automations/:id` - Update automation
- `DELETE /automations/:id` - Delete automation
- `GET /automations/stats` - Get statistics
- `GET /automations/variables/:triggerType` - Get available variables

**Required Response** (for `GET /automations`):
```json
{
  "success": true,
  "data": [
    {
      "id": "automation123",
      "automationId": "welcome",
      "title": "Welcome Series",
      "description": "Send welcome message to new customers",
      "triggerEvent": "welcome",
      "userMessage": "Welcome {{firstName}}!",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-12-01T00:00:00Z"
    }
  ]
}
```

**Status**: ✅ **READY**
- All endpoints exist
- Response includes required fields

**Missing Features** (if needed):
- ❓ Automation execution history (can use `GET /automations/stats`)
- ❓ Enable/disable automation (use `PUT /automations/:id` with `isActive`)

---

#### 7. Billing Page

**Endpoints**:
- `GET /billing/balance` - Get credit balance
- `GET /billing/packages` - Get available packages
- `GET /billing/topup/calculate` - Calculate top-up price
- `POST /billing/topup` - Create top-up checkout
- `GET /billing/history` - Get transaction history
- `GET /billing/billing-history` - Get billing history (Stripe)

**Required Response** (for `GET /billing/balance`):
```json
{
  "success": true,
  "data": {
    "balance": 1000,
    "reserved": 100,
    "available": 900,
    "currency": "EUR"
  }
}
```

**Status**: ✅ **READY**
- All endpoints exist
- Response includes required fields

**Missing Features** (if needed):
- ❓ Credit usage breakdown (can aggregate from transaction history)
- ❓ Billing alerts/thresholds (not in current API)

---

#### 8. Reports Page

**Endpoints**:
- `GET /reports/overview` - Overview report
- `GET /reports/kpis` - KPI metrics
- `GET /reports/campaigns` - Campaign reports
- `GET /reports/campaigns/:id` - Campaign-specific report
- `GET /reports/automations` - Automation reports
- `GET /reports/messaging` - Messaging reports
- `GET /reports/credits` - Credit reports
- `GET /reports/contacts` - Contact reports
- `GET /reports/export` - Export data

**Required Query Params** (for reports):
- `startDate`: Start date (ISO 8601)
- `endDate`: End date (ISO 8601)
- `format`: Response format (`json`, `csv`)

**Status**: ✅ **READY**
- All endpoints exist
- Date filtering supported
- Export supported

**Missing Features** (if needed):
- ❓ Custom date range presets (can handle in frontend)
- ❓ Report scheduling (not in current API)

---

#### 9. Settings Page

**Endpoints**:
- `GET /settings` - Get settings
- `GET /settings/account` - Get account info
- `PUT /settings` - Update settings

**Required Response** (for `GET /settings`):
```json
{
  "success": true,
  "data": {
    "senderNumber": "+1234567890",
    "senderName": "Astronote",
    "timezone": "UTC",
    "currency": "EUR"
  }
}
```

**Status**: ✅ **READY**
- All endpoints exist
- Response includes required fields

**Missing Features** (if needed):
- ❓ Shop name/domain update (use `GET /settings/account`)
- ❓ Subscription management (use `/subscriptions` endpoints)

---

#### 10. Tracking/Analytics Page

**Endpoints**:
- `GET /tracking/campaign/:campaignId` - Campaign delivery status
- `GET /tracking/mitto/:messageId` - Message status
- `POST /tracking/bulk-update` - Bulk update status

**Status**: ✅ **READY**
- Endpoints exist
- Response includes delivery status

---

## Authentication Flow

### Shopify Extension (App Bridge)

1. Frontend receives Shopify session token from App Bridge
2. Frontend calls `POST /auth/shopify-token` with session token
3. Backend returns app JWT token
4. Frontend stores token and includes in `Authorization: Bearer <token>` header

**Status**: ✅ **READY**

### Web App (OAuth)

1. User clicks "Install App"
2. Frontend redirects to `GET /auth/shopify?shop=<domain>`
3. Backend redirects to Shopify OAuth
4. User grants permissions
5. Shopify redirects to `GET /auth/callback`
6. Backend creates/updates shop and redirects to frontend with token

**Status**: ✅ **READY**

---

## Missing Endpoints (If Needed)

### Segment Management

If frontend needs to create/edit/delete segments:

- `POST /audiences/segments` - Create segment
- `PUT /audiences/segments/:id` - Update segment
- `DELETE /audiences/segments/:id` - Delete segment
- `GET /audiences/segments/:id` - Get segment details

**Priority**: P1 (if segment builder UI needed)

### Template Management

If frontend needs to create/edit templates (admin):

- `POST /admin/templates` - Create template
- `PUT /admin/templates/:id` - Update template
- `DELETE /admin/templates/:id` - Delete template

**Priority**: P2 (admin feature)

### Advanced Filtering

If frontend needs advanced contact filtering:

- Add query params to `GET /contacts`:
  - `hasPurchased`: Boolean
  - `lastOrderBefore`: Date
  - `lastOrderAfter`: Date
  - `tags`: Array (AND/OR logic)

**Priority**: P2 (nice to have)

---

## Response Format Consistency

### Standard Success Response

```json
{
  "success": true,
  "data": {...},
  "message": "Optional message"
}
```

### Standard Error Response

```json
{
  "success": false,
  "error": "error_code",
  "message": "Human-readable message",
  "code": "ERROR_CODE"
}
```

### Pagination Response

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

**Status**: ✅ **CONSISTENT**
- All endpoints use standard format
- Error responses consistent

---

## Rate Limiting

**Current Limits**:
- General API: 1000 requests / 15 minutes
- Auth: 5 requests / 15 minutes
- SMS sending: 10 requests / minute
- Webhooks: 100 requests / minute

**Headers**:
- `X-Rate-Limit-Remaining`: Remaining requests
- `X-Rate-Limit-Reset`: Reset time (Unix timestamp)

**Status**: ✅ **READY**
- Rate limiting implemented
- Headers included in responses

---

## Caching Strategy

### React Query Configuration

**Recommended**:
```javascript
// Query keys
const queryKeys = {
  contacts: ['contacts'],
  contactsList: (filters) => ['contacts', 'list', filters],
  contact: (id) => ['contacts', id],
  campaigns: ['campaigns'],
  campaign: (id) => ['campaigns', id],
  // ...
};

// Cache configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});
```

**Cache Invalidation**:
- On POST/PUT/DELETE, invalidate related queries
- Backend sends cache invalidation headers (if implemented)

**Status**: ✅ **READY**
- Backend supports caching
- Frontend can implement React Query

---

## Error Handling

### Error Codes

Common error codes:
- `VALIDATION_ERROR`: Input validation failed
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded
- `INSUFFICIENT_CREDITS`: Not enough credits
- `STORE_NOT_FOUND`: Store context missing

**Status**: ✅ **READY**
- Error codes consistent
- Error messages user-friendly

---

## Readiness Assessment

### ✅ Ready for Frontend Integration

**All Required Endpoints**: ✅ Present  
**Authentication Flow**: ✅ Complete  
**Response Format**: ✅ Consistent  
**Pagination**: ✅ Supported  
**Filtering**: ✅ Supported  
**Error Handling**: ✅ Consistent  
**Rate Limiting**: ✅ Implemented  
**Caching**: ✅ Supported  

### ⚠️ Minor Gaps (Non-Blocking)

1. **Segment CRUD**: Not in API (P1 if needed)
2. **Advanced Filtering**: Basic filtering only (P2)
3. **Template CRUD**: Admin only (P2)

### 📋 Recommended Implementation Order

1. **Phase 1**: Authentication + Dashboard
   - Auth flow
   - Dashboard page
   - Basic navigation

2. **Phase 2**: Core Features
   - Contacts page
   - Campaigns page
   - Templates page

3. **Phase 3**: Advanced Features
   - Automations page
   - Reports page
   - Billing page

4. **Phase 4**: Polish
   - Settings page
   - Advanced filtering
   - Segment management (if needed)

---

## Testing Checklist

### API Integration Tests

- [ ] Test authentication flow (Shopify Extension)
- [ ] Test authentication flow (Web App OAuth)
- [ ] Test all GET endpoints with pagination
- [ ] Test all POST/PUT/DELETE endpoints
- [ ] Test error responses
- [ ] Test rate limiting
- [ ] Test filtering and search

### Frontend Integration Tests

- [ ] Test React Query caching
- [ ] Test error handling
- [ ] Test loading states
- [ ] Test pagination UI
- [ ] Test filtering UI
- [ ] Test form validation

---

## Conclusion

**Status**: ✅ **READY FOR FRONTEND INTEGRATION**

The backend provides all required endpoints for the frontend. Minor gaps (segment CRUD, advanced filtering) can be addressed as needed or handled in frontend with existing endpoints.

**Recommendation**: Proceed with frontend development using the recommended implementation order above.

