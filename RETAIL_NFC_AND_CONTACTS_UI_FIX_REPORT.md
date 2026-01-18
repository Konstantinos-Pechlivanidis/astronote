Retail NFC & Contacts Fix Report
================================

TL;DR
- Added gender + birthday fields to the public join (/join/:token) form and payload; backend now validates/persists them.
- NFC/public join contacts are auto-added to a per-owner “NFC Leads” list (idempotent).
- Contacts table no longer shows email in rows.

What changed
- Backend:
  - apps/retail-api/apps/api/src/services/nfc.service.js: added default “NFC Leads” list helper + membership on NFC contact creation.
  - apps/retail-api/apps/api/src/routes/publicNfc.routes.js: add NFC submissions to the “NFC Leads” list (non-blocking).
  - apps/retail-api/apps/api/src/routes/publicJoin.routes.js: accept gender/birthday, validate, persist, and add contacts to the “NFC Leads” list.
- Frontend:
  - apps/astronote-web/app/(public)/join/[token]/JoinPageV2Client.tsx: form state + submission include gender/birthday.
  - apps/astronote-web/src/components/publicJoinV2/JoinFormCard.tsx: UI fields for gender select + birthday date input.
  - apps/astronote-web/src/features/publicJoin/i18n/enV2.ts & elV2.ts: labels for gender/birthday.
  - apps/astronote-web/src/features/publicJoin/hooks/useJoinSubmit.ts: payload includes gender/birthday.
  - apps/astronote-web/src/components/retail/contacts/ContactsTable.tsx: removed email column in table/cards.

Verification (manual)
- Navigate to /join/:token (public join):
  1) Form shows gender select + birthday input; submission succeeds with those fields filled or empty.
  2) Backend stores gender/birthday on contact (check via DB or contact detail).
  3) Contact appears in “NFC Leads” list (unique per owner, no duplicate membership on repeat submit).
- NFC public submit (/public/nfc/:token/submit):
  - Contact is created/updated and added to “NFC Leads” (listMembership createMany skipDuplicates).
- Contacts page:
  - Email is no longer displayed in the table or mobile cards; other fields remain.

Status checklist
- [x] gender+birthday visible on /join/:token
- [x] gender+birthday persisted in DB (join route upsert)
- [x] NFC/join contacts added to a default list (“NFC Leads”) idempotently
- [x] contacts table rows no longer show email
