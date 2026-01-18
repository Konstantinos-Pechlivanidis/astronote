# Dashboard Reports Data Shape

**Date**: 2025-01-XX  
**Purpose**: Define the embedded reports data structure in `/dashboard` response

## Overview

Reports are **embedded in the `/dashboard` response** as `data.reports`. There is **NO separate `/reports` endpoint**.

## Response Structure

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
      "last7Days": { ... },
      "topCampaigns": [ ... ],
      "deliveryRateTrend": [ ... ],
      "creditsUsage": [ ... ]
    }
  }
}
```

## Reports Object

### last7Days

Summary statistics for the last 7 days:

```json
{
  "sent": 500,
  "delivered": 480,
  "failed": 20,
  "unsubscribes": 5
}
```

**Source**: Aggregated from `CampaignRecipient.deliveryStatus` and `Contact.smsConsent` updates.

### topCampaigns

Top performing campaigns (limit: 5, ordered by `createdAt` desc):

```json
[
  {
    "id": "campaign123",
    "name": "Summer Sale",
    "sent": 200,
    "delivered": 195,
    "failed": 5,
    "createdAt": "2025-01-20T10:00:00Z"
  }
]
```

**Source**: `Campaign` with `status IN ('sent', 'sending', 'completed')` + `CampaignRecipient` counts.

### deliveryRateTrend

Daily delivery rate trend:

```json
[
  {
    "date": "2025-01-20",
    "deliveredRate": 96.5
  },
  {
    "date": "2025-01-21",
    "deliveredRate": 97.2
  }
]
```

**Source**: `CampaignRecipient` grouped by date (`sentAt`), calculated as `(delivered / sent) * 100`.

### creditsUsage

Daily credits usage:

```json
[
  {
    "date": "2025-01-20",
    "creditsDebited": 200
  },
  {
    "date": "2025-01-21",
    "creditsDebited": 150
  }
]
```

**Source**: `CreditTransaction` with `type = 'debit'` grouped by date (`createdAt`).

## Time Range

- **Default**: Last 7 days
- **Calculated from**: Current date - 7 days
- **Date grouping**: ISO date string (YYYY-MM-DD)

## Performance Considerations

- All queries use `shopId` filter (tenant isolation)
- Aggregations use Prisma `groupBy` for efficiency
- Parallel queries with `Promise.allSettled` for resilience
- Errors in individual queries don't fail entire response (fallback to empty/defaults)

## Frontend Usage

Frontend displays reports as **widgets** in the Dashboard page:
- Summary cards (last7Days stats)
- Performance chart (deliveryRateTrend)
- Top campaigns list (topCampaigns)
- Credits usage chart (creditsUsage)

**No separate `/reports` route exists in frontend.**

