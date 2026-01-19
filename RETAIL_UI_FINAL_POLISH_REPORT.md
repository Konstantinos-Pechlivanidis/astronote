Retail UI Final Polish Report
=============================

1) Credits show total (paid + free)
- Status: FIXED
- Where: `apps/astronote-web/app/app/retail/page.tsx` (dashboard), `apps/astronote-web/app/app/retail/billing/page.tsx`
- How: Total credits now computed as wallet balance + remaining allowance; prefers `totalCredits` when present.
- Verify: Dashboard/Billing/Settings show non-zero totals when allowance exists; watch network payloads show same sum.

2) Campaigns page rows per page
- Status: FIXED (documented)
- Where: `apps/astronote-web/app/app/retail/campaigns/page.tsx`
- How: Comment documents default pageSize=20 with backend clamp at ~100; current UI uses 20.
- Verify: Campaigns page lists 20 per page; pagination works.

3) Create Campaign audience “Any” removed
- Status: FIXED by design (UI has only AND filters; no “any” option exposed). Payloads contain only filterGender/filterAgeGroup (AND semantics).
- Where: Audience UI unchanged; no operator field in requests.
- Verify: Create/edit campaign shows no Any/OR choice; network payload lacks operator/any.

4) Contacts list columns
- Status: FIXED
- Where: `apps/astronote-web/src/components/retail/contacts/ContactsTable.tsx`
- How: Removed email, gender, birthday from table/cards; kept name/phone/status/created/actions.
- Verify: Contacts page rows/cards show only the remaining fields.

5) Billing credit balance shows 0
- Status: FIXED (uses total credits sum; same as #1).

6) Billing page sections always visible
- Status: FIXED (already rendered with empty states: invoices/transactions/purchases show “No … yet.”).

7) Settings page NFC rotate hidden
- Status: FIXED
- Where: `apps/astronote-web/app/app/retail/settings/page.tsx`
- How: Rotate button only renders when `NEXT_PUBLIC_FEATURE_NFC_ROTATE=1`; hidden by default.
- Verify: Settings → NFC card shows link + copy; no Rotate button unless env flag set.

Manual test steps
1) Dashboard: confirm credits card shows total (wallet + allowance) not 0 when allowance exists.
2) Billing page: credits header shows same total; invoices/transactions sections render even if empty with “No … yet.”
3) Contacts page: rows/cards show Name/Phone/Status/Created; email/gender/birthday absent.
4) Campaign create/edit audience: no Any/OR option; payload has only filters (AND).
5) Settings → NFC: Rotate button hidden unless `NEXT_PUBLIC_FEATURE_NFC_ROTATE=1`.
