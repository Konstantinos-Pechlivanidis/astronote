#!/usr/bin/env node
/**
 * Verify Billing Contract Parity (Retail + Shopify)
 *
 * Report-only helper:
 * - Extracts plan codes / intervals / currencies from backend sources of truth
 * - Extracts plan/interval/currency usage from FE billing pages
 * - Fails if FE references unknown values not supported by backend catalogs
 *
 * Usage:
 *   node scripts/verify-billing-contract-parity.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function extractStringLiterals(text) {
  // Very simple extraction: 'foo' and "foo"
  const out = [];
  const re = /['"]([a-zA-Z0-9_/-]+)['"]/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

function extractShopifyCatalog() {
  const text = readText('apps/shopify-api/services/plan-catalog.js');
  // Pull the config keys: starter/pro, month/year, EUR/USD
  const planCodes = uniq(Array.from(text.matchAll(/\b(starter|pro)\b/g)).map((m) => m[1]));
  const intervals = uniq(Array.from(text.matchAll(/\b(month|year)\b/g)).map((m) => m[1]));
  const currencies = uniq(Array.from(text.matchAll(/\b(EUR|USD)\b/g)).map((m) => m[1]));
  return { planCodes, intervals, currencies };
}

function extractRetailCatalog() {
  // Retail currently uses planType + currency, and assumes intervals by plan.
  const text = readText('apps/retail-api/apps/api/src/services/subscription.service.js');
  const planCodes = ['starter', 'pro'];
  const intervals = uniq(Array.from(text.matchAll(/\b(month|year)\b/g)).map((m) => m[1]));
  const currencies = ['EUR', 'USD'];
  return { planCodes, intervals, currencies };
}

function extractShopifyFeUsage() {
  const page = readText('apps/astronote-web/app/app/shopify/billing/page.tsx');
  const matrix = readText('apps/astronote-web/src/features/shopify/billing/utils/billingActionMatrix.ts');
  const strings = extractStringLiterals(page + '\n' + matrix);

  const planCodes = uniq(strings.filter((s) => s === 'starter' || s === 'pro'));
  const intervals = uniq(strings.filter((s) => s === 'month' || s === 'year'));
  const currencies = uniq(strings.filter((s) => s === 'EUR' || s === 'USD'));

  return { planCodes, intervals, currencies };
}

function extractRetailFeUsage() {
  const page = readText('apps/astronote-web/app/app/retail/billing/page.tsx');
  const strings = extractStringLiterals(page);

  const planCodes = uniq(strings.filter((s) => s === 'starter' || s === 'pro'));
  const intervals = uniq(strings.filter((s) => s === 'month' || s === 'year'));
  const currencies = uniq(strings.filter((s) => s === 'EUR' || s === 'USD'));

  return { planCodes, intervals, currencies };
}

function diffUnknown(used, allowed) {
  const allowedSet = new Set(allowed);
  return used.filter((v) => !allowedSet.has(v));
}

const shopifyBackend = extractShopifyCatalog();
const retailBackend = extractRetailCatalog();
const shopifyFe = extractShopifyFeUsage();
const retailFe = extractRetailFeUsage();

const problems = [];

problems.push(
  ...diffUnknown(shopifyFe.planCodes, shopifyBackend.planCodes).map(
    (v) => `Shopify FE uses unknown planCode: ${v}`,
  ),
);
problems.push(
  ...diffUnknown(shopifyFe.intervals, shopifyBackend.intervals).map(
    (v) => `Shopify FE uses unknown interval: ${v}`,
  ),
);
problems.push(
  ...diffUnknown(shopifyFe.currencies, shopifyBackend.currencies).map(
    (v) => `Shopify FE uses unknown currency: ${v}`,
  ),
);

problems.push(
  ...diffUnknown(retailFe.planCodes, retailBackend.planCodes).map(
    (v) => `Retail FE uses unknown planCode: ${v}`,
  ),
);
problems.push(
  ...diffUnknown(retailFe.intervals, retailBackend.intervals).map(
    (v) => `Retail FE uses unknown interval: ${v}`,
  ),
);
problems.push(
  ...diffUnknown(retailFe.currencies, retailBackend.currencies).map(
    (v) => `Retail FE uses unknown currency: ${v}`,
  ),
);

console.log('Billing contract parity check\n');
console.log('Shopify backend:', shopifyBackend);
console.log('Shopify FE:', shopifyFe);
console.log('Retail backend:', retailBackend);
console.log('Retail FE:', retailFe);

if (problems.length) {
  console.error('\nFAIL: parity problems found:');
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

console.log('\nPASS: FE values are compatible with backend catalogs.');


