# Backend-Driven URL Shortener

**Date**: 2025-01-XX  
**Purpose**: Database-backed URL shortener with click tracking and security controls

## Overview

The backend implements a database-driven URL shortener that:
- Generates short URLs using backend base URL (`URL_SHORTENER_BASE_URL`)
- Stores links in database with click tracking
- Handles redirects via `GET /r/:token` endpoint
- Prevents open redirect abuse
- Integrates with campaign and contact tracking

## Architecture

### Database Model

**`ShortLink`** model in Prisma schema:
- `token`: Unique token (10 characters, URL-safe)
- `destinationUrl`: Full destination URL
- `shopId`: Optional tenant scoping
- `campaignId`: Optional campaign association
- `contactId`: Optional contact association
- `clicks`: Click counter
- `lastClickedAt`: Last click timestamp
- `expiresAt`: Optional expiration date
- `meta`: Optional JSON metadata

### URL Format

Short URLs follow the pattern:
```
{URL_SHORTENER_BASE_URL}/r/{token}
```

Example:
```
https://astronote-shopify.onrender.com/r/abc123xyz9
```

## Environment Variables

### Required

- **`URL_SHORTENER_BASE_URL`**: Backend base URL for short links
  - Example: `https://astronote-shopify.onrender.com`
  - Used to construct short URLs
  - Should point to backend, not frontend

### Optional

- **`URL_SHORTENER_TYPE`**: Shortener type (default: `backend`)
  - `backend`: Database-backed shortener (recommended)
  - `custom`: Legacy base64url encoding (no database)
  - `bitly`: Bitly API integration
  - `tinyurl`: TinyURL API integration
  - `none`: Disable URL shortening

- **`REDIRECT_ALLOWED_HOSTS`**: Comma-separated list of allowed hostnames
  - Example: `https://example.com,*.myshopify.com`
  - Supports wildcards (e.g., `*.myshopify.com`)
  - If not set, all HTTPS URLs are allowed (in production)

## API Endpoints

### Public Redirect Endpoint

**`GET /r/:token`**

- **Authentication**: None (public endpoint)
- **Rate Limit**: 100 requests per minute per IP
- **Response**: 302 redirect to destination URL

**Behavior**:
- Token not found → 302 redirect to frontend error page
- Expired link → 410 Gone, redirect to frontend error page
- Invalid destination → 400 Bad Request
- Valid link → 302 redirect to destination, click count incremented

**Example**:
```bash
curl -I https://astronote-shopify.onrender.com/r/abc123xyz9

HTTP/1.1 302 Found
Location: https://example.com/page
```

## Service API

### `createShortLink(options)`

Creates a new short link in the database.

**Parameters**:
```javascript
{
  destinationUrl: string,  // Required: HTTPS URL
  shopId?: string,        // Optional: Tenant scoping
  campaignId?: string,    // Optional: Campaign association
  contactId?: string,     // Optional: Contact association
  expiresAt?: Date,       // Optional: Expiration date
  meta?: Object          // Optional: Metadata
}
```

**Returns**:
```javascript
{
  id: string,
  token: string,
  shortUrl: string,      // Full short URL
  destinationUrl: string,
  clicks: number,
  createdAt: Date,
  expiresAt?: Date
}
```

**Example**:
```javascript
import { createShortLink } from './services/shortLinks.js';

const shortLink = await createShortLink({
  destinationUrl: 'https://example.com/page',
  shopId: 'shop123',
  campaignId: 'campaign456',
  contactId: 'contact789',
});

console.log(shortLink.shortUrl);
// https://astronote-shopify.onrender.com/r/abc123xyz9
```

## Integration with Campaigns

### Automatic URL Shortening

When sending campaigns, URLs in message text are automatically shortened:

```javascript
// In queue/jobs/bulkSms.js
messageText = await shortenUrlsInText(messageText, {
  shopId,
  campaignId,
  contactId: recipient.contactId,
});
```

**Behavior**:
- Finds all URLs in message text
- Creates short links for each URL
- Associates with shop, campaign, and contact
- Replaces original URLs with short URLs
- **Never shortens unsubscribe URLs** (they remain full URLs)

### Click Tracking

Each click on a short link:
1. Increments `clicks` counter
2. Updates `lastClickedAt` timestamp
3. Logs click event (with redacted query params)

**Query Short Links by Campaign**:
```javascript
import prisma from './services/prisma.js';

const links = await prisma.shortLink.findMany({
  where: { campaignId: 'campaign123' },
  select: {
    token: true,
    destinationUrl: true,
    clicks: true,
    lastClickedAt: true,
  },
});
```

## Security

### Open Redirect Prevention

1. **Protocol Validation**: Only allows `https://` (or `http://` in development)
2. **Hostname Allowlist**: Optional `REDIRECT_ALLOWED_HOSTS` env var
3. **Wildcard Support**: Supports patterns like `*.myshopify.com`

**Example Configuration**:
```bash
REDIRECT_ALLOWED_HOSTS=https://example.com,*.myshopify.com,https://shopify.com
```

### Rate Limiting

- **Redirect Endpoint**: 100 requests per minute per IP
- Prevents abuse and DDoS attacks
- Uses `express-rate-limit` middleware

### Logging

- Click events logged with redacted query params
- Full destination URL logged (for debugging)
- Query string redacted in logs for privacy

## Migration from Legacy Shortener

### Before (Custom Shortener)

- Used `/s/{shortCode}` route (no handler)
- No database storage
- No click tracking
- No expiration support

### After (Backend Shortener)

- Uses `/r/{token}` route (with handler)
- Database-backed storage
- Click tracking
- Expiration support
- Campaign/contact association

### Migration Steps

1. **Update Environment**:
   ```bash
   URL_SHORTENER_TYPE=custom
   URL_SHORTENER_BASE_URL=https://astronote-shopify.onrender.com
   ```

2. **Run Migration**:
   ```bash
   npx prisma migrate dev --name add_short_links
   ```

3. **Deploy**: Existing short links will continue to work (if using custom type), new links will use backend shortener

## Testing

### Unit Tests

```bash
npm test tests/unit/shortLinks.test.js
```

**Tests**:
- Token generation uniqueness
- URL validation
- Click count increment
- Expiration handling

### Integration Tests

```bash
npm test tests/integration/shortLinkRedirect.test.js
```

**Tests**:
- Redirect endpoint (302)
- Non-existent token (404)
- Expired link (410)
- Click count increment

## Usage Examples

### Create Short Link for Campaign

```javascript
import { createShortLink } from './services/shortLinks.js';

// Create short link for campaign offer
const shortLink = await createShortLink({
  destinationUrl: 'https://shop.example.com/products/item?discount=SAVE20',
  shopId: shop.id,
  campaignId: campaign.id,
  contactId: contact.id,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  meta: {
    type: 'offer',
    discountCode: 'SAVE20',
  },
});

// Use in SMS message
const message = `Check out our sale: ${shortLink.shortUrl}`;
```

### Get Click Statistics

```javascript
import { getShortLinkStats } from './services/shortLinks.js';

const stats = await getShortLinkStats(shopId, campaignId);
console.log(`Total links: ${stats.total}, Total clicks: ${stats.totalClicks}`);
```

### Query Links by Campaign

```javascript
import prisma from './services/prisma.js';

const campaignLinks = await prisma.shortLink.findMany({
  where: {
    shopId: shopId,
    campaignId: campaignId,
  },
  orderBy: { clicks: 'desc' },
  take: 10,
});
```

## Troubleshooting

### Issue: Short links return 404

**Check**:
1. `URL_SHORTENER_BASE_URL` is set correctly
2. Route `/r/:token` is mounted in `app.js`
3. Database migration applied
4. Token exists in database

### Issue: Redirects to wrong URL

**Check**:
1. `destinationUrl` stored correctly in database
2. No URL encoding issues
3. HTTPS protocol required in production

### Issue: Click count not incrementing

**Check**:
1. Database connection working
2. Transaction not rolling back
3. `incrementClickCount()` called successfully

## Performance Considerations

- **Token Lookup**: Indexed on `token` field (fast lookups)
- **Click Updates**: Atomic increment (no race conditions)
- **Rate Limiting**: Prevents abuse
- **Caching**: Consider caching frequently accessed links (optional)

## Future Enhancements

- [ ] Link analytics dashboard
- [ ] Bulk link creation
- [ ] Link expiration notifications
- [ ] Custom token support
- [ ] QR code generation
- [ ] Link preview/metadata

