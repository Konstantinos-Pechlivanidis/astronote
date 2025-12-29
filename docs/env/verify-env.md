# Environment Variable Verification

## Overview
The `scripts/verify-env.js` script checks that required environment variables are set for each service.

## Usage

### From Repo Root
```bash
node scripts/verify-env.js
```

### What It Checks

**Required Keys (per service):**
- **retail-api:** DATABASE_URL, JWT_SECRET, MITTO_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- **retail-worker:** Same as retail-api
- **shopify-api:** DATABASE_URL, SHOPIFY_API_KEY, SHOPIFY_API_SECRET, STRIPE_SECRET_KEY
- **web:** VITE_SHOPIFY_API_BASE_URL, VITE_RETAIL_API_BASE_URL

**Optional Keys (reported if present):**
- DIRECT_URL, REDIS_*, FRONTEND_URL, CORS_ALLOWLIST, HOST, etc.

### Output

The script prints:
- ✅ Required keys present
- ❌ Required keys missing
- 📋 Optional keys present
- 📁 Env files found

### Example Output

```
🔍 Environment Variable Verification

============================================================

📦 RETAIL-API
------------------------------------------------------------
✅ Required keys: ALL PRESENT
   ✓ DATABASE_URL
   ✓ JWT_SECRET
   ✓ MITTO_API_KEY
   ✓ STRIPE_SECRET_KEY
   ✓ STRIPE_WEBHOOK_SECRET

📋 Optional keys present:
   • DIRECT_URL
   • REDIS_HOST
   • FRONTEND_URL

📁 Env files:
   • Root .env exists
   • retail-api/.env exists
```

## Integration

### CI/CD
Add to CI pipeline:
```yaml
- name: Verify Environment Variables
  run: node scripts/verify-env.js
```

### Pre-commit Hook (Optional)
```bash
#!/bin/sh
node scripts/verify-env.js || exit 1
```

## Notes

- ✅ Does NOT print secret values (only checks presence)
- ✅ Checks `.env`, `.env.local`, and root `.env` files
- ✅ Priority: `.env.local` > `.env` > root `.env`
- ✅ Exit code 0 if all required keys present, 1 if missing

## Customization

Edit `scripts/verify-env.js` to:
- Add/remove required keys per service
- Change optional keys
- Add custom validation logic

