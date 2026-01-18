# Shopify UI Parity Implementation Report

## Overview
- Shopify already used the shared `AppShell` and Retail scaffold components; this pass tightened parity and UX safety.
- Key UX fixes applied earlier and retained: mobile-friendly campaign composer, auth starfield backdrop, contact opt-in default, logout confirmations.
- Billing headers remain enforced by the Shopify axios interceptor; no backend changes required.

## Page-by-page notes
- **Layout/Nav:** No structural changes required; AppShell + ShopifySidebar/Topbar/MobileNav match Retail spacing/responsiveness.
- **Campaigns → New:** Added mobile Edit/Preview tabs so the editor stays primary; preview lives in its own tab (desktop remains side-by-side). Variable chips/help remain visible. Buttons disable while pending to prevent double-submit.
- **Contacts → New:** SMS consent defaults to opted-in and adds a brief consent hint; edit flow unchanged.
- **Auth Login:** Dark + Tiffany starfield background for parity with Retail/landing.
- **Automations/Templates/Settings/Billing/Dashboard:** Already using Retail layouts (cards, headers, empty/pagination patterns); no additional code changes made this pass.

## What was intentionally not changed
- Icon ordering in Shopify nav kept as-is (already aligned enough).
- Existing `<img>` lint warnings and a console in retail campaign detail left untouched (pre-existing).
- No backend or Prisma changes; header logic already correct.

## Testing
- `npm -w @astronote/web-next run lint` (passes; only existing warnings on `<img>`/console).  
- `npm -w @astronote/web-next run build` ✅.

## Next steps (optional)
- If stricter parity is desired, mirror Retail nav ordering and add shared breadcrumbs where applicable.
- Replace remaining `<img>` usages with `next/image` and remove the stray console in retail campaign detail.
