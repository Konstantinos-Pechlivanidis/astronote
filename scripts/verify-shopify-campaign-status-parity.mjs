#!/usr/bin/env node
/**
 * Verify Shopify campaign status contract parity (BE ↔ FE ↔ UI mapping).
 *
 * Checks:
 * - BE `CAMPAIGN_STATUS_VALUES` == FE `SHOPIFY_CAMPAIGN_STATUS_VALUES`
 * - FE Zod schema uses the shared list (no duplicated string enum)
 * - UI StatusBadge variants cover all statuses (or provide explicit fallback)
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const BE_STATUS_FILE = path.join(ROOT, 'apps/shopify-api/constants/campaign-status.js');
const FE_STATUS_FILE = path.join(
  ROOT,
  'apps/astronote-web/src/lib/shopify/constants/campaign-status.ts',
);
const FE_ZOD_FILE = path.join(ROOT, 'apps/astronote-web/src/lib/shopify/api/schemas.ts');
const UI_BADGE_FILE = path.join(ROOT, 'apps/astronote-web/src/components/shopify/CampaignStatusBadge.tsx');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function extractArrayFromObjectFreeze(text, constName) {
  const re = new RegExp(
    `export\\s+const\\s+${constName}\\s*=\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\)`,
    'm',
  );
  const m = text.match(re);
  if (!m) return null;
  return Array.from(m[1].matchAll(/'([^']+)'/g)).map(mm => mm[1]);
}

function extractArrayLiteral(text, constName) {
  const re = new RegExp(`export\\s+const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s+as\\s+const`, 'm');
  const m = text.match(re);
  if (!m) return null;
  return Array.from(m[1].matchAll(/'([^']+)'/g)).map(mm => mm[1]);
}

function extractObjectKeys(text, constName) {
  const re = new RegExp(
    `const\\s+${constName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\}\\s*(?:as\\s+const\\s*)?;`,
    'm',
  );
  const m = text.match(re);
  if (!m) return null;
  const body = m[1];
  return Array.from(body.matchAll(/^\s*([a-zA-Z0-9_]+)\s*:/gm)).map(mm => mm[1]);
}

function sameArray(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function fail(msg) {
  process.stderr.write(`${msg}\n`);
  process.exitCode = 1;
}

const beText = read(BE_STATUS_FILE);
const feText = read(FE_STATUS_FILE);
const zodText = read(FE_ZOD_FILE);
const uiText = read(UI_BADGE_FILE);

const be = extractArrayFromObjectFreeze(beText, 'CAMPAIGN_STATUS_VALUES');
const fe = extractArrayLiteral(feText, 'SHOPIFY_CAMPAIGN_STATUS_VALUES');
if (!be) throw new Error('Failed to parse BE CAMPAIGN_STATUS_VALUES');
if (!fe) throw new Error('Failed to parse FE SHOPIFY_CAMPAIGN_STATUS_VALUES');

process.stdout.write('== Shopify campaign status parity ==\n');

if (!sameArray(be, fe)) {
  fail(`- BE/FE mismatch:\n  BE: ${JSON.stringify(be)}\n  FE: ${JSON.stringify(fe)}`);
} else {
  process.stdout.write('- BE vs FE status list: OK\n');
}

// Ensure Zod schema uses shared list
if (!zodText.includes('SHOPIFY_CAMPAIGN_STATUS_VALUES') || !zodText.includes('z.enum(SHOPIFY_CAMPAIGN_STATUS_VALUES')) {
  fail('- FE Zod schema does not use SHOPIFY_CAMPAIGN_STATUS_VALUES (expected z.enum(sharedList))');
} else {
  process.stdout.write('- FE Zod schema uses shared list: OK\n');
}

// Ensure UI badge mapping covers all statuses (except legacy handling allowed)
const uiKeys = extractObjectKeys(uiText, 'variants') || [];
const missingUi = be.filter(s => !uiKeys.includes(s));
if (missingUi.length) {
  fail(`- UI StatusBadge missing variants for: ${missingUi.join(', ')}`);
} else {
  process.stdout.write('- UI StatusBadge variants cover all statuses: OK\n');
}

if (process.exitCode) {
  process.stdout.write('\nStatus parity check FAILED\n');
  process.exit(process.exitCode);
}
process.stdout.write('\nStatus parity check PASSED\n');


