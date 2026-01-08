# Retail Join Branding (Backend)

This document describes the backend contracts for the Retail public join branding system.

## Env
- `PUBLIC_RETAIL_BASE_URL` (optional): used for join links (handled elsewhere).
- Assets are served from the API host under `/public/assets/:assetId`.

## Models
- `RetailJoinBranding`: one row per owner (merchant) with colors, copy, meta, social links, and asset references.
- `RetailAsset`: file metadata for logo/OG assets stored on disk (`uploads/retail/...`).

## Authenticated Endpoints

### GET `/api/retail/join-branding`
Returns branding for the authenticated owner (creates defaults if missing).

Response:
```json
{
  "ok": true,
  "branding": {
    "storeName": "Store Name",
    "storeDisplayName": "Store Name",
    "logoUrl": "https://api.host/public/assets/123",
    "ogImageUrl": null,
    "primaryColor": "#111827",
    "secondaryColor": "#4B5563",
    "backgroundColor": "#FFFFFF",
    "textColor": "#111827",
    "accentColor": "#3B82F6",
    "marketingHeadline": null,
    "marketingBullets": null,
    "merchantBlurb": null,
    "pageTitle": null,
    "pageDescription": null,
    "websiteUrl": null,
    "facebookUrl": null,
    "instagramUrl": null,
    "rotateEnabled": false,
    "showPoweredBy": true
  }
}
```

### PUT `/api/retail/join-branding`
Updates allowed branding fields. Empty/undefined fields are ignored unless explicitly provided.

Request:
```json
{
  "storeDisplayName": "My Store",
  "primaryColor": "#111827",
  "secondaryColor": "#4B5563",
  "backgroundColor": "#FFFFFF",
  "textColor": "#111827",
  "accentColor": "#3B82F6",
  "marketingHeadline": "Get our offers first",
  "marketingBullets": ["VIP offers", "Early access"],
  "merchantBlurb": "Custom extra text",
  "pageTitle": "Join our store",
  "pageDescription": "Short description for SEO",
  "websiteUrl": "https://example.com",
  "facebookUrl": "https://facebook.com/brand",
  "instagramUrl": "https://instagram.com/brand",
  "rotateEnabled": false,
  "showPoweredBy": true
}
```

### POST `/api/retail/join-branding/logo`
Upload a logo file (multipart/form-data, field `file`).
- Allowed types: `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`
- Max size: 2MB

### POST `/api/retail/join-branding/og-image`
Upload an OG image file (multipart/form-data, field `file`).
- Allowed types: `image/png`, `image/jpeg`, `image/webp`
- Max size: 4MB

### DELETE `/api/retail/join-branding/logo`
Removes the linked logo asset.

### DELETE `/api/retail/join-branding/og-image`
Removes the linked OG image asset.

## Public Endpoints

### GET `/public/join/:token`
Returns the public join payload including branding. Asset URLs are resolved against the API host.

### GET `/public/assets/:assetId`
Serves a stored asset with caching headers.

## Storage
- Files are stored on disk under `uploads/retail/{ownerId}/{kind}/...`.
- `RetailAsset.storagePath` contains the relative path. Future storage can swap implementation.

## Notes
- `rotateEnabled` and `showPoweredBy` are stored for future UI use; rotate UI remains feature-flagged on the frontend.
- `marketingBullets` accepts up to 5 items, each up to 120 characters.
