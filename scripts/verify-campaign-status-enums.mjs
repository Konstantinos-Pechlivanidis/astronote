#!/usr/bin/env node
/**
 * Lightweight static validation: ensure campaign status enums referenced in FE
 * match BE Prisma enums for Retail + Shopify.
 *
 * No runtime side effects; reads source files only.
 */

import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function uniqSorted(arr) {
  return Array.from(new Set(arr)).sort();
}

function diffSets(expected, actual) {
  const e = new Set(expected);
  const a = new Set(actual);
  return {
    missingInActual: expected.filter(x => !a.has(x)),
    extraInActual: actual.filter(x => !e.has(x)),
  };
}

function extractPrismaEnum(schemaText, enumName) {
  const re = new RegExp(`enum\\s+${enumName}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = schemaText.match(re);
  if (!m) return null;
  const body = m[1];
  const values = body
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
    .filter(l => !l.startsWith('@'))
    .map(l => l.replace(/[,\s].*$/, ''))
    .filter(Boolean);
  return uniqSorted(values);
}

function extractTsUnion(fileText, typeName) {
  // Matches:
  // export type CampaignStatus =
  //   | 'draft'
  //   | 'scheduled'
  const re = new RegExp(`type\\s+${typeName}\\s*=\\s*([\\s\\S]*?);`, 'm');
  const m = fileText.match(re);
  if (!m) return null;
  const body = m[1];
  const values = Array.from(body.matchAll(/'([^']+)'/g)).map(mm => mm[1]);
  return uniqSorted(values);
}

function extractZodEnum(fileText, fieldName = 'status') {
  // Very lightweight: looks for `${fieldName}: z.enum([...])`
  const re = new RegExp(`${fieldName}\\s*:\\s*z\\.enum\\(\\[([\\s\\S]*?)\\]\\)`, 'm');
  const m = fileText.match(re);
  if (!m) return null;
  const body = m[1];
  const values = Array.from(body.matchAll(/'([^']+)'/g)).map(mm => mm[1]);
  return uniqSorted(values);
}

function extractObjectKeys(fileText, constName) {
  // Extract keys from: const statusVariants = { draft: '...', ... }
  const re = new RegExp(`const\\s+${constName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`, 'm');
  const m = fileText.match(re);
  if (!m) return null;
  const body = m[1];
  const keys = Array.from(body.matchAll(/^\s*([a-zA-Z0-9_]+)\s*:/gm)).map(mm => mm[1]);
  return uniqSorted(keys);
}

function banner(title) {
  process.stdout.write(`\n== ${title} ==\n`);
}

let ok = true;

// --- Shopify ---
banner('Shopify');
{
  const prismaSchemaPath = path.join(REPO_ROOT, 'apps/shopify-api/prisma/schema.prisma');
  const feTypesPathA = path.join(REPO_ROOT, 'apps/astronote-web/src/lib/shopify/api/campaigns.ts');
  const feTypesPathB = path.join(REPO_ROOT, 'apps/astronote-web/src/lib/shopifyCampaignsApi.ts');
  const feSchemasPath = path.join(REPO_ROOT, 'apps/astronote-web/src/lib/shopify/api/schemas.ts');

  const prismaSchema = readText(prismaSchemaPath);
  const beCampaignStatus = extractPrismaEnum(prismaSchema, 'CampaignStatus');

  const feA = readText(feTypesPathA);
  const feB = readText(feTypesPathB);
  const feSchemas = readText(feSchemasPath);

  const feCampaignStatusA = extractTsUnion(feA, 'CampaignStatus');
  const feCampaignStatusB = extractTsUnion(feB, 'CampaignStatus');
  const feZodStatus = extractZodEnum(feSchemas, 'status');

  if (!beCampaignStatus) throw new Error('Failed to parse Shopify BE CampaignStatus enum');
  if (!feCampaignStatusA) throw new Error('Failed to parse FE CampaignStatus (shopify/api/campaigns.ts)');
  if (!feCampaignStatusB) throw new Error('Failed to parse FE CampaignStatus (shopifyCampaignsApi.ts)');
  if (!feZodStatus) throw new Error('Failed to parse FE Zod status enum (schemas.ts)');

  const checks = [
    { name: 'FE TS union (shopify/api/campaigns.ts)', values: feCampaignStatusA },
    { name: 'FE TS union (shopifyCampaignsApi.ts)', values: feCampaignStatusB },
    { name: 'FE Zod schema (shopify/api/schemas.ts)', values: feZodStatus },
  ];

  for (const c of checks) {
    const { missingInActual, extraInActual } = diffSets(beCampaignStatus, c.values);
    process.stdout.write(`- ${c.name}\n`);
    if (missingInActual.length === 0 && extraInActual.length === 0) {
      process.stdout.write('  OK\n');
      continue;
    }
    ok = false;
    if (missingInActual.length) process.stdout.write(`  Missing (present in BE): ${missingInActual.join(', ')}\n`);
    if (extraInActual.length) process.stdout.write(`  Extra (not in BE): ${extraInActual.join(', ')}\n`);
  }
}

// --- Retail ---
banner('Retail');
{
  const prismaSchemaPath = path.join(REPO_ROOT, 'apps/retail-api/prisma/schema.prisma');
  const feStatusBadgePath = path.join(REPO_ROOT, 'apps/astronote-web/src/components/retail/StatusBadge.tsx');

  const prismaSchema = readText(prismaSchemaPath);
  const beCampaignStatus = extractPrismaEnum(prismaSchema, 'CampaignStatus');
  if (!beCampaignStatus) throw new Error('Failed to parse Retail BE CampaignStatus enum');

  // Retail FE does not have a single canonical union type (found during scan),
  // so we validate the UI badge map as a proxy for "statuses the UI expects".
  const badge = readText(feStatusBadgePath);
  const uiKeys = extractObjectKeys(badge, 'statusVariants');
  if (!uiKeys) throw new Error('Failed to parse Retail StatusBadge.statusVariants keys');

  // UI also contains non-campaign keys (active/inactive); filter them out.
  const uiCampaignKeys = uiKeys.filter(k => beCampaignStatus.includes(k));
  const { missingInActual, extraInActual } = diffSets(beCampaignStatus, uiCampaignKeys);
  process.stdout.write('- FE StatusBadge variants (campaign statuses only)\n');
  if (missingInActual.length === 0 && extraInActual.length === 0) {
    process.stdout.write('  OK\n');
  } else {
    ok = false;
    if (missingInActual.length) process.stdout.write(`  Missing (present in BE): ${missingInActual.join(', ')}\n`);
    if (extraInActual.length) process.stdout.write(`  Extra (not in BE): ${extraInActual.join(', ')}\n`);
  }
}

process.stdout.write('\n');
if (!ok) {
  process.stderr.write('Enum parity check FAILED\n');
  process.exit(1);
}
process.stdout.write('Enum parity check PASSED\n');


