# Shopify Campaigns Endpoints

Confirmed campaign endpoints from `apps/shopify-api`.

---

## 1. List Campaigns

**Method:** `GET`  
**Path:** `/api/campaigns`  
**Evidence:** `apps/shopify-api/routes/campaigns.js:26-31`

### Required Headers
- `Authorization: Bearer <jwt_token>` (required)
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

### Query Params
- `page` (number, default: 1) - Page number
- `pageSize` (number, default: 20, max: 100) - Items per page
- `status` (string, optional) - Filter by status: `draft`, `scheduled`, `sending`, `sent`, `failed`, `cancelled`
- `sortBy` (string, default: `createdAt`) - Sort field: `createdAt`, `updatedAt`, `name`, `scheduleAt`
- `sortOrder` (string, default: `desc`) - Sort order: `asc`, `desc`
- `search` (string, optional) - Search query (searches in name/message)

**Evidence:** `apps/shopify-api/schemas/campaigns.schema.js:205-213`

### Response Shape

**Success (200):**
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "id": "uuid",
        "name": "Campaign Name",
        "message": "Message text",
        "status": "draft",
        "scheduleType": "immediate",
        "scheduleAt": "2024-01-01T12:00:00Z",
        "createdAt": "2024-01-01T10:00:00Z",
        "updatedAt": "2024-01-01T10:00:00Z",
        "startedAt": null,
        "finishedAt": null,
        "audience": "all",
        "discountId": null,
        "recipientCount": 0,
        "sentCount": 0,
        "failedCount": 0
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 50,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

## 2. Get Campaign Stats Summary

**Method:** `GET`  
**Path:** `/api/campaigns/stats/summary`  
**Evidence:** `apps/shopify-api/routes/campaigns.js:34`

### Response Shape
```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 50,
      "byStatus": {
        "draft": 10,
        "scheduled": 5,
        "sending": 2,
        "sent": 30,
        "failed": 2,
        "cancelled": 1
      }
    }
  }
}
```

---

## 3. Get Single Campaign

**Method:** `GET`  
**Path:** `/api/campaigns/:id`  
**Evidence:** `apps/shopify-api/routes/campaigns.js:40`

### Response Shape
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Campaign Name",
    "message": "Message text",
    "status": "draft",
    "scheduleType": "immediate",
    "scheduleAt": null,
    "createdAt": "2024-01-01T10:00:00Z",
    "updatedAt": "2024-01-01T10:00:00Z",
    "startedAt": null,
    "finishedAt": null,
    "audience": "all",
    "discountId": null,
    "recipientCount": 0,
    "sentCount": 0,
    "failedCount": 0
  }
}
```

---

## 4. Create Campaign

**Method:** `POST`  
**Path:** `/api/campaigns`  
**Evidence:** `apps/shopify-api/routes/campaigns.js:42-48`

### Request Body
```json
{
  "name": "Campaign Name",
  "message": "Message text",
  "audience": "all",
  "discountId": "uuid",
  "scheduleType": "immediate",
  "scheduleAt": "2024-01-01T12:00:00Z",
  "recurringDays": 7,
  "priority": "normal"
}
```

**Evidence:** `apps/shopify-api/schemas/campaigns.schema.js:45-129`

### Response Shape
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Campaign Name",
    ...
  },
  "message": "Campaign created successfully"
}
```

---

## 5. Update Campaign

**Method:** `PUT`  
**Path:** `/api/campaigns/:id`  
**Evidence:** `apps/shopify-api/routes/campaigns.js:50-56`

### Request Body
Same as create, all fields optional.

---

## 6. Delete Campaign

**Method:** `DELETE`  
**Path:** `/api/campaigns/:id`  
**Evidence:** `apps/shopify-api/routes/campaigns.js:59`

### Response Shape
```json
{
  "success": true,
  "message": "Campaign deleted successfully"
}
```

---

## 7. Enqueue Campaign (Send)

**Method:** `POST`  
**Path:** `/api/campaigns/:id/enqueue`  
**Evidence:** `apps/shopify-api/routes/campaigns.js:64-70`

### Request Headers
- `Idempotency-Key: <uuid>` (recommended)

### Request Body
Empty object `{}`

### Response Shape
```json
{
  "success": true,
  "message": "Campaign queued for sending"
}
```

---

## 8. Schedule Campaign

**Method:** `PUT`  
**Path:** `/api/campaigns/:id/schedule`  
**Evidence:** `apps/shopify-api/routes/campaigns.js:83-89`

### Request Body
```json
{
  "scheduleType": "scheduled",
  "scheduleAt": "2024-01-01T12:00:00Z",
  "recurringDays": 7
}
```

**Evidence:** `apps/shopify-api/schemas/campaigns.schema.js:218-240`

---

## 9. Cancel Campaign

**Method:** `POST`  
**Path:** `/api/campaigns/:id/cancel`  
**Evidence:** `apps/shopify-api/routes/campaigns.js:91-96`

### Request Body
Empty object `{}`

---

## 10. Get Campaign Metrics

**Method:** `GET`  
**Path:** `/api/campaigns/:id/metrics`  
**Evidence:** `apps/shopify-api/routes/campaigns.js:99`

### Response Shape
```json
{
  "success": true,
  "data": {
    "total": 1000,
    "sent": 950,
    "failed": 50,
    "delivered": 940,
    "conversions": 10,
    "unsubscribes": 5,
    "conversionRate": 0.01
  }
}
```

---

## 11. Get Campaign Status

**Method:** `GET`  
**Path:** `/api/campaigns/:id/status`  
**Evidence:** `apps/shopify-api/routes/campaigns.js:102`

### Response Shape
```json
{
  "success": true,
  "data": {
    "queued": 100,
    "processed": 50,
    "sent": 45,
    "failed": 5
  }
}
```

---

## 12. Get Campaign Progress

**Method:** `GET`  
**Path:** `/api/campaigns/:id/progress`  
**Evidence:** `apps/shopify-api/routes/campaigns.js:108`

### Response Shape
```json
{
  "success": true,
  "data": {
    "sent": 950,
    "failed": 50,
    "pending": 0,
    "percentage": 100
  }
}
```

---

## 13. Get Campaign Preview

**Method:** `GET`  
**Path:** `/api/campaigns/:id/preview`  
**Evidence:** `apps/shopify-api/routes/campaigns.js:105`

### Response Shape
```json
{
  "success": true,
  "data": {
    "recipientCount": 1000,
    "estimatedCost": 100
  }
}
```

---

## Summary

**For Phase 3 Implementation:**

**List Page:**
- `GET /api/campaigns` - List with pagination/filtering
- `GET /api/campaigns/stats/summary` - Stats cards

**Create Page:**
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/:id` - Get for edit (if editing)

**Detail Page:**
- `GET /api/campaigns/:id` - Get campaign
- `GET /api/campaigns/:id/metrics` - Get metrics
- `GET /api/campaigns/:id/status` - Get status (auto-refresh every 30s)
- `GET /api/campaigns/:id/progress` - Get progress
- `POST /api/campaigns/:id/enqueue` - Send
- `POST /api/campaigns/:id/cancel` - Cancel
- `DELETE /api/campaigns/:id` - Delete

**Stats Page:**
- `GET /api/campaigns/:id/metrics` - Detailed metrics

**Status Page:**
- `GET /api/campaigns/:id/status` - Status with Phase 2.2 metrics

