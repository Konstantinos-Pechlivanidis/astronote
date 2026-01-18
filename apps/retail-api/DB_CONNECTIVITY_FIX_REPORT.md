# DB Connectivity Fix Report (Retail)

## Root cause
- Prisma could not reach Neon DB in the sandbox because outbound network/DNS resolution was blocked; using escalated permissions allowed TCP connect to `ep-young-dream-ag5u1znm-pooler.c-2.eu-central-1.aws.neon.tech:5432`.
- Env loader paths were off by one level; `loadEnv.js` now resolves repo root and retail-api root correctly.

## What changed
- `apps/api/src/config/loadEnv.js`: corrected path resolution (repo root = ../../../../../, retail-api root = ../../../../ from config file).
- `scripts/reset-uat-user.js`: added preflight (sanitized DB URL, SELECT 1), clearer env source logging, and kept dry-run default with `--apply/--execute` to delete.

## Current working env (sanitized example)
- DATABASE_URL: `postgresql://***@ep-young-dream-ag5u1znm-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
- DIRECT_DATABASE_URL: `postgresql://***@ep-young-dream-ag5u1znm.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`

## Verification commands
- Connectivity test (needs escalated network):  
  `nc -vz ep-young-dream-ag5u1znm-pooler.c-2.eu-central-1.aws.neon.tech 5432`
- Script dry-run:  
  `cd apps/retail-api && node scripts/reset-uat-user.js --email kostas.pehlivanidis.dev@gmail.com --dry-run`
  - Result: DB reachable; user not found (no deletions).
- Prisma check still requires Node 20.x for engine compatibility; not rerun here.

## Notes for Render/prod parity
- Ensure DATABASE_URL/DIRECT_DATABASE_URL include `sslmode=require` (Neon default).  
- If using pooler, DATABASE_URL can point to `*-pooler` host; DIRECT_DATABASE_URL should use direct host for migrations.  
- Network must allow outbound 5432 with DNS resolution.  
