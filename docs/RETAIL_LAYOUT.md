# Retail Layout Contract

This document defines the shared layout and navigation contract for the Retail app routes
under `app/(retail)/app/retail/*`.

## Layout Mount
- `apps/astronote-web/app/(retail)/app/retail/layout.tsx`
  - Wraps retail pages with `RetailAuthGuard` and the new shell:
    `src/components/retail/layout/RetailShell.tsx`

## Shell Components
- `src/components/retail/layout/RetailShell.tsx`
  - Desktop: fixed sidebar + top bar + content.
  - Mobile: top bar + bottom nav + “More” dialog.
- `src/components/retail/layout/RetailSidebar.tsx`
  - Desktop navigation (primary + secondary).
- `src/components/retail/layout/RetailTopBar.tsx`
  - Displays active section title and optional actions slot.
- `src/components/retail/layout/RetailMobileNav.tsx`
  - Bottom nav for primary items and “More” dialog for secondary items.

## Navigation Source of Truth
- `src/components/retail/layout/retailNav.ts`
  - Primary items: Dashboard, Campaigns, Contacts, Templates, Settings.
  - Secondary items: Automations, Billing, NFC / Join Page.
  - Update `match` and `exact` for active state correctness.

## Page Header & Actions
- Retail pages should continue using `RetailPageHeader` for page-level titles and actions.
- If a page needs actions in the top bar, extend `RetailTopBar` props and pass actions
  from `RetailShell` when a dedicated pattern is established.

## Adding a New Nav Item
1) Add an entry in `retailNav.ts`:
   - `id`, `label`, `href`, `icon`, and `match`.
2) If it should appear in mobile bottom tabs, set `mobile: 'primary'`.
3) For secondary-only items, use `mobile: 'secondary'` so it shows under “More.”

## Public vs App Shell Routes
- Public pages (e.g. `/join/[token]`, `/o/[trackingId]`, `/unsubscribe/[token]`) are not
  under the Retail app layout and should not import the Retail shell.
- Only routes under `app/(retail)/app/retail/*` use the retail shell.
