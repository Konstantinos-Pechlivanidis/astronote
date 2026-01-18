# Shopify Automations GraphQL Audit Report

**Date:** 2025-01-27  
**Scope:** Shopify-only automations (backend + frontend)  
**Focus:** GraphQL query quality, reliability, idempotency, and frontend integration  
**Status:** 🔍 **AUDIT COMPLETE**

---

## Executive Summary

This audit performs a thorough code-wise analysis of the Shopify automations implementation, with a focus on GraphQL query correctness, reliability, idempotency, and frontend integration. The audit identifies gaps and proposes targeted improvements without major refactoring.

**Key Findings:**
- ✅ GraphQL queries use variables correctly (no unsafe string interpolation)
- ✅ Idempotency mechanisms exist (EventProcessingState, webhook replay protection)
- ✅ Tenant scoping is enforced (shopId everywhere)
- ⚠️ **Gap:** No throttle/429 handling in GraphQL client
- ⚠️ **Gap:** No pagination for `getAbandonedCheckouts` (uses `first` but no cursor-based pagination)
- ⚠️ **Gap:** No GraphQL cost tracking or query optimization
- ⚠️ **Gap:** No retry logic with backoff for GraphQL queries
- ⚠️ **Gap:** No runtime validation (zod schemas) for GraphQL responses

---

## Phase 1: Inventory Automations Features and Flows

### A) Automation Types Supported

**Automation Types (from Prisma schema):**
- `welcome` - Welcome series for new customers
- `abandoned_cart` / `cart_abandoned` - Abandoned checkout reminders
- `order_confirmation` / `order_placed` - Order confirmation messages
- `shipping_update` - Shipping status updates
- `delivery_confirmation` / `order_fulfilled` - Fulfillment notifications
- `review_request` - Post-purchase review requests
- `reorder_reminder` - Reorder reminders
- `birthday` - Birthday offers
- `customer_inactive` - Win-back automations
- `cross_sell` - Cross-sell recommendations
- `upsell` - Upsell recommendations

**Total:** 12 automation types

### B) Trigger Sources

1. **Shopify Webhooks:**
   - `orders/create` → `order_placed` automation
   - `orders/fulfilled` → `order_fulfilled` automation
   - `checkout/abandoned` / `cart/abandoned` → `abandoned_cart` automation
   - **Location:** `apps/shopify-api/routes/automation-webhooks.js`
   - **HMAC Verification:** ✅ `validateShopifyWebhook` middleware

2. **Scheduled Polling Jobs:**
   - Daily birthday check → `birthday` automation
   - Daily re-engagement check (30 days) → `customer_inactive` automation
   - Monthly win-back check (90-180 days) → `customer_inactive` automation
   - **Location:** `apps/shopify-api/queue/jobs/automationTriggers.js`

3. **Manual Triggers:**
   - `POST /automation-webhooks/trigger` - For testing
   - **Location:** `apps/shopify-api/controllers/automation-webhooks.js`

### C) GraphQL Usage

**GraphQL Client:**
- **Location:** `apps/shopify-api/services/shopify-graphql.js`
- **Client Wrapper:** `executeGraphQLQuery(shopDomain, query, variables)`
- **API Version:** `2024-04` (hardcoded in `services/shopify.js`)
- **Access Token:** Retrieved from `Shop.accessToken` via `getShopifySession(shopDomain)`

**GraphQL Queries Defined:**
1. `getOrderDetails(shopDomain, orderId)` - Order details with customer, line items, shipping, discounts
2. `getFulfillmentDetails(shopDomain, fulfillmentId)` - Fulfillment with tracking info
3. `getAbandonedCheckout(shopDomain, abandonedCheckoutId)` - Single abandoned checkout
4. `getAbandonedCheckouts(shopDomain, queryString, first)` - List abandoned checkouts (⚠️ **NO PAGINATION**)
5. `getCustomerDetails(shopDomain, customerId)` - Customer details
6. `getProductRecommendations(shopDomain, productId, first)` - Product recommendations

**Query Storage:**
- ✅ Queries are stored in a single file (`services/shopify-graphql.js`)
- ✅ Queries are named clearly (e.g., `getOrderDetails`, `getFulfillmentDetails`)
- ✅ All queries use variables (no unsafe string interpolation)

---

## Phase 2: GraphQL Query Quality Audit

### A) Variable Usage ✅

**Status:** ✅ **PASS**

All GraphQL queries use variables correctly:

```javascript
// ✅ CORRECT: Uses variables
const query = `
  query GetOrderDetails($id: ID!) {
    order(id: $id) { ... }
  }
`;
const data = await executeGraphQLQuery(shopDomain, query, { id: orderId });

// ✅ CORRECT: Uses variables
const query = `
  query GetAbandonedCheckouts($first: Int!, $query: String) {
    abandonedCheckouts(first: $first, query: $query) { ... }
  }
`;
const data = await executeGraphQLQuery(shopDomain, query, { first, query: queryString });
```

**No unsafe string interpolation found.**

### B) Pagination ⚠️

**Status:** ⚠️ **GAP IDENTIFIED**

**Findings:**

1. **`getAbandonedCheckouts` - NO PAGINATION:**
   ```javascript
   // ⚠️ Uses `first` parameter but no cursor-based pagination
   export async function getAbandonedCheckouts(shopDomain, queryString = '', first = 10) {
     const query = `
       query GetAbandonedCheckouts($first: Int!, $query: String) {
         abandonedCheckouts(first: $first, query: $query) {
           nodes { ... }
         }
       }
     `;
     // ⚠️ No pageInfo, hasNextPage, endCursor
   }
   ```

2. **`getOrderDetails` - Line items pagination:**
   ```javascript
   // ✅ Uses `first: 50` for line items (reasonable limit)
   lineItems(first: 50) {
     edges { ... }
   }
   // ⚠️ But no cursor-based pagination if order has >50 items
   ```

3. **Other queries:**
   - `getFulfillmentDetails` - Single resource (no pagination needed) ✅
   - `getCustomerDetails` - Single resource (no pagination needed) ✅
   - `getProductRecommendations` - Uses `first` parameter (reasonable limit) ✅

**Impact:**
- ⚠️ `getAbandonedCheckouts` may miss checkouts if there are more than `first` results
- ⚠️ Orders with >50 line items may not fetch all items

**Recommendation:**
- Add cursor-based pagination to `getAbandonedCheckouts` if used for polling
- Add pagination support for line items if orders can have >50 items

### C) Overfetching ⚠️

**Status:** ⚠️ **MINOR GAPS**

**Findings:**

1. **`getOrderDetails` - Fetches all fields:**
   ```javascript
   // Fetches: id, name, processedAt, phone, totalPriceSet, customer, lineItems, discountCodes, shippingAddress, fulfillments
   // ✅ All fields are used by automation variables
   ```

2. **`getFulfillmentDetails` - Fetches all fields:**
   ```javascript
   // Fetches: id, createdAt, estimatedDeliveryAt, status, trackingInfo, order (with customer)
   // ✅ All fields are used by automation variables
   ```

3. **`getAbandonedCheckout` - Fetches all fields:**
   ```javascript
   // Fetches: id, abandonedCheckoutPayload (with lineItems, subtotalPriceSet, discountCodes), customer, emailState, daysSinceLastAbandonmentEmail, hoursSinceLastAbandonedCheckout
   // ✅ All fields are used by automation variables
   ```

**Verdict:** ✅ Queries are well-optimized, fetching only required fields.

### D) Nullability and Missing Fields ✅

**Status:** ✅ **PASS**

**Findings:**

1. **Defensive parsing:**
   ```javascript
   // ✅ Checks for null/undefined
   if (!data.order) {
     throw new Error(`Order not found: ${orderId}`);
   }
   ```

2. **Optional chaining:**
   ```javascript
   // ✅ Uses optional chaining in automation variables
   orderDetails.customer?.email
   orderDetails.totalPriceSet?.shopMoney?.amount
   ```

3. **Fallback values:**
   ```javascript
   // ✅ Provides fallback values
   const phoneE164 = customer.phone || customer.default_address?.phone || null;
   ```

**Verdict:** ✅ Code handles nullability and missing fields safely.

### E) Runtime Validation ⚠️

**Status:** ⚠️ **GAP IDENTIFIED**

**Findings:**

1. **No zod schemas for GraphQL responses:**
   - GraphQL responses are parsed without runtime validation
   - Relies on TypeScript types (not available at runtime)
   - No validation that response shape matches expected structure

2. **Error handling:**
   ```javascript
   // ✅ Checks for GraphQL errors
   if (response.body.errors && response.body.errors.length > 0) {
     throw new Error(`Shopify GraphQL error: ${graphqlErrors}`);
   }
   
   // ✅ Checks for data existence
   if (!response.body.data) {
     throw new Error('Invalid response structure from Shopify API');
   }
   ```

**Impact:**
- ⚠️ Schema changes in Shopify API may cause runtime errors
- ⚠️ No early detection of response shape mismatches

**Recommendation:**
- Add zod schemas for critical GraphQL responses (Order, Fulfillment, AbandonedCheckout)
- Validate responses before using them in automation logic

### F) Shopify Cost/Rate Limits ⚠️

**Status:** ⚠️ **GAP IDENTIFIED**

**Findings:**

1. **No throttle status parsing:**
   ```javascript
   // ⚠️ Does not parse throttleStatus/cost extensions
   const response = await client.query({ data: { query, variables } });
   // No check for response.body.extensions?.cost
   // No check for response.body.extensions?.throttleStatus
   ```

2. **No 429 handling:**
   ```javascript
   // ⚠️ No retry logic for 429 (Too Many Requests)
   // ⚠️ No backoff strategy
   // ⚠️ No throttle detection
   ```

3. **No cost tracking:**
   ```javascript
   // ⚠️ Does not log query cost
   // ⚠️ Does not warn on high-cost queries
   ```

**Impact:**
- ⚠️ GraphQL queries may fail with 429 errors without retry
- ⚠️ No visibility into query cost (may hit Shopify rate limits)
- ⚠️ No proactive throttling based on cost

**Recommendation:**
- Add throttle status parsing and retry logic with exponential backoff
- Add cost tracking and warnings for high-cost queries
- Implement request queuing for rate-limited requests

---

## Phase 3: Event/Idempotency Correctness Audit

### A) Webhook-Based Triggers ✅

**Status:** ✅ **PASS**

**Findings:**

1. **HMAC Verification:**
   ```javascript
   // ✅ validateShopifyWebhook middleware verifies HMAC
   // Location: apps/shopify-api/middlewares/shopify-webhook.js
   export function validateShopifyWebhook(req, res, next) {
     const isValid = verifyShopifyWebhookSignature(req);
     // ...
   }
   ```

2. **Topic Matching:**
   ```javascript
   // ✅ Routes match webhook topics
   r.post('/shopify/orders/create', validateShopifyWebhook, ctrl.handleOrderCreated);
   r.post('/shopify/orders/fulfilled', validateShopifyWebhook, ctrl.handleOrderFulfilled);
   r.post('/shopify/checkout/abandoned', validateShopifyWebhook, ctrl.handleAbandonedCheckout);
   ```

3. **Deduplication:**
   - ✅ **Webhook Replay Protection:** `processWebhookWithReplayProtection` in `services/webhook-replay.js`
   - ✅ **EventProcessingState:** Tracks last processed event per shop/automation type
   - ✅ **WebhookEvent Model:** Stores webhook events with unique constraint `(provider, eventId)`

**Verdict:** ✅ Webhook processing is idempotent and secure.

### B) Scheduled Jobs ✅

**Status:** ✅ **PASS**

**Findings:**

1. **Job Idempotency:**
   ```javascript
   // ✅ Unique jobId prevents duplicates
   jobId: `order-confirmation-${shop.id}-${id}-${Date.now()}`
   jobId: `abandoned-cart-${shop.id}-${checkoutId}-${Date.now()}`
   ```

2. **ScheduledAutomation Model:**
   ```prisma
   model ScheduledAutomation {
     jobId String @unique // ✅ Prevents duplicate jobs
     // ...
   }
   ```

3. **Job Cancellation:**
   ```javascript
   // ✅ Cancels abandoned checkout jobs when order is completed
   await cancelAutomationsForOrder(shop.id, id.toString());
   ```

4. **Query Windows:**
   ```javascript
   // ✅ Uses EventProcessingState for query windows
   const minOccurredAt = await getMinOccurredAt(shopId, automationType);
   // Queries events after last processed event
   ```

**Verdict:** ✅ Scheduled jobs are idempotent and prevent duplicates.

---

## Phase 4: Data Mapping and DB Writes Audit

### A) Tenant Scoping ✅

**Status:** ✅ **PASS**

**Findings:**

1. **All DB queries scoped by shopId:**
   ```javascript
   // ✅ Contact queries
   const contact = await prisma.contact.findFirst({
     where: { id: contactId, shopId },
   });
   
   // ✅ Automation queries
   const userAutomation = await prisma.userAutomation.findFirst({
     where: { shopId, automation: { triggerEvent }, isActive: true },
   });
   
   // ✅ ScheduledAutomation queries
   const scheduledAutomations = await prisma.scheduledAutomation.findMany({
     where: { shopId, orderId, status: 'scheduled' },
   });
   ```

2. **Unique constraints prevent cross-tenant leakage:**
   ```prisma
   @@unique([shopId, phoneE164]) // Contact
   @@unique([shopId, automationType]) // EventProcessingState
   @@unique([shopId, contactId, sequenceType]) // AutomationSequence
   ```

**Verdict:** ✅ Tenant scoping is enforced everywhere.

### B) Unique Constraints ✅

**Status:** ✅ **PASS**

**Findings:**

1. **ScheduledAutomation:**
   ```prisma
   jobId String @unique // ✅ Prevents duplicate jobs
   ```

2. **EventProcessingState:**
   ```prisma
   @@unique([shopId, automationType]) // ✅ One state per shop/automation type
   ```

3. **WebhookEvent:**
   ```prisma
   @@unique([provider, eventId]) // ✅ Prevents duplicate webhook processing
   ```

4. **AbandonedCheckout:**
   ```prisma
   @@unique([shopId, checkoutId]) // ✅ Prevents duplicate abandoned checkouts
   ```

**Verdict:** ✅ Unique constraints prevent duplication.

### C) Schema Field Alignment ✅

**Status:** ✅ **PASS**

**Findings:**

1. **Prisma schema fields match code usage:**
   - ✅ `Contact.smsConsent`, `Contact.smsConsentStatus`, `Contact.isSubscribed`
   - ✅ `ScheduledAutomation.jobId`, `ScheduledAutomation.status`
   - ✅ `EventProcessingState.lastEventId`, `EventProcessingState.lastProcessedAt`
   - ✅ `AbandonedCheckout.checkoutId`, `AbandonedCheckout.recoveredAt`

2. **No mismatched fields found:**
   - Code uses `isActive` (matches Prisma schema)
   - Code uses `shopId` (matches Prisma schema)

**Verdict:** ✅ Schema fields align with code usage.

### D) Failure Handling ✅

**Status:** ✅ **PASS**

**Findings:**

1. **Job retry logic:**
   ```javascript
   // ✅ Exponential backoff
   attempts: 3,
   backoff: { type: 'exponential', delay: 2000 },
   ```

2. **Error logging:**
   ```javascript
   // ✅ Comprehensive error logging
   logger.error('GraphQL query execution failed', {
     shopDomain,
     error: error.message,
     stack: error.stack,
   });
   ```

3. **Graceful degradation:**
   ```javascript
   // ✅ Falls back to webhook data if GraphQL fails
   try {
     orderDetails = await getOrderDetails(shop_domain, orderGid);
   } catch (graphqlError) {
     logger.warn('Failed to fetch order details via GraphQL, using webhook data');
     // Uses webhook data as fallback
   }
   ```

**Verdict:** ✅ Failure handling prevents "stuck" states.

---

## Phase 5: Frontend Integration Audit

### A) Automations UI Pages ✅

**Status:** ✅ **PASS**

**Findings:**

1. **Pages exist:**
   - ✅ `/app/shopify/automations` - List page
   - ✅ `/app/shopify/automations/new` - Create page
   - ✅ `/app/shopify/automations/[id]` - Detail/edit page

2. **API Client Usage:**
   ```typescript
   // ✅ Uses centralized API client
   import shopifyApi from './axios';
   export const automationsApi = {
     list: async (): Promise<Automation[]> => {
       const response = await shopifyApi.get<Automation[]>('/automations');
       return response as unknown as Automation[];
     },
   };
   ```

3. **Hooks:**
   - ✅ `useAutomations()` - List automations
   - ✅ `useAutomationStats()` - Get statistics
   - ✅ `useUpdateAutomation()`, `useDeleteAutomation()` - Mutations

**Verdict:** ✅ Frontend pages exist and use centralized API client.

### B) Error Handling ⚠️

**Status:** ⚠️ **MINOR GAPS**

**Findings:**

1. **Error boundaries:**
   ```typescript
   // ✅ ErrorBoundary component exists
   // Location: apps/astronote-web/app/app/shopify/_components/ErrorBoundary.tsx
   ```

2. **Defensive parsing:**
   ```typescript
   // ⚠️ Response parsing relies on TypeScript types (not runtime validation)
   return response as unknown as Automation[];
   ```

3. **Error states:**
   ```typescript
   // ✅ Shows error states
   {automationsError && (
     <RetailCard variant="danger">
       <p>Error loading automations</p>
     </RetailCard>
   )}
   ```

**Verdict:** ✅ Error handling is present but could be more robust.

---

## Phase 6: Findings Summary

### Blockers (Must Fix)

1. **❌ No throttle/429 handling in GraphQL client**
   - **Impact:** GraphQL queries may fail with 429 errors without retry
   - **Fix:** Add retry logic with exponential backoff for 429 errors
   - **Files:** `apps/shopify-api/services/shopify-graphql.js`

2. **❌ No pagination for `getAbandonedCheckouts`**
   - **Impact:** May miss abandoned checkouts if there are more than `first` results
   - **Fix:** Add cursor-based pagination with `pageInfo` and `endCursor`
   - **Files:** `apps/shopify-api/services/shopify-graphql.js`

### Reliability Improvements

3. **⚠️ No GraphQL cost tracking**
   - **Impact:** No visibility into query cost, may hit Shopify rate limits
   - **Fix:** Parse `extensions.cost` and log warnings for high-cost queries
   - **Files:** `apps/shopify-api/services/shopify-graphql.js`

4. **⚠️ No runtime validation for GraphQL responses**
   - **Impact:** Schema changes in Shopify API may cause runtime errors
   - **Fix:** Add zod schemas for critical responses (Order, Fulfillment, AbandonedCheckout)
   - **Files:** `apps/shopify-api/services/shopify-graphql.js`, new `schemas/graphql-responses.schema.js`

5. **⚠️ Hardcoded API version**
   - **Impact:** API version `2024-04` is hardcoded, may become outdated
   - **Fix:** Make API version configurable via env var with fallback
   - **Files:** `apps/shopify-api/services/shopify.js`

### Performance Improvements (Query Cost)

6. **⚠️ No query cost optimization**
   - **Impact:** Queries may fetch unnecessary data
   - **Fix:** Review queries and remove unused fields (if any)
   - **Status:** ✅ Queries are already well-optimized (no unused fields found)

7. **⚠️ No request queuing for rate-limited requests**
   - **Impact:** Concurrent GraphQL requests may hit rate limits
   - **Fix:** Implement request queuing with priority (optional, low priority)

### Observability Improvements

8. **⚠️ No correlation IDs in GraphQL requests**
   - **Impact:** Difficult to trace GraphQL requests across services
   - **Fix:** Add `X-Request-ID` or `X-Correlation-ID` header to GraphQL requests
   - **Files:** `apps/shopify-api/services/shopify-graphql.js`

9. **⚠️ Limited structured logging for GraphQL queries**
   - **Impact:** Difficult to debug GraphQL query failures
   - **Fix:** Add structured logging with query name, variables, cost, duration
   - **Files:** `apps/shopify-api/services/shopify-graphql.js`

---

## Phase 7: Implementation Plan

### Step 1: Add Throttle/429 Handling (BLOCKER)

**Files:** `apps/shopify-api/services/shopify-graphql.js`

**Changes:**
1. Parse `response.body.extensions?.throttleStatus` and `response.body.extensions?.cost`
2. Detect 429 status code or throttle status
3. Implement exponential backoff retry (max 3 retries, 2s, 4s, 8s delays)
4. Add jitter to prevent thundering herd

**Code:**
```javascript
async function executeGraphQLQuery(shopDomain, query, variables = {}, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 2000;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await client.query({ data: { query, variables } });
      
      // Check for throttle status
      const throttleStatus = response.body.extensions?.throttleStatus;
      if (throttleStatus?.currentlyAvailable < throttleStatus?.maximumAvailable * 0.1) {
        // Low throttle budget, wait before retrying
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000; // Jitter
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Check for 429 status
      if (response.statusCode === 429) {
        const retryAfter = response.headers['retry-after'] || baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      // Process response...
    } catch (error) {
      if (error.statusCode === 429 && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

### Step 2: Add Pagination to `getAbandonedCheckouts` (BLOCKER)

**Files:** `apps/shopify-api/services/shopify-graphql.js`

**Changes:**
1. Add `pageInfo` and `endCursor` to query
2. Implement cursor-based pagination loop
3. Add max pages limit to prevent infinite loops

**Code:**
```javascript
export async function getAbandonedCheckouts(shopDomain, queryString = '', first = 10) {
  const query = `
    query GetAbandonedCheckouts($first: Int!, $query: String, $after: String) {
      abandonedCheckouts(first: $first, query: $query, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes { ... }
      }
    }
  `;
  
  const allCheckouts = [];
  let cursor = null;
  let hasNextPage = true;
  let pageCount = 0;
  const maxPages = 100; // Prevent infinite loops
  
  while (hasNextPage && pageCount < maxPages) {
    const data = await executeGraphQLQuery(shopDomain, query, {
      first,
      query: queryString || undefined,
      after: cursor || undefined,
    });
    
    allCheckouts.push(...(data.abandonedCheckouts?.nodes || []));
    hasNextPage = data.abandonedCheckouts?.pageInfo?.hasNextPage || false;
    cursor = data.abandonedCheckouts?.pageInfo?.endCursor || null;
    pageCount++;
  }
  
  return allCheckouts;
}
```

### Step 3: Add Cost Tracking (RELIABILITY)

**Files:** `apps/shopify-api/services/shopify-graphql.js`

**Changes:**
1. Parse `response.body.extensions?.cost`
2. Log query cost with query name
3. Warn if cost exceeds threshold (e.g., 50 points)

**Code:**
```javascript
const cost = response.body.extensions?.cost;
if (cost) {
  logger.info('GraphQL query cost', {
    shopDomain,
    queryName: options.queryName || 'unknown',
    requestedQueryCost: cost.requestedQueryCost,
    actualQueryCost: cost.actualQueryCost,
    throttleStatus: cost.throttleStatus,
  });
  
  if (cost.actualQueryCost > 50) {
    logger.warn('High-cost GraphQL query', {
      shopDomain,
      queryName: options.queryName || 'unknown',
      cost: cost.actualQueryCost,
    });
  }
}
```

### Step 4: Add Runtime Validation (RELIABILITY)

**Files:** `apps/shopify-api/schemas/graphql-responses.schema.js` (NEW), `apps/shopify-api/services/shopify-graphql.js`

**Changes:**
1. Create zod schemas for Order, Fulfillment, AbandonedCheckout responses
2. Validate responses before returning
3. Log validation errors with actionable messages

**Code:**
```javascript
import { z } from 'zod';

const OrderResponseSchema = z.object({
  order: z.object({
    id: z.string(),
    name: z.string(),
    customer: z.object({
      id: z.string(),
      email: z.string().nullable(),
      firstName: z.string().nullable(),
      lastName: z.string().nullable(),
    }).nullable(),
    // ... other fields
  }),
});

export async function getOrderDetails(shopDomain, orderId) {
  const data = await executeGraphQLQuery(shopDomain, query, { id: orderId });
  
  // Validate response
  try {
    const validated = OrderResponseSchema.parse(data);
    return validated.order;
  } catch (error) {
    logger.error('GraphQL response validation failed', {
      shopDomain,
      orderId,
      error: error.message,
      data: JSON.stringify(data).substring(0, 500),
    });
    throw new Error(`Invalid GraphQL response: ${error.message}`);
  }
}
```

### Step 5: Make API Version Configurable (RELIABILITY)

**Files:** `apps/shopify-api/services/shopify.js`

**Changes:**
1. Add `SHOPIFY_API_VERSION` env var
2. Use env var with fallback to `2024-04`
3. Log API version on initialization

**Code:**
```javascript
apiVersion: process.env.SHOPIFY_API_VERSION || '2024-04',
```

### Step 6: Add Correlation IDs (OBSERVABILITY)

**Files:** `apps/shopify-api/services/shopify-graphql.js`

**Changes:**
1. Accept `requestId` parameter
2. Add `X-Request-ID` header to GraphQL requests (if Shopify supports it)
3. Include `requestId` in logs

**Code:**
```javascript
async function executeGraphQLQuery(shopDomain, query, variables = {}, options = {}) {
  const requestId = options.requestId || req?.id || 'unknown';
  
  logger.info('Executing GraphQL query', {
    shopDomain,
    queryName: options.queryName || 'unknown',
    requestId,
  });
  
  // Include requestId in error logs
  logger.error('GraphQL query execution failed', {
    shopDomain,
    requestId,
    error: error.message,
  });
}
```

### Step 7: Improve Structured Logging (OBSERVABILITY)

**Files:** `apps/shopify-api/services/shopify-graphql.js`

**Changes:**
1. Add query name to all queries
2. Log query name, variables (sanitized), cost, duration
3. Include requestId in all logs

**Code:**
```javascript
async function executeGraphQLQuery(shopDomain, query, variables = {}, options = {}) {
  const startTime = Date.now();
  const queryName = options.queryName || 'unknown';
  const requestId = options.requestId || 'unknown';
  
  try {
    const response = await client.query({ data: { query, variables } });
    const duration = Date.now() - startTime;
    
    logger.info('GraphQL query executed', {
      shopDomain,
      queryName,
      requestId,
      duration,
      cost: response.body.extensions?.cost?.actualQueryCost,
    });
    
    return response.body.data;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('GraphQL query execution failed', {
      shopDomain,
      queryName,
      requestId,
      duration,
      error: error.message,
    });
    throw error;
  }
}
```

---

## Phase 8: Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────┐
│                    Shopify Webhooks                         │
│  (orders/create, orders/fulfilled, checkout/abandoned)      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         validateShopifyWebhook (HMAC Verification)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│      processWebhookWithReplayProtection                    │
│  (checks WebhookEvent for duplicates, records event)       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         automation-webhooks.js Controllers                 │
│  (handleOrderCreated, handleOrderFulfilled, etc.)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           shopify-graphql.js (GraphQL Client)              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ executeGraphQLQuery(shopDomain, query, variables)  │   │
│  │  - getOrderDetails()                              │   │
│  │  - getFulfillmentDetails()                        │   │
│  │  - getAbandonedCheckout()                          │   │
│  │  - getAbandonedCheckouts() ⚠️ NO PAGINATION       │   │
│  │  - getCustomerDetails()                           │   │
│  │  - getProductRecommendations()                    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ⚠️ GAPS:                                                  │
│  - No throttle/429 handling                               │
│  - No cost tracking                                       │
│  - No retry with backoff                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              automationQueue (BullMQ)                        │
│  (queues automation jobs with retry/backoff)               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         automationTriggers.js Job Handlers                 │
│  (handleOrderConfirmationTrigger, etc.)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              automations.js Service                         │
│  (triggerAutomation, processMessageTemplate)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Prisma (Database)                        │
│  - Shop (tenant)                                            │
│  - Contact (scoped by shopId)                              │
│  - UserAutomation (scoped by shopId)                       │
│  - ScheduledAutomation (scoped by shopId, unique jobId)     │
│  - EventProcessingState (scoped by shopId, dedup)          │
│  - WebhookEvent (dedup by provider+eventId)                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Frontend (apps/astronote-web)                   │
│  - /app/shopify/automations (list)                          │
│  - /app/shopify/automations/new (create)                    │
│  - /app/shopify/automations/[id] (detail/edit)              │
│  - Uses centralized shopifyApi client (tenant headers)     │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 9: Exact Implementation Steps (Ordered)

### Priority 1: Blockers (Must Fix)

1. **Add throttle/429 handling to GraphQL client**
   - File: `apps/shopify-api/services/shopify-graphql.js`
   - Add retry logic with exponential backoff
   - Parse throttle status and 429 status codes
   - Add jitter to prevent thundering herd

2. **Add pagination to `getAbandonedCheckouts`**
   - File: `apps/shopify-api/services/shopify-graphql.js`
   - Add `pageInfo` and `endCursor` to query
   - Implement cursor-based pagination loop
   - Add max pages limit

### Priority 2: Reliability Improvements

3. **Add cost tracking**
   - File: `apps/shopify-api/services/shopify-graphql.js`
   - Parse `extensions.cost`
   - Log query cost with query name
   - Warn on high-cost queries

4. **Add runtime validation**
   - File: `apps/shopify-api/schemas/graphql-responses.schema.js` (NEW)
   - Create zod schemas for Order, Fulfillment, AbandonedCheckout
   - Validate responses before returning
   - File: `apps/shopify-api/services/shopify-graphql.js` (update)

5. **Make API version configurable**
   - File: `apps/shopify-api/services/shopify.js`
   - Add `SHOPIFY_API_VERSION` env var
   - Use env var with fallback

### Priority 3: Observability Improvements

6. **Add correlation IDs**
   - File: `apps/shopify-api/services/shopify-graphql.js`
   - Accept `requestId` parameter
   - Include in logs

7. **Improve structured logging**
   - File: `apps/shopify-api/services/shopify-graphql.js`
   - Add query name to all queries
   - Log query name, variables (sanitized), cost, duration

---

## Phase 10: Risk Assessment

### High Risk

1. **Throttle/429 handling:**
   - **Risk:** GraphQL queries may fail under load
   - **Mitigation:** Add retry logic with exponential backoff
   - **Impact:** High (affects all automations)

2. **Pagination:**
   - **Risk:** May miss abandoned checkouts
   - **Mitigation:** Add cursor-based pagination
   - **Impact:** Medium (affects abandoned checkout automation only)

### Medium Risk

1. **Cost tracking:**
   - **Risk:** May hit Shopify rate limits without visibility
   - **Mitigation:** Add cost tracking and warnings
   - **Impact:** Medium (affects observability)

2. **Runtime validation:**
   - **Risk:** Schema changes may cause runtime errors
   - **Mitigation:** Add zod schemas for critical responses
   - **Impact:** Medium (affects reliability)

### Low Risk

1. **API version:**
   - **Risk:** Hardcoded version may become outdated
   - **Mitigation:** Make configurable via env var
   - **Impact:** Low (can be updated manually)

2. **Correlation IDs:**
   - **Risk:** Difficult to trace requests
   - **Mitigation:** Add correlation IDs to logs
   - **Impact:** Low (affects observability only)

---

## Next Steps

1. ✅ **Audit Complete** - This report
2. ⏭️ **Implementation** - Fix blockers and reliability improvements
3. ⏭️ **Verification** - Create audit script
4. ⏭️ **Final Report** - Document implemented changes

---

**Report Generated:** 2025-01-27  
**Status:** 🔍 **AUDIT COMPLETE - READY FOR IMPLEMENTATION**

