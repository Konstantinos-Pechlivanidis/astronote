# Retail Auth Flow - Legacy UI

This document explains exactly how authentication works in the `apps/retail-web-legacy` application.

---

## Overview

The legacy retail UI uses a **dual-token authentication system**:
- **Access Token**: JWT stored in `localStorage` (sent in `Authorization` header)
- **Refresh Token**: HTTP-only cookie (set by backend, sent automatically)

---

## Token Storage

### Access Token
- **Location**: `localStorage.getItem('accessToken')`
- **Format**: JWT string
- **Lifetime**: Short-lived (expires quickly, exact duration set by backend)
- **Usage**: Sent in every authenticated request as `Authorization: Bearer {token}` header

### Refresh Token
- **Location**: HTTP-only cookie (set by backend)
- **Format**: Cookie value (not accessible to JavaScript)
- **Lifetime**: Long-lived (exact duration set by backend)
- **Usage**: Automatically sent with requests when `withCredentials: true` is set

---

## Authentication Flow

### 1. Initial Login

**User Action**: Submits login form (`/login`)

**Process**:
1. `LoginForm` component calls `AuthProvider.login(email, password)`
2. `AuthProvider.login()` calls `authApi.login({ email, password })`
3. Axios makes `POST /api/auth/login` request
   - **Headers**: None (public endpoint)
   - **Body**: `{ email, password }`
   - **withCredentials**: `true` (for cookie handling)
4. Backend responds with:
   ```json
   {
     "accessToken": "jwt_token_string",
     "user": { ... }
   }
   ```
5. Backend also sets HTTP-only cookie: `refreshToken=...` (via `Set-Cookie` header)
6. `AuthProvider` stores access token:
   ```javascript
   localStorage.setItem('accessToken', res.data.accessToken);
   ```
7. `AuthProvider` updates user state:
   ```javascript
   setUser(res.data.user);
   ```
8. Component navigates to `/app/dashboard` (handled by component)

**Result**:
- ✅ Access token in `localStorage`
- ✅ Refresh token in HTTP-only cookie
- ✅ User state updated
- ✅ User redirected to dashboard

---

### 2. Initial Signup

**User Action**: Submits signup form (`/signup`)

**Process**:
1. `SignupForm` component calls `AuthProvider.signup(email, password, senderName, company)`
2. `AuthProvider.signup()` calls `authApi.register({ email, password, senderName, company })`
3. Axios makes `POST /api/auth/register` request
   - **Headers**: None (public endpoint)
   - **Body**: `{ email, password, senderName, company }`
   - **withCredentials**: `true`
4. Backend responds with:
   ```json
   {
     "accessToken": "jwt_token_string",
     "user": { ... }
   }
   ```
5. Backend sets HTTP-only cookie: `refreshToken=...`
6. `AuthProvider` stores access token and updates user state (same as login)
7. Component navigates to `/app/dashboard`

**Result**: Same as login

---

### 3. App Initialization (Token Verification)

**Trigger**: App mounts, `AuthProvider` initializes

**Process**:
1. `AuthProvider` `useEffect` runs on mount
2. Checks for existing token:
   ```javascript
   const token = localStorage.getItem('accessToken');
   ```
3. If token exists:
   - Makes `GET /api/me` request with `Authorization: Bearer {token}` header
   - If successful: Updates user state with `res.data.user`
   - If fails (401): Removes token from `localStorage`
4. Sets `loading: false` to allow app to render

**Purpose**: Verify token validity on app load, restore user session

---

### 4. Authenticated Requests

**How Requests Are Authenticated**:

1. **Axios Request Interceptor** (`src/api/axios.js`):
   ```javascript
   api.interceptors.request.use((config) => {
     const token = localStorage.getItem('accessToken');
     if (token) {
       config.headers.Authorization = `Bearer ${token}`;
     }
     return config;
   });
   ```
2. Every API call automatically includes:
   - `Authorization: Bearer {accessToken}` header
   - `withCredentials: true` (for cookie sending)

**Example Request**:
```
GET /api/campaigns
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Cookie: refreshToken=abc123... (sent automatically)
```

---

### 5. Token Refresh (Automatic)

**Trigger**: Any authenticated request returns `401 Unauthorized`

**Process** (Axios Response Interceptor):

1. **Detect 401 Error**:
   ```javascript
   if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
     // Start refresh flow
   }
   ```
   - Excludes auth endpoints (`/auth/login`, `/auth/register`, `/auth/refresh`) from auto-refresh

2. **Queue Failed Requests**:
   - If refresh is already in progress, queue the failed request
   - Prevents multiple simultaneous refresh calls

3. **Call Refresh Endpoint**:
   ```javascript
   const response = await axios.post(
     `${baseURL}/api/auth/refresh`,
     {},
     { withCredentials: true } // Sends refresh token cookie
   );
   ```
   - **No Authorization header** (uses cookie only)
   - **withCredentials: true** (required for cookie)

4. **Update Access Token**:
   ```javascript
   const { accessToken } = response.data;
   localStorage.setItem('accessToken', accessToken);
   ```

5. **Retry Original Request**:
   - Updates original request headers with new token
   - Preserves all original headers (including `Idempotency-Key`)
   - Retries the failed request

6. **Process Queued Requests**:
   - Resolves all queued requests with new token
   - Each queued request is retried with updated `Authorization` header

**Example Flow**:
```
1. GET /api/campaigns → 401 Unauthorized
2. POST /api/auth/refresh (with cookie) → 200 OK { accessToken: "new_token" }
3. GET /api/campaigns (with new token) → 200 OK
```

---

### 6. Refresh Failure Handling

**Trigger**: `POST /api/auth/refresh` fails (401, 403, network error, etc.)

**Process**:
1. Clear access token:
   ```javascript
   localStorage.removeItem('accessToken');
   ```
2. Clear user state:
   ```javascript
   setUser(null);
   ```
3. Process queued requests (reject with error)
4. Redirect to login (if not already on auth page):
   ```javascript
   const currentPath = window.location.pathname;
   const isOnAuthPage = currentPath === '/login' || currentPath === '/signup';
   if (!isOnAuthPage) {
     setTimeout(() => {
       window.location.href = '/login';
     }, 2000); // 2s delay to allow error display
   }
   ```

**Result**: User is logged out and redirected to login page

---

### 7. Logout

**User Action**: Clicks logout button

**Process**:
1. `AuthProvider.logout()` is called
2. Attempts to call backend:
   ```javascript
   await authApi.logout(); // POST /api/auth/logout
   ```
   - **Headers**: `Authorization: Bearer {token}`
   - **Purpose**: Backend invalidates refresh token cookie
   - **Error Handling**: Continues even if API call fails (network issues, etc.)

3. Clears local state:
   ```javascript
   localStorage.removeItem('accessToken');
   setUser(null);
   ```

4. Component navigates to `/login` (handled by component)

**Result**:
- ✅ Access token removed from `localStorage`
- ✅ User state cleared
- ✅ Refresh token cookie cleared (by backend)
- ✅ User redirected to login

---

## CORS & withCredentials

### Configuration

**Axios Instance** (`src/api/axios.js`):
```javascript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  withCredentials: true, // REQUIRED for cookie-based refresh
});
```

### Why `withCredentials: true` is Required

1. **Cookie Sending**: HTTP-only cookies are only sent when `withCredentials: true`
2. **Refresh Token**: Refresh token is stored as HTTP-only cookie, so this is essential
3. **CORS**: Backend must allow credentials:
   - `Access-Control-Allow-Credentials: true`
   - `Access-Control-Allow-Origin` must be specific origin (not `*`)

### CORS Requirements

**Backend must respond with**:
```
Access-Control-Allow-Origin: http://localhost:5173 (or specific frontend origin)
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, Idempotency-Key
```

---

## Route Guards

### AuthGuard
- **Location**: `src/app/router/guards.jsx`
- **Purpose**: Protect routes that require authentication
- **Logic**:
  ```javascript
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  ```
- **Used On**: All `/app/*` routes

### PublicOnlyGuard
- **Location**: `src/app/router/guards.jsx`
- **Purpose**: Redirect authenticated users away from public pages
- **Logic**:
  ```javascript
  if (user) {
    return <Navigate to="/app/dashboard" replace />;
  }
  ```
- **Used On**: `/`, `/login`, `/signup`

---

## Security Considerations

### Access Token Storage
- **Current**: `localStorage` (accessible to JavaScript)
- **Risk**: Vulnerable to XSS attacks
- **Mitigation**: Short-lived tokens, automatic refresh

### Refresh Token Storage
- **Current**: HTTP-only cookie (not accessible to JavaScript)
- **Benefit**: Protected from XSS attacks
- **Requirement**: `withCredentials: true` for cookie sending

### Token Refresh
- **Automatic**: No user interaction required
- **Idempotent**: Queued requests prevent duplicate refresh calls
- **Error Handling**: Graceful logout on refresh failure

### Logout
- **Backend Call**: Attempts to invalidate refresh token
- **Fallback**: Clears local state even if API call fails
- **Result**: User is logged out regardless of network state

---

## Summary

1. **Login/Signup**: Sets access token in `localStorage` and refresh token in HTTP-only cookie
2. **Requests**: Access token sent in `Authorization` header, refresh token sent automatically via cookie
3. **Refresh**: Automatic on 401 errors, uses cookie-based refresh endpoint
4. **Logout**: Clears both tokens and redirects to login
5. **CORS**: Requires `withCredentials: true` and proper backend CORS configuration

---

## Key Files

- **Auth Provider**: `src/app/providers/AuthProvider.jsx`
- **Axios Config**: `src/api/axios.js`
- **Auth API**: `src/api/modules/auth.js`
- **Route Guards**: `src/app/router/guards.jsx`
- **Endpoints**: `src/api/endpoints.js`

