# Shopify Automations Endpoints Documentation

**Evidence:** `apps/shopify-api/routes/automations.js`

---

## 1. List Automations

**Method:** `GET`  
**Path:** `/api/automations`  
**Evidence:** `apps/shopify-api/routes/automations.js:13`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Response:**
```typescript
Automation[]
```

**Controller Evidence:** `apps/shopify-api/controllers/automations.js:90-144`

**Note:** Returns all automations for the current shop. No pagination.

---

## 2. Get Automation Statistics

**Method:** `GET`  
**Path:** `/api/automations/stats`  
**Evidence:** `apps/shopify-api/routes/automations.js:19`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Response:**
```typescript
{
  total: number;
  active: number;
  paused: number;
  messagesSent?: number;
  successRate?: number;
}
```

**Controller Evidence:** `apps/shopify-api/controllers/automations.js:250-304`

---

## 3. Create Automation

**Method:** `POST`  
**Path:** `/api/automations`  
**Evidence:** `apps/shopify-api/routes/automations.js:14-18`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)
- `Content-Type: application/json`

**Request Body:**
```typescript
{
  name: string; // 1-255 characters
  trigger: AutomationTrigger; // See trigger enum below
  message: string; // 10-1600 characters
  status?: 'draft' | 'active' | 'paused'; // Optional, defaults to 'draft'
  triggerConditions?: Record<string, any>; // Optional
}
```

**Response:**
```typescript
Automation
```

**Controller Evidence:** `apps/shopify-api/controllers/automations.js:15-85`

---

## 4. Update Automation

**Method:** `PUT`  
**Path:** `/api/automations/:id`  
**Evidence:** `apps/shopify-api/routes/automations.js:25-29`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)
- `Content-Type: application/json`

**Request Body:**
```typescript
{
  message?: string; // 10-1600 characters
  status?: 'draft' | 'active' | 'paused';
  userMessage?: string; // Alternative to 'message'
  isActive?: boolean; // Alternative to 'status'
}
```

**Response:**
```typescript
Automation
```

**Controller Evidence:** `apps/shopify-api/controllers/automations.js:149-250`

**Note:** Supports both frontend format (status) and backend format (isActive).

---

## 5. Delete Automation

**Method:** `DELETE`  
**Path:** `/api/automations/:id`  
**Evidence:** `apps/shopify-api/routes/automations.js:30`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Response:**
```typescript
{
  message: 'Automation deleted successfully'
}
```

**Controller Evidence:** `apps/shopify-api/controllers/automations.js:306-350`

---

## 6. Get Automation Variables

**Method:** `GET`  
**Path:** `/api/automations/variables/:triggerType`  
**Evidence:** `apps/shopify-api/routes/automations.js:20-24`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Response:**
```typescript
{
  variables: Array<{
    name: string;
    description: string;
    example: string;
  }>;
}
```

**Controller Evidence:** `apps/shopify-api/controllers/automations.js:352-400`

**Note:** Returns available variables for a specific trigger type (e.g., {{firstName}}, {{orderNumber}}).

---

## Automation Type Definitions

### AutomationTrigger Enum
```typescript
type AutomationTrigger =
  | 'welcome'
  | 'abandoned_cart'
  | 'order_confirmation'
  | 'shipping_update'
  | 'delivery_confirmation'
  | 'review_request'
  | 'reorder_reminder'
  | 'birthday'
  | 'customer_inactive'
  | 'cart_abandoned'
  | 'order_placed'
  | 'order_fulfilled'
  | 'cross_sell'
  | 'upsell';
```

### Automation Interface
```typescript
interface Automation {
  id: string;
  automationId: string;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  message: string;
  status: 'draft' | 'active' | 'paused';
  isSystemDefault: boolean;
  createdAt: string;
  updatedAt: string;
  // Backend fields (for compatibility)
  title?: string;
  triggerEvent?: AutomationTrigger;
  userMessage?: string;
  isActive?: boolean;
}
```

---

## Notes

1. **Status Mapping:**
   - `active` → `isActive: true`
   - `paused` → `isActive: false`
   - `draft` → `isActive: false`

2. **Coming Soon Triggers:**
   - `cart_abandoned`, `customer_inactive`, `abandoned_cart` are not yet fully supported
   - Should show "Coming Soon" badge in UI

3. **Variables:**
   - Variables are trigger-specific
   - Use `GET /api/automations/variables/:triggerType` to get available variables
   - Variables are used in message templates (e.g., `{{firstName}}`, `{{orderNumber}}`)

4. **No Pagination:**
   - List endpoint returns all automations (typically small number)
   - No pagination needed

---

## Schema Evidence

**Validation Schemas:** `apps/shopify-api/schemas/automations.schema.js`

- `createAutomationSchema` - For POST /automations
- `updateAutomationSchema` - For PUT /automations/:id
- `automationVariablesSchema` - For GET /automations/variables/:triggerType

