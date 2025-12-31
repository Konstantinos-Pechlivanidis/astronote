# Retail Billing API Contract

## GET /api/subscriptions/portal

### Request
- **Method:** `GET`
- **Path:** `/api/subscriptions/portal`
- **Headers:**
  - `Authorization: Bearer <accessToken>` (required)
  - `Cookie: refreshToken=<token>` (optional, for refresh)
- **Query Parameters:** None
- **Body:** None

### Response

#### Success (200 OK)
```json
{
  "ok": true,
  "portalUrl": "https://billing.stripe.com/p/session/..."
}
```

#### Error Responses

**400 Bad Request** - No customer ID found
```json
{
  "message": "No payment account found. Please subscribe to a plan first.",
  "code": "MISSING_CUSTOMER_ID"
}
```

**503 Service Unavailable** - Stripe not configured
```json
{
  "message": "Payment processing unavailable",
  "code": "STRIPE_NOT_CONFIGURED"
}
```

### Implementation Notes

1. **Backend derives `returnUrl`** from `FRONTEND_URL` environment variable:
   - If `FRONTEND_URL` includes `localhost`: `${FRONTEND_URL}/app/retail/billing`
   - Otherwise: `${FRONTEND_URL}/app/retail/billing` (with `/retail` path handling)

2. **Backend derives `customerId`** from the logged-in user's subscription record (no frontend input required).

3. **Frontend redirects** browser to `portalUrl` using `window.location.assign()`.

4. **No query parameters or request body** are required or accepted.

### Frontend Usage

```typescript
const res = await subscriptionsApi.getPortal();
if (res.data.portalUrl || res.data.url) {
  window.location.assign(res.data.portalUrl || res.data.url);
}
```

