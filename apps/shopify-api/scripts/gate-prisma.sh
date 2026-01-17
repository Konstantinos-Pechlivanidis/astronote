#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== Shopify Prisma Gate =="
echo "cwd: $(pwd)"
echo "node: $(node -v)"
echo "prisma: $(npx prisma -v | tr '\n' ' ' | sed 's/  */ /g')"
echo ""

echo "== prisma generate =="
npx prisma generate
echo ""

echo "== prisma migrate status =="
npx prisma migrate status
echo ""

echo "== prisma migrate deploy =="
set +e
DEPLOY_OUT="$(npx prisma migrate deploy 2>&1)"
DEPLOY_CODE=$?
set -e

echo "$DEPLOY_OUT"

if [[ $DEPLOY_CODE -ne 0 ]]; then
  if echo "$DEPLOY_OUT" | grep -q "P3005"; then
    cat <<'EOF'

ERROR: Prisma migrate deploy failed with P3005 ("The database schema is not empty").

This usually means the DB was created outside Prisma Migrate (no _prisma_migrations table),
so Prisma refuses to apply migrations to a non-empty schema until you baseline it.

SAFE BASELINE WORKFLOW (prod-like DB that you MUST preserve):
1) Verify drift (should be EMPTY before baselining):
   npx prisma migrate diff --from-url "$DATABASE_URL" --to-migrations prisma/migrations --script > prisma_drift.sql
   # Inspect prisma_drift.sql. If it's non-empty, STOP and reconcile drift first.

2) If drift is empty, mark migrations as already applied (creates _prisma_migrations):
   for d in prisma/migrations/*; do
     npx prisma migrate resolve --applied "$(basename "$d")"
   done

3) Deploy again:
   npx prisma migrate deploy

DEV/TEST RESET (DB can be dropped):
   npx prisma migrate reset --force

Full guide: see PRISMA_PROD_GATE.md in repo root.
EOF
    exit 1
  fi
  echo ""
  echo "ERROR: prisma migrate deploy failed (see output above)."
  exit "$DEPLOY_CODE"
fi

echo ""
echo "== sanity query (SELECT 1 + key tables) =="
node --input-type=module -e "import {PrismaClient} from '@prisma/client'; const prisma=new PrismaClient(); try { await prisma.\$queryRaw\`SELECT 1\`; await prisma.shop.findFirst({select:{id:true}}); await prisma.contact.findFirst({select:{id:true}}).catch(()=>null); console.log('sanity: ok'); } finally { await prisma.\$disconnect(); }"

echo ""
echo "== Shopify Prisma Gate: OK =="

