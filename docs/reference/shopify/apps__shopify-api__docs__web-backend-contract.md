# Web Backend Contract

**Date**: 2025-01-XX  
**Purpose**: API contract between `apps/web` frontend and `apps/shopify-api` backend

## Overview

This document defines the contract between the React frontend (`apps/web`) and the Shopify API backend (`apps/shopify-api`). All endpoints are store-scoped via `resolveStore` and `requireStore` middleware.

## Response Format

All API responses follow this envelope format:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

Paginated responses:
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

## Authentication

- **Method**: Bearer JWT token
- **Header**: `Authorization: Bearer <token>`
- **401 Response**: Clears token, redirects to `/settings`
- **Token Storage**: Redux + localStorage

## Endpoints by Page

### Dashboard Page (`/dashboard`)

#### GET /dashboard

**Response**:
```json
{
  "success": true,
  "data": {
    "credits": 1000,
    "totalCampaigns": 25,
    "totalContacts": 500,
    "totalMessagesSent": 10000,
    "activeAutomations": 3,
    "reports": {
      "last7Days": {
        "sent": 500,
        "delivered": 480,
        "failed": 20,
        "unsubscribes": 5
      },
      "topCampaigns": [
        {
          "id": "campaign123",
          "name": "Summer Sale",
          "sent": 200,
          "delivered": 195,
          "failed": 5,
          "createdAt": "2025-01-20T10:00:00Z"
        }
      ],
      "deliveryRateTrend": [
        {
          "date": "2025-01-20",
          "deliveredRate": 96.5
        }
      ],
      "creditsUsage": [
        {
          "date": "2025-01-20",
          "creditsDebited": 200
        }
      ]
    }
  }
}
```

**Note**: Reports are embedded in dashboard response. **NO separate `/reports` endpoint exists.**

### Campaigns Page (`/campaigns`)

#### GET /campaigns

**Query Params**:
- `page` (number, default: 1)
- `pageSize` (number, default: 20, max: 100)
- `status` (optional: "draft", "scheduled", "sending", "sent", "failed", "cancelled")
- `sortBy` (optional: "createdAt", "updatedAt", "name", "scheduleAt")
- `sortOrder` (optional: "asc", "desc")

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "campaign123",
      "name": "Summer Sale",
      "status": "sent",
      "createdAt": "2025-01-20T10:00:00Z",
      "scheduledAt": null,
      "sentCount": 200,
      "deliveredCount": 195,
      "failedCount": 5,
      "recipientCount": 200
    }
  ],
  "pagination": { ... }
}
```

#### POST /campaigns

**Body**:
```json
{
  "name": "Campaign Name",
  "message": "Hello {{firstName}}, use code {{discount}}!",
  "audience": "all" | { "type": "all" } | { "type": "segment", "segmentId": "segment123" },
  "includeDiscount": true,  // Optional
  "discountValue": "SAVE20",  // Optional
  "scheduleType": "immediate" | "scheduled" | "recurring",
  "scheduleAt": "2025-01-25T10:00:00Z",  // Required if scheduleType === "scheduled"
  "recurringDays": 7,  // Required if scheduleType === "recurring"
  "priority": "normal"  // Optional: "low", "normal", "high", "urgent"
}
```

**Response**: Created campaign object

**Mutations**: Invalidates `['campaigns']`

#### POST /campaigns/:id/enqueue

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "queued",
    "queuedRecipients": 200,
    "creditsDebited": 200
  }
}
```

**Mutations**: Invalidates `['campaigns']`, `['campaign', id]`

#### DELETE /campaigns/:id

**Mutations**: Invalidates `['campaigns']`

### Create Campaign Page (`/campaigns/new`)

Uses same endpoints as Campaigns Page:
- **POST /campaigns** - Create campaign
- **GET /audiences/segments** - Get segments for audience selection

### Contacts Page (`/contacts`)

#### GET /contacts

**Query Params**:
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `search` (string, optional) - Search by phone/email/name

**Response**:
```json
{
  "success": true,
  "data": {
    "contacts": [
      {
        "id": "contact123",
        "phoneE164": "+1234567890",
        "firstName": "John",
        "lastName": "Doe",
        "smsConsent": "opted_in",
        "createdAt": "2025-01-20T10:00:00Z"
      }
    ],
    "total": 500,
    "page": 1,
    "pageSize": 20
  }
}
```

#### POST /contacts/import

**Body**: `multipart/form-data` with CSV file

**Response**: Import result

**Mutations**: Invalidates `['contacts']`

### Lists Page (`/lists`)

#### GET /audiences/segments

**Response**:
```json
{
  "success": true,
  "data": {
    "segments": [
      {
        "id": "segment123",
        "key": "gender_male",
        "name": "Male",
        "type": "system",
        "criteria": { "gender": "male" },
        "isActive": true,
        "createdAt": "2025-01-20T10:00:00Z"
      },
      {
        "id": "segment456",
        "key": "age_18_24",
        "name": "Age 18-24",
        "type": "system",
        "criteria": { "age": { "gte": 18, "lte": 24 } },
        "isActive": true,
        "createdAt": "2025-01-20T10:00:00Z"
      }
    ],
    "total": 8
  }
}
```

**Note**: System segments are auto-created on first call (idempotent).

#### GET /audiences/segments/:id/preview

**Response**:
```json
{
  "success": true,
  "data": {
    "segmentId": "segment123",
    "estimatedCount": 150
  }
}
```

### Automations Page (`/automations`)

#### GET /automations

**Response**:
```json
{
  "success": true,
  "data": {
    "automations": [
      {
        "id": "auto123",
        "name": "Welcome Series",
        "triggerType": "order_placed",
        "message": "Thank you for your order!",
        "active": true,
        "createdAt": "2025-01-20T10:00:00Z"
      }
    ]
  }
}
```

#### PUT /automations/:id

**Body**:
```json
{
  "active": true,  // Toggle active/inactive
  "message": "Updated message"  // Update message
}
```

**Mutations**: Invalidates `['automations']`

### Templates Page (`/templates`)

#### GET /templates

**Response**:
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "template123",
        "name": "Welcome Message",
        "category": "welcome",
        "message": "Welcome {{firstName}}!",
        "content": "Welcome {{firstName}}!"
      }
    ]
  }
}
```

**Note**: Templates are read-only, copy/paste only. No campaign association.

### Settings Page (`/settings`)

#### GET /settings

**Response**: Settings object (structure depends on backend)

#### PUT /settings

**Body**: Settings object

**Mutations**: Invalidates `['settings']`

## System Segments

System segments are automatically created per shop on first access to `GET /audiences/segments`.

### Gender Segments
- `gender_male` - Male contacts
- `gender_female` - Female contacts
- `gender_unknown` - Unknown/null gender

### Age Bucket Segments
- `age_18_24` - Age 18-24
- `age_25_34` - Age 25-34
- `age_35_44` - Age 35-44
- `age_45_54` - Age 45-54
- `age_55_plus` - Age 55+

**Note**: Age segments exclude contacts without `birthDate` (null birthdays).

## Campaign Audience Format

Campaigns support two audience formats:

### Legacy Format (String)
```json
{
  "audience": "all" | "men" | "women" | "segment:segmentId"
}
```

### New Format (Object)
```json
{
  "audience": {
    "type": "all" | "segment",
    "segmentId": "segment123"  // Required if type === "segment"
  }
}
```

Both formats are supported for backward compatibility.

## Campaign Meta Fields

Campaign `meta` JSON field stores:
```json
{
  "includeDiscount": true,
  "discountValue": "SAVE20"
}
```

## Segment Resolution

When enqueueing a campaign with segment audience:
1. Validate segment belongs to shop (tenant isolation)
2. For system segments: Resolve contacts using criteria (gender/age filters)
3. For custom segments: Use SegmentMembership table
4. Filter by `smsConsent: 'opted_in'` always

## URL Shortener

- **Base URL**: `URL_SHORTENER_BASE_URL` env var (points to backend)
- **Format**: `${URL_SHORTENER_BASE_URL}/r/${token}`
- **Redirect**: `GET /r/:token` → 302 redirect to destination
- **Security**: HTTPS-only in production, optional hostname allowlist

## CORS

Allowed origins:
- `https://astronote.onrender.com` (web frontend)
- `https://admin.shopify.com` (Shopify admin)
- `https://astronote-shopify-frontend.onrender.com` (legacy)
- `*.myshopify.com` (Shopify storefronts)
- `ALLOWED_ORIGINS` env var (CSV)

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": "unauthorized",
  "message": "Authentication required"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": "validation_error",
  "message": "Validation failed",
  "details": { ... }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "not_found",
  "message": "Resource not found"
}
```

## Notes

1. **Reports**: Embedded in `/dashboard` response. No separate `/reports` endpoint.
2. **Templates**: Read-only, copy/paste only. No campaign association.
3. **Segments**: System segments auto-created (idempotent).
4. **Tenant Isolation**: All endpoints scoped by `shopId` via middleware.
5. **Backward Compatibility**: Legacy audience formats still supported.

