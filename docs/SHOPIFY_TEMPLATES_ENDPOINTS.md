# Shopify Templates Endpoints Documentation

**Evidence:** `apps/shopify-api/routes/templates.js`

---

## 1. List Templates

**Method:** `GET`  
**Path:** `/api/templates`  
**Evidence:** `apps/shopify-api/routes/templates.js:7`

**Query Parameters:**
- `limit` (number, default: 50) - Number of templates per page
- `offset` (number, default: 0) - Offset for pagination
- `category` (string, optional) - Filter by category
- `search` (string, optional) - Search in title, content, or tags

**Required Headers:**
- `Authorization: Bearer <jwt_token>` (optional - templates are public)
- `X-Shopify-Shop-Domain: <shop-domain>` (optional - for usage tracking)

**Response:**
```typescript
{
  templates: Template[],
  pagination: {
    page: number,
    pageSize: number,
    total: number,
    totalPages: number,
    hasNextPage: boolean,
    hasPrevPage: boolean
  },
  categories: string[] // Available categories for filtering
}
```

**Controller Evidence:** `apps/shopify-api/controllers/templates.js:10-130`

**Note:** Templates are public (`isPublic: true`). If shopId is available, usage counts are included.

---

## 2. Get Template Categories

**Method:** `GET`  
**Path:** `/api/templates/categories`  
**Evidence:** `apps/shopify-api/routes/templates.js:8`

**Required Headers:**
- `Authorization: Bearer <jwt_token>` (optional - templates are public)

**Response:**
```typescript
string[] // Array of category names
```

**Controller Evidence:** `apps/shopify-api/controllers/templates.js:182-205`

---

## 3. Get Single Template

**Method:** `GET`  
**Path:** `/api/templates/:id`  
**Evidence:** `apps/shopify-api/routes/templates.js:9`

**Required Headers:**
- `Authorization: Bearer <jwt_token>` (optional - templates are public)

**Response:**
```typescript
Template
```

**Controller Evidence:** `apps/shopify-api/controllers/templates.js:135-177`

---

## 4. Track Template Usage

**Method:** `POST`  
**Path:** `/api/templates/:id/track`  
**Evidence:** `apps/shopify-api/routes/templates.js:13`

**Required Headers:**
- `Authorization: Bearer <jwt_token>` (required for tracking)
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Response:**
```typescript
{
  message: 'Template usage tracked'
}
```

**Controller Evidence:** `apps/shopify-api/controllers/templates.js:210-274`

**Note:** Tracks template usage for analytics. Requires shop context.

---

## Template Type Definition

```typescript
interface Template {
  id: string
  title: string
  category: string
  content: string // SMS message content
  previewImage?: string | null
  tags?: string[]
  conversionRate?: number | null
  productViewsIncrease?: number | null
  clickThroughRate?: number | null
  averageOrderValue?: number | null
  customerRetention?: number | null
  useCount?: number // Usage count for current shop (if shopId available)
  createdAt?: string
  updatedAt?: string
}
```

---

## Notes

1. **Public Templates:** All templates are public (`isPublic: true`). No authentication required to view.
2. **Usage Tracking:** Requires shop context. Tracks how many times a template has been used by a shop.
3. **Pagination:** Uses `offset`/`limit` instead of `page`/`pageSize`, but response includes both formats.
4. **Categories:** Categories are extracted from public templates and returned as a simple string array.

