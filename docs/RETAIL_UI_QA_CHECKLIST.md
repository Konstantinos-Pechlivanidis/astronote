# Retail UI QA Checklist

## Overview

This checklist ensures all Retail pages meet the iOS26-minimal LIGHT design system standards with full responsiveness and consistent UX patterns.

**Testing Breakpoints:**
- Mobile: 360px width
- Tablet: 768px width
- Desktop: 1440px width

---

## 1. Spacing Rules

### Padding/Margins
- [ ] **Page container:** `px-4 sm:px-6 lg:px-8 py-6 lg:py-8`
- [ ] **Card padding:** `p-6` (desktop), `p-4` (mobile)
- [ ] **Section spacing:** `space-y-6` or `mb-6`
- [ ] **Form field spacing:** `space-y-4` or `space-y-6`
- [ ] **Button groups:** `gap-2` or `gap-3`

### Grid Gaps
- [ ] **KPI cards:** `gap-4 sm:gap-6`
- [ ] **Content cards:** `gap-4 sm:gap-6`
- [ ] **Form grids:** `gap-4`

---

## 2. Typography Scale

### Headings
- [ ] **Page title:** `text-3xl font-bold text-text-primary`
- [ ] **Section heading:** `text-lg font-semibold text-text-primary` or `text-xl font-semibold`
- [ ] **Card title:** `text-lg font-semibold text-text-primary`

### Body Text
- [ ] **Primary text:** `text-sm text-text-primary` or `text-base text-text-primary`
- [ ] **Secondary text:** `text-sm text-text-secondary`
- [ ] **Helper text:** `text-xs text-text-tertiary`
- [ ] **Error text:** `text-sm text-red-400`

### Readability
- [ ] Minimum font size: 14px for body text
- [ ] Line height: Adequate spacing (default Tailwind)
- [ ] Text contrast: WCAG AA compliant

---

## 3. Card/Table Rules

### Cards
- [ ] **Use RetailCard component** (not GlassCard directly)
- [ ] **Border:** `border border-border` (visible contrast)
- [ ] **Background:** `bg-surface` (solid white, not transparent)
- [ ] **Border radius:** `rounded-2xl` (24px)
- [ ] **Shadow:** Subtle but visible (`shadow` class)
- [ ] **Hover state:** Slight elevation increase

### Tables
- [ ] **Desktop:** Full table with `bg-surface-light` header
- [ ] **Mobile:** Stacked cards (`hidden md:block` for table, `md:hidden` for cards)
- [ ] **Row hover:** `hover:bg-surface` (subtle gray)
- [ ] **Borders:** `divide-y divide-border` (visible separators)
- [ ] **Header:** `text-xs font-medium text-text-secondary uppercase`

### Empty States
- [ ] **Use EmptyState component**
- [ ] **Icon + title + description**
- [ ] **Optional CTA button**

---

## 4. Button Sizes & States

### Sizes
- [ ] **Default:** `h-11` (44px) - touch-friendly
- [ ] **Small:** `h-9` (36px)
- [ ] **Large:** `h-12` (48px)
- [ ] **Icon-only:** `h-10 w-10` (40×40px minimum)

### Variants
- [ ] **Primary:** Tiffany accent (`bg-accent text-white`)
- [ ] **Secondary:** `variant="outline"` (border, transparent)
- [ ] **Tertiary:** `variant="ghost"` (minimal)
- [ ] **Destructive:** Red styling for delete actions

### States
- [ ] **Hover:** Visible state change
- [ ] **Disabled:** `opacity-50 cursor-not-allowed`
- [ ] **Loading:** Spinner or text change
- [ ] **Focus:** Tiffany ring visible

---

## 5. Breakpoints Behavior

### Mobile (360px)
- [ ] **No horizontal overflow** (test with DevTools)
- [ ] **Single column layouts** (grid-cols-1)
- [ ] **Full-width buttons** (`w-full sm:w-auto`)
- [ ] **Stacked form fields**
- [ ] **Cards instead of tables**
- [ ] **Touch targets:** Minimum 44×44px

### Tablet (768px)
- [ ] **2-column grids** where appropriate (`sm:grid-cols-2`)
- [ ] **Tables visible** (`md:block`)
- [ ] **Buttons auto-width** (`sm:w-auto`)
- [ ] **Side-by-side form fields** where appropriate

### Desktop (1440px)
- [ ] **4-column KPI grids** (`lg:grid-cols-4`)
- [ ] **3-column content grids** (`lg:grid-cols-3`)
- [ ] **Max-width container** (`max-w-7xl mx-auto`)
- [ ] **Optimal whitespace**

---

## 6. Color Token Usage

### Backgrounds
- [ ] **Page background:** `bg-background` (#FFFFFF)
- [ ] **Card background:** `bg-surface` (solid white)
- [ ] **Subtle background:** `bg-surface-light` (#F3F4F6)
- [ ] **Hover background:** `bg-surface-hover` (#FAFBFC)

### Borders
- [ ] **Primary border:** `border-border` (rgba(0,0,0,0.12))
- [ ] **Light border:** `border-border-light` (rgba(0,0,0,0.08))
- [ ] **Visible contrast** between cards and background

### Text
- [ ] **Primary:** `text-text-primary` (#111827)
- [ ] **Secondary:** `text-text-secondary` (#4B5563)
- [ ] **Tertiary:** `text-text-tertiary` (#6B7280)
- [ ] **Muted:** `text-text-muted` (#9CA3AF)

### Accent
- [ ] **Primary actions:** `text-accent` or `bg-accent` (#0ABAB5)
- [ ] **Links:** `text-accent` with hover state
- [ ] **Focus rings:** Tiffany accent

### Semantic Colors
- [ ] **Success:** `text-green-400` or `bg-green-100`
- [ ] **Error:** `text-red-400` or `bg-red-100`
- [ ] **Warning:** `text-yellow-400` or `bg-yellow-100`
- [ ] **Info:** `text-blue-400` or `bg-blue-100`

---

## 7. Component Usage

### Layout Components
- [ ] **RetailPageLayout:** Used for consistent container
- [ ] **RetailPageHeader:** Used for title/subtitle/actions
- [ ] **RetailSection:** Used for section grouping

### Surface Components
- [ ] **RetailCard:** Used instead of GlassCard
- [ ] **Variants:** `default`, `subtle`, `danger`, `info` as needed

### Form Components
- [ ] **RetailFormField:** Used for consistent form fields
- [ ] **Input/Textarea/Select:** Use UI components
- [ ] **Error states:** Red text below field
- [ ] **Helper text:** Gray, smaller font

### Data Components
- [ ] **RetailDataTable:** Used for tables (if applicable)
- [ ] **EmptyState:** Used for empty states
- [ ] **Skeleton loaders:** Match layout structure

### Navigation
- [ ] **All nav items clickable** (no disabled divs)
- [ ] **No full-page overlays** blocking navigation
- [ ] **Loading states scoped** to content area

---

## 8. Responsive Testing Checklist

### Mobile (360px)
- [ ] No horizontal scroll
- [ ] All text readable (min 14px)
- [ ] Buttons touch-friendly (min 44×44px)
- [ ] Forms usable
- [ ] Tables stack to cards
- [ ] Navigation accessible

### Tablet (768px)
- [ ] Proper grid layouts (2-column)
- [ ] Tables visible
- [ ] Better use of space
- [ ] No layout breaks

### Desktop (1440px)
- [ ] Optimal grid layouts (3-4 columns)
- [ ] Max-width prevents over-stretching
- [ ] Balanced whitespace
- [ ] All features accessible

---

## 9. Accessibility

- [ ] **Focus rings:** Visible (Tiffany accent)
- [ ] **ARIA labels:** On icon-only buttons
- [ ] **Keyboard navigation:** All interactive elements accessible
- [ ] **Color contrast:** WCAG AA compliant
- [ ] **Screen readers:** Semantic HTML, proper headings

---

## 10. Error & Loading States

### Error States
- [ ] **Inline error cards** (don't block navigation)
- [ ] **Retry button** available
- [ ] **Error message** clear and actionable
- [ ] **Red styling** for errors

### Loading States
- [ ] **Skeleton loaders** match layout
- [ ] **No full-page overlays**
- [ ] **Navigation remains accessible**
- [ ] **Loading text** where appropriate

---

## Page-Specific Checklist

### Auth Pages
- [ ] Centered card layout
- [ ] Full-width on mobile
- [ ] Show/hide password toggle
- [ ] Error messages visible
- [ ] Form validation working

### Dashboard
- [ ] KPI grid: 1-col mobile, 2-col tablet, 4-col desktop
- [ ] Action buttons accessible
- [ ] Error state doesn't block navigation
- [ ] Credits card visible

### Campaigns
- [ ] List table responsive
- [ ] Create form multi-step
- [ ] Detail view clear
- [ ] Stats cards responsive

### Contacts
- [ ] Table stacks to cards on mobile
- [ ] Search/filter accessible
- [ ] Import flow clear

### Templates
- [ ] Grid/cards responsive
- [ ] Search + filters working
- [ ] Copy functionality clear

### Automations
- [ ] Toggle visible in light mode
- [ ] Cards responsive
- [ ] Billing gate banner clear

### Billing
- [ ] Cards responsive
- [ ] Package grid responsive
- [ ] Transaction table responsive

### Settings
- [ ] Form sections clear
- [ ] Responsive layout
- [ ] Save buttons accessible

### Public Pages
- [ ] Mobile-first
- [ ] Clear CTAs
- [ ] Compliance-friendly

---

## Validation Steps

1. **Open page in browser**
2. **Test at 360px, 768px, 1440px** (DevTools responsive mode)
3. **Check spacing** (use DevTools element inspector)
4. **Verify colors** (check CSS variables)
5. **Test interactions** (hover, focus, click)
6. **Check accessibility** (keyboard navigation, screen reader)
7. **Verify error states** (simulate API errors)
8. **Test loading states** (slow network)

---

## Notes

- **Consistency first:** One system, reused everywhere
- **Better contrast:** Surfaces clearly separated from background
- **Preserve behavior:** Don't break flows or validations
- **No big redesign:** Refine and standardize existing patterns

