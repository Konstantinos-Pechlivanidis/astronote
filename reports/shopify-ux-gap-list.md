# Shopify App UX Gap List (Audit → Plan)

Scope: `apps/astronote-web/app/app/shopify/**` (plus minimal supporting components/hooks) and Shopify API changes **only where needed for UX**.

## Executive summary

The Shopify app is already structurally close to “professional”, but a few gaps consistently show up across pages:

- **Guidance gaps**: users don’t clearly understand tokens, discounts, unsubscribe compliance, and **credits vs allowance**.
- **Consistency gaps**: pagination controls / URL query state patterns vary by page; some filters are not URL-stable.
- **Compose gaps**: Create Campaign needs clearer “what will be sent” preview (tokens + unsubscribe + encoding/segments).
- **Staleness gaps**: critical mutations generally invalidate correctly now, but “refresh affordances” and consistent skeleton/error patterns are not uniformly applied.

## Page-by-page gap list

### Dashboard (`app/app/shopify/dashboard/page.tsx`)
- **Missing**: concise inline explanation of “Available to send” = allowance + wallet.
- **Missing**: a small “Refresh” affordance (even though refetch works).
- **Plan**: add a compact help blurb + refresh icon that calls `refetch()` (no behavior change).

### Campaigns list (`app/app/shopify/campaigns/page.tsx`)
- **Gap**: pagination exists but is page-local; filters/search not guaranteed to round-trip via URL query consistently.
- **Gap**: page-size selector missing.
- **Gap**: empty-state guidance could be richer (“Create your first campaign” CTA).
- **Plan**: unify pagination/URL sync pattern, add page-size selector, keep existing “Showing X–Y of Z”.

### Campaign create (`app/app/shopify/campaigns/new/page.tsx`)
- **Gap**: preview currently doesn’t show the **unsubscribe short link** that will be appended.
- **Gap**: segment estimate is simplistic (160-char); doesn’t show GSM-7 vs UCS-2.
- **Gap**: personalization token insertion is manual (typing).
- **Plan**: live preview with appended unsubscribe short link (example), encoding+segments estimation, token inserter buttons, and a compact “SMS Help” panel.

### Campaign detail (`app/app/shopify/campaigns/[id]/page.tsx`)
- **Gap**: scheduled vs draft legacy data may show wrong badge without compat logic.
- **Plan**: normalize display: draft+scheduleAt+scheduled => Scheduled (already implemented).

### Contacts list (`app/app/shopify/contacts/page.tsx`)
- **Gap**: pagination + debounce exist; URL state not persisted (page/filter/search).
- **Gap**: “Export” is page-limited (exports only current page).
- **Plan**: unify URL pagination pattern; (optional follow-up) backend export endpoint for full filtered export.

### Templates list (`app/app/shopify/templates/page.tsx`)
- **Gap**: pagination exists; URL state not persisted (category/search/page/favorites).
- **Gap**: page-size selector missing.
- **Plan**: unify URL pagination pattern; optional page-size selector.

### Billing (`app/app/shopify/billing/page.tsx`)
- **Gap**: user clarity around credits/allowance could be even more explicit inline.
- **Gap**: invoices pagination is local state; not in URL.
- **Plan**: expand help copy and keep invoice pagination consistent with other pages.

## Cross-cutting improvements (priority order)

1. **System-owned unsubscribe short links**: always append `Unsubscribe: https://<web>/r/<token>` (DB-backed mapping).
2. **Compose clarity**: preview shows what will be sent (tokens + unsubscribe), plus GSM-7/UCS-2 and segment count.
3. **Pagination pattern**: consistent controls + URL query state persistence for list pages.
4. **Loading/errors**: consistent skeleton + retry button patterns.


