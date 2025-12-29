# Routing Strategy Options

**Date**: 2025-01-XX  
**Purpose**: Propose alternative routing grouping approaches for backend APIs

## Current State

Both `shopify-api` and `retail-api` currently use flat route structures:
- `/campaigns`
- `/contacts`
- `/automations`
- `/reports`
- etc.

## Proposed Strategies

### Option 1: Versioned API Routes

**Structure**:
```
/api/v1/campaigns
/api/v1/contacts
/api/v1/automations
/public/webhooks
/public/opt-in
```

**Pros**:
- Clear API versioning
- Easy to deprecate old versions
- Standard REST convention
- Frontend can target specific versions

**Cons**:
- Requires migration of all routes
- Breaking change for existing clients
- More complex route definitions

**Migration Impact**: High - All routes need prefix updates

### Option 2: Functional Grouping

**Structure**:
```
/api/campaigns
/api/contacts
/api/automations
/public/webhooks
/public/opt-in
/public/r/:token  (short links)
```

**Pros**:
- Clear separation of public vs authenticated
- Logical grouping by function
- Easier to apply middleware per group
- Less breaking than versioning

**Cons**:
- Still requires route updates
- No versioning built-in

**Migration Impact**: Medium - Routes need prefix updates

### Option 3: App-Specific Prefixes

**Structure**:
```
/shopify/campaigns
/shopify/contacts
/retail/campaigns
/retail/contacts
/public/webhooks
```

**Pros**:
- Clear app separation
- Can run both APIs on same domain
- Easy to identify source of requests

**Cons**:
- Redundant if apps are on separate domains
- More verbose URLs
- Requires app identification in routes

**Migration Impact**: High - All routes need app prefix

### Option 4: Keep Current (Flat Structure)

**Structure**:
```
/campaigns
/contacts
/automations
/webhooks
/opt-in
/r/:token
```

**Pros**:
- No migration needed
- Simple URLs
- Works well for separate deployments

**Cons**:
- No versioning
- Harder to group by function
- Mixing public and authenticated routes

**Migration Impact**: None

## Recommendation

**For Phase 1**: Keep current flat structure (Option 4)
- No breaking changes
- Focus on monorepo structure first
- Can migrate later if needed

**For Phase 2+**: Consider Option 2 (Functional Grouping)
- Add `/api` prefix for authenticated routes
- Add `/public` prefix for public routes
- Better organization without versioning complexity
- Can be done incrementally

## Frontend Integration Notes

**Reports as Dashboard Widgets**:
- Reports will be dashboard widgets, not separate pages
- API endpoints remain: `/reports/*` or `/api/reports/*`
- Frontend fetches data and renders widgets
- No `/reports` page route needed in frontend

**Example Frontend Routes**:
```
/dashboard              # Main dashboard with widgets
/dashboard/campaigns    # Campaign management
/dashboard/contacts     # Contact management
/dashboard/automations  # Automation management
```

**API Endpoints** (regardless of routing strategy):
```
GET /api/reports/campaigns/summary
GET /api/reports/campaigns/:id/details
GET /api/reports/contacts/stats
```

## Implementation Timeline

1. **Phase 1** (Current): Keep flat structure
2. **Phase 2**: Evaluate need for routing changes
3. **Phase 3**: Implement chosen strategy if needed

## Migration Strategy (if implementing Option 2)

1. **Add route prefixes**:
   ```javascript
   // Before
   app.use('/campaigns', campaignsRoutes);
   
   // After
   app.use('/api/campaigns', campaignsRoutes);
   app.use('/public/webhooks', webhookRoutes);
   ```

2. **Update frontend API calls**:
   ```javascript
   // Before
   fetch('/campaigns')
   
   // After
   fetch('/api/campaigns')
   ```

3. **Maintain backward compatibility** (optional):
   ```javascript
   // Redirect old routes to new
   app.use('/campaigns', (req, res) => res.redirect('/api/campaigns' + req.path));
   ```

## Decision Matrix

| Factor | Option 1 (Versioned) | Option 2 (Functional) | Option 3 (App Prefix) | Option 4 (Flat) |
|--------|---------------------|----------------------|---------------------|----------------|
| Migration Effort | High | Medium | High | None |
| Breaking Changes | Yes | Yes | Yes | No |
| Clarity | High | High | High | Medium |
| Versioning | Yes | No | No | No |
| Recommended | No | Yes | No | Yes (Phase 1) |

