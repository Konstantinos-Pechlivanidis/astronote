# Unified Frontend Routing Proposal

## Goal

Create a single unified frontend at `https://astronote.onrender.com` that serves:
- `/` - Marketing landing page (dark mode)
- `/retail` - Retail dashboard/login area
- `/shopify` - Shopify dashboard/login area

## Current State

### Existing Frontends
1. **`apps/web`**: Shopify-focused frontend (partially implemented)
   - Routes: `/dashboard`, `/campaigns`, `/contacts`, etc.
   - Tech: React, Vite, TailwindCSS, shadcn/ui
   - API: `VITE_SHOPIFY_API_BASE_URL`

2. **`apps/retail-api/apps/web`**: Retail frontend (fully implemented)
   - Routes: `/app/dashboard`, `/app/campaigns`, etc.
   - Tech: React, Vite, TailwindCSS, custom components
   - API: `VITE_API_BASE_URL`

## Proposed Unified Structure

### Route Organization

```
/                           → Marketing landing (public)
/retail                     → Retail login/landing
/retail/login               → Retail login page
/retail/signup              → Retail signup page
/retail/app/*               → Retail dashboard (protected)
  /retail/app/dashboard
  /retail/app/campaigns
  /retail/app/contacts
  /retail/app/templates
  /retail/app/billing
  /retail/app/automations
  /retail/app/settings
/shopify                    → Shopify login/landing
/shopify/login              → Shopify login page
/shopify/auth/callback      → Shopify OAuth callback
/shopify/app/*              → Shopify dashboard (protected)
  /shopify/app/dashboard
  /shopify/app/campaigns
  /shopify/app/contacts
  /shopify/app/templates
  /shopify/app/automations
  /shopify/app/settings
  /shopify/app/billing
  /shopify/app/subscriptions
```

### Public Routes (Shared)
- `/o/:trackingId` - Offer redemption (works for both)
- `/unsubscribe` - Unsubscribe (works for both)
- `/r/:token` - Short link redirect (backend handles)

## Implementation Strategy

### Option 1: Single App with Route-Based Separation (Recommended)

**Structure**:
```
apps/web/
  src/
    app/
      router/
        index.jsx          # Main router
        guards.jsx         # Auth guards
      providers/           # React Query, Redux, Auth
    features/
      marketing/           # Landing page
      retail/
        auth/              # Retail auth pages
        dashboard/         # Retail dashboard
        campaigns/         # Retail campaigns
        ...
      shopify/
        auth/              # Shopify auth pages
        dashboard/         # Shopify dashboard
        campaigns/         # Shopify campaigns
        ...
    api/
      retail.js            # Retail API client
      shopify.js           # Shopify API client
    store/
      retailAuthSlice.js
      shopifyAuthSlice.js
      uiSlice.js
```

**Router Configuration**:
```jsx
<Routes>
  {/* Marketing */}
  <Route path="/" element={<LandingPage />} />
  
  {/* Retail Routes */}
  <Route path="/retail">
    <Route path="login" element={<RetailLoginPage />} />
    <Route path="signup" element={<RetailSignupPage />} />
    <Route path="app/*" element={
      <AuthGuard authType="retail">
        <RetailAppShell />
      </AuthGuard>
    }>
      <Route path="dashboard" element={<RetailDashboardPage />} />
      <Route path="campaigns" element={<RetailCampaignsPage />} />
      {/* ... */}
    </Route>
  </Route>
  
  {/* Shopify Routes */}
  <Route path="/shopify">
    <Route path="login" element={<ShopifyLoginPage />} />
    <Route path="auth/callback" element={<ShopifyCallbackPage />} />
    <Route path="app/*" element={
      <AuthGuard authType="shopify">
        <ShopifyAppShell />
      </AuthGuard>
    }>
      <Route path="dashboard" element={<ShopifyDashboardPage />} />
      <Route path="campaigns" element={<ShopifyCampaignsPage />} />
      {/* ... */}
    </Route>
  </Route>
  
  {/* Public Routes */}
  <Route path="/o/:trackingId" element={<OfferPage />} />
  <Route path="/unsubscribe" element={<UnsubscribePage />} />
</Routes>
```

**Code Splitting Strategy**:
- Use React.lazy() for route-based code splitting
- Split by feature area (retail vs shopify)
- Load marketing bundle on `/`
- Load retail bundle on `/retail/*`
- Load shopify bundle on `/shopify/*`

**Example**:
```jsx
const RetailDashboardPage = lazy(() => import('../features/retail/dashboard/pages/DashboardPage'));
const ShopifyDashboardPage = lazy(() => import('../features/shopify/dashboard/pages/DashboardPage'));
```

### Option 2: Micro-Frontends (Not Recommended)

- Separate build outputs for retail and shopify
- Use module federation or iframe
- **Cons**: Complex, harder to maintain, shared code duplication

### Option 3: Subdomain-Based (Alternative)

- `astronote.onrender.com` - Marketing
- `retail.astronote.onrender.com` - Retail app
- `shopify.astronote.onrender.com` - Shopify app
- **Cons**: Requires multiple deployments, CORS complexity

## Feature Module Separation

### Shared Components
- `components/common/` - Shared UI components (buttons, inputs, etc.)
- `components/layout/` - Layout components (can be customized per app)
- `utils/` - Shared utilities

### Retail-Specific
- `features/retail/` - All retail features
- `api/retail.js` - Retail API client
- `store/retailAuthSlice.js` - Retail auth state

### Shopify-Specific
- `features/shopify/` - All Shopify features
- `api/shopify.js` - Shopify API client
- `store/shopifyAuthSlice.js` - Shopify auth state

## Authentication Strategy

### Retail Auth
- JWT access token + refresh token (HTTP-only cookie)
- Store in `retailAuthSlice`
- API client: `api/retail.js`

### Shopify Auth
- JWT token from OAuth flow
- Store in `shopifyAuthSlice`
- API client: `api/shopify.js`

### Auth Guards
```jsx
function AuthGuard({ authType, children }) {
  const retailAuth = useSelector(state => state.retailAuth);
  const shopifyAuth = useSelector(state => state.shopifyAuth);
  
  const isAuthenticated = authType === 'retail' 
    ? retailAuth.isAuthenticated 
    : shopifyAuth.isAuthenticated;
  
  if (!isAuthenticated) {
    return <Navigate to={`/${authType}/login`} />;
  }
  
  return children;
}
```

## API Client Strategy

### Separate Clients
```jsx
// api/retail.js
export const retailApi = axios.create({
  baseURL: import.meta.env.VITE_RETAIL_API_BASE_URL,
});

// api/shopify.js
export const shopifyApi = axios.create({
  baseURL: import.meta.env.VITE_SHOPIFY_API_BASE_URL,
});
```

### React Query Setup
```jsx
// Use separate query clients or namespaced keys
const retailQueryClient = new QueryClient();
const shopifyQueryClient = new QueryClient();

// Or use namespaced keys
useQuery(['retail', 'campaigns'], ...);
useQuery(['shopify', 'campaigns'], ...);
```

## Styling Strategy

### Shared Styles
- TailwindCSS base styles
- Shared component styles

### App-Specific Styles
- Use CSS modules or Tailwind variants
- Or separate style files per feature

## Migration Plan

### Phase 1: Merge Retail Frontend
1. Move `apps/retail-api/apps/web/src` → `apps/web/src/features/retail`
2. Update routes to `/retail/app/*`
3. Update API client to use `VITE_RETAIL_API_BASE_URL`
4. Test retail functionality

### Phase 2: Integrate Shopify Frontend
1. Move existing `apps/web/src` → `apps/web/src/features/shopify`
2. Update routes to `/shopify/app/*`
3. Ensure API client uses `VITE_SHOPIFY_API_BASE_URL`
4. Test Shopify functionality

### Phase 3: Add Marketing Landing
1. Create `apps/web/src/features/marketing`
2. Add landing page at `/`
3. Add dark mode styling

### Phase 4: Code Splitting
1. Implement React.lazy() for route-based splitting
2. Optimize bundle sizes
3. Test loading performance

## Benefits

1. **Single Deployment**: One frontend to deploy and maintain
2. **Shared Code**: Common components and utilities
3. **Consistent UX**: Unified design system
4. **Easier Maintenance**: One codebase, one build process
5. **Code Splitting**: Load only what's needed per route

## Challenges

1. **Bundle Size**: Need effective code splitting
2. **State Management**: Separate auth states for retail/shopify
3. **API Clients**: Two separate API clients
4. **Routing Complexity**: More complex router configuration
5. **Testing**: Need to test both retail and shopify flows

## Recommendations

1. **Use Option 1** (Single App with Route-Based Separation)
2. **Implement code splitting** from the start
3. **Use feature-based folder structure** for clear separation
4. **Share common components** but keep feature-specific code separate
5. **Use environment variables** to configure API endpoints
6. **Implement proper error boundaries** per feature area

