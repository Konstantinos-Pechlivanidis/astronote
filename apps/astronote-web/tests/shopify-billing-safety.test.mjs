import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const billingApiPath = resolve(
  process.cwd(),
  'apps/astronote-web/src/lib/shopifyBillingApi.ts',
);
const billingPagePath = resolve(
  process.cwd(),
  'apps/astronote-web/app/app/shopify/billing/page.tsx',
);

const billingApiContent = readFileSync(billingApiPath, 'utf8');
const billingPageContent = readFileSync(billingPagePath, 'utf8');

test('shopify billing API uses safe parsing defaults', () => {
  assert.match(billingApiContent, /billingSummarySchema\.safeParse/);
  assert.match(billingApiContent, /defaultSummary/);
  assert.match(billingApiContent, /billingProfileSchema\.safeParse/);
  assert.match(billingApiContent, /defaultBillingProfile/);
  assert.match(billingApiContent, /invoicesResponseSchema\.safeParse/);
  assert.match(billingApiContent, /defaultInvoicesResponse/);
});

test('shopify billing UI uses defensive fallbacks', () => {
  assert.match(billingPageContent, /billingSummary \|\| null/);
  assert.match(billingPageContent, /summary\?\./);
  assert.match(billingPageContent, /subscriptionRaw/);
});

test('shopify subscription flow uses correct payload and endpoint', () => {
  assert.ok(billingApiContent.includes('/subscriptions/subscribe'));
  assert.ok(billingApiContent.includes('subscribe: async (data: SubscribeRequest)'));
  assert.ok(billingPageContent.includes('subscribe.mutateAsync({ planType, currency })'));
});
