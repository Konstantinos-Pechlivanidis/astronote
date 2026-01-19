Retail Final UI Parity Report
=============================

What was wrong
- Dashboard/Settings showed 0 credits while Billing showed the correct balance.
- Audience section still surfaced “Any” in campaign detail/review placeholders.
- Contacts list needed to hide email/gender/birthday.
- Settings page should hide NFC rotate control by default.
- Needed explicit note on campaigns page pageSize.

Changes (files)
- Credits normalization:
  - apps/astronote-web/src/features/retail/billing/hooks/useBillingGate.ts (uses totalCredits = wallet + allowance)
  - apps/astronote-web/app/app/retail/dashboard/page.tsx (uses totalCredits)
  - apps/astronote-web/app/app/retail/page.tsx (already adjusted to sum wallet+allowance)
  - apps/astronote-web/app/app/retail/billing/page.tsx (already using total)
- Audience “Any” removed from retail detail/review:
  - apps/astronote-web/app/app/retail/campaigns/[id]/page.tsx (displays “All” when no filter)
  - apps/astronote-web/app/app/retail/campaigns/[id]/edit/page.tsx (placeholders now “All”; comment clarifies filters mean All)
- Contacts columns already trimmed (email/gender/birthday removed) in ContactsTable (unchanged in this pass).
- Settings NFC rotate hidden unless NEXT_PUBLIC_FEATURE_NFC_ROTATE=1 (already in place).
- Campaigns page pageSize documented (20 default, backend clamp ~100) in page.tsx comment.

Manual verification
1) Dashboard: credits card matches Billing total (wallet + remaining allowance) when allowance exists.
2) Settings → Billing card shows same credits total as Billing page.
3) Contacts page rows/cards show only Name/Phone/Status/Created.
4) Campaign detail/review “Audience Filters” shows “All” when no filter; edit page placeholders say “All”; no “Any/OR” UI.
5) Settings → NFC card: Rotate button hidden unless NEXT_PUBLIC_FEATURE_NFC_ROTATE=1.
6) Campaigns list shows 20 rows per page (default); backend clamps to ~100.

No commits were made.
