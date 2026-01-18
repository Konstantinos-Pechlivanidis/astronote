# Shopify Styling Alignment Report

**Date:** 2024  
**Scope:** Align Shopify app UI styling with Retail app styling system  
**Approach:** Styling-only changes, no logic modifications

---

## 1. Retail Styling System Summary

### 1.1 Theme & CSS Variables

**Source:** `apps/astronote-web/app/globals.css`

The Retail app uses the **retail-light** theme with the following CSS variables:

```css
/* Light mode background */
--color-background: #FFFFFF;
--color-background-elevated: #F9FAFB;

/* Light surfaces */
--color-surface: #FFFFFF;
--color-surface-hover: #FAFBFC;
--color-surface-light: #F3F4F6;
--color-surface-subtle: #F9FAFB;

/* Borders */
--color-border: rgba(0, 0, 0, 0.12);
--color-border-light: rgba(0, 0, 0, 0.08);
--color-border-subtle: rgba(0, 0, 0, 0.04);

/* Text */
--color-text-primary: #111827;
--color-text-secondary: #4B5563;
--color-text-tertiary: #6B7280;
--color-text-muted: #9CA3AF;

/* Accent (Tiffany Blue) */
--color-accent: #0ABAB5;
--color-accent-hover: #0BC5C0;
--color-accent-light: rgba(10, 186, 181, 0.1);
--color-accent-lighter: rgba(10, 186, 181, 0.05);

/* Shadows */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.08);
--shadow-md: 0 8px 24px 0 rgba(0, 0, 0, 0.12);
--shadow-lg: 0 12px 32px 0 rgba(0, 0, 0, 0.16);

/* Border Radius */
--radius-sm: 0.375rem; /* 6px */
--radius-md: 0.5rem; /* 8px */
--radius-lg: 0.75rem; /* 12px */
--radius-xl: 1rem; /* 16px */
--radius-2xl: 1.5rem; /* 24px - default for cards */
```

**Theme Activation:**
- Applied via `data-theme="retail-light"` and `class="retail-light"` on `<html>`
- Set in `apps/astronote-web/app/(retail)/layout.tsx` and `RetailShell`

### 1.2 Tailwind Config Tokens

**Source:** `apps/astronote-web/tailwind.config.ts`

Tailwind tokens map to CSS variables:
- `background`, `background-elevated`
- `surface`, `surface-hover`
- `border`, `border-light`
- `text-primary`, `text-secondary`, `text-tertiary`
- `accent`, `accent-hover`, `accent-light`

### 1.3 Shared UI Components

**Location:** `apps/astronote-web/components/ui/` and `apps/astronote-web/src/components/retail/`

#### Core UI Components (used by both Retail and Shopify):
- `Button` - `components/ui/button.tsx`
- `Input` - `components/ui/input.tsx`
- `Select` - `components/ui/select.tsx`
- `Textarea` - `components/ui/textarea.tsx`
- `GlassCard` - `components/ui/glass-card.tsx`

#### Retail-Specific Components:
- `RetailCard` - `src/components/retail/RetailCard.tsx`
  - Wraps GlassCard with retail-light styling
  - Variants: `default`, `subtle`, `danger`, `info`
  - Supports `hover` prop
  
- `RetailPageHeader` - `src/components/retail/RetailPageHeader.tsx`
  - Title + description + actions layout
  - Responsive flex layout
  
- `RetailSection` - `src/components/retail/RetailSection.tsx`
  - Section wrapper with optional title/description
  
- `RetailDataTable` - `src/components/retail/RetailDataTable.tsx`
  - Responsive table (desktop) / cards (mobile)
  - Uses RetailCard for container
  
- `StatusBadge` - `src/components/retail/StatusBadge.tsx`
  - Status indicators with semantic colors
  
- `EmptyState` - `src/components/retail/EmptyState.tsx`
  - Empty state with icon, title, description, action

### 1.4 Layout Patterns

**Source:** `apps/astronote-web/app/app/retail/_components/`

#### RetailShell (`RetailShell.tsx`):
- **Sidebar:** Fixed left, collapsible (280px expanded / 80px collapsed)
- **Topbar:** Sticky top bar with title and user menu
- **Mobile Nav:** Slide-out mobile navigation
- **Main Content:** `px-4 py-6 lg:px-8` padding
- **Theme:** Sets `retail-light` theme on mount

**Components:**
- `RetailSidebar` - Collapsible sidebar with navigation
- `RetailTopbar` - Top bar with page title and actions
- `RetailMobileNav` - Mobile slide-out navigation
- `RetailNavList` - Navigation items with grouping

**Spacing Rhythm:**
- Page padding: `px-4 py-6 lg:px-8`
- Card padding: `p-6 sm:p-8 lg:p-10`
- Section spacing: `space-y-6`
- Grid gaps: `gap-4 sm:gap-6`

**Typography:**
- Page title: `text-3xl font-bold`
- Section title: `text-lg font-semibold`
- Body: `text-sm` or `text-base`
- Labels: `text-sm font-medium`

---

## 2. Shopify App Current Styling Summary

### 2.1 Theme Usage

**Current State:**
- ✅ Uses same CSS variables (via retail-light theme)
- ✅ Uses same Tailwind tokens
- ❌ **Gap:** Theme not explicitly set in ShopifyShell (relies on parent)

**Location:** `apps/astronote-web/app/app/shopify/layout.tsx`
- Layout handles auth, but doesn't set theme
- Theme should be set in ShopifyShell

### 2.2 Layout Structure

**Source:** `apps/astronote-web/src/components/shopify/ShopifyShell.tsx`

**Current Implementation:**
```tsx
<div className="min-h-screen flex bg-background">
  <aside className="w-64 glass border-r border-border flex flex-col">
    {/* Logo + Nav + Logout */}
  </aside>
  <div className="flex-1 flex flex-col">
    <main className="flex-1 p-6 lg:p-8">{children}</main>
  </div>
</div>
```

**Gaps vs Retail:**
- ❌ No collapsible sidebar (fixed 256px width)
- ❌ No topbar (page titles not in consistent location)
- ❌ No mobile navigation
- ❌ Different padding: `p-6 lg:p-8` vs Retail's `px-4 py-6 lg:px-8`
- ❌ Sidebar styling differs (no backdrop blur, different structure)

### 2.3 Component Usage

**Already Using Retail Components:**
- ✅ `RetailCard` - Used in dashboard, campaigns, contacts, billing, templates
- ✅ `RetailPageHeader` - Used in most pages
- ✅ `RetailDataTable` - Used in campaigns, contacts
- ✅ `StatusBadge` - Used throughout
- ✅ `EmptyState` - Used in contacts, billing
- ✅ `Button`, `Input`, `Select` - Used throughout

**Inconsistencies:**
- Some pages use inline styling instead of RetailSection
- Some custom card implementations instead of RetailCard
- Inconsistent spacing in some pages

### 2.4 Pages Audit

#### Pages Using Retail Components:
1. **Dashboard** (`dashboard/page.tsx`)
   - ✅ Uses RetailPageHeader, RetailCard
   - ✅ Consistent styling

2. **Campaigns** (`campaigns/page.tsx`)
   - ✅ Uses RetailPageHeader, RetailCard, RetailDataTable, StatusBadge
   - ✅ Consistent styling

3. **Contacts** (`contacts/page.tsx`)
   - ✅ Uses RetailPageHeader, RetailCard, RetailDataTable, StatusBadge, EmptyState
   - ✅ Consistent styling

4. **Templates** (`templates/page.tsx`)
   - ✅ Uses RetailPageHeader, RetailCard
   - ✅ Consistent styling

5. **Billing** (`billing/page.tsx`)
   - ✅ Uses RetailPageHeader, RetailCard, StatusBadge, EmptyState
   - ✅ Consistent styling

6. **Settings** (`settings/page.tsx`)
   - ⚠️ Needs audit (not fully reviewed)

7. **Automations** (`automations/page.tsx`, `automations/[id]/page.tsx`, `automations/new/page.tsx`)
   - ⚠️ Needs audit (not fully reviewed)

#### Auth Pages:
- **Login** (`auth/login/page.tsx`)
  - Uses custom styling (not Retail components)
  - Should align with Retail auth pages

- **Callback** (`auth/callback/page.tsx`)
  - Uses custom styling

### 2.5 Polaris Usage

**Finding:** ❌ **No Polaris usage detected**
- No `@shopify/polaris` imports found
- No Polaris components in use
- Safe to proceed with full styling alignment

---

## 3. Gaps / Inconsistencies

### 3.1 Layout Gaps

1. **ShopifyShell Structure**
   - Missing collapsible sidebar
   - Missing topbar for page titles
   - Missing mobile navigation
   - Different padding structure

2. **Theme Activation**
   - Theme not explicitly set in ShopifyShell
   - Should set `data-theme="retail-light"` on mount

3. **Spacing Inconsistencies**
   - Main content padding differs: `p-6 lg:p-8` vs `px-4 py-6 lg:px-8`
   - Some pages have inconsistent section spacing

### 3.2 Component Gaps

1. **Missing RetailSection Usage**
   - Some pages use custom section wrappers
   - Should standardize on RetailSection

2. **Auth Pages**
   - Login/callback pages don't use Retail auth patterns
   - Should align with Retail auth styling (but keep Shopify-specific logic)

### 3.3 Styling Gaps

1. **Sidebar Styling**
   - Different glass effect implementation
   - Missing backdrop blur consistency
   - Navigation item styling differs slightly

2. **Page Headers**
   - Some pages don't use RetailPageHeader consistently
   - Inconsistent action button placement

---

## 4. Proposed Migration Plan (Minimal-Risk)

### Strategy: **Strategy A - Shared Design System** (Preferred)

Since Shopify already uses Retail components and there's no Polaris dependency, we'll:

1. **Enhance ShopifyShell** to match RetailShell patterns:
   - Add collapsible sidebar (optional, can be simpler than Retail)
   - Add topbar for consistent page titles
   - Add mobile navigation
   - Set retail-light theme explicitly
   - Match padding structure

2. **Standardize Component Usage**:
   - Ensure all pages use RetailPageHeader
   - Replace custom sections with RetailSection where appropriate
   - Ensure consistent RetailCard usage

3. **Align Auth Pages**:
   - Apply Retail auth styling patterns
   - Keep Shopify-specific auth logic intact

4. **Spacing & Typography**:
   - Standardize page padding
   - Ensure consistent section spacing
   - Match typography scale

### Implementation Phases

#### Phase 1: Shell Enhancement
- Update ShopifyShell to match RetailShell structure
- Add theme activation
- Add topbar component
- Add mobile nav (if needed for embedded context)

#### Phase 2: Component Standardization
- Audit all pages for Retail component usage
- Replace custom implementations with Retail components
- Standardize spacing

#### Phase 3: Auth Pages
- Apply Retail auth styling to login/callback
- Keep Shopify OAuth logic intact

#### Phase 4: Polish & Consistency
- Review all pages for spacing consistency
- Ensure typography matches
- Final visual parity check

---

## 5. Component Mapping Table

| Retail Component | Shopify Current Usage | Action Required |
|-----------------|----------------------|-----------------|
| `RetailCard` | ✅ Used extensively | ✅ Keep, ensure consistent usage |
| `RetailPageHeader` | ✅ Used in most pages | ✅ Keep, ensure all pages use it |
| `RetailSection` | ⚠️ Partially used | 🔄 Add to pages missing it |
| `RetailDataTable` | ✅ Used in campaigns/contacts | ✅ Keep |
| `StatusBadge` | ✅ Used throughout | ✅ Keep |
| `EmptyState` | ✅ Used in contacts/billing | ✅ Keep, ensure all empty states use it |
| `RetailShell` | ❌ Not used | 🔄 Create ShopifyShell based on RetailShell |
| `RetailSidebar` | ❌ Not used | 🔄 Create ShopifySidebar (simpler version) |
| `RetailTopbar` | ❌ Not used | 🔄 Create ShopifyTopbar |
| `RetailMobileNav` | ❌ Not used | ⚠️ Optional (embedded context may not need) |
| `Button` | ✅ Used | ✅ Keep |
| `Input` | ✅ Used | ✅ Keep |
| `Select` | ✅ Used | ✅ Keep |
| `GlassCard` | ✅ Used via RetailCard | ✅ Keep |

---

## 6. Files to Change

### 6.1 Shell & Layout Files

1. **`apps/astronote-web/src/components/shopify/ShopifyShell.tsx`**
   - Major refactor to match RetailShell structure
   - Add theme activation
   - Add topbar
   - Enhance sidebar (collapsible optional)

2. **`apps/astronote-web/app/app/shopify/layout.tsx`**
   - Minor: Ensure theme is set (or rely on ShopifyShell)

### 6.2 New Components (if needed)

3. **`apps/astronote-web/app/app/shopify/_components/ShopifyTopbar.tsx`** (NEW)
   - Similar to RetailTopbar but Shopify-specific

4. **`apps/astronote-web/app/app/shopify/_components/ShopifyNavList.tsx`** (NEW)
   - Navigation items for Shopify app

### 6.3 Page Updates (Styling Only)

5. **`apps/astronote-web/app/app/shopify/auth/login/page.tsx`**
   - Apply Retail auth styling patterns
   - Keep Shopify OAuth logic

6. **`apps/astronote-web/app/app/shopify/auth/callback/page.tsx`**
   - Apply Retail auth styling patterns

7. **`apps/astronote-web/app/app/shopify/settings/page.tsx`**
   - Audit and ensure Retail component usage

8. **`apps/astronote-web/app/app/shopify/automations/*.tsx`**
   - Audit and ensure Retail component usage

### 6.4 Minor Updates (if needed)

9. Various page files - ensure consistent spacing and RetailSection usage

---

## 7. Risk Assessment

### Low Risk ✅
- Component styling updates (RetailCard, RetailPageHeader already used)
- Spacing/typography adjustments
- Theme activation

### Medium Risk ⚠️
- ShopifyShell refactor (structure change, but styling only)
- Topbar addition (new component, but styling only)

### No Risk ✅
- No Polaris dependencies to worry about
- No business logic changes
- All changes are styling-only

---

## 8. Success Criteria

1. ✅ Visual parity with Retail app (colors, spacing, typography)
2. ✅ Consistent component usage across all Shopify pages
3. ✅ Shell structure matches Retail patterns (with Shopify-specific adaptations)
4. ✅ No broken functionality (all logic preserved)
5. ✅ Responsive design maintained
6. ✅ Embedded iframe compatibility maintained

---

## 9. Next Steps

1. **Review this report** with stakeholders
2. **Proceed with Phase 1** (Shell Enhancement)
3. **Iterate through phases** with testing at each step
4. **Create final report** after implementation

---

**Report Generated:** 2024  
**Status:** Ready for Implementation

