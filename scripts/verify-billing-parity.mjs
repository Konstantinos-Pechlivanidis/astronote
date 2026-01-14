#!/usr/bin/env node
/**
 * Billing Parity Verifier (Shopify + Retail)
 *
 * Static, repo-local checks only:
 * - Next success/cancel routes exist (Shopify + Retail)
 * - Prisma schemas include key uniqueness constraints
 * - Backend routers expose required billing endpoints (subscribe/invoices/history/portal/webhooks)
 * - Invoices services contain Stripe fallback/backfill codepaths
 * - Plan-catalog env validation parity rules (Shopify simplified + matrix; Retail alias support)
 *
 * Env checks are conditional:
 * - If STRIPE_SECRET_KEY is set, enforce plan price env vars are complete for the chosen mode.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function assertFileExists(relPath) {
  const abs = path.join(repoRoot, relPath);
  assert(exists(abs), `Missing file: ${relPath}`);
}

function assertIncludes(relPath, needle, hint = '') {
  const abs = path.join(repoRoot, relPath);
  assert(exists(abs), `Missing file: ${relPath}`);
  const content = read(abs);
  assert(
    content.includes(needle),
    `Expected "${needle}" in ${relPath}${hint ? ` (${hint})` : ''}`,
  );
}

function assertRegex(relPath, re, hint = '') {
  const abs = path.join(repoRoot, relPath);
  assert(exists(abs), `Missing file: ${relPath}`);
  const content = read(abs);
  assert(
    re.test(content),
    `Expected ${re} to match ${relPath}${hint ? ` (${hint})` : ''}`,
  );
}

function checkNextRoutes() {
  // Shopify
  assertFileExists('apps/astronote-web/app/app/shopify/billing/success/page.tsx');
  assertFileExists('apps/astronote-web/app/app/shopify/billing/cancel/page.tsx');
  // Retail
  assertFileExists('apps/astronote-web/app/app/retail/billing/success/page.tsx');
  assertFileExists('apps/astronote-web/app/app/retail/billing/cancel/page.tsx');
}

function checkPrismaUniques() {
  const shopifySchema = 'apps/shopify-api/prisma/schema.prisma';
  const retailSchema = 'apps/retail-api/prisma/schema.prisma';

  // Stripe webhook replay protection
  assertRegex(shopifySchema, /model\s+WebhookEvent[\s\S]*@@unique\(\[provider,\s*eventId\]\)/);
  assertRegex(retailSchema, /model\s+WebhookEvent[\s\S]*@@unique\(\[provider,\s*eventId\]\)/);

  // Invoice unique
  assertRegex(shopifySchema, /model\s+InvoiceRecord[\s\S]*stripeInvoiceId\s+String[\s\S]*@unique/);
  assertRegex(retailSchema, /model\s+InvoiceRecord[\s\S]*stripeInvoiceId\s+String[\s\S]*@unique/);

  // BillingTransaction idempotency
  assertRegex(shopifySchema, /model\s+BillingTransaction[\s\S]*@@unique\(\[shopId,\s*idempotencyKey\]\)/);
  assertRegex(retailSchema, /model\s+BillingTransaction[\s\S]*@@unique\(\[ownerId,\s*idempotencyKey\]\)/);

  // CreditTransaction idempotency (if present)
  assertRegex(shopifySchema, /model\s+CreditTransaction[\s\S]*@@unique\(\[shopId,\s*idempotencyKey\]\)/);
  assertRegex(retailSchema, /model\s+CreditTransaction[\s\S]*@@unique\(\[ownerId,\s*idempotencyKey\]\)/);
}

function checkBackendEndpoints() {
  // Shopify routes (router path names)
  assertIncludes('apps/shopify-api/routes/subscriptions.js', "r.get('/portal'", 'Shopify portal route');
  assertIncludes('apps/shopify-api/routes/subscriptions.js', "r.get('/status'", 'Shopify status route');
  assertIncludes('apps/shopify-api/routes/subscriptions.js', "r.post('/subscribe'", 'Shopify subscribe route');
  assertRegex('apps/shopify-api/routes/billing.js', /r\.get\(\s*['"]\/invoices['"]/, 'Shopify invoices route');
  assertRegex('apps/shopify-api/routes/billing.js', /r\.get\(\s*['"]\/billing-history['"]/, 'Shopify purchase history route');
  assertIncludes('apps/shopify-api/routes/stripe-webhooks.js', "r.post('/'", 'Shopify Stripe webhook route');

  // Retail routes
  assertIncludes('apps/retail-api/apps/api/src/routes/billing.js', "r.get('/subscriptions/portal'", 'Retail portal route');
  assertRegex('apps/retail-api/apps/api/src/routes/billing.js', /r\.get\(\s*['"]\/billing\/invoices['"]/, 'Retail invoices route');
  assertRegex('apps/retail-api/apps/api/src/routes/billing.js', /r\.get\(\s*['"]\/billing\/billing-history['"]/, 'Retail billing history route');
  assertRegex('apps/retail-api/apps/api/src/routes/billing.js', /r\.post\(\s*['"]\/subscriptions\/finalize['"]/, 'Retail finalize route');
  assertIncludes('apps/retail-api/apps/api/src/routes/stripe.webhooks.js', "module.exports", 'Retail Stripe webhook handler file');
}

function checkInvoicesFallback() {
  // Shopify invoices service: must contain stripe.invoices.list fallback
  assertRegex('apps/shopify-api/services/invoices.js', /stripe\.invoices\.list\(/, 'Shopify invoices fallback');
  // Retail invoices service: must contain stripe.invoices.list fallback
  assertRegex('apps/retail-api/apps/api/src/services/invoices.service.js', /stripe\.invoices\.list\(/, 'Retail invoices fallback');
}

function checkPlanCatalogParity() {
  // Shopify dual-mode validator is expected
  assertIncludes('apps/shopify-api/services/plan-catalog.js', "mode === 'matrix'", 'dual-mode validation');
  assertIncludes('apps/shopify-api/services/plan-catalog.js', 'STRIPE_PRICE_ID_SUB_STARTER_EUR', 'simplified vars');
  assertIncludes('apps/shopify-api/services/plan-catalog.js', 'STRIPE_PRICE_ID_SUB_PRO_USD', 'simplified vars');
  assertIncludes('apps/shopify-api/config/env-validation.js', 'mode=', 'mode-aware error');

  // Retail alias support: should reference matrixKey fallback
  assertIncludes('apps/retail-api/apps/api/src/billing/stripePrices.js', 'STRIPE_PRICE_ID_SUB_', 'Retail subscription env key');
  assertIncludes('apps/retail-api/apps/api/src/billing/stripePrices.js', 'matrixKey', 'Retail alias fallback');

  // Conditional env completeness checks (only if Stripe is configured)
  if (process.env.STRIPE_SECRET_KEY) {
    const simplifiedVars = [
      'STRIPE_PRICE_ID_SUB_STARTER_EUR',
      'STRIPE_PRICE_ID_SUB_STARTER_USD',
      'STRIPE_PRICE_ID_SUB_PRO_EUR',
      'STRIPE_PRICE_ID_SUB_PRO_USD',
    ];
    const matrixVars = [
      'STRIPE_PRICE_ID_SUB_STARTER_MONTH_EUR',
      'STRIPE_PRICE_ID_SUB_STARTER_MONTH_USD',
      'STRIPE_PRICE_ID_SUB_STARTER_YEAR_EUR',
      'STRIPE_PRICE_ID_SUB_STARTER_YEAR_USD',
      'STRIPE_PRICE_ID_SUB_PRO_MONTH_EUR',
      'STRIPE_PRICE_ID_SUB_PRO_MONTH_USD',
      'STRIPE_PRICE_ID_SUB_PRO_YEAR_EUR',
      'STRIPE_PRICE_ID_SUB_PRO_YEAR_USD',
    ];
    const anySimplified = simplifiedVars.some((k) => !!process.env[k]);
    const anyMatrix = matrixVars.some((k) => !!process.env[k]);
    const mode = anySimplified ? (anyMatrix ? 'mixed' : 'simplified') : anyMatrix ? 'matrix' : 'simplified';
    const required = mode === 'matrix' ? matrixVars : simplifiedVars;
    const missing = required.filter((k) => !process.env[k]);
    assert(
      missing.length === 0,
      `Env parity: missing required Stripe subscription price env vars (mode=${mode}): ${missing.join(', ')}`,
    );

    // Webhook secret presence check (basic)
    assert(
      !!process.env.STRIPE_WEBHOOK_SECRET,
      'Env parity: STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is missing',
    );
  }
}

function main() {
  const checks = [
    ['Next routes', checkNextRoutes],
    ['Prisma uniqueness constraints', checkPrismaUniques],
    ['Backend endpoints', checkBackendEndpoints],
    ['Invoices Stripe fallback', checkInvoicesFallback],
    ['Plan catalog/env parity', checkPlanCatalogParity],
  ];

  const failures = [];
  for (const [name, fn] of checks) {
    try {
      fn();
      // eslint-disable-next-line no-console
      console.log(`✅ ${name}`);
    } catch (e) {
      failures.push({ name, error: e?.message || String(e) });
      // eslint-disable-next-line no-console
      console.error(`❌ ${name}: ${e?.message || e}`);
    }
  }

  if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.error('\nBilling parity verification failed:\n');
    for (const f of failures) {
      // eslint-disable-next-line no-console
      console.error(`- ${f.name}: ${f.error}`);
    }
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('\n✅ Billing parity verification passed');
}

main();


