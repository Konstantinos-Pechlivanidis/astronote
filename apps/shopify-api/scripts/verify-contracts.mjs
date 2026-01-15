/**
 * Shopify API contracts verification gate (Prisma↔DB).
 *
 * Runs:
 * - prisma validate
 * - prisma migrate status
 * - prisma-db-parity.mjs
 *
 * Fails CI/dev startup if Prisma schema drifts from DB again.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run(cmd, args) {
  const res = spawnSync(cmd, args, {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

run('npx', ['prisma', 'validate', '--schema', 'prisma/schema.prisma']);
run('npx', ['prisma', 'migrate', 'status', '--schema', 'prisma/schema.prisma']);
run('node', ['scripts/prisma-db-parity.mjs']);

console.log('✅ verify-contracts: Prisma schema + migrations + DB parity OK');


