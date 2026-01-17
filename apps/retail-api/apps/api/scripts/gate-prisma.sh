#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== Retail API Prisma Gate =="
echo "cwd: $(pwd)"
echo "node: $(node -v)"
echo "prisma: $(npx prisma -v | tr '\n' ' ' | sed 's/  */ /g')"
echo ""

echo "== prisma generate (workspace root: apps/retail-api) =="
(cd ../.. && npx prisma generate)
echo ""

echo "== prisma migrate status (workspace root: apps/retail-api) =="
(cd ../.. && npx prisma migrate status)
echo ""

echo "== prisma migrate deploy (workspace root: apps/retail-api) =="
set +e
DEPLOY_OUT="$((cd ../.. && npx prisma migrate deploy) 2>&1)"
DEPLOY_CODE=$?
set -e

echo "$DEPLOY_OUT"

if [[ $DEPLOY_CODE -ne 0 ]]; then
  if echo "$DEPLOY_OUT" | grep -q "P3005"; then
    cat <<'EOF'

ERROR: Prisma migrate deploy failed with P3005 ("The database schema is not empty").

Baseline workflow:
1) Verify drift:
   (cd apps/retail-api && npx prisma migrate diff --from-url "$DATABASE_URL" --to-migrations prisma/migrations --script > prisma_drift.sql)

2) If drift is empty, mark migrations applied:
   (cd apps/retail-api && for d in prisma/migrations/*; do npx prisma migrate resolve --applied "$(basename "$d")"; done)

3) Deploy again:
   (cd apps/retail-api && npx prisma migrate deploy)

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
(cd ../.. && node --input-type=module -e "import {PrismaClient} from '@prisma/client'; const prisma=new PrismaClient(); try { await prisma.\$queryRaw\`SELECT 1\`; await prisma.user.findFirst({select:{id:true}}); await prisma.subscription.findFirst({select:{id:true}}).catch(()=>null); console.log('sanity: ok'); } finally { await prisma.\$disconnect(); }")

echo ""
echo "== Retail API Prisma Gate: OK =="

