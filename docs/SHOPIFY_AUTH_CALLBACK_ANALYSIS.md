# Shopify Auth Callback Analysis

**Date:** 2025-01-27  
**Issue:** `https://astronote.onrender.com/shopify/auth/callback?token=...` returns 404

---

## 1) Origin of Callback URL

### Backend Construction

**File:** `apps/shopify-api/routes/auth.js`

**Line 416:** Callback URL is constructed here:
```javascript
const redirectUrl = `${webAppUrl}/shopify/auth/callback?token=${token}`;
```

**Line 405:** Token is generated:
```javascript
const { token } = await generateAppToken(store.shopDomain);
```

**Line 413-415:** `webAppUrl` is determined:
```javascript
const webAppUrl =
  process.env.WEB_APP_URL ||
  'https://astronote-shopify-frontend.onrender.com';
```

**Evidence:**
- `apps/shopify-api/routes/auth.js:416` - Callback URL construction
- `apps/shopify-api/routes/auth.js:405` - Token generation
- `apps/shopify-api/routes/auth.js:413-415` - Web app URL configuration

### OAuth Flow

1. User clicks "Log in" → Frontend redirects to `Backend /auth/shopify?shop=...`
2. Backend redirects to `Shopify OAuth page`
3. Shopify redirects back to `Backend /auth/callback` (configured in Shopify Partners)
4. Backend processes OAuth → generates JWT token → redirects to `Frontend /shopify/auth/callback?token=...`
5. Frontend callback page saves token and redirects to dashboard

**Evidence:**
- `apps/shopify-api/routes/auth.js:62-127` - OAuth initiation
- `apps/shopify-api/routes/auth.js:142-451` - OAuth callback handler
- `apps/astronote-shopify-frontend/src/pages/auth/AuthCallback.jsx:12-18` - Flow documentation

---

## 2) What the `token` Is

### Answer: **Option A - Backend JWT**

**Evidence:**

**File:** `apps/shopify-api/services/auth.js`

**Lines 152-162:** Token generation:
```javascript
const token = jwt.sign(
  {
    storeId: store.id,
    shopDomain: store.shopDomain,
    source: 'auth_service',
  },
  process.env.JWT_SECRET,
  {
    expiresIn: '30d', // Long-lived token
  },
);
```

**Token Structure:**
- **Type:** JWT (JSON Web Token)
- **Signed by:** Our backend server (`JWT_SECRET`)
- **Contains:**
  - `storeId` - Store ID from database
  - `shopDomain` - Shop domain (e.g., `example.myshopify.com`)
  - `source: 'auth_service'` - Token source identifier
  - `exp` - Expiration (30 days)
  - `iat` - Issued at timestamp

**Not:**
- ❌ Shopify session token (that's from App Bridge, used for embedded apps)
- ❌ Temporary token (it's a long-lived JWT, 30 days)

**Evidence:**
- `apps/shopify-api/services/auth.js:152-162` - JWT signing
- `apps/shopify-api/services/auth.js:86-169` - `generateAppToken` function
- `apps/astronote-shopify-frontend/src/pages/auth/AuthCallback.jsx:54-67` - Token decoding (extracts `storeId` and `shopDomain` from JWT payload)

---

## 3) Recommended Implementation

### Current State

**Backend redirects to:**
```
${webAppUrl}/shopify/auth/callback?token=${token}
```

Where `webAppUrl` is:
- `process.env.WEB_APP_URL` OR
- `https://astronote-shopify-frontend.onrender.com` (default)

**Current frontend route:**
- `app/app/shopify/auth/callback/page.tsx` → `/app/shopify/auth/callback`

**Mismatch:**
- Backend redirects to: `/shopify/auth/callback`
- Frontend route is at: `/app/shopify/auth/callback`

### Solution Options

#### Option 1: Create redirect route (Recommended)

Create a route at `/shopify/auth/callback` that redirects to `/app/shopify/auth/callback?token=...`

**Pros:**
- No backend changes needed
- Backward compatible
- Works with existing backend configuration

**Cons:**
- Extra redirect step

#### Option 2: Update backend redirect URL

Change backend to redirect to `/app/shopify/auth/callback`

**Pros:**
- Direct route, no redirect

**Cons:**
- Requires backend environment variable change
- Breaks compatibility with reference frontend

### Recommended: Option 1

**Implementation:**

1. **Create redirect route:** `app/shopify/auth/callback/page.tsx`
   - Extract `token` from query params
   - Redirect to `/app/shopify/auth/callback?token=${token}` using Next.js router

2. **Keep existing route:** `app/app/shopify/auth/callback/page.tsx`
   - Already implemented correctly
   - Handles token storage and verification

---

## 4) Embedded/Iframe Redirect Rules

### Current Implementation (Correct)

**File:** `apps/astronote-web/app/app/shopify/auth/callback/page.tsx`

**Line 116:** Uses internal Next.js navigation:
```typescript
router.push('/app/shopify/dashboard');
```

**File:** `apps/astronote-web/src/lib/shopify/auth/redirect.ts`

**Lines 11-19:** Top-level redirect utility:
```typescript
export function topLevelRedirect(url: string): void {
  if (typeof window !== 'undefined') {
    if (window.top) {
      window.top.location.href = url;
    } else {
      window.location.href = url;
    }
  }
}
```

**Rules:**
- ✅ **Internal navigation:** Use `router.push()` for same-origin routes
- ✅ **OAuth redirects:** Use `topLevelRedirect()` for external OAuth flows
- ✅ **Current implementation:** Correctly uses `router.push()` for dashboard redirect

---

## 5) Files to Change

### File 1: Create redirect route

**Path:** `apps/astronote-web/app/shopify/auth/callback/page.tsx`

**Purpose:** Redirect from `/shopify/auth/callback` to `/app/shopify/auth/callback`

**Implementation:**
```typescript
'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ShopifyAuthCallbackRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    // Redirect to the actual callback handler with all query params
    if (error) {
      router.push(`/app/shopify/auth/callback?error=${encodeURIComponent(error)}`);
    } else if (token) {
      router.push(`/app/shopify/auth/callback?token=${encodeURIComponent(token)}`);
    } else {
      // No token or error - redirect to login
      router.push('/app/shopify/auth/login');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
        <p className="mt-4 text-text-secondary">Redirecting...</p>
      </div>
    </div>
  );
}

export default function ShopifyAuthCallbackRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
            <p className="mt-4 text-text-secondary">Loading...</p>
          </div>
        </div>
      }
    >
      <ShopifyAuthCallbackRedirect />
    </Suspense>
  );
}
```

### File 2: No changes needed

**Path:** `apps/astronote-web/app/app/shopify/auth/callback/page.tsx`

**Status:** ✅ Already correctly implemented
- Extracts token from query params
- Decodes JWT to get store info
- Verifies token via backend
- Stores token and store info in localStorage
- Redirects to dashboard using `router.push()`

---

## 6) Decision Summary

### Token Type: **Option A - Backend JWT**

**Evidence:**
- Generated by `generateAppToken()` in `apps/shopify-api/services/auth.js:152-162`
- Signed with `JWT_SECRET` (our backend secret)
- Contains `storeId`, `shopDomain`, `source: 'auth_service'`
- Expires in 30 days

### Implementation: **Create redirect route**

**Reason:**
- Backend already configured to redirect to `/shopify/auth/callback`
- No backend changes needed
- Backward compatible
- Minimal frontend changes

### Redirect Rules: **Already correct**

- ✅ Internal navigation uses `router.push()`
- ✅ OAuth redirects use `topLevelRedirect()`
- ✅ Current callback implementation is correct

---

## 7) Next Steps

1. ✅ Create `app/shopify/auth/callback/page.tsx` (redirect route)
2. ✅ Verify `app/app/shopify/auth/callback/page.tsx` (already correct)
3. ⏳ Test OAuth flow end-to-end
4. ⏳ Verify token storage and verification

---

**Status:** Ready for implementation (pending user confirmation)

