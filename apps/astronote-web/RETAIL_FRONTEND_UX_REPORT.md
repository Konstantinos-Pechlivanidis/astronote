# Retail Frontend UX Updates

- Campaign create: removed discount code UI, kept only supported variables (firstName, lastName), English help text, and mobile edit/preview tabs stay in editor by default. Enqueue errors now surface queue/schema drift messages; success invalidates campaigns list/detail/status, KPIs, balance, billing summary/history, and invoices.
- Billing: microcopy now English; portal already opens in a new tab; success guard shows clear placeholder message. No UI for invoice/receipt preference added because the backend does not expose that field yet.
- Contacts: opt-in defaults on, helper text translated. NFC public form now collects birthday + gender, uses English copy, and keeps consent on; payload sends optional birthday/gender.
- Layout/auth: retail sidebar/topbar/mobile nav use logo and English logout confirmations; auth pages already had black/star background and remain unchanged.

## Mutation → Invalidation map
- Campaign enqueue: `['retail','campaigns','detail',id]`, `['retail','campaigns','list']`, `['retail','campaigns','status',id]`, `['retail-kpis']`, `['retail-balance']`, `['retail-billing-summary']`, `['retail-billing-history']`, `['retail-billing-invoices']`.
- Create/update contact: `['retail','contacts','list']`.
- Billing (subscribe/topup/verify/finalize) unchanged in this pass; portal opens new tab only.

## Not changed (requires backend support)
- Invoice/receipt preference UI is deferred; needs BillingProfile.documentPreference + InvoiceRecord.documentType exposed by the API before adding controls.
- NFC creates contacts via public endpoint; list freshness still relies on standard fetch (no live push).

## Manual verification (suggested)
1) Create campaign on mobile: edit tab stays visible; insert {{firstName}}/{{lastName}} via chips; preview tab works.  
2) Enqueue campaign with/without credits: see clear toast (INSUFFICIENT_CREDITS or queue unavailable), no double submit, status/metrics refresh.  
3) Billing portal: “Manage payment method” opens in new tab; success page shows English messages and blocks placeholder session_id.  
4) Contacts: new contact defaults to opted-in; helper text English; birthday/gender render in table/card views.  
5) NFC public form: submit with birthday/gender + consent; success message in English; new contact appears after reloading contacts list.  
6) Logout from sidebar/topbar/mobile nav: confirmation dialog appears; cancel keeps session, confirm signs out.  

