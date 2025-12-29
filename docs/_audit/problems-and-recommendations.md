# Problems and Recommendations

## Priority Classification

- **P0 (Must Fix)**: Critical issues that must be addressed before production
- **P1 (Should Fix)**: Important issues that should be addressed soon
- **P2 (Nice to Have)**: Improvements that can be done later

---

## P0: Must Fix Before Live

### 1. Nested Monorepo Structure
**Problem**: `apps/retail-api` contains its own workspace configuration (`workspaces: ["apps/*"]`), creating a nested monorepo.

**Impact**:
- Dependency resolution issues
- Confusing structure for developers
- npm workspace commands don't work correctly
- Duplicate `node_modules` and `package-lock.json` files

**Solution**:
1. Flatten structure:
   - Move `apps/retail-api/apps/api` → `apps/retail-api` (or `apps/retail-api-server`)
   - Move `apps/retail-api/apps/web` → `apps/retail-web` (or merge with `apps/web`)
   - Move `apps/retail-api/apps/worker` → `apps/retail-worker`
2. Remove nested workspace config from `apps/retail-api/package.json`
3. Update root `package.json` workspaces to include new locations
4. Move `apps/retail-api/prisma/` to appropriate location (keep at `apps/retail-api/prisma/` if retail-api becomes single app)

**Files to Update**:
- Root `package.json` workspaces
- All import paths in moved files
- Prisma schema paths
- Environment variable loading paths
- Build/deploy scripts

---

### 2. Package Name Conflict
**Problem**: Both `apps/web` and `apps/retail-api/apps/web` use package name `@astronote/web`.

**Impact**:
- npm workspace resolution ambiguity
- Potential dependency conflicts
- Confusion in tooling

**Solution**:
- Rename `apps/retail-api/apps/web` package to `@astronote/retail-web`
- Or merge both into single unified frontend (see P1 recommendation)

---

### 3. Environment Variable Naming Conflicts
**Problem**: Multiple env keys for similar purposes:
- `FRONTEND_URL`, `FRONTEND_BASE_URL`, `WEB_APP_URL`, `APP_PUBLIC_BASE_URL`
- `ALLOWED_ORIGINS` vs `CORS_ALLOWLIST`
- `HOST` vs `APP_URL` vs `API_URL` vs `API_BASE_URL`
- `UNSUBSCRIBE_SECRET` vs `UNSUBSCRIBE_TOKEN_SECRET`
- `DIRECT_URL` vs `DIRECT_DATABASE_URL`

**Impact**:
- Configuration confusion
- Inconsistent behavior
- Harder to maintain

**Solution**:
1. Standardize on:
   - `FRONTEND_URL` for main frontend
   - `PUBLIC_BASE_URL` for public URLs
   - `ALLOWED_ORIGINS` for CORS
   - `API_BASE_URL` or `HOST` for API base
   - `UNSUBSCRIBE_SECRET` for unsubscribe tokens
   - `DIRECT_URL` for direct database connection
2. Create unified `.env.example` at root
3. Update all code to use standardized keys
4. Add migration guide for existing deployments

---

### 4. Missing Root .env.example
**Problem**: No root-level `.env.example` file documenting all environment variables.

**Impact**:
- Difficult to set up new environments
- Unclear what variables are needed
- Risk of missing required configuration

**Solution**:
1. Create root `.env.example` with all variables organized by category
2. Document which variables are required vs optional
3. Include comments explaining each variable
4. Reference app-specific `.env.example` files if needed

---

### 5. Port Conflicts
**Problem**: Both `apps/web` and `apps/retail-api/apps/web` use port 5173 (Vite default).

**Impact**:
- Cannot run both simultaneously in development
- Confusion about which frontend is running

**Solution**:
- Configure different ports in `vite.config.js`
- Or merge into single unified frontend (see P1)

---

## P1: Should Fix

### 6. Duplicate Frontend Applications
**Problem**: Two separate frontend apps (`apps/web` and `apps/retail-api/apps/web`) with overlapping functionality.

**Impact**:
- Code duplication
- Maintenance burden
- Inconsistent UX
- Larger bundle sizes

**Solution**:
- Merge into single unified frontend (see `unified-frontend-routing-proposal.md`)
- Use route-based separation (`/retail/*` and `/shopify/*`)
- Implement code splitting for optimal bundle sizes

---

### 7. Inconsistent Prisma Schema Locations
**Problem**: 
- `apps/shopify-api/prisma/schema.prisma` (independent)
- `apps/retail-api/prisma/schema.prisma` (shared by sub-apps)

**Impact**:
- Unclear schema ownership
- Potential for schema drift
- Migration management complexity

**Solution**:
- Keep separate schemas if using separate databases (recommended)
- Document schema relationships
- Consider shared models in `packages/shared` if needed

---

### 8. Duplicate node_modules
**Problem**: Multiple `node_modules/` directories throughout the monorepo.

**Impact**:
- Increased disk usage
- Slower installs
- Potential version conflicts

**Solution**:
- Use npm workspaces hoisting (already enabled)
- Review and remove unnecessary nested `node_modules/`
- Consider using `.npmrc` to control hoisting behavior

---

### 9. Missing Environment Variable Validation
**Problem**: No unified environment variable validation at startup.

**Impact**:
- Runtime errors from missing variables
- Difficult to debug configuration issues

**Solution**:
- Create root-level env validation script
- Use Zod schemas (like retail-api already does)
- Fail fast on missing required variables
- Add to startup scripts

---

### 10. Inconsistent Error Handling
**Problem**: Different error response formats across APIs.

**Impact**:
- Frontend needs different error handling per API
- Inconsistent user experience

**Solution**:
- Standardize error response format: `{ success: boolean, error?: string, message?: string, code?: string, data?: any }`
- Create shared error utilities in `packages/shared`
- Update all APIs to use standard format

---

### 11. Missing API Documentation
**Problem**: No comprehensive API documentation for frontend developers.

**Impact**:
- Difficult for frontend team to integrate
- Unclear endpoint contracts
- Potential integration bugs

**Solution**:
- Create/update `docs/frontend-endpoints-map.md` (already exists, needs updating)
- Add OpenAPI/Swagger specs for both APIs
- Document request/response schemas
- Include authentication requirements

---

### 12. CORS Configuration Inconsistency
**Problem**: 
- `shopify-api` uses `ALLOWED_ORIGINS`
- `retail-api` uses `CORS_ALLOWLIST`

**Impact**:
- Configuration confusion
- Potential CORS errors

**Solution**:
- Standardize on `ALLOWED_ORIGINS`
- Update retail-api to use `ALLOWED_ORIGINS`
- Document CORS requirements

---

## P2: Nice to Have

### 13. Shared Packages Not Populated
**Problem**: `packages/shared/` exists but is empty.

**Impact**:
- Code duplication across apps
- No shared utilities/types

**Solution**:
- Populate `packages/shared/` with:
  - Common types/interfaces
  - Shared utilities
  - Validation schemas (Zod)
  - Error classes
  - Constants

---

### 14. Missing TypeScript Types
**Problem**: Both APIs are JavaScript, no shared TypeScript types.

**Impact**:
- No type safety across frontend/backend
- Potential runtime errors

**Solution**:
- Add TypeScript to `packages/shared`
- Generate types from Zod schemas
- Export types for frontend consumption

---

### 15. Inconsistent Logging
**Problem**: Different logging approaches:
- `shopify-api` uses Winston
- `retail-api` uses Pino

**Impact**:
- Inconsistent log formats
- Harder to aggregate logs

**Solution**:
- Standardize on one logging library (recommend Pino for performance)
- Create shared logging utilities
- Use structured logging consistently

---

### 16. Missing Integration Tests
**Problem**: Limited integration tests across the monorepo.

**Impact**:
- Risk of breaking changes
- Harder to refactor

**Solution**:
- Add integration tests for critical flows
- Test API contracts
- Test worker job processing
- Add to CI pipeline

---

### 17. No Monorepo Tooling
**Problem**: No tools for managing monorepo (e.g., Turborepo, Nx).

**Impact**:
- Slower builds
- No build caching
- Harder to manage dependencies

**Solution**:
- Consider adding Turborepo for:
  - Build caching
  - Task orchestration
  - Dependency graph visualization

---

### 18. Missing CI/CD Pipeline
**Problem**: No automated CI/CD pipeline defined.

**Impact**:
- Manual deployment process
- Risk of human error
- No automated testing

**Solution**:
- Set up GitHub Actions or similar
- Add automated tests
- Add linting/formatting checks
- Add deployment automation

---

### 19. Inconsistent Code Style
**Problem**: Different code style preferences across apps.

**Impact**:
- Harder to maintain
- Inconsistent codebase

**Solution**:
- Already addressed in Phase 6 (ESLint + Prettier)
- Ensure all apps use same configs
- Add pre-commit hooks

---

### 20. Missing Performance Monitoring
**Problem**: No application performance monitoring (APM) setup.

**Impact**:
- Hard to identify performance issues
- No visibility into production performance

**Solution**:
- Add Sentry (already configured in shopify-api)
- Add performance monitoring
- Set up alerts for errors/slow requests

---

## Summary

### P0 Issues (5)
1. Nested monorepo structure
2. Package name conflict
3. Environment variable naming conflicts
4. Missing root .env.example
5. Port conflicts

### P1 Issues (7)
6. Duplicate frontend applications
7. Inconsistent Prisma schema locations
8. Duplicate node_modules
9. Missing environment variable validation
10. Inconsistent error handling
11. Missing API documentation
12. CORS configuration inconsistency

### P2 Issues (8)
13. Shared packages not populated
14. Missing TypeScript types
15. Inconsistent logging
16. Missing integration tests
17. No monorepo tooling
18. Missing CI/CD pipeline
19. Inconsistent code style (mostly fixed)
20. Missing performance monitoring

---

## Recommended Action Plan

### Phase 1: Critical Fixes (P0)
1. Flatten retail-api structure
2. Resolve package name conflicts
3. Standardize environment variables
4. Create root .env.example
5. Fix port conflicts

### Phase 2: Important Improvements (P1)
1. Merge frontend applications
2. Standardize error handling
3. Add environment validation
4. Update API documentation
5. Standardize CORS configuration

### Phase 3: Enhancements (P2)
1. Populate shared packages
2. Add integration tests
3. Set up CI/CD
4. Add performance monitoring
5. Consider monorepo tooling

---

## Migration Risks

### High Risk
- Flattening retail-api structure (many file moves, path updates)
- Merging frontend applications (complex routing, state management)

### Medium Risk
- Standardizing environment variables (requires deployment updates)
- Updating error handling (frontend integration changes)

### Low Risk
- Adding shared packages
- Adding tests
- Setting up CI/CD

---

## Testing Strategy

### Before Restructuring
1. Document current behavior
2. Create test suite for critical flows
3. Backup current state

### During Restructuring
1. Test incrementally
2. Verify each moved component
3. Run integration tests

### After Restructuring
1. Full integration test suite
2. Smoke tests for all services
3. Performance benchmarks
4. User acceptance testing

