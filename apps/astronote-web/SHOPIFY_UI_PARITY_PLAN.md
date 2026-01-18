# Shopify UI Parity Plan (vs Retail)

## Retail primitives to reuse
- **Layout shell:** `AppShell` with sidebar/topbar/mobile nav, shared padding via CSS vars.
- **Page scaffold:** `RetailPageLayout`, `RetailPageHeader`/`AppPageHeader`, `RetailCard`, `EmptyState`, `Pagination`, skeletons.
- **Action patterns:** primary actions top-right, destructive actions confirmed, buttons disabled while pending with spinner.
- **Lists/tables:** desktop table + mobile cards, paginated, clear empty states.
- **Forms:** sectioned cards, inline validation, concise helper text.
- **Billing/campaign helpers:** variable chips, unsubscribe note, preview side-by-side on desktop.

## Shopify pages in scope
- Layout/nav: `app/app/shopify/layout.tsx`, `_components` (Sidebar, Topbar, MobileNav, NavList).
- Dashboard, Contacts (list/new/edit), Campaigns (list/new/detail/status), Automations, Templates, Settings/Billing, Auth login.

## Done criteria
- Shopify shell matches Retail spacing/behavior (desktop + mobile).
- All Shopify pages use Retail page scaffold (headers, cards, sections, empty/skeleton, pagination where applicable).
- Forms and mutations show inline validation and disable while pending.
- Campaign create uses editor-first mobile layout with preview tab and helper panel; no double-submit.
- Auth login uses dark/starfield backdrop like Retail/landing.
- Contacts create defaults SMS consent to opt-in with hint.
- Lint/build green. No backend changes required; headers remain via Shopify axios interceptor.
