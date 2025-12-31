# Retail UI System — iOS26 Minimal Light Design

## Overview

The Retail UI System is a comprehensive design system for the Retail section of Astronote, inspired by iOS 26 minimal aesthetics with a light mode theme. All Retail routes use this system for consistent, premium, fully responsive user experiences.

**Theme Scope:** Retail routes only (`/app/retail/*`, `/auth/retail/*`, public Retail pages)
**Theme Activation:** Applied via `html.retail-light` class or `data-theme='retail-light'`

---

## 1. Design Tokens

### 1.1 Colors

#### Backgrounds
```css
--color-background: #FFFFFF              /* Main page background */
--color-background-elevated: #F9FAFB    /* Elevated surfaces (modals, cards) */
--color-surface: rgba(255, 255, 255, 0.9)  /* Card/component background */
--color-surface-hover: rgba(255, 255, 255, 1)  /* Hover state */
--color-surface-light: #F3F4F6          /* Subtle backgrounds (skeletons, dividers) */
```

#### Borders
```css
--color-border: rgba(0, 0, 0, 0.1)      /* Primary borders */
--color-border-light: rgba(0, 0, 0, 0.05)  /* Subtle borders */
```

#### Text
```css
--color-text-primary: #111827            /* Headings, primary text */
--color-text-secondary: #6B7280         /* Body text, descriptions */
--color-text-tertiary: #9CA3AF          /* Helper text, placeholders */
```

#### Accent (Tiffany Blue)
```css
--color-accent: #0ABAB5                 /* Primary accent (buttons, links, focus) */
--color-accent-hover: #0BC5C0           /* Hover state */
--color-accent-light: rgba(10, 186, 181, 0.1)  /* Subtle accent backgrounds */
--color-secondary: rgba(10, 186, 181, 0.2)  /* Secondary accent */
```

#### Semantic Colors
```css
--color-success: #10b981                 /* Success states */
--color-success-light: rgba(16, 185, 129, 0.1)
--color-error: #ef4444                   /* Error states */
--color-error-light: rgba(239, 68, 68, 0.1)
--color-warning: #f59e0b                 /* Warning states */
--color-warning-light: rgba(245, 158, 11, 0.1)
```

### 1.2 Typography Scale

```css
/* Font sizes */
text-xs:    0.75rem  (12px)   /* Helper text, badges */
text-sm:    0.875rem (14px)   /* Secondary text, captions */
text-base:  1rem     (16px)   /* Body text (default) */
text-lg:    1.125rem (18px)   /* Subheadings */
text-xl:    1.25rem  (20px)   /* Section headings */
text-2xl:   1.5rem   (24px)   /* Page titles */
text-3xl:   1.875rem (30px)   /* Hero titles */

/* Font weights */
font-normal:  400  /* Body text */
font-medium:  500  /* Emphasis */
font-semibold: 600  /* Headings */
font-bold:    700  /* Strong emphasis */
```

### 1.3 Spacing Scale

```css
/* Padding/Margin scale (Tailwind) */
p-2:   0.5rem  (8px)   /* Tight spacing */
p-3:   0.75rem (12px)  /* Compact spacing */
p-4:   1rem    (16px)  /* Standard spacing */
p-6:   1.5rem  (24px)  /* Card padding */
p-8:   2rem    (32px)  /* Section spacing */

/* Gap scale */
gap-2:  0.5rem  (8px)
gap-3:  0.75rem (12px)
gap-4:  1rem    (16px)
gap-6:  1.5rem  (24px)
gap-8:  2rem    (32px)
```

### 1.4 Border Radius

```css
rounded-xs:  0.25rem  (4px)   /* Small elements */
rounded-sm:  0.375rem (6px)   /* Buttons, inputs */
rounded-md:  0.5rem   (8px)   /* Cards (small) */
rounded-lg:  0.75rem  (12px)  /* Cards (medium) */
rounded-xl:  1rem     (16px)  /* Cards (large), inputs */
rounded-2xl: 1.5rem   (24px)  /* GlassCard default */
rounded-full: 9999px           /* Pills, badges */
```

### 1.5 Shadows

```css
/* Minimal shadows (iOS26 style) */
shadow-sm:   0 1px 2px 0 rgba(0, 0, 0, 0.05)
shadow:      0 4px 16px 0 rgba(0, 0, 0, 0.08)  /* GlassCard default */
shadow-md:   0 8px 24px 0 rgba(0, 0, 0, 0.12)  /* Hover state */
```

---

## 2. Core Components

### 2.1 Layout Components

#### PageShell
**Purpose:** Consistent page container with responsive padding and max-width

**Usage:**
```tsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
  {children}
</div>
```

**Responsive:**
- Mobile: `px-4 py-6`
- Tablet: `px-6 py-6`
- Desktop: `px-8 py-8`, `max-w-7xl`

#### PageHeader
**Purpose:** Consistent page title, subtitle, and action buttons

**Usage:**
```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
  <div>
    <h1 className="text-3xl font-bold text-text-primary">{title}</h1>
    {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
  </div>
  {actions && <div className="flex gap-2">{actions}</div>}
</div>
```

### 2.2 Surface Components

#### GlassCard
**Location:** `@/components/ui/glass-card`
**Purpose:** Primary card component with glass morphism effect

**Props:**
- `hover?: boolean` - Enable hover effect
- `light?: boolean` - Use lighter glass variant
- Standard HTML div props

**Usage:**
```tsx
<GlassCard>
  <h3 className="text-lg font-semibold text-text-primary mb-4">Title</h3>
  <p className="text-sm text-text-secondary">Content</p>
</GlassCard>
```

**Styling:**
- Default: `rounded-2xl p-6`
- Light mode: Subtle backdrop blur, white background with border
- Hover: Slight elevation increase

### 2.3 Form Components

#### Input
**Location:** `@/components/ui/input`
**Purpose:** Text input with consistent styling

**Props:** Standard HTML input props

**Usage:**
```tsx
<Input type="text" placeholder="Enter text" />
```

**Styling:**
- Height: `h-11` (44px)
- Border radius: `rounded-xl`
- Focus: Tiffany accent ring

#### Textarea
**Location:** `@/components/ui/textarea`
**Purpose:** Multi-line text input

**Usage:**
```tsx
<Textarea rows={4} placeholder="Enter message" />
```

#### Select
**Location:** `@/components/ui/select`
**Purpose:** Dropdown select

**Usage:**
```tsx
<Select>
  <option value="option1">Option 1</option>
</Select>
```

#### FormField (Pattern)
**Purpose:** Consistent form field wrapper (label + input + helper + error)

**Usage Pattern:**
```tsx
<div>
  <label htmlFor="field" className="block text-sm font-medium text-text-secondary mb-1">
    Label <span className="text-red-400">*</span>
  </label>
  <Input id="field" {...register('field')} />
  {helper && <p className="mt-1 text-xs text-text-tertiary">{helper}</p>}
  {error && <p className="mt-1 text-sm text-red-400">{error.message}</p>}
</div>
```

### 2.4 Button

**Location:** `@/components/ui/button`
**Purpose:** Consistent button styling

**Variants:**
- `default` - Primary action (Tiffany accent)
- `outline` - Secondary action (border, transparent)
- `ghost` - Tertiary action (minimal)
- `glass` - Glass morphism style

**Sizes:**
- `sm` - `h-9 px-4 text-sm`
- `default` - `h-11 px-6 text-base`
- `lg` - `h-12 px-8 text-lg`
- `icon` - `h-10 w-10`

**Usage:**
```tsx
<Button variant="default" size="default">Primary Action</Button>
<Button variant="outline" size="sm">Secondary</Button>
<Button variant="ghost">Tertiary</Button>
```

### 2.5 Badge / StatusPill

**Purpose:** Status indicators, labels

**Usage Pattern:**
```tsx
<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
  Active
</span>
```

**Variants:**
- Success: `bg-green-100 text-green-800`
- Error: `bg-red-100 text-red-800`
- Warning: `bg-yellow-100 text-yellow-800`
- Info: `bg-blue-100 text-blue-800`
- Neutral: `bg-gray-100 text-gray-800`

### 2.6 DataTable

**Purpose:** Responsive table with mobile stacked view

**Desktop Pattern:**
```tsx
<GlassCard>
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-border">
      <thead>
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">
            Column
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {/* Rows */}
      </tbody>
    </table>
  </div>
</GlassCard>
```

**Mobile Pattern (Stacked Cards):**
```tsx
<div className="space-y-4 md:hidden">
  {items.map(item => (
    <GlassCard key={item.id} className="p-4">
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm font-medium text-text-primary">{item.name}</span>
          <span className="text-sm text-text-secondary">{item.value}</span>
        </div>
      </div>
    </GlassCard>
  ))}
</div>
```

### 2.7 EmptyState

**Location:** `@/src/components/retail/EmptyState`
**Purpose:** Consistent empty state with icon, title, description, CTA

**Usage:**
```tsx
<EmptyState
  icon={FileText}
  title="No templates found"
  description="Create your first template to get started"
  action={<Button>Create Template</Button>}
/>
```

### 2.8 Skeleton Loaders

**Purpose:** Loading placeholders

**Pattern:**
```tsx
<div className="space-y-4">
  {[1, 2, 3].map(i => (
    <GlassCard key={i}>
      <div className="h-20 bg-surface-light rounded animate-pulse" />
    </GlassCard>
  ))}
</div>
```

### 2.9 Toast / InlineAlert

**Toast:** Uses `sonner` library
```tsx
import { toast } from 'sonner';

toast.success('Success message');
toast.error('Error message');
```

**InlineAlert Pattern:**
```tsx
<div className="bg-red-50 border border-red-200 rounded-lg p-3">
  <p className="text-sm text-red-800">Error message</p>
</div>
```

---

## 3. Layout Rules

### 3.1 Page Structure

**Standard Layout:**
```
<RetailShell>
  <PageShell>
    <PageHeader />
    <Content />
  </PageShell>
</RetailShell>
```

### 3.2 Responsive Breakpoints

```css
/* Tailwind defaults */
sm:  640px   /* Tablet portrait */
md:  768px   /* Tablet landscape */
lg:  1024px  /* Desktop */
xl:  1280px  /* Large desktop */
2xl: 1536px  /* Extra large */
```

### 3.3 Grid Layouts

**KPI Cards:**
- Mobile: `grid-cols-1`
- Tablet: `grid-cols-2`
- Desktop: `grid-cols-4`

**Content Cards:**
- Mobile: `grid-cols-1`
- Tablet: `grid-cols-2`
- Desktop: `grid-cols-3` or `grid-cols-4`

**Two-Column Layout (when needed):**
- Mobile: Single column
- Desktop: `grid-cols-1 lg:grid-cols-2`

### 3.4 Spacing Rules

- **Section spacing:** `mb-6` or `space-y-6`
- **Card padding:** `p-6` (desktop), `p-4` (mobile)
- **Form field spacing:** `space-y-4` or `space-y-6`
- **Button groups:** `gap-2` or `gap-3`

### 3.5 Navigation Rules

- **Always clickable:** No disabled navigation items
- **No full-page overlays:** Loading states scoped to content area
- **Sticky actions on mobile:** Primary actions can be sticky at bottom when appropriate

---

## 4. Component Usage Guidelines

### 4.1 Buttons

- **Primary action:** `variant="default"` (Tiffany accent)
- **Secondary action:** `variant="outline"`
- **Tertiary action:** `variant="ghost"`
- **Destructive action:** `variant="outline"` with red styling

### 4.2 Forms

- **Required fields:** Show `*` in label
- **Error states:** Red text below field
- **Helper text:** Gray, smaller font
- **Disabled states:** `opacity-50 cursor-not-allowed`

### 4.3 Tables

- **Desktop:** Full table with horizontal scroll if needed
- **Mobile:** Stacked cards (hide table, show cards)
- **Pagination:** Bottom of table/cards

### 4.4 Cards

- **Consistent padding:** `p-6` (desktop), `p-4` (mobile)
- **Hover effects:** Only when interactive
- **Borders:** Subtle, `border-border`

### 4.5 Typography

- **Page titles:** `text-3xl font-bold`
- **Section headings:** `text-xl font-semibold` or `text-lg font-semibold`
- **Body text:** `text-base` or `text-sm`
- **Helper text:** `text-xs text-text-tertiary`

---

## 5. Responsive Patterns

### 5.1 Mobile-First Approach

Always design for mobile first, then enhance for larger screens:

```tsx
// Mobile: single column, full width
// Desktop: max-width, centered
<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
```

### 5.2 Hide/Show Patterns

```tsx
{/* Desktop table */}
<div className="hidden md:block">
  <table>...</table>
</div>

{/* Mobile cards */}
<div className="md:hidden">
  <div className="space-y-4">
    {/* Cards */}
  </div>
</div>
```

### 5.3 Sticky Actions

```tsx
{/* Mobile: sticky bottom */}
<div className="sticky bottom-0 bg-background border-t border-border p-4 md:static md:border-t-0 md:p-0">
  <Button className="w-full md:w-auto">Action</Button>
</div>
```

---

## 6. Accessibility

- **Focus rings:** Always visible, Tiffany accent
- **ARIA labels:** On icon-only buttons
- **Keyboard navigation:** All interactive elements accessible
- **Color contrast:** WCAG AA compliant
- **Screen readers:** Semantic HTML, proper headings

---

## 7. Implementation Checklist

When upgrading a page:

- [ ] Use PageShell for consistent container
- [ ] Use PageHeader for title/subtitle/actions
- [ ] Replace custom cards with GlassCard
- [ ] Use FormField pattern for all inputs
- [ ] Ensure responsive: mobile/tablet/desktop
- [ ] Add mobile stacked view for tables
- [ ] Use consistent spacing scale
- [ ] Apply proper typography scale
- [ ] Test focus states
- [ ] Verify no horizontal scroll (except tables)
- [ ] Check empty states
- [ ] Verify loading states
- [ ] Test error states

---

## 8. File Locations

### Components
- `@/components/ui/glass-card` - GlassCard
- `@/components/ui/button` - Button
- `@/components/ui/input` - Input
- `@/components/ui/textarea` - Textarea
- `@/components/ui/select` - Select
- `@/components/ui/dialog` - Dialog
- `@/src/components/retail/EmptyState` - EmptyState

### Styles
- `app/globals.css` - Theme tokens (Retail Light section)

---

## 9. Examples

See upgraded pages for reference implementations:
- `/app/retail/dashboard` - KPI grid, responsive cards
- `/app/retail/campaigns` - Table with mobile cards
- `/app/retail/templates` - Grid layout, filters
- `/app/retail/billing` - Card layout, responsive

