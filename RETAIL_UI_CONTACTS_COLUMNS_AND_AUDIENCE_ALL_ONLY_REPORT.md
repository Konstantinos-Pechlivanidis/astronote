Retail UI – Contacts Columns & Audience “All Only” Report
========================================================

DONE/NOT DONE
- [x] Contacts rows do not show email/gender/birthday (desktop + mobile cards).
- [x] Audience filter shows only “All” (AND); “Any” is not exposed.
- [x] UI never sends operator=any (no operator field; filters normalize to AND-only).

What changed
- apps/astronote-web/src/components/retail/contacts/ContactsTable.tsx: removed email, gender, birthday columns from desktop table and mobile cards; kept name/phone/status/created/actions.

Audience notes
- Retail campaign filters only include gender/age/list; there is no operator field in the request schema. UI already behaves as AND-only. No UI element for “Any” exists, and payloads do not include an operator key; thus the UI cannot send `any`. Saved drafts with a hypothetical `any` would be normalized by absence (backend treats missing operator as AND).

Manual test steps
1) Go to Retail → Contacts: verify table shows columns Name, Phone, Status, Created, Actions (no email/gender/birthday); mobile cards also omit them.
2) Campaign create/edit audience section: confirm there is no “Any/OR” selector; filters behave as AND. Save a campaign and inspect network payload (only filterGender/filterAgeGroup, no operator).
