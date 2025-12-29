# Frontend Endpoints Mapping

This document maps frontend pages to backend API endpoints, including required fields, query parameters, and query invalidation rules.

## Important Notes

- **Reports are embedded in `/dashboard` response** - There is NO separate `/reports` page or endpoint
- **Templates are NOT associated with campaigns** - Templates page is copy/paste only
- **All data fetching uses React Query** - No server data stored in Redux (only auth token + UI prefs)

---

## Dashboard Page (`/dashboard`)

### Endpoints Used

| Method | Endpoint | Query Params | Required Fields | Response Fields |
|--------|----------|--------------|-----------------|-----------------|
| GET | `/dashboard` | None | None | `kpis`, `credits`, `reports` |

### Response Shape

```javascript
{
  data: {
    kpis: {
      totalContacts: number,
      activeCampaigns: number,
      activeAutomations: number,
    },
    credits: {
      balance: number,
    },
    reports: {
      last7Days: {
        sent: number,
        delivered: number,
        failed: number,
        unsubscribes?: number,
      },
      topCampaigns: Array<{
        id: string,
        name: string,
        sent: number,
        delivered: number,
        failed: number,
      }>,
      deliveryRateTrend: Array<{
        date: string,
        deliveredRate: number,
      }>,
      creditsUsage: Array<{
        date: string,
        creditsDebited: number,
      }>,
    },
  },
}
```

### Query Invalidation

- Invalidated by: Campaign create/enqueue, Contact import

---

## Campaigns Page (`/campaigns`)

### Endpoints Used

| Method | Endpoint | Query Params | Required Fields | Response Fields |
|--------|----------|--------------|-----------------|-----------------|
| GET | `/campaigns` | `page`, `pageSize`, `search`, `status` | None | `campaigns[]`, `total` |
| POST | `/campaigns/:id/enqueue` | None | Header: `Idempotency-Key` (optional) | `ok`, `enqueuedJobs`, `created` |

### Campaign Object Shape

```javascript
{
  id: string,
  name: string,
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed',
  sentCount: number,
  deliveredCount: number,
  failedCount: number,
  recipientCount: number,
  createdAt: string,
}
```

### Query Invalidation

- Invalidated by: Campaign create, enqueue, update, delete
- Also invalidates: `['dashboard']`

---

## Create Campaign Page (`/campaigns/new`)

### Endpoints Used

| Method | Endpoint | Query Params | Required Fields | Response Fields |
|--------|----------|--------------|-----------------|-----------------|
| POST | `/campaigns` | None | `name`, `message`, `audience` | `id`, `name`, `status` |
| POST | `/campaigns/:id/enqueue` | None | Header: `Idempotency-Key` (optional) | `ok`, `enqueuedJobs` |

### Request Body

```javascript
{
  name: string,
  message: string,
  audience: {
    type: 'all' | 'segment',
    segmentId?: string, // Required if type === 'segment'
  },
  includeDiscount?: boolean,
  discountValue?: string, // Required if includeDiscount === true
}
```

### Query Invalidation

- Invalidates: `['campaigns']`, `['dashboard']`

---

## Contacts Page (`/contacts`)

### Endpoints Used

| Method | Endpoint | Query Params | Required Fields | Response Fields |
|--------|----------|--------------|-----------------|-----------------|
| GET | `/contacts` | `q`, `page`, `pageSize` | None | `contacts[]`, `total` |
| POST | `/contacts/import` | None | `file` (multipart/form-data) | `imported`, `skipped`, `invalid` |

### Contact Object Shape

```javascript
{
  id: string,
  phoneE164: string,
  firstName?: string,
  lastName?: string,
  smsConsent: 'opted_in' | 'opted_out' | 'unknown',
  createdAt: string,
}
```

### Query Invalidation

- Invalidated by: Contact import, create, update, delete

---

## Lists Page (`/lists`)

### Endpoints Used

| Method | Endpoint | Query Params | Required Fields | Response Fields |
|--------|----------|--------------|-----------------|-----------------|
| GET | `/audiences/segments` | None | None | `segments[]` |

### Segment Object Shape

```javascript
{
  id: string,
  key: string, // e.g., 'gender_male', 'age_25_34'
  name: string, // e.g., 'Men', 'Age 25-34'
  type: 'system' | 'custom',
  criteriaJson: {
    gender?: 'male' | 'female' | null,
    age?: { gte?: number, lte?: number },
  },
  estimatedCount?: number,
  isActive: boolean,
}
```

### System Segments

- **Gender**: `gender_male`, `gender_female`, `gender_unknown`
- **Age**: `age_18_24`, `age_25_34`, `age_35_44`, `age_45_54`, `age_55_plus`

### Query Invalidation

- Rarely invalidated (system segments are read-only)

---

## Automations Page (`/automations`)

### Endpoints Used

| Method | Endpoint | Query Params | Required Fields | Response Fields |
|--------|----------|--------------|-----------------|-----------------|
| GET | `/automations` | None | None | `automations[]` |
| PUT | `/automations/:id/status` | None | `active: boolean` | `id`, `active` |
| PUT | `/automations/:id` | None | `message: string` | `id`, `message` |

### Automation Object Shape

```javascript
{
  id: string,
  name?: string,
  triggerType: string,
  message: string,
  active: boolean,
  createdAt: string,
}
```

### Query Invalidation

- Invalidated by: Automation toggle, update

---

## Templates Page (`/templates`)

### Endpoints Used

| Method | Endpoint | Query Params | Required Fields | Response Fields |
|--------|----------|--------------|-----------------|-----------------|
| GET | `/templates` | None | None | `templates[]` |

### Template Object Shape

```javascript
{
  id: string,
  name?: string,
  message: string,
  content?: string, // Fallback if message not present
  category?: string,
}
```

### Important

- **NO association with campaigns** - Templates are copy/paste only
- Frontend copies template text to clipboard
- No mutations (read-only)

### Query Invalidation

- Rarely invalidated (read-only)

---

## Settings Page (`/settings`)

### Endpoints Used

| Method | Endpoint | Query Params | Required Fields | Response Fields |
|--------|----------|--------------|-----------------|-----------------|
| GET | `/settings` | None | None | Settings object (varies) |
| PUT | `/settings` | None | Settings object | Updated settings |

### Settings Object Shape

```javascript
{
  baseUrl?: string,
  senderName?: string,
  // ... other settings as defined by backend
}
```

### Query Invalidation

- Invalidated by: Settings update

---

## Common Patterns

### Query Keys

- `['dashboard']`
- `['campaigns', params]`
- `['campaign', id]`
- `['contacts', params]`
- `['segments']`
- `['automations']`
- `['templates']`
- `['settings']`

### Error Handling

- All hooks use React Query's `error` state
- Pages show `ErrorState` component with retry button
- Toast notifications for mutations (success/error)

### Loading States

- All pages show `LoadingBlock` during initial load
- Tables show skeleton loaders
- Buttons show loading text during mutations

### Empty States

- All pages show `EmptyState` when no data
- Includes CTA buttons where appropriate (e.g., "Create Campaign", "Import CSV")

---

## Environment Variables

Required in `apps/web/.env.local`:

```bash
VITE_SHOPIFY_API_BASE_URL=https://astronote-shopify.onrender.com
VITE_APP_URL=https://astronote.onrender.com
```

For local development:

```bash
VITE_SHOPIFY_API_BASE_URL=http://localhost:3001
```
