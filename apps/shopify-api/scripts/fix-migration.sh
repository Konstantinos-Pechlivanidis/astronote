#!/bin/bash
# Fix failed migration by marking it as rolled back and re-running

cd "$(dirname "$0")/.."

echo "Step 1: Marking failed migration as rolled back..."
npx prisma migrate resolve --rolled-back 20250125000000_phase4_production_hardening

echo ""
echo "Step 2: Re-running migration with fixed SQL..."
npx prisma migrate deploy

echo ""
echo "Step 3: Generating Prisma Client..."
npx prisma generate

echo ""
echo "Migration fix complete!"

