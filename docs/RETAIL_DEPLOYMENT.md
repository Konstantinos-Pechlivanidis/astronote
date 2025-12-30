# Retail Deployment Guide

## Environment

### Required Environment Variables

```env
# Retail API Base URL (Production)
NEXT_PUBLIC_RETAIL_API_BASE_URL=https://astronote-retail.onrender.com

# For local development
# NEXT_PUBLIC_RETAIL_API_BASE_URL=http://localhost:3001
```

### Optional Environment Variables

```env
# App Environment (for feature flags, if needed)
NEXT_PUBLIC_APP_ENV=production
```

---

## Render Deployment Settings

### Build Command
```bash
npm run build
```

### Start Command
```bash
npm start
```

### Install Command
```bash
npm install
```

### Node Version
- **Recommended**: Node.js 20.x
- **Minimum**: Node.js 18.x

### Build Environment
- **Node**: 20.x
- **NPM**: 9.x or higher

---

## Local Development

### Prerequisites
- Node.js >= 20
- npm >= 8
- Retail API running (default: `http://localhost:3001`)

### Setup

1. **Navigate to app directory:**
   ```bash
   cd apps/astronote-web
   ```

2. **Create environment file:**
   ```bash
   echo "NEXT_PUBLIC_RETAIL_API_BASE_URL=http://localhost:3001" > .env.local
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Access the app:**
   - Open `http://localhost:3000`
   - Navigate to `/auth/retail/login` or `/auth/retail/register`

---

## Build & Production

### Build
```bash
cd apps/astronote-web
npm run build
```

### Start Production Server
```bash
npm start
```

### Verify Build
```bash
# From monorepo root
npm run verify:builds
```

---

## Route Structure

### Public Routes (No Auth)
- `/unsubscribe?pt=...` - Unsubscribe page
- `/resubscribe?pt=...` - Resubscribe page
- `/tracking/offer/[trackingId]` - Offer landing
- `/tracking/redeem/[trackingId]` - Redemption status

### Auth Routes
- `/auth/retail/login` - Login
- `/auth/retail/register` - Register

### App Routes (Auth Required)
- `/app/retail/dashboard` - Dashboard
- `/app/retail/billing` - Billing
- `/app/retail/campaigns` - Campaigns list
- `/app/retail/campaigns/new` - Create campaign
- `/app/retail/campaigns/[id]` - Campaign detail
- `/app/retail/campaigns/[id]/stats` - Campaign stats

---

## CORS Configuration

The Retail API must allow CORS from the frontend domain:

```javascript
// Backend CORS config should include:
{
  origin: ['https://your-frontend-domain.com', 'http://localhost:3000'],
  credentials: true, // Required for refresh token cookie
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
}
```

---

## Health Checks

### Frontend Health
- `GET /` - Should return 200 (marketing landing)

### Retail API Health
- `GET https://astronote-retail.onrender.com/health` (if available)
- Or: `GET https://astronote-retail.onrender.com/api/me` (requires auth)

---

## Monitoring

### Key Metrics to Monitor
1. **Auth Refresh Failures**: High rate indicates token expiry issues
2. **401 Errors**: Should trigger automatic refresh (not user-visible)
3. **Campaign Enqueue Errors**: Check for Idempotency-Key issues
4. **Public Route Errors**: Unsubscribe/offer/redeem failures

### Error Tracking
- Errors are logged to console in development
- Production: Integrate with error tracking service (e.g., Sentry)
- Error boundaries catch React errors and show user-friendly messages

---

## Rollback Plan

If deployment fails:

1. **Revert to previous build** (Render auto-rollback or manual)
2. **Check environment variables** are correct
3. **Verify API connectivity** from frontend domain
4. **Check browser console** for CORS/auth errors

---

## Troubleshooting

### Common Issues

**Issue**: "Session expired" errors on every request
- **Fix**: Check `NEXT_PUBLIC_RETAIL_API_BASE_URL` is correct
- **Fix**: Verify CORS allows credentials
- **Fix**: Check refresh token cookie is being set

**Issue**: Campaign enqueue fails with "Already sending"
- **Fix**: Idempotency-Key is working correctly (prevents duplicates)
- **Fix**: Check campaign status before enqueue

**Issue**: Public routes show dark mode
- **Fix**: Verify routes are in `(retail)` route group
- **Fix**: Check `(retail)/layout.tsx` is applying theme

**Issue**: Build fails
- **Fix**: Run `npm run typecheck` to see TypeScript errors
- **Fix**: Run `npm run lint` to see linting errors
- **Fix**: Verify all dependencies are installed

---

## Performance

### Optimizations
- React Query caching (30s-5min staleTime depending on data)
- Code splitting (Next.js automatic)
- Image optimization (if images added)
- Pagination for large tables (20 items per page)

### Lighthouse Targets
- Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 90+ (for public routes)

---

## Security

### Implemented
- ✅ HTTP-only refresh token cookie
- ✅ Access token in localStorage (not httpOnly, but required for client-side)
- ✅ CORS with credentials
- ✅ Idempotency-Key for idempotent operations
- ✅ Input validation (Zod schemas)
- ✅ XSS protection (React automatic)

### Recommendations
- Add CSP headers in production
- Add rate limiting on public routes (backend)
- Monitor for suspicious activity
- Regular security audits

---

## Support

For issues or questions:
1. Check `docs/RETAIL_MIGRATION_STATUS.md` for parity notes
2. Check `docs/RETAIL_API_USAGE.md` for endpoint documentation
3. Check `docs/RETAIL_AUTH_FLOW.md` for auth behavior
4. Review legacy implementation in `apps/retail-web-legacy` for reference

