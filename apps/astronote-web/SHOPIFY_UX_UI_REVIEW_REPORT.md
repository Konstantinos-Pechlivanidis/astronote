# Shopify UX/UI Review (Layout + Key Fixes)

- Layout uses shared `AppShell` (sidebar/topbar/mobile nav) with retail spacing/containers; no structural change needed for parity.
- Shopify auth login now matches retail/landing atmosphere (black + Tiffany starfield background) while keeping existing card/form.
- Campaign create (Shopify) gains mobile Edit/Preview tabs so the composer stays primary on mobile; preview moves to its own tab and remains sticky on desktop. Variable chips and help stay inline.
- Contact create defaults SMS consent to opted-in with a brief consent note; edit flow unchanged.
- Logout confirmation already present in sidebar/topbar; left as-is.
- Web lint/build pass (warnings only on pre-existing `<img>`/`console`).

## Page Notes
- **Auth Login**: Added starfield overlay on dark background; no flow changes.
- **Campaigns → New**: Mobile tabs (`edit`/`preview`), editor not trapped by preview, buttons still disable while pending; preview/help unchanged on desktop.
- **Contacts → New**: `smsConsent` defaults to `opted_in`; hint added under selector.
- **Navigation/Spacing**: Shopify shell already aligns with retail AppShell paddings and breakpoints.

## How to Test (manual)
1. Open `/app/shopify/campaigns/new` on mobile width: edit tab visible, textarea doesn’t jump into preview; switch to Preview tab to view phone render.
2. Send/draft/schedule buttons stay disabled while pending; no double-submit.
3. `/app/shopify/auth/login`: dark + starfield background, form readable.
4. `/app/shopify/contacts/new`: SMS consent pre-selected to Opted In; can change if needed.
5. Logout from sidebar/topbar: confirmation dialog appears; cancel keeps session.
