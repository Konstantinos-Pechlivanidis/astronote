# Shopify Auth and Tenancy

Exact authentication and tenancy implementation for Shopify UI in `apps/astronote-web`.

---

## A. Obtaining Shopify Session Token in Embedded Iframe Context

### Context
Shopify apps run inside an iframe when embedded in the Shopify admin. The iframe receives a session token from Shopify App Bridge.

### How It Works
1. **Shopify App Bridge** provides session token via `window.shopify.sessionToken`
2. **Session token** is a JWT signed by Shopify containing:
   - `shop` (shop domain)
   - `sub` (user ID)
   - `exp` (expiration)
   - `dest` (destination URL)
   - **Evidence:** `apps/shopify-api/services/auth.js:43-78` (verifyShopifySessionToken)

### Implementation in astronote-web

**File:** `apps/astronote-web/src/lib/shopify/auth/session-token.ts`

```typescript
// Get session token from Shopify App Bridge
export function getShopifySessionToken(): string | null {
  // In embedded iframe context
  if (typeof window !== 'undefined' && (window as any).shopify?.sessionToken) {
    return (window as any).shopify.sessionToken;
  }
  return null;
}
```

**Note:** If not in embedded context (e.g., standalone web app), session token may not be available. Fallback to OAuth flow (see below).

---

## B. Exchanging Session Token with Backend

### Endpoint
**POST** `/api/auth/shopify-token`

**Evidence:** `apps/shopify-api/routes/auth.js:21-55`

### Request

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "sessionToken": "<shopify_session_token>"
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "token": "<app_jwt_token>",
    "store": {
      "id": "store_uuid",
      "shopDomain": "example.myshopify.com",
      "credits": 100,
      "currency": "EUR"
    },
    "expiresIn": "30d"
  },
  "message": "Token generated successfully"
}
```

**Error (400/401):**
```json
{
  "success": false,
  "error": "ValidationError",
  "message": "Session token is required"
}
```

### Implementation

**File:** `apps/astronote-web/src/lib/shopify/api/auth.ts`

```typescript
import axios from 'axios';
import { SHOPIFY_API_BASE_URL } from '@/lib/shopify/config';

export async function exchangeShopifyToken(sessionToken: string) {
  const response = await axios.post(
    `${SHOPIFY_API_BASE_URL}/auth/shopify-token`,
    { sessionToken },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
  
  return response.data.data; // { token, store, expiresIn }
}
```

### Token Storage

**Store JWT token in:**
- `localStorage.setItem('shopify_token', token)`
- `localStorage.setItem('shopify_store', JSON.stringify(store))`

**Evidence:** `apps/astronote-shopify-frontend/src/pages/auth/AuthCallback.jsx:52-93`

---

## C. Shop Tenancy Enforcement

### How Tenancy Works

The backend enforces shop tenancy via:

1. **JWT Token Claims** (Primary Method)
   - JWT contains `storeId` and `shopDomain`
   - **Evidence:** `apps/shopify-api/services/auth.js:86-163` (generateAppToken)
   - **Evidence:** `apps/shopify-api/middlewares/store-resolution.js:29-127` (JWT verification)

2. **X-Shopify-Shop-Domain Header** (Fallback)
   - If JWT doesn't contain storeId, header is used
   - **Evidence:** `apps/shopify-api/middlewares/store-resolution.js:136-203`

### JWT Token Structure

**Decoded JWT Payload:**
```json
{
  "storeId": "store_uuid",
  "shopDomain": "example.myshopify.com",
  "source": "shopify",
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Evidence:** `apps/shopify-api/services/auth.js:120-163` (generateAppToken)

### Middleware Resolution Order

1. **JWT Token** (Authorization: Bearer) - **PRIORITY**
2. **X-Shopify-Shop-Domain header** - Fallback
3. **Query params** (`?shop=`) - Fallback
4. **Body params** (`{ shop }`) - Fallback

**Evidence:** `apps/shopify-api/middlewares/store-resolution.js:23-340`

### Implementation in astronote-web

**File:** `apps/astronote-web/src/lib/shopify/api/axios.ts`

```typescript
import axios from 'axios';
import { SHOPIFY_API_BASE_URL } from '@/lib/shopify/config';

const shopifyApi = axios.create({
  baseURL: SHOPIFY_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token and shop domain
shopifyApi.interceptors.request.use((config) => {
  // Get JWT token from localStorage
  const token = localStorage.getItem('shopify_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Add shop domain header as fallback (from token or localStorage)
  const storeInfo = localStorage.getItem('shopify_store');
  if (storeInfo) {
    try {
      const store = JSON.parse(storeInfo);
      if (store.shopDomain) {
        config.headers['X-Shopify-Shop-Domain'] = store.shopDomain;
      }
    } catch (e) {
      // Silently fail
    }
  }
  
  return config;
});

// Response interceptor - handle 401 (token expired)
shopifyApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear invalid token
      localStorage.removeItem('shopify_token');
      localStorage.removeItem('shopify_store');
      
      // Redirect to login or re-authenticate
      if (typeof window !== 'undefined') {
        window.location.href = '/shopify/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

export default shopifyApi;
```

**Evidence:** `apps/astronote-shopify-frontend/src/services/api.js:14-113` (request interceptor)

---

## D. Making Requests

### Standard Request Pattern

**All API requests:**
1. Include `Authorization: Bearer <jwt_token>` header
2. Include `X-Shopify-Shop-Domain: <shop-domain>` header (fallback)
3. Use axios instance with interceptors (see above)

### Example Request

```typescript
import shopifyApi from '@/lib/shopify/api/axios';

// GET request
const response = await shopifyApi.get('/campaigns', {
  params: { page: 1, pageSize: 20 }
});

// POST request
const response = await shopifyApi.post('/campaigns', {
  name: 'Campaign Name',
  message: 'Campaign Message'
});
```

### withCredentials

**Not required** - JWT token is sent in Authorization header, not cookies.

**Evidence:** Backend uses JWT tokens, not cookies (see `apps/shopify-api/middlewares/store-resolution.js`).

---

## E. Handling Redirects in Iframe

### Embedded App Constraints

Shopify embedded apps run in an iframe. Redirects must be handled carefully:

1. **Top-Level Redirects** (for OAuth)
   - Use `window.top.location.href = url` to break out of iframe
   - **When:** OAuth flow, logout, external redirects
   - **Evidence:** Shopify App Bridge requires top-level redirects for OAuth

2. **Internal Navigation** (within app)
   - Use Next.js router (`useRouter().push()`) for same-origin navigation
   - **When:** Navigating between app pages
   - **Evidence:** Standard Next.js behavior

3. **What NOT to Do**
   - Don't use `window.location.href` for internal navigation (breaks iframe)
   - Don't use `window.location.replace()` for internal navigation
   - Don't redirect to external URLs without top-level redirect

### Implementation

**File:** `apps/astronote-web/src/lib/shopify/auth/redirect.ts`

```typescript
/**
 * Top-level redirect (breaks out of iframe)
 * Use for OAuth, logout, external redirects
 */
export function topLevelRedirect(url: string) {
  if (typeof window !== 'undefined' && window.top) {
    window.top.location.href = url;
  } else {
    window.location.href = url;
  }
}

/**
 * Internal navigation (within app)
 * Use for same-origin page navigation
 */
export function internalNavigate(path: string, router: any) {
  router.push(path);
}
```

### OAuth Flow Redirects

**OAuth Initiation:**
```typescript
// Redirect to backend OAuth endpoint
topLevelRedirect(`${SHOPIFY_API_BASE_URL}/auth/shopify?shop=${shopDomain}`);
```

**OAuth Callback:**
- Backend redirects to frontend with token: `/shopify/auth/callback?token=<jwt>`
- Frontend saves token and redirects to dashboard
- **Evidence:** `apps/shopify-api/routes/auth.js:412-418` (OAuth callback redirect)

---

## F. Token Refresh Strategy

### Current Implementation

**JWT tokens expire after 30 days:**
- **Evidence:** `apps/shopify-api/routes/auth.js:45` (`expiresIn: '30d'`)
- **Evidence:** `apps/shopify-api/services/auth.js:120-163` (JWT expires in 30 days)

### Refresh Endpoint

**POST** `/api/auth/refresh`

**Evidence:** `apps/shopify-api/routes/auth.js:517-585`

### Request

**Headers:**
```
Authorization: Bearer <existing_jwt_token>
```

### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "token": "<new_jwt_token>",
    "expiresIn": "30d"
  },
  "message": "Token refreshed successfully"
}
```

### Implementation

**File:** `apps/astronote-web/src/lib/shopify/api/auth.ts`

```typescript
export async function refreshToken() {
  const token = localStorage.getItem('shopify_token');
  if (!token) {
    throw new Error('No token to refresh');
  }
  
  const response = await axios.post(
    `${SHOPIFY_API_BASE_URL}/auth/refresh`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  
  const newToken = response.data.data.token;
  localStorage.setItem('shopify_token', newToken);
  
  return newToken;
}
```

### When to Refresh

**Options:**
1. **On 401 Error** - Refresh token when API returns 401
2. **Proactive Refresh** - Refresh token before expiration (e.g., 7 days before expiry)
3. **On App Load** - Check token expiry on app initialization

**Recommendation:** Refresh on 401 error (simpler, handles edge cases).

**Implementation in axios interceptor:**
```typescript
shopifyApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        // Try to refresh token
        await refreshToken();
        // Retry original request
        return shopifyApi.request(error.config);
      } catch (refreshError) {
        // Refresh failed - redirect to login
        localStorage.removeItem('shopify_token');
        localStorage.removeItem('shopify_store');
        window.location.href = '/shopify/auth/login';
      }
    }
    return Promise.reject(error);
  }
);
```

---

## G. Environment Variables

### Required ENV Vars in astronote-web

**File:** `apps/astronote-web/.env.local` (or `.env`)

```bash
# Shopify API Base URL
NEXT_PUBLIC_SHOPIFY_API_BASE_URL=https://your-shopify-api.onrender.com

# App URL (for OAuth redirects)
NEXT_PUBLIC_APP_URL=https://your-app.onrender.com

# Shopify API Key (if needed for OAuth initiation)
NEXT_PUBLIC_SHOPIFY_API_KEY=your_api_key
```

### Configuration File

**File:** `apps/astronote-web/src/lib/shopify/config.ts`

```typescript
export const SHOPIFY_API_BASE_URL =
  process.env.NEXT_PUBLIC_SHOPIFY_API_BASE_URL ||
  'https://astronote-shopify-backend.onrender.com';

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://astronote-web.onrender.com';

export const SHOPIFY_API_KEY =
  process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || '';
```

### Backend ENV Vars (for reference)

**File:** `apps/shopify-api/env.example`

```bash
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
HOST=https://your-shopify-api.onrender.com
WEB_APP_URL=https://your-app.onrender.com
```

**Evidence:** `apps/shopify-api/routes/auth.js:79-94` (OAuth initiation uses these vars)

---

## H. OAuth Flow (Alternative to Session Token)

### When to Use OAuth

- **Standalone web app** (not embedded in Shopify admin)
- **Session token unavailable** (fallback)
- **Initial app installation**

### OAuth Flow Steps

1. **User clicks "Log in"** → Frontend redirects to backend
   ```
   GET /api/auth/shopify?shop=example.myshopify.com
   ```

2. **Backend redirects to Shopify OAuth**
   ```
   https://example.myshopify.com/admin/oauth/authorize?client_id=...&scope=...&redirect_uri=...
   ```

3. **Shopify redirects back to backend**
   ```
   GET /api/auth/callback?code=...&shop=...&hmac=...
   ```

4. **Backend processes OAuth and redirects to frontend**
   ```
   GET /shopify/auth/callback?token=<jwt_token>
   ```

5. **Frontend saves token and redirects to dashboard**

**Evidence:** `apps/shopify-api/routes/auth.js:62-135` (OAuth initiation)
**Evidence:** `apps/shopify-api/routes/auth.js:142-451` (OAuth callback)

### Implementation

**File:** `apps/astronote-web/app/shopify/auth/login/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { SHOPIFY_API_BASE_URL } from '@/lib/shopify/config';

export default function LoginPage() {
  const [shopDomain, setShopDomain] = useState('');
  
  const handleLogin = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = `${SHOPIFY_API_BASE_URL}/auth/shopify?shop=${shopDomain}`;
  };
  
  return (
    <div>
      <input
        type="text"
        value={shopDomain}
        onChange={(e) => setShopDomain(e.target.value)}
        placeholder="example.myshopify.com"
      />
      <button onClick={handleLogin}>Log in</button>
    </div>
  );
}
```

**File:** `apps/astronote-web/app/shopify/auth/callback/page.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    
    if (error) {
      // Handle error
      router.push('/shopify/auth/login?error=' + encodeURIComponent(error));
      return;
    }
    
    if (token) {
      // Save token
      localStorage.setItem('shopify_token', token);
      
      // Decode token to get store info
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.storeId && payload.shopDomain) {
          localStorage.setItem('shopify_store', JSON.stringify({
            id: payload.storeId,
            shopDomain: payload.shopDomain,
          }));
        }
      } catch (e) {
        // Silently fail
      }
      
      // Redirect to dashboard
      router.push('/shopify/dashboard');
    }
  }, [searchParams, router]);
  
  return <div>Completing authentication...</div>;
}
```

**Evidence:** `apps/astronote-shopify-frontend/src/pages/auth/AuthCallback.jsx:19-154`

---

## I. Protected Routes

### Implementation

**File:** `apps/astronote-web/app/shopify/layout.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function ShopifyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Check if token exists
    const token = localStorage.getItem('shopify_token');
    
    if (!token) {
      // Redirect to login
      router.push('/shopify/auth/login');
      return;
    }
    
    // Verify token with backend
    fetch('/api/auth/verify', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          // Token invalid - redirect to login
          localStorage.removeItem('shopify_token');
          localStorage.removeItem('shopify_store');
          router.push('/shopify/auth/login');
        }
      })
      .catch(() => {
        // Network error - redirect to login
        router.push('/shopify/auth/login');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [router]);
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return null; // Redirecting...
  }
  
  return <div>{children}</div>;
}
```

**Evidence:** `apps/astronote-shopify-frontend/src/components/auth/ProtectedRoute.jsx`

---

## Summary

1. **Session Token:** Get from `window.shopify.sessionToken` (embedded iframe)
2. **Token Exchange:** POST `/api/auth/shopify-token` with session token → get JWT
3. **Tenancy:** JWT contains `storeId` and `shopDomain` (primary), header as fallback
4. **Requests:** Always include `Authorization: Bearer <jwt>` and `X-Shopify-Shop-Domain` (fallback)
5. **Redirects:** Top-level for OAuth, internal navigation for app pages
6. **Refresh:** POST `/api/auth/refresh` on 401 error
7. **ENV Vars:** `NEXT_PUBLIC_SHOPIFY_API_BASE_URL`, `NEXT_PUBLIC_APP_URL`
8. **OAuth:** Fallback flow for standalone web app or initial installation

