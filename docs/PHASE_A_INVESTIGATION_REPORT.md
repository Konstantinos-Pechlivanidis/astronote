# PHASE A — Investigation Report: Retail Navigation Not Applied

**Date:** 2024-12-19  
**Status:** Investigation Complete  
**Goal:** Find root cause why Retail navigation/layout is not applied on desktop

## 1. Route File Locations

### Verified Route Files:

| Route | File Path | Status |
|-------|-----------|--------|
| `/app/retail/dashboard` | `app/(retail)/app/retail/dashboard/page.tsx` | ✅ Found |
| `/app/retail/campaigns` | `app/(retail)/app/retail/campaigns/page.tsx` | ✅ Found |
| `/app/retail/contacts` | `app/(retail)/app/retail/contacts/page.tsx` | ✅ Found |

**All retail routes are under:** `app/(retail)/app/retail/*`

## 2. Layout Hierarchy Analysis

### All Layouts Found:

```
app/layout.tsx                          (Root - providers, html/body)
├── app/app/layout.tsx                  (App layout - applies to /app/*)
│   └── app/app/shopify/layout.tsx      (Shopify layout - applies to /app/shopify/*)
└── app/(retail)/layout.tsx             (Route group - theme only, passes through)
    └── app/(retail)/app/retail/layout.tsx  (Retail layout - applies to /app/retail/*)
```

### Layout Resolution for `/app/retail/dashboard`:

**Expected Layout Chain:**
1. `app/layout.tsx` - Root (providers)
2. `app/(retail)/layout.tsx` - Route group (theme only, passes through)
3. `app/(retail)/app/retail/layout.tsx` - Retail layout (RetailAppLayout)

**Key Question:** Does `app/app/layout.tsx` apply to routes in `app/(retail)/app/retail/*`?

**Answer:** In Next.js App Router, route groups create SEPARATE hierarchies. Since `app/app/layout.tsx` is NOT in the `(retail)` route group, it should NOT apply to routes in `app/(retail)/app/retail/*`.

**However:** The route structure suggests there might be confusion:
- `app/app/layout.tsx` applies to `/app/*` (which includes `/app/retail/*` in URL space)
- But `app/(retail)/app/retail/*` routes are in a different file system hierarchy

## 3. Retail Navigation Components

### Current Components:

| Component | Location | Exported As | Used By |
|-----------|----------|-------------|---------|
| `RetailAppLayout` | `src/components/retail/layout/RetailAppLayout.tsx` | Named export | `app/(retail)/app/retail/layout.tsx` |
| `RetailSidebar` | `src/components/retail/layout/RetailSidebar.tsx` | Named export | `RetailAppLayout.tsx` |
| `RetailTopBar` | `src/components/retail/layout/RetailTopBar.tsx` | Named export | `RetailAppLayout.tsx` |
| `RetailNavItemComponent` | `src/components/retail/layout/RetailNavItem.tsx` | Named export | `RetailSidebar.tsx`, `RetailTopBar.tsx` |
| `retailNavItems` | `src/components/retail/layout/retailNav.config.ts` | Named export | All nav components |

### Old/Conflicting Components:

| Component | Location | Status | Issue |
|-----------|----------|--------|-------|
| `Sidebar` | `components/app/sidebar.tsx` | ⚠️ Active | Used by `app/app/layout.tsx` for retail routes |
| `TopBar` | `components/app/topbar.tsx` | ⚠️ Active | Used by `app/app/layout.tsx` for retail routes |
| `RetailPageLayout` | `src/components/retail/RetailPageLayout.tsx` | ✅ Active | Used by pages (content wrapper, not nav) |

### Dependency Graph:

```
app/(retail)/app/retail/layout.tsx
  └── RetailAppLayout
      ├── RetailSidebar (desktop: hidden lg:flex)
      └── RetailTopBar (mobile: hamburger + drawer)

app/app/layout.tsx
  └── Sidebar (generic, used for retail if this layout applies)
  └── TopBar (generic, used for retail if this layout applies)
```

## 4. PRIMARY ROOT CAUSE IDENTIFIED

### Root Cause: Layout Hierarchy Conflict

**Evidence:**

1. **Route Group Structure:**
   - Retail routes are in: `app/(retail)/app/retail/*`
   - Generic app layout is in: `app/app/layout.tsx`
   - These are in DIFFERENT route group hierarchies

2. **Next.js App Router Behavior:**
   - Route groups like `(retail)` create separate layout hierarchies
   - `app/app/layout.tsx` applies to routes under `app/app/*` (not in route groups)
   - `app/(retail)/app/retail/layout.tsx` applies to routes under `app/(retail)/app/retail/*`

3. **The Problem:**
   - In Next.js App Router, layouts are resolved based on the file system path
   - For `app/(retail)/app/retail/dashboard/page.tsx`, the layout chain should be:
     - `app/layout.tsx` (root)
     - `app/(retail)/layout.tsx` (route group)
     - `app/(retail)/app/retail/layout.tsx` (segment layout)
   - `app/app/layout.tsx` should NOT be in this chain because it's not in the `(retail)` route group

4. **However, there's a potential issue:**
   - If Next.js resolves layouts by URL path (`/app/*`), then `app/app/layout.tsx` might still apply
   - This would create a conflict where BOTH layouts try to render

5. **Additional Issue Found:**
   - `app/app/layout.tsx` has logic that renders `Sidebar` and `TopBar` for retail routes (line 38: `serviceType = 'retail'`)
   - This suggests the developer expected `app/app/layout.tsx` to apply to retail routes
   - But retail routes are in a different route group, so this layout might not apply

### Secondary Issues:

1. **Pages use RetailPageLayout:**
   - All retail pages wrap content in `<RetailPageLayout>` (69 matches found)
   - This is a content wrapper, not a navigation shell
   - This is correct and should remain

2. **Desktop Sidebar Visibility:**
   - `RetailSidebar` uses: `'hidden lg:flex'` (line 47)
   - This means: hidden on mobile, visible on desktop (lg+)
   - This is CORRECT

3. **Content Offset:**
   - `RetailAppLayout` uses: `lg:ml-[280px]` (line 19)
   - This provides correct spacing for fixed sidebar
   - This is CORRECT

## 5. Hypothesis

**Most Likely Root Cause:**

The retail layout (`app/(retail)/app/retail/layout.tsx`) IS correctly placed and SHOULD apply to retail routes. However, there might be:

1. **A Next.js routing issue** where `app/app/layout.tsx` is also being applied (creating duplicate layouts)
2. **A build/cache issue** where old layout structure is being used
3. **A missing check** in `app/app/layout.tsx` to skip retail routes (similar to how it skips shopify routes)

**Recommended Fix:**

Add a check in `app/app/layout.tsx` to skip retail routes (similar to shopify), OR verify that Next.js route groups properly isolate layouts.

## 6. Verification Needed

To confirm the root cause, we need to:
1. Check if `app/app/layout.tsx` is being applied to retail routes (it shouldn't be)
2. Verify the actual layout chain at runtime (requires running the app)
3. Check for any build/cache issues

**Since we can't run the app, we'll proceed with the safest fix:**
- Ensure `app/app/layout.tsx` explicitly skips retail routes (defensive programming)
- Verify `app/(retail)/app/retail/layout.tsx` is correctly structured
- Remove any duplicate/conflicting navigation components

---

**Next Steps:** Proceed to PHASE B to implement the fix.

