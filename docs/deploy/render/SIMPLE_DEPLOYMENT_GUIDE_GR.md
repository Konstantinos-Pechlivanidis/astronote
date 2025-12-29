# Απλός Οδηγός Deployment στο Render

## Βήμα 1: Push στο GitHub

### 1.1. Αρχικοποίηση Git (αν δεν υπάρχει ήδη)

```bash
cd /Users/konstantinos/Documents/GitHub/astronote-shopify-backend

# Ελέγξε αν υπάρχει git repo
git status

# Αν δεν υπάρχει, αρχικοποίησε:
git init
git add .
git commit -m "Initial commit - monorepo ready for Render"
```

### 1.2. Σύνδεση με το GitHub Repo

```bash
# Προσθήκη remote
git remote add origin https://github.com/Konstantinos-Pechlivanidis/astronote.git

# Push στο GitHub
git branch -M main
git push -u origin main
```

**Σημείωση:** Αν το repo δεν είναι άδειο στο GitHub, μπορεί να χρειαστεί `git pull` πρώτα.

---

## Βήμα 2: Δημιουργία Services στο Render

Θα δημιουργήσεις **4 services** στο Render:

1. **Web Frontend** (`apps/web`)
2. **Shopify API** (`apps/shopify-api`)
3. **Retail API** (`apps/retail-api`)
4. **Retail Worker** (`apps/retail-worker`)

---

## Βήμα 3: Web Frontend (apps/web)

### 3.1. Δημιουργία Service

1. Πήγαινε στο Render Dashboard → **New** → **Web Service**
2. Σύνδεσε το GitHub repo: `Konstantinos-Pechlivanidis/astronote`
3. Στο **Settings:**
   - **Name:** `astronote-web`
   - **Environment:** `Node`
   - **Region:** Επίλεξε (π.χ. Frankfurt)
   - **Branch:** `main`
   - **Root Directory:** `apps/web`

### 3.2. Build & Start Commands

**Build Command:**
```bash
npm ci && npm run build
```

**Start Command:**
```bash
npm run start
```

### 3.3. Environment Variables

Πρόσθεσε αυτές τις μεταβλητές (Settings → Environment):

```
VITE_APP_URL=https://astronote.onrender.com
VITE_RETAIL_API_BASE_URL=https://astronote-retail.onrender.com
VITE_SHOPIFY_API_BASE_URL=https://astronote-shopify.onrender.com
```

**Σημείωση:** Θα πάρεις το URL μετά το deploy. Αν χρειαστεί, άλλαξέ το μετά.

### 3.4. Deploy

Κάνε **Manual Deploy** ή άσε το **Auto-Deploy** να τρέξει.

---

## Βήμα 4: Retail API (apps/retail-api)

### 4.1. Δημιουργία Service

1. **New** → **Web Service**
2. Σύνδεσε το ίδιο GitHub repo
3. **Settings:**
   - **Name:** `astronote-retail-api`
   - **Environment:** `Node`
   - **Region:** Ίδια με web
   - **Branch:** `main`
   - **Root Directory:** `apps/retail-api`

### 4.2. Build & Start Commands

**Build Command:**
```bash
npm ci
```

**Start Command:**
```bash
npm run start
```

### 4.3. Environment Variables

**Βασικές:**
```
NODE_ENV=production
DATABASE_URL=<το Neon PostgreSQL connection string>
DIRECT_URL=<το Neon direct connection string>
REDIS_HOST=<Redis host>
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=<Redis password>
REDIS_TLS=true
JWT_SECRET=<γεννήσε με: openssl rand -base64 32>
CORS_ALLOWLIST=https://astronote.onrender.com
```

**Για πλήρη λίστα:** Δες `docs/deploy/checklists/render-retail-api-env.md`

**Σημείωση:** Θα χρειαστείς:
- Neon PostgreSQL database (δημιούργησε αν δεν έχεις)
- Redis instance (Redis Cloud recommended)

### 4.4. Prisma Migrations

Μετά το πρώτο deploy, πήγαινε στο **Render Shell** και τρέξε:

```bash
cd apps/retail-api
npm run prisma:generate
npm run prisma:migrate:deploy
```

---

## Βήμα 5: Retail Worker (apps/retail-worker)

### 5.1. Δημιουργία Service

1. **New** → **Background Worker**
2. Σύνδεσε το ίδιο GitHub repo
3. **Settings:**
   - **Name:** `astronote-retail-worker`
   - **Environment:** `Node`
   - **Region:** Ίδια με retail-api
   - **Branch:** `main`
   - **Root Directory:** `apps/retail-worker`

### 5.2. Build & Start Commands

**Build Command:**
```bash
npm ci
```

**Start Command:**
```bash
npm run start
```

### 5.3. Environment Variables

**Χρησιμοποίησε ΤΑ ΙΔΙΑ** με retail-api:
- `DATABASE_URL`
- `DIRECT_URL`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_TLS`
- `JWT_SECRET` (ίδιο!)
- `MITTO_API_KEY`
- `STRIPE_SECRET_KEY`
- κ.λπ.

**Για πλήρη λίστα:** Δες `docs/deploy/checklists/render-retail-worker-env.md`

---

## Βήμα 6: Shopify API (apps/shopify-api)

### 6.1. Δημιουργία Service

1. **New** → **Web Service**
2. Σύνδεσε το ίδιο GitHub repo
3. **Settings:**
   - **Name:** `astronote-shopify-api`
   - **Environment:** `Node`
   - **Region:** Ίδια με web
   - **Branch:** `main`
   - **Root Directory:** `apps/shopify-api`

### 6.2. Build & Start Commands

**Build Command:**
```bash
npm ci && npm run build
```

**Start Command:**
```bash
npm run start
```

### 6.3. Environment Variables

**Βασικές:**
```
NODE_ENV=production
DATABASE_URL=<το Neon PostgreSQL connection string>
DIRECT_URL=<το Neon direct connection string>
REDIS_HOST=<Redis host>
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=<Redis password>
REDIS_TLS=true
SHOPIFY_API_KEY=<Shopify API key>
SHOPIFY_API_SECRET=<Shopify API secret>
SESSION_SECRET=<γεννήσε με: openssl rand -base64 32>
CORS_ALLOWLIST=https://astronote.onrender.com
URL_SHORTENER_TYPE=custom
URL_SHORTENER_BASE_URL=https://astronote-shopify.onrender.com
```

**Για πλήρη λίστα:** Δες `docs/deploy/checklists/render-shopify-api-env.md`

**Σημείωση:** Θα χρειαστείς:
- Shopify Partners app (για API keys)
- Stripe account (για payments)
- Mitto SMS account (για SMS)

### 6.4. Prisma Migrations

Μετά το πρώτο deploy, πήγαινε στο **Render Shell** και τρέξε:

```bash
cd apps/shopify-api
npm run prisma:generate
npm run prisma:migrate:deploy
```

---

## Βήμα 7: Ενημέρωση URLs

Μετά το deploy όλων των services, πήγαινε στο **Web Frontend** service και ενημέρωσε τα URLs:

```
VITE_APP_URL=<το πραγματικό URL του web service>
VITE_RETAIL_API_BASE_URL=<το πραγματικό URL του retail-api>
VITE_SHOPIFY_API_BASE_URL=<το πραγματικό URL του shopify-api>
```

**Σημείωση:** Μετά την αλλαγή env vars, θα χρειαστεί **rebuild** (Render θα το κάνει αυτόματα).

---

## Βήμα 8: Verification

### 8.1. Health Checks

```bash
# Web
curl https://astronote.onrender.com

# Retail API
curl https://astronote-retail.onrender.com/healthz

# Shopify API
curl https://astronote-shopify.onrender.com/health
```

### 8.2. Frontend Test

1. Άνοιξε το browser: `https://astronote.onrender.com`
2. Πρέπει να φορτώσει η landing page
3. Άνοιξε DevTools → Network tab
4. Πήγαινε σε `/retail/login` ή `/shopify/login`
5. Έλεγξε ότι τα API calls πηγαίνουν στα σωστά backends

---

## Σύνοψη: Build & Start Commands

| Service | Root Directory | Build Command | Start Command |
|---------|----------------|---------------|---------------|
| **Web** | `apps/web` | `npm ci && npm run build` | `npm run start` |
| **Retail API** | `apps/retail-api` | `npm ci` | `npm run start` |
| **Retail Worker** | `apps/retail-worker` | `npm ci` | `npm run start` |
| **Shopify API** | `apps/shopify-api` | `npm ci && npm run build` | `npm run start` |

---

## Troubleshooting

### Build Fails

- Έλεγξε ότι όλα τα dependencies είναι στο `package.json`
- Έλεγξε ότι το `package-lock.json` είναι commit-μένο
- Έλεγξε τα Render logs για errors

### Start Fails

- Έλεγξε ότι όλα τα env variables είναι set
- Έλεγξε τα Render logs για errors
- Έλεγξε ότι το database/Redis είναι accessible

### Prisma Errors

- Έλεγξε ότι το `DATABASE_URL` είναι σωστό
- Τρέξε `prisma:generate` και `prisma:migrate:deploy` στο Render Shell

### CORS Errors

- Έλεγξε ότι το `CORS_ALLOWLIST` περιλαμβάνει το frontend URL
- Έλεγξε ότι το frontend URL είναι σωστό στα env vars

---

## Next Steps

1. ✅ Push στο GitHub
2. ✅ Δημιούργησε 4 services στο Render
3. ✅ Set build/start commands
4. ✅ Set environment variables
5. ✅ Run Prisma migrations
6. ✅ Verify health checks
7. ✅ Test frontend

**Για λεπτομερείς οδηγίες:** Δες `docs/deploy/render/go-live-runbook.md`

