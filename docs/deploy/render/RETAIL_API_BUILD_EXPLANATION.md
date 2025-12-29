# Retail API - Build Command Explanation

## Why `npm ci` only (no build step)?

### Retail API
**Build Command:** `npm ci` (only)

**Reason:**
- Retail API is **pure JavaScript** (CommonJS)
- No TypeScript compilation needed
- No bundling needed (runs directly with Node.js)
- Prisma client generation is handled separately (via `prisma:generate` script)
- Dependencies are installed via `npm ci` at root (monorepo)

**When Prisma generation happens:**
- **Option 1:** Pre-deploy script in Render (recommended)
  - Add to Render service settings: **Predeploy Command:** `npm -w @astronote/retail-api run prisma:generate`
- **Option 2:** Manual (first deploy only)
  - Render Shell: `cd apps/retail-api && npm run prisma:generate`

---

### Shopify API
**Build Command:** `npm ci && npm -w @astronote/shopify-api run build`

**Reason:**
- Shopify API has a `build` script that runs `prisma generate`
- This ensures Prisma client is generated before start
- More automated approach

**Build script:**
```json
"build": "prisma generate"
```

---

## Should Retail API also have build step?

**Current approach (npm ci only):**
- ✅ Simpler
- ✅ Faster builds
- ⚠️ Requires separate Prisma generation step

**Alternative (add build step):**
- ✅ More automated (Prisma generates automatically)
- ✅ Consistent with Shopify API
- ⚠️ Slightly longer build time

**Recommendation:** Add build step for consistency and automation.

---

## Updated Build Commands (Recommended)

### Retail API
**Build Command:**
```bash
npm ci && npm -w @astronote/retail-api run build
```

**Start Command:**
```bash
npm -w @astronote/retail-api run start
```

This ensures:
1. Dependencies installed (`npm ci`)
2. Prisma client generated (`npm run build` = `prisma generate`)
3. Service starts (`npm run start`)

---

## Comparison

| Service | Build Needed? | Why |
|---------|---------------|-----|
| **Retail API** | Prisma only | Pure JS, no compilation |
| **Shopify API** | Prisma only | Pure JS (ESM), no compilation |
| **Web Frontend** | Yes (Vite) | React app needs bundling |

---

## Summary

**Retail API:**
- No TypeScript → No compilation
- No bundling → Runs directly with Node.js
- Only needs Prisma client generation
- Can use `npm ci` only (manual Prisma) OR `npm ci && npm run build` (automatic Prisma)

**Recommended:** Use `npm ci && npm -w @astronote/retail-api run build` for consistency and automation.

