# Shopify UI Style Reuse

How Shopify UI will reuse Retail UI kit components in `apps/astronote-web`.

**Target:** `apps/astronote-web/src/components/retail/` (reuse existing components)

---

## A. Reusable Components

### 1. PageHeader

**File:** `apps/astronote-web/src/components/retail/RetailPageHeader.tsx`

**Usage:**
```typescript
import { RetailPageHeader } from '@/components/retail/RetailPageHeader';

<RetailPageHeader
  title="Dashboard"
  description="Welcome back to your SMS marketing dashboard"
  actions={<Button>Create Campaign</Button>}
/>
```

**Props:**
- `title: string` - Page title
- `description?: string` - Optional subtitle
- `actions?: ReactNode` - Optional action buttons
- `className?: string` - Optional custom classes

**Evidence:** `apps/astronote-web/src/components/retail/RetailPageHeader.tsx:1-38`

---

### 2. RetailCard

**File:** `apps/astronote-web/src/components/retail/RetailCard.tsx`

**Usage:**
```typescript
import { RetailCard } from '@/components/retail/RetailCard';

<RetailCard variant="default" hover>
  <h3>Card Title</h3>
  <p>Card content</p>
</RetailCard>
```

**Props:**
- `variant?: 'default' | 'subtle' | 'danger' | 'info'` - Card variant
- `hover?: boolean` - Enable hover effects
- `children: ReactNode` - Card content
- `className?: string` - Optional custom classes

**Evidence:** `apps/astronote-web/src/components/retail/RetailCard.tsx:1-37`

---

### 3. RetailDataTable

**File:** `apps/astronote-web/src/components/retail/RetailDataTable.tsx`

**Usage:**
```typescript
import { RetailDataTable } from '@/components/retail/RetailDataTable';

<RetailDataTable
  columns={[
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status', render: (item) => <Badge>{item.status}</Badge> },
  ]}
  data={campaigns}
  keyExtractor={(item) => item.id}
  emptyTitle="No campaigns found"
  emptyDescription="Create your first campaign to get started"
  emptyAction={<Button>Create Campaign</Button>}
  error={error?.message}
  onRetry={() => refetch()}
/>
```

**Props:**
- `columns: Column<T>[]` - Table columns
- `data: T[]` - Table data
- `keyExtractor: (item: T) => string | number` - Key function
- `emptyTitle?: string` - Empty state title
- `emptyDescription?: string` - Empty state description
- `emptyIcon?: LucideIcon` - Empty state icon
- `emptyAction?: ReactNode` - Empty state action button
- `error?: string` - Error message
- `onRetry?: () => void` - Retry function
- `mobileCardRender?: (item: T) => ReactNode` - Mobile card render function
- `onRowClick?: (item: T) => void` - Row click handler

**Evidence:** `apps/astronote-web/src/components/retail/RetailDataTable.tsx:1-184`

---

### 4. FormField

**File:** Check if exists in Retail components, or use shadcn/ui Input/Select

**Usage:**
```typescript
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<div>
  <Label htmlFor="name">Campaign Name</Label>
  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
</div>
```

**Note:** Use shadcn/ui form components if Retail doesn't have FormField.

---

### 5. Buttons

**File:** `apps/astronote-web/src/components/ui/button.tsx` (shadcn/ui)

**Usage:**
```typescript
import { Button } from '@/components/ui/button';

<Button variant="default" size="default">
  Create Campaign
</Button>
```

**Variants:**
- `default` - Primary action
- `secondary` - Secondary action
- `destructive` - Delete/danger actions
- `outline` - Outlined button
- `ghost` - Ghost button
- `link` - Link button

**Sizes:**
- `default` - Standard size
- `sm` - Small
- `lg` - Large
- `icon` - Icon button

---

### 6. Skeletons

**File:** `apps/astronote-web/src/components/ui/skeleton.tsx` (shadcn/ui)

**Usage:**
```typescript
import { Skeleton } from '@/components/ui/skeleton';

<Skeleton className="h-4 w-[250px]" />
<Skeleton className="h-4 w-[200px]" />
```

**For loading states:**
- Table rows: `<Skeleton className="h-12 w-full" />`
- Cards: `<Skeleton className="h-32 w-full" />`
- Text: `<Skeleton className="h-4 w-full" />`

---

### 7. Alerts

**File:** `apps/astronote-web/src/components/ui/alert.tsx` (shadcn/ui)

**Usage:**
```typescript
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

<Alert variant="destructive">
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Failed to load campaigns</AlertDescription>
</Alert>
```

**Variants:**
- `default` - Info
- `destructive` - Error
- `warning` - Warning (if supported)
- `success` - Success (if supported)

---

### 8. EmptyState

**File:** Check if exists in Retail components

**Usage:**
```typescript
import { EmptyState } from '@/components/retail/EmptyState';

<EmptyState
  title="No campaigns found"
  description="Create your first campaign to get started"
  icon={CampaignIcon}
  action={<Button>Create Campaign</Button>}
/>
```

**If not exists, create:**
```typescript
// apps/astronote-web/src/components/retail/EmptyState.tsx
export function EmptyState({ title, description, icon, action }) {
  return (
    <RetailCard className="text-center py-12">
      {icon && <div className="mb-4">{icon}</div>}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && <p className="text-text-secondary mb-4">{description}</p>}
      {action && <div>{action}</div>}
    </RetailCard>
  );
}
```

---

## B. No New Design System

**Rule:** Do NOT create new design system components for Shopify.

**Reuse:**
- Retail UI kit components (PageHeader, Card, DataTable)
- shadcn/ui components (Button, Input, Select, Skeleton, Alert)
- Existing utility classes from Tailwind

**Only Extend If:**
- Component doesn't exist and is needed
- Extension is minimal (e.g., new variant)
- Extension doesn't break existing Retail components

---

## C. Shopify Layout Constraints

### Embedded App Constraints

**Width:**
- Shopify admin iframe has variable width
- Use responsive design (mobile-first)
- Max width: `max-w-7xl` (same as Retail)

**Scroll:**
- Iframe handles scrolling
- Don't use `overflow-hidden` on body
- Let content scroll naturally

**Header:**
- Shopify admin provides top bar
- Don't duplicate navigation in iframe
- Use sidebar navigation if needed (optional)

### Implementation

**File:** `apps/astronote-web/app/shopify/layout.tsx`

```typescript
'use client';

export default function ShopifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-bg-base">
      {/* Optional: Sidebar navigation */}
      <div className="flex">
        <aside className="w-64 border-r border-border-subtle">
          {/* Navigation */}
        </aside>
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
```

**Note:** Start with simple layout, add sidebar only if needed.

---

## D. UI Consistency Checklist

### Spacing Rules

**Padding:**
- Page padding: `px-4 py-6` (mobile), `px-6 py-8` (desktop)
- Card padding: `p-4` (mobile), `p-6` (desktop)
- Section spacing: `mb-6` (mobile), `mb-8` (desktop)

**Gaps:**
- Grid gaps: `gap-4` (mobile), `gap-6` (desktop)
- Flex gaps: `gap-2` (small), `gap-4` (medium), `gap-6` (large)

**Evidence:** Retail components use similar spacing patterns.

---

### Typography Scale

**Headings:**
- H1: `text-3xl font-bold` (page titles)
- H2: `text-2xl font-semibold` (section titles)
- H3: `text-xl font-semibold` (card titles)
- H4: `text-lg font-semibold` (sub-section titles)

**Body:**
- Default: `text-base` (body text)
- Small: `text-sm` (captions, metadata)
- Large: `text-lg` (emphasis)

**Colors:**
- Primary text: `text-text-primary`
- Secondary text: `text-text-secondary`
- Muted text: `text-text-muted`

**Evidence:** Retail components use Tailwind typography classes.

---

### Contrast Rules

**Light Mode (Default):**
- Background: `bg-neutral-bg-base` (white/light gray)
- Surface: `bg-white` or `bg-neutral-bg-subtle`
- Border: `border-border-subtle` (light gray)
- Text: `text-text-primary` (dark gray/black)

**Surface Separation:**
- Cards: `border border-border-subtle bg-white rounded-lg shadow-sm`
- Sections: `mb-6` or `mb-8` spacing
- Dividers: `border-t border-border-subtle`

**Evidence:** Retail uses light mode with subtle borders and shadows.

---

### Focus Ring (Tiffany Accent)

**Accent Color:** `#0ABAB5` (Tiffany blue)

**Focus Ring:**
```css
focus:outline-none focus:ring-2 focus:ring-[#0ABAB5] focus:ring-offset-2
```

**Or use Tailwind class:**
```typescript
className="focus-ring" // If defined in globals.css
```

**Usage:**
- Interactive elements (buttons, inputs, links)
- Keyboard navigation
- Accessibility requirement

**Evidence:** Retail uses Tiffany accent for focus states.

---

### Minimum Hit Targets

**Rule:** All interactive elements must be at least 44px × 44px.

**Implementation:**
- Buttons: `min-h-[44px]` or `h-11` (44px)
- Inputs: `min-h-[44px]` or `h-11`
- Links: `min-h-[44px]` padding
- Icon buttons: `w-11 h-11` (44px × 44px)

**Evidence:** iOS 26 / 2026-inspired design follows accessibility guidelines.

---

## E. Component Mapping

### Reference → Retail Component

| Reference Component | Retail Component | Notes |
|-------------------|------------------|-------|
| `GlassCard` | `RetailCard` | Use `variant="default"` or `variant="subtle"` |
| `PageHeader` | `RetailPageHeader` | Direct reuse |
| `GlassTable` | `RetailDataTable` | Direct reuse |
| `GlassButton` | `Button` (shadcn/ui) | Use shadcn/ui Button |
| `GlassInput` | `Input` (shadcn/ui) | Use shadcn/ui Input |
| `GlassSelect` | `Select` (shadcn/ui) | Use shadcn/ui Select |
| `LoadingSpinner` | `Skeleton` (shadcn/ui) | Use Skeleton for loading states |
| `ErrorState` | `Alert` (shadcn/ui) | Use Alert with `variant="destructive"` |
| `EmptyState` | `EmptyState` (create if needed) | Create using RetailCard |
| `StatusBadge` | `Badge` (shadcn/ui) | Use shadcn/ui Badge |
| `ConfirmDialog` | `AlertDialog` (shadcn/ui) | Use shadcn/ui AlertDialog |

---

## F. Styling Patterns

### Card Pattern

```typescript
<RetailCard className="p-6">
  <h3 className="text-lg font-semibold mb-4">Card Title</h3>
  <p className="text-text-secondary">Card content</p>
</RetailCard>
```

### Table Pattern

```typescript
<RetailDataTable
  columns={columns}
  data={data}
  keyExtractor={(item) => item.id}
  emptyTitle="No items found"
  error={error?.message}
  onRetry={() => refetch()}
/>
```

### Form Pattern

```typescript
<div className="space-y-4">
  <div>
    <Label htmlFor="name">Name</Label>
    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
  </div>
  <Button type="submit">Save</Button>
</div>
```

### Loading Pattern

```typescript
{isLoading ? (
  <div className="space-y-4">
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-12 w-full" />
  </div>
) : (
  <RetailDataTable ... />
)}
```

### Error Pattern

```typescript
{error ? (
  <Alert variant="destructive">
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>{error.message}</AlertDescription>
    <Button onClick={() => refetch()}>Retry</Button>
  </Alert>
) : (
  <RetailDataTable ... />
)}
```

---

## G. Color Palette

### Primary Colors

- **Tiffany Accent:** `#0ABAB5` (primary action, focus ring)
- **Text Primary:** Dark gray/black (headings, body)
- **Text Secondary:** Medium gray (captions, metadata)
- **Border Subtle:** Light gray (borders, dividers)

### Background Colors

- **Base:** White/light gray (`bg-neutral-bg-base`)
- **Surface:** White (`bg-white`)
- **Subtle:** Very light gray (`bg-neutral-bg-subtle`)

### Status Colors

- **Success:** Green (if needed)
- **Error:** Red (destructive actions)
- **Warning:** Yellow/amber (if needed)
- **Info:** Blue (if needed)

**Evidence:** Retail uses neutral palette with Tiffany accent.

---

## H. Responsive Breakpoints

**Mobile:** `< 640px` (default)
- Single column layout
- Stacked cards
- Full-width buttons

**Tablet:** `640px - 1024px` (sm:)
- 2-column grid
- Side-by-side cards
- Compact navigation

**Desktop:** `> 1024px` (lg:)
- 3-4 column grid
- Full table layout
- Sidebar navigation (optional)

**Evidence:** Retail components use Tailwind responsive classes.

---

## Summary

1. **Reuse Retail Components:** PageHeader, Card, DataTable
2. **Use shadcn/ui:** Button, Input, Select, Skeleton, Alert, Badge
3. **No New Design System:** Only extend if absolutely necessary
4. **Layout Constraints:** Handle iframe width, scroll, header
5. **Consistency:** Follow spacing, typography, contrast, focus ring, hit targets
6. **Responsive:** Mobile-first, breakpoints at 640px and 1024px
7. **Tiffany Accent:** `#0ABAB5` for focus states and primary actions

