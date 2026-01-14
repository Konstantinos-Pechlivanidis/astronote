#!/usr/bin/env node
/**
 * Verify Billing Env Catalog (Retail + Shopify)
 *
 * Report-only helper:
 * - Scans code for STRIPE_* env var references related to billing
 * - Prints required env var names and whether they are present in process.env
 * - Exits non-zero if any are missing (unless --soft)
 *
 * Usage:
 *   node scripts/verify-billing-env-catalog.mjs
 *   node scripts/verify-billing-env-catalog.mjs --soft
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());

const args = new Set(process.argv.slice(2));
const soft = args.has('--soft');

const FILES_TO_SCAN = [
  'apps/shopify-api/services/plan-catalog.js',
  'apps/shopify-api/services/subscription.js',
  'apps/shopify-api/services/stripe.js',
  'apps/shopify-api/controllers/subscriptions.js',
  'apps/shopify-api/controllers/stripe-webhooks.js',
  'apps/shopify-api/config/env-validation.js',
  'apps/retail-api/apps/api/src/billing/stripePrices.js',
  'apps/retail-api/apps/api/src/services/stripe.service.js',
  'apps/retail-api/apps/api/src/services/subscription.service.js',
  'apps/retail-api/apps/api/src/routes/billing.js',
  'apps/retail-api/apps/api/src/routes/stripe.webhooks.js',
];

function readText(relPath) {
  const abs = path.join(ROOT, relPath);
  return fs.readFileSync(abs, 'utf8');
}

function extractEnvReads(text) {
  // Only treat *actual env reads* as env vars.
  // This avoids false positives like 'STRIPE_ERROR' error codes.
  const out = new Set();

  const reDot = /process\.env\.([A-Z0-9_]+)/g;
  const reBracket = /process\.env\[['"`]([A-Z0-9_]+)['"`]\]/g;

  for (const re of [reDot, reBracket]) {
    let m;
    while ((m = re.exec(text))) {
      const name = m[1];
      if (name) out.add(name);
    }
  }

  return out;
}

function isBillingRelatedEnv(name) {
  // Limit to billing-related env vars only.
  return (
    name.startsWith('STRIPE_') ||
    name === 'FRONTEND_URL' ||
    name === 'FRONTEND_BASE_URL' ||
    name === 'WEB_APP_URL'
  );
}

const discovered = new Map(); // envVar -> [files...]

for (const relPath of FILES_TO_SCAN) {
  let text;
  try {
    text = readText(relPath);
  } catch (err) {
    // Skip missing files (repo may change)
    continue;
  }

  const vars = extractEnvReads(text);
  for (const v of vars) {
    if (!isBillingRelatedEnv(v)) continue;
    const list = discovered.get(v) || [];
    list.push(relPath);
    discovered.set(v, list);
  }
}

// Ensure these are listed even if referenced indirectly via helper libs
for (const extra of ['FRONTEND_URL', 'FRONTEND_BASE_URL', 'WEB_APP_URL']) {
  if (!discovered.has(extra)) discovered.set(extra, []);
}

const rows = Array.from(discovered.entries())
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([envVar, files]) => ({
    envVar,
    present: Boolean(process.env[envVar]),
    files,
  }));

const missing = rows.filter((r) => !r.present);

console.log('Billing env catalog audit (Retail + Shopify)\n');
console.log(`Scanned ${FILES_TO_SCAN.length} files. Found ${rows.length} env var references.\n`);

for (const r of rows) {
  const status = r.present ? 'OK ' : 'MISS';
  const refs = r.files.length ? `  (${r.files.join(', ')})` : '';
  console.log(`${status}  ${r.envVar}${refs}`);
}

if (missing.length) {
  console.log(`\nMissing ${missing.length} env vars.`);
  if (!soft) {
    process.exit(1);
  }
} else {
  console.log('\nAll discovered env vars are present in process.env.');
}


