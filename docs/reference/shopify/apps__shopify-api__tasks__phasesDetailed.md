Προτεινόμενη δομή repo (στόχος Phase 0)
apps/
  api/          # Express API (TS)
  web/          # Admin UI (React)
  worker/       # BullMQ workers (TS)
packages/
  shared/       # Zod schemas, types, utils
docs/
  01-prd/
  02-flows/
  03-architecture/
  04-data/
tasks/
  PHASES_DETAILED.md

PHASE 0 — Foundation (Repo, tooling, rules, env)
P0.1 — Init monorepo + workspace

Στόχος: να τρέχει monorepo με κοινά scripts.
Files:

package.json (root)

pnpm-workspace.yaml

apps/api/package.json, apps/web/package.json, apps/worker/package.json

packages/shared/package.json
Steps:

Στήσε pnpm workspace.

Πρόσθεσε root scripts: dev, build, lint, typecheck, test.
Acceptance:

pnpm -r dev ξεκινά api/web/worker (ή τουλάχιστον api/web).

pnpm -r build τρέχει χωρίς errors.

P0.2 — TypeScript baseline (shared tsconfig)

Files:

tsconfig.base.json

apps/*/tsconfig.json, packages/shared/tsconfig.json
Acceptance:

pnpm -r typecheck περνάει.

P0.3 — Biome setup (format/lint)

Files:

biome.json

scripts σε root + per package
Steps:

Πρόσθεσε biome check / biome format.

On-save (Cursor/VSCode) οδηγίες στο docs/00-dev.md.
Acceptance:

pnpm lint διορθώνει ή αποτυγχάνει καθαρά.

pnpm format κάνει consistent formatting.

P0.4 — Cursor rules (ομοιομορφία)

Files:

.cursor/rules/01-core.mdc (ή AGENTS.md)
Περιεχόμενο rules (minimum):

folder conventions

API patterns (Zod request validation)

DB access layer rules

“μην σκληροκωδικοποιείς secrets”

“κάθε endpoint έχει tests (όπου critical)”
Acceptance:

Έχεις ένα “single source of truth” για το πώς γράφεται κώδικας στο repo.

P0.5 — Environment & secrets policy

Files:

.env.example

docs/00-secrets.md
Must env vars (ενδεικτικά):

DATABASE_URL

REDIS_URL

SHOPIFY_API_KEY, SHOPIFY_API_SECRET

APP_URL

MITTO_API_KEY (μόνο στο runtime env)

ENCRYPTION_MASTER_KEY (AES-GCM key)

STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
Acceptance:

Δεν υπάρχει κανένα secret committed.

P0.6 — Basic CI gate (optional αλλά recommended από τώρα)

Files:

.github/workflows/ci.yml
Steps:

run: install → lint → typecheck → tests
Acceptance:

PR fail αν σπάει lint/typecheck.

PHASE 1 — DB + Core backend skeleton

Σε αυτό το Phase φτιάχνουμε το ελάχιστο “real backend”: DB schema + auth context “store”.

P1.1 — Prisma init + first migration (tables core)

Prereq: Έχεις DBML.
Files:

apps/api/prisma/schema.prisma

apps/api/prisma/migrations/*
Tables (MVP subset):

stores, shopify_sessions, contacts, banners,

campaigns, outbound_messages,

short_links, unsubscribes,

mitto_credentials,

credit_ledger (ακόμα κι αν billing μπει αργότερα)
Acceptance:

pnpm --filter api prisma migrate dev δημιουργεί tables.

Στο repo υπάρχει πρώτη migration.

P1.2 — API server scaffold (Express + TS + health)

Files:

apps/api/src/index.ts

apps/api/src/app.ts

apps/api/src/routes/health.ts
Acceptance:

GET /health → { ok: true }

P1.3 — Shared validation layer (Zod in packages/shared)

Files:

packages/shared/src/schemas/*.ts

packages/shared/src/index.ts
Acceptance:

API μπορεί να κάνει import schemas από shared.

TypeScript types inferred από Zod.

P1.4 — Encryption helper (store encrypted tokens/keys)

Files:

apps/api/src/lib/crypto.ts (AES-GCM)
Rules:

Shopify access token + Mitto API key αποθήκευση encrypted.
Acceptance:

encrypt(plain) -> {ciphertext, iv, tag} και decrypt(...) -> plain

Unit tests για round-trip encryption.

PHASE 2 — Shopify connect (Store install, OAuth, sessions)

Στόχος: εγκατάσταση app σε store → γράφουμε stores + shopify_sessions.

P2.1 — Shopify app bootstrap

Outcome: λειτουργικό app skeleton (embedded).
Files:

apps/api/src/shopify/*

apps/web/* (basic embedded UI shell)
Acceptance:

Υπάρχει endpoint για auth start/callback.

P2.2 — OAuth start endpoint

Files:

apps/api/src/routes/shopify/auth.ts
Behavior:

Redirect στο Shopify OAuth

Validate shop param
Acceptance:

Αν δώσεις shop domain → σε πάει στο Shopify permission screen.

P2.3 — OAuth callback + store/session persist

Files:

apps/api/src/routes/shopify/callback.ts

apps/api/src/repositories/storeRepo.ts

apps/api/src/repositories/sessionRepo.ts
DB:

upsert stores

insert/update shopify_sessions (encrypted access_token)
Acceptance:

Μετά το callback υπάρχει store row + session row.

P2.4 — Store context middleware (multi-tenant enforcement)

Files:

apps/api/src/middleware/storeContext.ts
Behavior:

Από session/headers βρίσκει store_id

Inject req.store (store_id)
Acceptance:

Κάθε protected route ξέρει ποιο store καλεί.

P2.5 — Web app “login via store”

Files:

apps/web/src/routes/*

apps/web/src/lib/apiClient.ts
Acceptance:

Όταν ανοίγει embedded UI, κάνει authenticated calls στο API (store-scoped).

PHASE 3 — Theme App Extension Banner → Opt-in → Contact creation

Στόχος: banner μαζεύει στοιχεία → POST /public/optin → contact store-scoped.

P3.1 — Theme App Extension scaffold (banner block)

Files:

extensions/banner/* (ανάλογα Shopify structure)

docs/02-flows/F-001.flow.md (Mermaid flow για opt-in)
Acceptance:

Υπάρχει “App block” που μπορεί να προστεθεί σε theme.

P3.2 — Banner UI fields + validation client-side

Fields:

First name, Last name, Birth date, Phone (E.164), Country code mandatory
Acceptance:

Δεν επιτρέπει submit χωρίς country code + valid E.164.

P3.3 — Public API endpoint: POST /api/public/optin

Files:

apps/api/src/routes/public/optin.ts

packages/shared/src/schemas/optin.ts
DB behavior:

upsert contact by (store_id, phone_e164)

create opt_in_event

set consent fields
Acceptance:

Στέλνοντας valid payload → contact δημιουργείται/ενημερώνεται στο σωστό store.

P3.4 — Duplicate + unsubscribe logic

Rules:

Αν is_subscribed = false → default συμπεριφορά: δεν ξανα-ενεργοποιείς χωρίς explicit re-consent flag.
Acceptance:

Αν contact unsubscribed → opt-in endpoint απαντά με σαφή status (π.χ. 409 unsubscribed) ή απαιτεί reconsent=true.

P3.5 — Banner server-side configuration (DB banners)

Files:

apps/api/src/routes/banners/*

packages/shared/src/schemas/banner.ts
Acceptance:

Merchant μπορεί να δημιουργήσει banner config που το extension “τραβάει”.

PHASE 4 — Contacts, Lists, Segments (Web app)
P4.1 — Contacts list API

Endpoint:

GET /api/contacts?q=&page=
Acceptance:

pagination + search by name/phone.

P4.2 — Contacts list UI

Files:

apps/web/src/pages/Contacts.tsx
Acceptance:

βλέπεις contacts, search, open contact details.

P4.3 — Contact details view + message history

Endpoint:

GET /api/contacts/:id/messages
Acceptance:

εμφανίζει outbound messages ανά contact.

P4.4 — Lists CRUD

Endpoints:

POST /api/lists

GET /api/lists

POST /api/lists/:id/members
Acceptance:

μπορείς να φτιάξεις list και να προσθέσεις contacts.

P4.5 — Segments MVP (rules_json)

Rules examples:

subscribed only

created last N days
Acceptance:

GET /api/segments/:id/preview επιστρέφει sample contacts.

PHASE 5 — Mitto integration: Campaigns (bulk send) + message statuses

Εδώ γίνεται το “core value”: campaigns σε μαζικά contacts.

P5.1 — Mitto client wrapper (server)

Files:

apps/api/src/integrations/mitto/client.ts
Behavior:

sendBulk(messages[])

sendSingle(message)

getMessage(messageId)
Acceptance:

Functions υπάρχουν, κάνουν request με header X-Mitto-API-Key (από decrypted key).

P5.2 — Mitto credentials management per store

Endpoints:

POST /api/settings/mitto (traffic_account_id + api_key)

store encrypted in mitto_credentials
Acceptance:

store μπορεί να κάνει save/test connection.

P5.3 — Placeholder engine (dynamic values)

Placeholders:

{First_Name}, {Last_Name}, {Birth_Date}, {Phone}
Files:

packages/shared/src/template/render.ts
Acceptance:

render("Hi {First_Name}", contact) → σωστό output

missing fields → fallback empty string ή configurable.

P5.4 — Credits gate (MVP: required active plan later, but gate credits now)

Logic (MVP):

πριν στείλεις, compute estimated credits = recipients * messageParts

αν insufficient → fail με σαφές error
Acceptance:

campaign send δεν προχωρά αν δεν επαρκούν credits.

P5.5 — Campaign create (draft)

Endpoints:

POST /api/campaigns (name, sender, message_text, audience)
DB:

create row in campaigns status draft
Acceptance:

draft εμφανίζεται στο UI.

P5.6 — Campaign “prepare audience” (resolve recipients)

Behavior:

resolve list/segment → contacts subscribed only

de-dup by phone
Acceptance:

preview recipients count before send.

P5.7 — Bulk send execution

Behavior:

Create outbound_messages per recipient (Queued)

Call Mitto bulk

Save bulkId + messageIds to outbound_messages

Mark campaign status sending/sent
Acceptance:

Σε DB υπάρχουν outbound_messages με mitto_message_id.

P5.8 — Worker: status polling (BullMQ + Redis)

Files:

apps/worker/src/queues/statusPoll.ts

apps/worker/src/jobs/pollMittoMessage.ts
Behavior:

κάθε X λεπτά, παίρνει recent messages με status Queued/Sent/Unknown

call getMessage and update delivery_status
Acceptance:

statuses ενημερώνονται αυτόματα.

P5.9 — Campaign metrics aggregation

Behavior:

compute totals: sent/delivered/failed

store in campaigns.totals_json
Acceptance:

dashboard δείχνει totals.

PHASE 6 — Short links + Unsubscribe (Compliance + tracking)
P6.1 — Short link generator + resolver route

Endpoint:

GET /l/:code → redirect target_url + log click
DB:

short_links, link_clicks
Acceptance:

click καταγράφεται.

P6.2 — Unsubscribe link per outbound message

Behavior:

για κάθε outbound message δημιουργείς short link type=unsubscribe

append στο SMS π.χ. “Stop: https://a.note/l/XYZ”

Acceptance:

κάθε message έχει unsubscribe link.

P6.3 — Unsubscribe landing page

Routes:

GET /unsubscribe/:code (web page)

POST /unsubscribe/:code (perform unsubscribe)
DB:

set contacts.is_subscribed=false, unsubscribed_at=now

insert row unsubscribes
Acceptance:

μετά το unsubscribe, ο contact δεν συμπεριλαμβάνεται σε audiences.

PHASE 7 — Shopify Discount Codes sync
P7.1 — Shopify Admin API wrapper (discount codes)

Endpoint:

POST /api/shopify/discounts/sync
DB:

discount_codes_cache upsert
Acceptance:

βλέπεις cache discount codes στο UI.

P7.2 — Use discount code in banner success

Behavior:

banner config selects a discount code

after opt-in show code / copy
Acceptance:

banner δείχνει code σωστά.

PHASE 8 — Automations (Welcome / Abandoned / Post-purchase)
P8.1 — Automations CRUD UI/API

Endpoints:

GET/POST /api/automations
Acceptance:

enable/disable, sender, message, delay.

P8.2 — Shopify webhooks ingestion

Events (ενδεικτικά):

orders/create

checkouts/update
DB:

shopify_orders, shopify_checkouts
Acceptance:

webhook payloads αποθηκεύονται (raw_json).

P8.3 — Abandoned checkout rule engine (MVP)

Rule:

μετά 30’ αν checkout not completed AND cart unchanged (line_items stable) → send
Acceptance:

δημιουργεί automation_run scheduled, εκτελεί, στέλνει 1 SMS.

P8.4 — Automation send via Mitto single send

Behavior:

create outbound_message

call send single

status polling same mechanism
Acceptance:

automation messages εμφανίζονται στο contact timeline.

PHASE 9 — Stripe Billing + Credits
P9.1 — Stripe customer + subscription scaffolding

DB:

stripe_customers, stripe_subscriptions
Acceptance:

store συνδέεται με stripe customer.

P9.2 — Plans: monthly/yearly + credit grants

Rules:

monthly: +100 credits

yearly: +500 credits
Acceptance:

on subscription active → ledger entry “grant” και balance updated.

P9.3 — Credit purchase (0.045€/credit) gated by active subscription

Acceptance:

purchase allowed only if subscription active.

P9.4 — Spend credits per message (parts-aware)

Acceptance:

credits μειώνονται με κάθε send, based on message_parts.

PHASE 10 — Admin dashboard (εσύ)
P10.1 — Admin auth

Acceptance:

μόνο admin βλέπει system dashboards.

P10.2 — Stores overview + revenue + message volume

Acceptance:

βλέπεις per store: credits balance, spend, campaigns count, last activity.

P10.3 — Audit logs

Acceptance:

critical actions γράφουν audit_logs.