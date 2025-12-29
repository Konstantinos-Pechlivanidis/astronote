Phase 0 — Repo, κανόνες, ποιότητα (foundation)

P0.1 Create monorepo structure

apps/web, apps/api, packages/shared, docs/*, tasks/*
Done: τρέχει dev scripts, έχει καθαρή δομή.

P0.2 Add Cursor rules / AGENTS.md

conventions, folder structure, “1 task = 1 PR”, definition-of-done
Done: ο Cursor έχει σαφείς κανόνες.

P0.3 Add Biome + scripts + pre-commit

format, lint, check
Done: format/lint περνάει αυτόματα.

P0.4 Add local dev env (optional)

docker compose για local Postgres/Redis (αν θες)
Done: local run χωρίς να εξαρτάσαι από cloud.

Phase 1 — Shopify App install + Store connect (multi-tenant)

P1.1 Create Shopify app skeleton (embedded)

install flow, OAuth, scopes
Done: μπορεί να εγκατασταθεί σε store.

P1.2 Persist store + session

γράφει stores + shopify_sessions
Done: μετά το install, υπάρχει store record.

P1.3 Auth for web app “login via store”

store-scoped session + προστασία endpoints
Done: ο χρήστης βλέπει web app μόνο για το δικό του store.

Phase 2 — Opt-in banner extension → δημιουργία contact

P2.1 Theme app extension: Banner UI + fields

First name, Last name, DOB, Phone (E.164 + country code mandatory)
Done: banner εμφανίζεται και κάνει submit.

P2.2 Public API: POST /api/public/optin

validate input, create contact, create opt_in_event
Done: contact εμφανίζεται στη βάση με store_id.

P2.3 Basic unsubscribe suppression logic (DB level)

αν contact is_subscribed=false → μην ξαναγράφεις opt-in χωρίς explicit re-consent
Done: σωστό handling.

Phase 3 — Contacts & Lists (web app)

P3.1 Contacts list UI + search
Done: βρίσκεις contacts με phone/name.

P3.2 Create Lists + add/remove members
Done: λίστες λειτουργούν.

P3.3 Segments (rules_json) – MVP

απλό segment: “subscribed contacts only”, “created last 30 days”
Done: segment επιστρέφει σωστό audience.

Phase 4 — Mitto campaigns (bulk send) + status sync

P4.1 Mitto client module (server)

bulk send endpoint wrapper (με X-Mitto-API-Key από encrypted storage)
Done: μπορείς να κάνεις send bulk.

P4.2 Campaign create/send flow

campaigns + create outbound_messages rows per recipient

call Mitto bulk → store mitto_bulk_id + each mitto_message_id
Done: campaign στέλνει και αποθηκεύει message IDs.

P4.3 Status polling job

queue worker: GET message details by messageId → update delivery_status
Done: statuses ενημερώνονται.

Phase 5 — Short links + Unsubscribe page (compliance)

P5.1 Short link generator

table short_links + route /l/:code (click redirect)
Done: clicks καταγράφονται σε link_clicks.

P5.2 Unsubscribe link per message

generate unique unsubscribe link (per contact/message)

landing page /unsubscribe/:code
Done: sets contact unsubscribed + stores event.

Phase 6 — Shopify Discount Codes sync

P6.1 Shopify Admin API: list discount codes / price rules

sync to discount_codes_cache
Done: UI μπορεί να εμφανίζει διαθέσιμους κωδικούς.

P6.2 Banner uses discount code (optional MVP)

after opt-in → show code / apply logic
Done: επιβεβαιώνεται στο UI.

Phase 7 — Automations engine (Welcome / Abandoned Checkout / Post-purchase)

P7.1 Automation CRUD (web app)

enable/disable, message template, sender, delay
Done: automations αποθηκεύονται.

P7.2 Shopify webhooks ingestion

orders/create, checkouts/update (ή ό,τι επιλέξεις) → store raw_json
Done: events μπαίνουν DB.

P7.3 Scheduler (delay + conditions)

π.χ. abandoned: μετά από 30’ ελέγχει “still not completed” → send 1 message
Done: runs σωστά με automation_runs.

P7.4 Automation send + Mitto single send

δημιουργεί outbound_message + messageId + status updates
Done: end-to-end automation messaging.

Phase 8 — Stripe billing + Credits

P8.1 Plans + subscription enforcement

monthly (40€, 100 credits), yearly (240€, 500 credits)

send allowed only if subscription active
Done: δεν στέλνει χωρίς ενεργό plan.

P8.2 Credits ledger

grant credits on subscription start

purchase credits (0.045€/credit)

spend credits per message parts
Done: balance σωστό, audit trail πλήρες.

P8.3 Stripe webhooks

subscription status changes, payments
Done: αξιόπιστο billing state.

Phase 9 — Analytics & Dashboard (merchant)

P9.1 Campaign metrics API

sent/delivered/failed, cost credits
Done: dashboard δείχνει σωστά KPIs.

P9.2 Click metrics & “value” mapping (MVP)

clicks per campaign + basic attribution
Done: initial ROI-style view (θα βελτιωθεί αργότερα).

Phase 10 — Admin dashboard (εσύ)

P10.1 Admin auth + admin views

stores list, revenue, credits, payments history, message volume
Done: “να ξέρω τι γίνεται κάθε στιγμή”.

P10.2 Audit logs & security hardening

encrypt secrets, rate limits, webhook verification
Done: production-ready.