# Retail Campaign Mobile UX Report

## Changes
- Campaign creation (Step 1) now uses mobile tabs (Edit / Preview). Textarea stays in view on mobile; preview is accessible via the Preview tab. Desktop keeps side-by-side layout.
- Added variable/help panel with quick insert chips: `{{firstName}}`, `{{lastName}}`, `{{discountCode}}`, plus notes on auto unsubscribe shortlink, discount code, and GSM length awareness.
- Message field supports cursor insertion for variables.
- Logout now prompts for confirmation (Greek copy) in retail sidebar.
- Retail auth (login/register) pages now use black + Tiffany starfield background for consistency with landing while keeping forms readable.
- Contact create/edit form shows SMS opt-in toggle (default ON for new contacts) with microcopy about marketing permission.

## How to test
1) Mobile create campaign: open Step 1 on mobile width; textarea focus does not jump to preview, toggle Preview tab to view phone preview, insert variables via chips; counts still visible.
2) Send button: stays disabled/loading while pending (existing behavior maintained).
3) Logout: click Sign Out → confirmation modal (Αποσύνδεση); cancel keeps session; confirm logs out.
4) Auth pages: login/register show black/starfield background; forms readable on mobile/desktop.
5) Contacts: Add contact shows “Subscribed to SMS” checked by default with opt-in note; edit contact preserves current value and can be unchecked.
