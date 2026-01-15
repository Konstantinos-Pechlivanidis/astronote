/**
 * Retail verification gate (no product behavior changes).
 *
 * Runs:
 * - prisma validate
 * - prisma migrate status
 * - prisma-db-parity.js
 * - (optional) smoke-retail-mutations.js if RETAIL_TEST_TOKEN is set
 *
 * Exit 1 on failure.
 */

const { execSync } = require('child_process');
const path = require('path');

const API_ROOT = path.resolve(__dirname, '..'); // apps/retail-api/apps/api
const RETAIL_ROOT = path.resolve(API_ROOT, '../..'); // apps/retail-api
const SCHEMA = path.resolve(RETAIL_ROOT, 'prisma/schema.prisma');

function run(cmd, cwd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function main() {
  let failed = false;

  try {
    run(`npx prisma validate --schema "${SCHEMA}"`, RETAIL_ROOT);
  } catch (e) {
    failed = true;
  }

  try {
    run(`npx prisma migrate status --schema "${SCHEMA}"`, RETAIL_ROOT);
  } catch (e) {
    // migrate status exits non-zero when migrations are pending.
    // We still want to run parity to give actionable details.
    failed = true;
  }

  try {
    run(`node "${path.resolve(API_ROOT, 'scripts/prisma-db-parity.js')}"`, API_ROOT);
  } catch (e) {
    failed = true;
  }

  if (process.env.RETAIL_TEST_TOKEN) {
    try {
      run(`node "${path.resolve(API_ROOT, 'scripts/smoke-retail-mutations.js')}"`, API_ROOT);
    } catch (e) {
      failed = true;
    }
  } else {
    console.log('\n(smoke-retail-mutations) skipped: RETAIL_TEST_TOKEN not set');
  }

  if (failed) {
    console.error('\nverify:contracts failed ❌ (see output above)');
    process.exit(1);
  }
  console.log('\nverify:contracts passed ✅');
}

main();


