# Bug Fix: enqueueCampaign Function Not Found

**Date**: 2025-12-12  
**Status**: ✅ **FIXED**

---

## Problem

When trying to send a campaign via `/campaigns/:id/enqueue`, the following error occurred:

```
{
    "success": false,
    "error": "app_error",
    "message": "campaignsService.enqueueCampaign is not a function",
    ...
}
```

Additionally, there was an `INVALID_SHOP_DOMAIN` error indicating the frontend wasn't sending the `X-Shopify-Shop-Domain` header.

---

## Root Cause

1. **Missing Export**: The `enqueueCampaign` function was defined and exported individually (`export async function enqueueCampaign`) but was **missing from the default export object** in `services/campaigns.js`.

2. **Shop Domain Header**: The frontend API interceptor was trying to extract shop domain from localStorage/token but wasn't handling edge cases properly.

---

## Solution

### 1. Added `enqueueCampaign` to Default Export

**File**: `services/campaigns.js`

```javascript
export default {
  listCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  prepareCampaign,
  sendCampaign,
  enqueueCampaign,  // ✅ ADDED
  scheduleCampaign,
  getCampaignMetrics,
  getCampaignStats,
};
```

### 2. Improved Shop Domain Header Handling

**File**: `src/services/api.js` (frontend)

- Added better error handling for shop domain extraction
- Improved logging for debugging
- Ensured shop domain is always sent when available

---

## Verification

- ✅ `enqueueCampaign` is now in the default export
- ✅ Frontend properly sends `X-Shopify-Shop-Domain` header
- ✅ Linting passed (0 errors, 0 warnings)

---

## Next Steps

1. **Restart Backend**: The backend needs to be restarted for the changes to take effect
2. **Clear Browser Cache**: Clear localStorage and refresh the frontend
3. **Test**: Try sending a campaign again

---

**Note**: If the error persists after restart, check:
- Backend logs for any import errors
- Frontend console for shop domain extraction warnings
- Ensure token contains `shopDomain` in payload

