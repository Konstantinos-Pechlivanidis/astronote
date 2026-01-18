# TL;DR
- Η χρέωση στο retail τρέχει μέσα από Stripe Checkout (subscriptions + topups/credits) με Stripe Tax ανοικτό και fallback συγχρονισμό από webhooks.
- Όλα τα endpoints είναι κάτω από `/api` (`/api/subscriptions/*`, `/api/billing/*`), με invoices/billing-history διαθέσιμα από το backend (DB-first, Stripe fallback).
- Μετά το checkout η σελίδα success καλεί `verify-payment` + `finalize/reconcile` ώστε να ενεργοποιηθεί η συνδρομή και να πιστωθούν credits· αν δεν φανούν, κάνουμε refresh/reconcile.

## Πώς λειτουργεί (σήμερα)
1. Stripe είναι το source of truth· η DB κρατά snapshot (Subscription, InvoiceRecord, BillingTransaction, CreditTransaction, WebhookEvent).
2. Subscriptions: `POST /api/subscriptions/subscribe` φτιάχνει Stripe Checkout με `automatic_tax` + VAT collection, metadata ownerId. Webhooks (`checkout.session.completed`, `invoice.paid`) ενεργοποιούν συνδρομή και γράφουν invoices/credits.
3. Changes: `POST /api/subscriptions/switch` αποφασίζει checkout vs scheduled (month→year checkout, year→month scheduled) και επιστρέφει `changeMode`.
4. Reconcile/Finalize: `POST /api/subscriptions/finalize` και `POST /api/subscriptions/reconcile` επανασυγχρονίζουν από Stripe όταν γυρίσει ο χρήστης στο success.
5. Credits/Topups: `POST /api/billing/topup` + `createCreditTopupCheckoutSession` → webhook `invoice.paid/payment_succeeded` πιστώνει wallet idempotently (BillingTransaction + CreditTransaction).
6. Billing profile: `GET/PUT /api/billing/profile` με `isBusiness`, VAT number/country, διεύθυνση· συγχρονίζεται σε Stripe customer + tax IDs.
7. VAT/Tax: Stripe Checkout έχει `automatic_tax` και `tax_id_collection`· tax resolver ακολουθεί GR domestic VAT, EU B2B reverse charge (με έγκυρο VAT), EU B2C VAT, non-EU 0%.
8. Invoices: `GET /api/billing/invoices` επιστρέφει DB invoices (subtotal/tax/total/links) με Stripe fallback όταν λείπουν. Billing history: `/api/billing/billing-history` (ledger από BillingTransaction).
9. Balance & summary: `/api/billing/balance` δίνει credits + συνδρομή, `/api/billing/summary` συνδυάζει allowance/credits.
10. Webhooks: stripe.webhooks route με raw body, replay protection (WebhookEvent), αποθηκεύει unmatched events με λόγο.
11. Frontend success: `/app/retail/billing/success` καλεί `billing.verify-payment` (όλα τα είδη), μετά `subscriptions.finalize/reconcile` αν είναι συνδρομή, και κάνει redirect στο billing page.
12. Endpoints base path: όλα τα billing/subscription routes είναι mounted με prefix `/api` (π.χ. `/api/billing/invoices`, `/api/billing/billing-history`). Κλήσεις χωρίς `/api` θα δίνουν 404.

## Τι λείπει / τι κινδυνεύει
- FRONTEND_URL δεν είναι ρυθμισμένο στο περιβάλλον → τα success/cancel URLs/validate μπορεί να σπάσουν (CONFIG_ERROR 500).
- Prisma migrate deploy δεν τρέχει με Node 24 (schema engine error)· χρειάζεται Node 20 για έλεγχο παραγωγής.
- Εάν το frontend καλέσει `/billing/*` χωρίς prefix `/api`, θα πάρει 404 (το mount είναι `/api`).
- UX δεν εξηγεί ρητά ότι η επαλήθευση γίνεται μετά το redirect (verify/reconcile) και ότι τα invoices/credits μπορεί να εμφανιστούν μετά από λίγα δευτερόλεπτα.

## Πού πληρώνω / βήματα χρήστη (ροή)
1. Πηγαίνω στο `/app/retail/billing`.
2. Διαλέγω Συνδρομή (starter/pro) ή Top-up πακέτο credits.
3. Πατάω CTA (Subscribe ή Buy credits) → backend καλεί `/api/subscriptions/subscribe` ή `/api/billing/topup` και παίρνω `checkoutUrl`.
4. Μεταφέρομαι σε Stripe Checkout (με αυτόματο υπολογισμό ΦΠΑ, πεδία επιχείρησης/VAT).
5. Πληρώνω με κάρτα. Stripe ολοκληρώνει.
6. Επιστρέφω στο `/app/retail/billing/success?session_id=...`.
7. Η σελίδα success καλεί `POST /api/billing/verify-payment` (και `subscriptions/finalize` + `reconcile` αν είναι συνδρομή).
8. Redirect πίσω στο `/app/retail/billing?paymentSuccess=1`.
9. Βλέπω ενημερωμένα: status συνδρομής, υπόλοιπο credits, λίστα invoices και billing history.

### Αν δεν βλέπω credits/invoices μετά το checkout
- Κάνω refresh στη σελίδα billing.
- Πατάω ξανά το success URL (κρατά το session_id) για να επανεκτελέσει verify/reconcile.
- Αν λείπουν invoices, τρέχει fallback στο `/api/billing/invoices` που καλεί Stripe· αλλιώς χρησιμοποιώ `/api/subscriptions/reconcile` χειροκίνητα.

## Προτεινόμενες βελτιώσεις UX
- Προσθήκη microcopy στο billing page: “Μετά την πληρωμή θα σε γυρίσουμε πίσω για αυτόματο sync συνδρομής/credits”.
- Εμφάνιση alert στο success page με κουμπί “Refresh billing now” (router.refresh) αντί για μόνο auto-redirect.
- Badge/loader στα sections Subscription/Credits μέχρι να ολοκληρωθεί το verify (για να μην μπερδεύεται ο χρήστης).
- Ξεκάθαρο toggle “Είμαι επιχείρηση (με ΑΦΜ/VAT)” με σύντομη επεξήγηση για ΦΠΑ GR/EU.
- CTA grouping: ένα primary “Subscribe” και secondary “Buy credits” με tooltips που εξηγούν πότε χρειάζεται το καθένα.
- Link “View invoices”/“Billing history” ορατό αμέσως μετά το payment success.

## Checklist verification (manual)
- Subscribe (starter/pro) → checkout → success page → συνδρομή active, plan/interval σωστά, invoice εμφανίζεται.
- Month→Year αλλαγή → `changeMode=checkout` και παίρνει νέο checkout URL.
- Year→Month αλλαγή → `changeMode=scheduled` και pending change φαίνεται.
- Top-up credits → μετά το success το wallet αυξάνεται και billing history έχει μία γραμμή.
- `/api/billing/invoices` & `/api/billing/billing-history` επιστρέφουν 200 με σελιδοποίηση (θυμήσου το `/api` prefix).
- Billing profile update (VAT/country/address) συγχρονίζεται στο Stripe customer (tax_id) και εφαρμόζεται σε επόμενο checkout/invoice.
