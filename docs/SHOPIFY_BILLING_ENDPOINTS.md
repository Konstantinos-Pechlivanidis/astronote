# Shopify Billing Endpoints Documentation

**Evidence:** `apps/shopify-api/routes/billing.js`

---

## 1. Get Credit Balance

**Method:** `GET`  
**Path:** `/api/billing/balance`  
**Evidence:** `apps/shopify-api/routes/billing.js:24`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Response:**
```typescript
{
  credits: number;
  balance: number; // Alias for credits
  currency?: string; // 'EUR' | 'USD'
}
```

**Controller Evidence:** `apps/shopify-api/controllers/billing.js:19-34`

---

## 2. Get Credit Packages

**Method:** `GET`  
**Path:** `/api/billing/packages`  
**Evidence:** `apps/shopify-api/routes/billing.js:27`

**Query Parameters:**
- `currency` (string, optional): 'EUR' | 'USD' (default: 'EUR')

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Response:**
```typescript
{
  packages: Array<{
    id: string;
    name: string;
    credits: number;
    price: number;
    currency: string;
    description?: string;
  }>;
  currency: string;
  subscriptionRequired?: boolean; // true if subscription not active
}
```

**Controller Evidence:** `apps/shopify-api/controllers/billing.js:68-130`

**Note:** Only returns packages if subscription is active. Returns empty array if subscription not active.

---

## 3. Calculate Top-up Price

**Method:** `GET`  
**Path:** `/api/billing/topup/calculate`  
**Evidence:** `apps/shopify-api/routes/billing.js:29-34`

**Query Parameters:**
- `credits` (number, required): Number of credits to calculate price for

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Response:**
```typescript
{
  credits: number;
  price: number;
  currency: string;
}
```

**Controller Evidence:** `apps/shopify-api/controllers/billing.js` (check calculateTopup function)

---

## 4. Create Top-up Checkout Session

**Method:** `POST`  
**Path:** `/api/billing/topup`  
**Evidence:** `apps/shopify-api/routes/billing.js:36-42`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)
- `Content-Type: application/json`

**Request Body:**
```typescript
{
  credits: number;
  successUrl: string;
  cancelUrl: string;
  currency?: string; // Optional, defaults to shop currency
}
```

**Response:**
```typescript
{
  sessionUrl: string; // Stripe checkout URL
  checkoutUrl?: string; // Alias for sessionUrl
}
```

**Controller Evidence:** `apps/shopify-api/controllers/billing.js` (check createTopup function)

---

## 5. Create Purchase Checkout Session (Credit Packs)

**Method:** `POST`  
**Path:** `/api/billing/purchase`  
**Evidence:** `apps/shopify-api/routes/billing.js:60-66`

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)
- `Content-Type: application/json`

**Request Body:**
```typescript
{
  packageId: string;
  successUrl: string;
  cancelUrl: string;
  currency?: string; // Optional
}
```

**Response:**
```typescript
{
  sessionUrl: string; // Stripe checkout URL
  checkoutUrl?: string; // Alias for sessionUrl
}
```

**Controller Evidence:** `apps/shopify-api/controllers/billing.js:137-250`

**Note:** Requires active subscription. Returns 402 if subscription not active.

---

## 6. Get Transaction History

**Method:** `GET`  
**Path:** `/api/billing/history`  
**Evidence:** `apps/shopify-api/routes/billing.js:44-50`

**Query Parameters:**
- `page` (number, optional, default: 1)
- `pageSize` (number, optional, default: 20)

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Response:**
```typescript
{
  transactions: Array<{
    id: string;
    type: 'credit_purchase' | 'topup' | 'subscription' | 'refund';
    amount: number;
    currency: string;
    credits?: number;
    status: 'completed' | 'pending' | 'failed';
    createdAt: string;
    description?: string;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
```

**Controller Evidence:** `apps/shopify-api/controllers/billing.js` (check getHistory function)

---

## 7. Get Billing History (Stripe Transactions)

**Method:** `GET`  
**Path:** `/api/billing/billing-history`  
**Evidence:** `apps/shopify-api/routes/billing.js:52-58`

**Query Parameters:**
- `page` (number, optional, default: 1)
- `pageSize` (number, optional, default: 20)

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Shopify-Shop-Domain: <shop-domain>` (optional fallback)

**Response:**
```typescript
{
  items: Array<{
    id: string;
    type: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    description?: string;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
```

**Controller Evidence:** `apps/shopify-api/controllers/billing.js` (check getBillingHistory function)

---

## Subscription Endpoints

**Note:** Subscription endpoints may be in a separate routes file. Check `apps/shopify-api/routes/subscriptions.js` if it exists.

If subscription endpoints exist, they would include:
- `GET /api/subscriptions/current` - Get subscription status
- `POST /api/subscriptions/subscribe` - Subscribe to plan
- `PUT /api/subscriptions/update` - Update subscription
- `POST /api/subscriptions/cancel` - Cancel subscription
- `GET /api/subscriptions/portal` - Get Stripe customer portal URL

---

## Type Definitions

### Credit Package
```typescript
interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  description?: string;
}
```

### Transaction
```typescript
interface Transaction {
  id: string;
  type: 'credit_purchase' | 'topup' | 'subscription' | 'refund';
  amount: number;
  currency: string;
  credits?: number;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
  description?: string;
}
```

### Balance
```typescript
interface Balance {
  credits: number;
  balance: number; // Alias for credits
  currency?: string;
}
```

---

## Notes

1. **Subscription Requirement:**
   - Credit packages (`/billing/packages` and `/billing/purchase`) require active subscription
   - Top-up (`/billing/topup`) does NOT require subscription

2. **Currency:**
   - Supported currencies: 'EUR', 'USD'
   - Default: 'EUR'
   - Currency can come from query param, shop settings, or default

3. **Stripe Checkout:**
   - All purchase/topup endpoints return a `sessionUrl` or `checkoutUrl`
   - Frontend should redirect to this URL for Stripe checkout
   - Success/cancel URLs are provided in request body

4. **Caching:**
   - Balance endpoint uses `billingBalanceCache` middleware
   - History endpoints use `billingHistoryCache` middleware
   - Cache is invalidated on purchase/topup

5. **Rate Limiting:**
   - All billing routes use `billingRateLimit` middleware

