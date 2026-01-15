import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const FE_BILLING_PAGE = path.resolve(repoRoot, 'apps/astronote-web/app/app/retail/billing/page.tsx');
const BE_STRIPE_PRICES = path.resolve(repoRoot, 'apps/retail-api/apps/api/src/billing/stripePrices.js');
const BE_BILLING_ROUTES = path.resolve(repoRoot, 'apps/retail-api/apps/api/src/routes/billing.js');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function uniq(arr) {
  return [...new Set(arr)];
}

function mdRow(cells) {
  return `| ${cells.map((c) => String(c).replace(/\|/g, '\\|')).join(' | ')} |`;
}

function extractRetailBillingUiOptions(feText) {
  // Very small heuristic parser: pull the `intervalOptions = [ ... ]` object literals.
  const block = feText.match(/const\s+intervalOptions\s*=\s*\[([\s\S]*?)\n\s*\];/m);
  if (!block) return { options: [], error: 'Could not find intervalOptions block in retail billing page.' };

  const body = block[1];
  const optionRegex = /interval:\s*'(?<interval>month|year)'\s+as\s+const,[\s\S]*?planType:\s*'(?<planType>starter|pro)'/g;
  const options = [];
  for (const m of body.matchAll(optionRegex)) {
    options.push({ interval: m.groups.interval, planType: m.groups.planType });
  }
  return { options };
}

function extractEnvReadsFromRetailStripePrices(beText) {
  // Retail uses template env keys; return the required patterns.
  const reads = [];
  if (beText.includes('STRIPE_PRICE_ID_CREDIT_TOPUP_')) reads.push('STRIPE_PRICE_ID_CREDIT_TOPUP_{EUR|USD}');
  if (beText.includes('STRIPE_PRICE_ID_SUB_')) reads.push('STRIPE_PRICE_ID_SUB_{STARTER|PRO}_{EUR|USD}');
  if (beText.includes('STRIPE_PRICE_ID_SUB_') && beText.includes('impliedInterval')) {
    reads.push('alias: STRIPE_PRICE_ID_SUB_{STARTER_MONTH|PRO_YEAR}_{EUR|USD}');
  }
  return reads;
}

function extractBackendIntervalPolicyFromSwitchRoute(routesText) {
  // Expect intervalToPlan mapping month->starter, year->pro
  const match = routesText.match(/const\s+intervalToPlan\s*=\s*\{\s*[\s\S]*?month:\s*'starter'[\s\S]*?year:\s*'pro'[\s\S]*?\}/m);
  if (!match) return { ok: false, error: 'Could not find intervalToPlan mapping in /subscriptions/switch.' };
  return { ok: true };
}

function main() {
  const feText = read(FE_BILLING_PAGE);
  const pricesText = read(BE_STRIPE_PRICES);
  const routesText = read(BE_BILLING_ROUTES);

  const fe = extractRetailBillingUiOptions(feText);
  const beReads = extractEnvReadsFromRetailStripePrices(pricesText);
  const switchPolicy = extractBackendIntervalPolicyFromSwitchRoute(routesText);

  const expectedUi = [
    { planType: 'starter', interval: 'month' },
    { planType: 'pro', interval: 'year' },
  ];

  const normalizedUi = uniq((fe.options || []).map((o) => `${o.planType}/${o.interval}`)).sort();
  const normalizedExpectedUi = uniq(expectedUi.map((o) => `${o.planType}/${o.interval}`)).sort();

  const envRequired = [
    'STRIPE_PRICE_ID_SUB_STARTER_EUR',
    'STRIPE_PRICE_ID_SUB_STARTER_USD',
    'STRIPE_PRICE_ID_SUB_PRO_EUR',
    'STRIPE_PRICE_ID_SUB_PRO_USD',
  ];
  const envOptional = ['STRIPE_PRICE_ID_CREDIT_TOPUP_EUR', 'STRIPE_PRICE_ID_CREDIT_TOPUP_USD'];

  const lines = [];
  lines.push('# Retail Billing Parity Verification');
  lines.push('');
  lines.push('## Expected catalog (Retail parity)');
  lines.push('- UI options: `starter/month`, `pro/year`');
  lines.push('- Interval inference: `month -> starter`, `year -> pro`');
  lines.push('');

  lines.push('## FE options (parsed)');
  if (fe.error) {
    lines.push(`- **ERROR**: ${fe.error}`);
  } else {
    lines.push(mdRow(['planType/interval']));
    lines.push(mdRow(['---']));
    for (const key of normalizedUi) {
      lines.push(mdRow([key]));
    }
  }
  lines.push('');

  lines.push('## Backend switch policy');
  lines.push(switchPolicy.ok ? '- ok ✅ (intervalToPlan mapping found)' : `- **ERROR**: ${switchPolicy.error}`);
  lines.push('');

  lines.push('## Stripe price resolver env reads (retail-api)');
  lines.push(beReads.length ? beReads.map((r) => `- ${r}`).join('\n') : '- (no reads detected)');
  lines.push('');

  lines.push('## Required env vars');
  lines.push(envRequired.map((k) => `- ${k}`).join('\n'));
  lines.push('');
  lines.push('## Optional env vars');
  lines.push(envOptional.map((k) => `- ${k}`).join('\n'));
  lines.push('');

  const uiOk =
    !fe.error &&
    normalizedUi.length === normalizedExpectedUi.length &&
    normalizedUi.every((v, i) => v === normalizedExpectedUi[i]);
  const overallOk = uiOk && switchPolicy.ok;

  lines.push('## Result');
  lines.push(uiOk ? '- FE options match expected ✅' : `- **FE options drift**: expected ${normalizedExpectedUi.join(', ')} got ${normalizedUi.join(', ')}`);
  lines.push(overallOk ? '- Overall: PASS ✅' : '- Overall: FAIL ❌');
  lines.push('');

  const outPath = path.resolve(repoRoot, 'reports/retail-billing-parity-report.md');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Wrote ${outPath}`);

  if (!overallOk) process.exit(1);
}

main();


