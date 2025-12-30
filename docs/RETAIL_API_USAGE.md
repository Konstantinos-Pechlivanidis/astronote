# Retail API Usage - Legacy UI Endpoints

This document lists all retail-api endpoints used by the `apps/retail-web-legacy` application, grouped by functional area.

## Base Configuration

- **Base URL**: `VITE_API_BASE_URL` (default: `http://localhost:3001`)
- **Axios Instance**: `src/api/axios.js`
- **Credentials**: `withCredentials: true` (sends cookies for refresh token)
- **Auth Header**: `Authorization: Bearer {accessToken}` (from localStorage)

---

## Authentication

### POST `/api/auth/register`
- **Module**: `api/modules/auth.js` → `authApi.register()`
- **Used By**: Signup page
- **Headers**: None (public endpoint)
- **Body**: 
  ```json
  {
    "email": "string",
    "password": "string",
    "senderName": "string (optional, max 11)",
    "company": "string (optional, max 160)"
  }
  ```
- **Response**: `{ accessToken: string, user: {...} }`
- **Token Storage**: Stored in `localStorage` as `accessToken`

### POST `/api/auth/login`
- **Module**: `api/modules/auth.js` → `authApi.login()`
- **Used By**: Login page
- **Headers**: None (public endpoint)
- **Body**: 
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Response**: `{ accessToken: string, user: {...} }`
- **Token Storage**: Stored in `localStorage` as `accessToken`
- **Cookies**: Refresh token set as HTTP-only cookie

### POST `/api/auth/refresh`
- **Module**: `api/modules/auth.js` → `authApi.refresh()`
- **Used By**: Axios interceptor (automatic on 401)
- **Headers**: None (uses cookie for refresh token)
- **Body**: Empty `{}`
- **Cookies**: Requires refresh token cookie (`withCredentials: true`)
- **Response**: `{ accessToken: string }`
- **Token Storage**: Updates `localStorage.accessToken`

### POST `/api/auth/logout`
- **Module**: `api/modules/auth.js` → `authApi.logout()`
- **Used By**: Logout action
- **Headers**: `Authorization: Bearer {token}`
- **Body**: Empty `{}`
- **Cookies**: Clears refresh token cookie
- **Response**: Success status
- **Token Cleanup**: Removes `localStorage.accessToken`

---

## User & Profile

### GET `/api/me`
- **Module**: `api/modules/me.js` → `meApi.get()`
- **Used By**: AuthProvider (verify token on mount), Settings page
- **Headers**: `Authorization: Bearer {token}`
- **Response**: `{ user: {...} }`
- **Purpose**: Get current user profile

### PUT `/api/user`
- **Module**: `api/modules/user.js` → `userApi.update()`
- **Used By**: Settings page (profile update)
- **Headers**: `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "company": "string (optional, max 160)",
    "senderName": "string (optional, max 11, alphanumeric)",
    "timezone": "string (optional, IANA format)"
  }
  ```
- **Response**: Updated user object

### PUT `/api/user/password`
- **Module**: `api/modules/user.js` → `userApi.changePassword()`
- **Used By**: Settings page (password change)
- **Headers**: `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "currentPassword": "string",
    "newPassword": "string (min 8 chars)"
  }
  ```
- **Response**: Success status

---

## Dashboard

### GET `/api/dashboard/kpis`
- **Module**: `api/modules/dashboard.js` → `dashboardApi.getKPIs()`
- **Used By**: Dashboard page
- **Headers**: `Authorization: Bearer {token}`
- **Response**: 
  ```json
  {
    "totalCampaigns": number,
    "totalMessages": number,
    "sent": number,
    "sentRate": number,
    "failed": number,
    "conversion": number,
    "conversionRate": number
  }
  ```

---

## Campaigns

### GET `/api/campaigns`
- **Module**: `api/modules/campaigns.js` → `campaignsApi.list()`
- **Used By**: Campaigns list page, Dashboard (recent campaigns)
- **Headers**: `Authorization: Bearer {token}`
- **Query Params**: 
  - `page` (number, default 1)
  - `pageSize` (number, default 20)
  - `q` (string, search query)
  - `status` (string, filter by status)
- **Response**: Paginated campaigns list

### GET `/api/campaigns/:id`
- **Module**: `api/modules/campaigns.js` → `campaignsApi.get()`
- **Used By**: Campaign detail page, Edit campaign page
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Campaign object

### POST `/api/campaigns`
- **Module**: `api/modules/campaigns.js` → `campaignsApi.create()`
- **Used By**: New campaign page
- **Headers**: `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "name": "string (required, max 200)",
    "messageText": "string (required, max 2000)",
    "filterGender": "male|female|other|null (optional)",
    "filterAgeGroup": "18_24|25_39|40_plus|null (optional)",
    "scheduledAt": "string (ISO date, optional)"
  }
  ```
- **Response**: Created campaign object

### PUT `/api/campaigns/:id`
- **Module**: `api/modules/campaigns.js` → `campaignsApi.update()`
- **Used By**: Edit campaign page
- **Headers**: `Authorization: Bearer {token}`
- **Body**: Same as POST (all fields optional)
- **Response**: Updated campaign object

### POST `/api/campaigns/:id/enqueue`
- **Module**: `api/modules/campaigns.js` → `campaignsApi.enqueue()`
- **Used By**: Campaign detail page (send now)
- **Headers**: 
  - `Authorization: Bearer {token}`
  - `Idempotency-Key: {uuid}` (optional, for idempotent requests)
- **Body**: Empty `{}`
- **Response**: Campaign status

### POST `/api/campaigns/:id/schedule`
- **Module**: `api/modules/campaigns.js` → `campaignsApi.schedule()`
- **Used By**: Campaign detail page (schedule)
- **Headers**: `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "scheduledAt": "string (ISO date)"
  }
  ```
- **Response**: Campaign status

### POST `/api/campaigns/:id/unschedule`
- **Module**: `api/modules/campaigns.js` → `campaignsApi.unschedule()`
- **Used By**: Campaign detail page (cancel schedule)
- **Headers**: `Authorization: Bearer {token}`
- **Body**: Empty `{}`
- **Response**: Campaign status

### GET `/api/campaigns/:id/status`
- **Module**: `api/modules/campaigns.js` → `campaignsApi.getStatus()`
- **Used By**: Campaign status page (polling)
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Real-time campaign sending status

### GET `/api/campaigns/:id/stats`
- **Module**: `api/modules/campaigns.js` → `campaignsApi.getStats()`
- **Used By**: Campaign detail page, Campaign stats page
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Campaign statistics (sent, delivered, failed, conversions, etc.)

### GET `/api/campaigns/:id/preview`
- **Module**: `api/modules/campaigns.js` → `campaignsApi.getPreview()`
- **Used By**: Campaign detail page (message preview)
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Rendered message preview

### POST `/api/campaigns/preview-audience`
- **Module**: `api/modules/campaigns.js` → `campaignsApi.previewAudience()`
- **Used By**: New campaign page (audience preview)
- **Headers**: `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "filterGender": "male|female|other|null",
    "filterAgeGroup": "18_24|25_39|40_plus|null",
    "listId": "number (optional)"
  }
  ```
- **Response**: Audience count estimate

---

## Contacts

### GET `/api/contacts`
- **Module**: `api/modules/contacts.js` → `contactsApi.list()`
- **Used By**: Contacts list page
- **Headers**: `Authorization: Bearer {token}`
- **Query Params**: 
  - `page` (number)
  - `pageSize` (number)
  - `q` (string, search query)
  - `listId` (number, optional, filter by list)
- **Response**: Paginated contacts list

### GET `/api/contacts/:id`
- **Module**: `api/modules/contacts.js` → `contactsApi.get()`
- **Used By**: Contact detail (if implemented)
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Contact object

### POST `/api/contacts`
- **Module**: `api/modules/contacts.js` → `contactsApi.create()`
- **Used By**: Contacts page (create contact)
- **Headers**: `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "phone": "string (required, E.164 format)",
    "email": "string (optional, max 320)",
    "firstName": "string (optional, max 120)",
    "lastName": "string (optional, max 120)",
    "gender": "male|female|other (optional)",
    "birthday": "string (ISO date, optional, past date)",
    "isSubscribed": "boolean (optional)"
  }
  ```
- **Response**: Created contact object

### PUT `/api/contacts/:id`
- **Module**: `api/modules/contacts.js` → `contactsApi.update()`
- **Used By**: Contacts page (edit contact)
- **Headers**: `Authorization: Bearer {token}`
- **Body**: Same as POST (all fields optional)
- **Response**: Updated contact object

### DELETE `/api/contacts/:id`
- **Module**: `api/modules/contacts.js` → `contactsApi.delete()`
- **Used By**: Contacts page (delete contact)
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Success status

### POST `/api/contacts/import`
- **Module**: `api/modules/contacts.js` → `contactsApi.import()`
- **Used By**: Contacts import page
- **Headers**: 
  - `Authorization: Bearer {token}`
  - `Content-Type: multipart/form-data`
- **Body**: FormData with `file` field (CSV/Excel)
- **Response**: `{ jobId: string }` (import job ID)

### GET `/api/contacts/import/:jobId`
- **Module**: `api/modules/contacts.js` → `contactsApi.getImportStatus()`
- **Used By**: Contacts import page (polling)
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Import job status (pending, processing, completed, failed)

### GET `/api/contacts/import/template`
- **Module**: `api/modules/contacts.js` → `contactsApi.downloadTemplate()`
- **Used By**: Contacts import page (download template)
- **Headers**: `Authorization: Bearer {token}`
- **Response**: CSV file blob

---

## Lists (System Lists)

### GET `/api/lists`
- **Module**: `api/modules/lists.js` → `listsApi.list()` or `listsApi.getSystemLists()`
- **Used By**: Contacts page (filter dropdown)
- **Headers**: `Authorization: Bearer {token}`
- **Query Params**: Optional pagination
- **Response**: Lists array with `isSystem: boolean` flag
- **Note**: Client-side filters to `isSystem: true` for system lists only

### GET `/api/lists/:id`
- **Module**: `api/modules/lists.js` (not directly used, but endpoint exists)
- **Headers**: `Authorization: Bearer {token}`
- **Response**: List object

### GET `/api/lists/:id/contacts`
- **Module**: `api/modules/lists.js` (not directly used, but endpoint exists)
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Contacts in list

---

## Templates

### GET `/api/templates`
- **Module**: `api/modules/templates.js` → `templatesApi.list()`
- **Used By**: Templates list page
- **Headers**: `Authorization: Bearer {token}`
- **Query Params**: 
  - `language` (required: "en" or "gr", default "en")
  - `page` (number)
  - `pageSize` (number, max 100)
  - `q` (string, search by name)
  - `category` (string, filter by category)
- **Response**: Paginated templates list (system + user templates)

### GET `/api/templates/:id`
- **Module**: `api/modules/templates.js` → `templatesApi.get()`
- **Used By**: Template detail/preview
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Template object

### POST `/api/templates`
- **Module**: `api/modules/templates.js` → `templatesApi.create()`
- **Used By**: Templates page (create custom template)
- **Headers**: `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "name": "string (required, max 200)",
    "text": "string (required, max 2000)",
    "category": "cafe|restaurant|gym|sports_club|generic|hotels (optional, default 'generic')",
    "goal": "string (optional, max 200)",
    "suggestedMetrics": "string (optional, max 500)",
    "language": "en|gr (optional, default 'en')"
  }
  ```
- **Response**: Created template object

### PUT `/api/templates/:id`
- **Module**: `api/modules/templates.js` → `templatesApi.update()`
- **Used By**: Templates page (edit custom template)
- **Headers**: `Authorization: Bearer {token}`
- **Body**: Same as POST (all fields optional)
- **Response**: Updated template object

### DELETE `/api/templates/:id`
- **Module**: `api/modules/templates.js` → `templatesApi.delete()`
- **Used By**: Templates page (delete custom template)
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Success status

### POST `/api/templates/:id/render`
- **Module**: `api/modules/templates.js` → `templatesApi.render()`
- **Used By**: Templates page (preview with contact data)
- **Headers**: `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "contactId": "number (optional)",
    "contact": {
      "firstName": "string",
      "lastName": "string",
      "email": "string"
    }
  }
  ```
- **Response**: Rendered message text

### GET `/api/templates/:id/stats`
- **Module**: `api/modules/templates.js` → `templatesApi.getStats()`
- **Used By**: Templates page (benchmark stats for system templates)
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Template statistics (benchmark data)

---

## Billing & Credits

### GET `/api/billing/balance`
- **Module**: `api/modules/billing.js` → `billingApi.getBalance()`
- **Used By**: Dashboard (credits card), Billing page
- **Headers**: `Authorization: Bearer {token}`
- **Response**: 
  ```json
  {
    "balance": number,
    "subscription": {
      "active": boolean,
      "planType": "string|null"
    }
  }
  ```
- **Note**: Normalized client-side to `{ credits: number, subscription: {...} }`

### GET `/api/billing/wallet`
- **Module**: `api/modules/billing.js` → `billingApi.getWallet()`
- **Used By**: Billing page (alias for balance)
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Same as `/api/billing/balance`

### GET `/api/billing/packages`
- **Module**: `api/modules/billing.js` → `billingApi.getPackages()`
- **Used By**: Billing page (credit packs + subscription packages)
- **Headers**: `Authorization: Bearer {token}`
- **Query Params**: `currency` (string, default "EUR")
- **Response**: Array of packages (credit packs + subscription packages)
- **Note**: Credit packs have `type: "credit_pack"` and `id` is normalized to string

### GET `/api/billing/transactions`
- **Module**: `api/modules/billing.js` → `billingApi.getTransactions()`
- **Used By**: Billing page (transaction history)
- **Headers**: `Authorization: Bearer {token}`
- **Query Params**: Pagination params
- **Response**: Paginated transactions list

### GET `/api/billing/purchases`
- **Module**: `api/modules/billing.js` → `billingApi.getPurchases()`
- **Used By**: Billing page (purchase history)
- **Headers**: `Authorization: Bearer {token}`
- **Query Params**: Pagination params
- **Response**: Paginated purchases list

### POST `/api/billing/purchase`
- **Module**: `api/modules/billing.js` → `billingApi.purchase()`
- **Used By**: Billing page (purchase subscription package)
- **Headers**: `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "packageId": number,
    "currency": "string (optional, default 'EUR')"
  }
  ```
- **Response**: `{ sessionId: string, url: string }` (Stripe checkout URL)

### POST `/api/billing/topup`
- **Module**: `api/modules/billing.js` → `billingApi.topup()`
- **Used By**: Billing page (purchase credit pack)
- **Headers**: `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "packId": "string (required, e.g., 'pack_100')"
  }
  ```
- **Response**: `{ sessionId: string, url: string }` (Stripe checkout URL)
- **Note**: `packId` MUST be string (normalized client-side)

---

## Subscriptions

### GET `/api/subscriptions/current`
- **Module**: `api/modules/subscriptions.js` → `subscriptionsApi.getCurrent()`
- **Used By**: Billing page
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Current subscription object

### POST `/api/subscriptions/subscribe`
- **Module**: `api/modules/subscriptions.js` → `subscriptionsApi.subscribe()`
- **Used By**: Billing page (subscribe to plan)
- **Headers**: `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "planType": "string (e.g., 'starter', 'pro')",
    "currency": "string (optional, default 'EUR')"
  }
  ```
- **Response**: `{ sessionId: string, url: string }` (Stripe checkout URL)

### POST `/api/subscriptions/update`
- **Module**: `api/modules/subscriptions.js` → `subscriptionsApi.update()`
- **Used By**: Billing page (update subscription)
- **Headers**: `Authorization: Bearer {token}`
- **Body**: Subscription update data
- **Response**: Updated subscription

### POST `/api/subscriptions/cancel`
- **Module**: `api/modules/subscriptions.js` → `subscriptionsApi.cancel()`
- **Used By**: Billing page (cancel subscription)
- **Headers**: `Authorization: Bearer {token}`
- **Body**: Empty `{}`
- **Response**: Success status

### GET `/api/subscriptions/portal`
- **Module**: `api/modules/subscriptions.js` → `subscriptionsApi.getPortal()`
- **Used By**: Billing page (Stripe customer portal)
- **Headers**: `Authorization: Bearer {token}`
- **Response**: `{ url: string }` (Stripe customer portal URL)

---

## Automations

### GET `/api/automations`
- **Module**: `api/modules/automations.js` → `automationsApi.list()`
- **Used By**: Automations page
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Array of automation types

### GET `/api/automations/:type`
- **Module**: `api/modules/automations.js` → `automationsApi.get()`
- **Used By**: Automations page (get automation config)
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Automation configuration object

### PUT `/api/automations/:type`
- **Module**: `api/modules/automations.js` → `automationsApi.update()`
- **Used By**: Automations page (update automation)
- **Headers**: `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "messageBody": "string (required, max 2000)",
    "enabled": "boolean (optional)"
  }
  ```
- **Response**: Updated automation

### GET `/api/automations/:type/stats`
- **Module**: `api/modules/automations.js` → `automationsApi.getStats()`
- **Used By**: Automations page (automation statistics)
- **Headers**: `Authorization: Bearer {token}`
- **Response**: Automation statistics

---

## Public Endpoints (No Auth Required)

### Tracking

#### GET `/tracking/offer/:trackingId`
- **Module**: `api/modules/tracking.js` → `trackingApi.getOffer()`
- **Used By**: Public offer page
- **Headers**: None
- **Response**: Offer details for tracking link

#### GET `/tracking/redeem/:trackingId`
- **Module**: `api/modules/tracking.js` → `trackingApi.getRedeemStatus()`
- **Used By**: Public offer page (check redemption status)
- **Headers**: None
- **Response**: Redemption status

### Unsubscribe/Resubscribe

#### GET `/api/contacts/preferences/:pageToken`
- **Module**: `api/modules/publicContacts.js` → `publicContactsApi.getPreferences()`
- **Used By**: Public unsubscribe page
- **Headers**: None
- **Response**: Contact preferences page data

#### POST `/api/contacts/unsubscribe`
- **Module**: `api/modules/publicContacts.js` → `publicContactsApi.unsubscribe()`
- **Used By**: Public unsubscribe page
- **Headers**: None
- **Body**: 
  ```json
  {
    "token": "string (unsubscribe token)",
    "phone": "string (E.164 format)"
  }
  ```
- **Response**: Success status

#### POST `/api/contacts/resubscribe`
- **Module**: `api/modules/publicContacts.js` → `publicContactsApi.resubscribe()`
- **Used By**: Public resubscribe page
- **Headers**: None
- **Body**: 
  ```json
  {
    "token": "string (resubscribe token)",
    "phone": "string (E.164 format)"
  }
  ```
- **Response**: Success status

### NFC

#### GET `/nfc/:publicId/config`
- **Module**: `api/modules/nfc.js` → `nfcApi.getConfig()`
- **Used By**: Public NFC opt-in page
- **Headers**: None
- **Response**: NFC configuration

#### POST `/nfc/:publicId/submit`
- **Module**: `api/modules/nfc.js` → `nfcApi.submit()`
- **Used By**: Public NFC opt-in page
- **Headers**: None
- **Body**: 
  ```json
  {
    "phone": "string (E.164 format)"
  }
  ```
- **Response**: Success status

### Conversion Tags

#### GET `/api/conversion/:tagPublicId`
- **Module**: `api/modules/conversion.js` → `conversionApi.getConfig()`
- **Used By**: Public conversion tag page
- **Headers**: None
- **Response**: Conversion tag configuration

#### POST `/api/conversion/:tagPublicId`
- **Module**: `api/modules/conversion.js` → `conversionApi.submit()`
- **Used By**: Public conversion tag page
- **Headers**: None
- **Body**: 
  ```json
  {
    "phone": "string (E.164 format)"
  }
  ```
- **Response**: Success status

---

## Special Headers

### Idempotency-Key
- **Used By**: `POST /api/campaigns/:id/enqueue`
- **Header**: `Idempotency-Key: {uuid}`
- **Purpose**: Ensure idempotent campaign enqueue requests
- **Implementation**: Generated client-side UUID, preserved during token refresh

---

## Error Handling

- **401 Unauthorized**: Axios interceptor automatically attempts token refresh
- **Refresh Flow**: 
  1. Queue failed requests
  2. Call `/api/auth/refresh` with cookie
  3. Update `localStorage.accessToken`
  4. Retry failed requests with new token
  5. If refresh fails, redirect to `/login` (after 2s delay)

---

## Notes

- All authenticated endpoints require `Authorization: Bearer {token}` header
- Token is stored in `localStorage` as `accessToken`
- Refresh token is stored as HTTP-only cookie (set by backend)
- `withCredentials: true` is required for cookie-based refresh
- Public endpoints do not require authentication
- Some endpoints support idempotency via `Idempotency-Key` header

