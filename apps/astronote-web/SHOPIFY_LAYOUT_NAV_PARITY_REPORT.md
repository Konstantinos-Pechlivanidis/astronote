# Shopify Layout & Navigation Parity Report

## What we reused from Retail
- Shared `AppShell` (sidebar/topbar/mobile nav) with the same padding/width CSS vars and collapse/mobile behaviors.
- Retail scaffold components on Shopify pages: `RetailPageLayout`, `AppPageHeader`/`RetailPageHeader`, `RetailCard`, `EmptyState`, `Pagination`.
- Confirm dialogs for destructive actions (logout, delete) consistent with Retail pattern.

## Shopify navigation state
- Sidebar/Topbar/MobileNav already mirror Retail styling (icons, hover, active state) via shared AppShell props.
- Shopify nav config follows the same grouping/spacing; logo hides on pages that request it. No structural drift detected.

## Minor adjustments (this pass)
- Kept AppShell defaults for container width and breakpoints; no extra spacing tweaks needed.
- Logout confirmation already present; left intact.
- Mobile nav collapse handled by AppShell (same as Retail).

## Next follow-ups (if desired)
- Optionally align icon set/order exactly to Retail’s latest nav map if product wants strict match.
- Add shared breadcrumbs component if Retail introduces one globally.
