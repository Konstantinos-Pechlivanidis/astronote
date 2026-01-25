import fs from 'fs';
import path from 'path';

const root = process.cwd();
const issues = [];
const lines = [];

const readText = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return null;
  }
};

const addCheck = (label, ok, details = '') => {
  const status = ok ? 'PASS' : 'FAIL';
  lines.push(`- ${status}: ${label}${details ? ` (${details})` : ''}`);
  if (!ok) issues.push(`${label}${details ? ` (${details})` : ''}`);
};

const billingPagePath = path.join(root, 'apps', 'astronote-web', 'app', 'app', 'retail', 'billing', 'page.tsx');
const billingPage = readText(billingPagePath);
addCheck('billing page exists', !!billingPagePath && !!billingPage);

const billingApiPath = path.join(root, 'apps', 'astronote-web', 'src', 'lib', 'retail', 'api', 'billing.ts');
const billingApi = readText(billingApiPath);
addCheck('billing API client exists', !!billingApiPath && !!billingApi);

const subscriptionsApiPath = path.join(root, 'apps', 'astronote-web', 'src', 'lib', 'retail', 'api', 'subscriptions.ts');
const subscriptionsApi = readText(subscriptionsApiPath);
addCheck('subscriptions API client exists', !!subscriptionsApiPath && !!subscriptionsApi);

const endpointsPath = path.join(root, 'apps', 'astronote-web', 'src', 'lib', 'retail', 'api', 'endpoints.ts');
const endpoints = readText(endpointsPath);
addCheck('endpoints file exists', !!endpointsPath && !!endpoints);

const billingGatePath = path.join(root, 'apps', 'astronote-web', 'src', 'features', 'retail', 'billing', 'hooks', 'useBillingGate.ts');
const billingGate = readText(billingGatePath) || '';

const enqueueHookPath = path.join(root, 'apps', 'astronote-web', 'src', 'features', 'retail', 'campaigns', 'hooks', 'useEnqueueCampaign.ts');
const enqueueHook = readText(enqueueHookPath) || '';

if (billingPage) {
  addCheck('billing page uses billingApi.getSummary', billingPage.includes('billingApi.getSummary'));
  const usesPackages = billingPage.includes('billingApi.getPackages');
  const usesPurchase = billingPage.includes('billingApi.purchase');
  addCheck(
    'billing page uses billingApi.getPackages with currency',
    usesPackages ? billingPage.includes('billingApi.getPackages(selectedCurrency)') : true,
    usesPackages ? '' : 'skipped (packages UI removed)',
  );
  addCheck(
    'billing page uses billingApi.purchase with idempotencyKey',
    usesPurchase ? /billingApi\.purchase\([^)]*idempotencyKey/.test(billingPage) : true,
    usesPurchase ? '' : 'skipped (packages UI removed)',
  );
  addCheck('billing page uses subscriptionsApi.switch', billingPage.includes('subscriptionsApi.switch'));
  addCheck('billing page uses subscriptionsApi.cancel', billingPage.includes('subscriptionsApi.cancel'));
  addCheck('billing page passes idempotencyKey to switch', /subscriptionsApi\.switch\([^)]*idempotencyKey/.test(billingPage));
  addCheck('billing page passes idempotencyKey to cancel', /subscriptionsApi\.cancel\([^)]*cancelKeyRef/.test(billingPage));
}

if (billingApi) {
  addCheck('billing API uses Idempotency-Key header', billingApi.includes('Idempotency-Key'));
  addCheck('billing API includes summary endpoint', billingApi.includes('getSummary'));
}

if (subscriptionsApi) {
  addCheck('subscriptions API includes switch endpoint', subscriptionsApi.includes('endpoints.subscriptions.switch'));
  addCheck('subscriptions API uses Idempotency-Key header', subscriptionsApi.includes('Idempotency-Key'));
}

if (endpoints) {
  addCheck('endpoints include /api/billing/summary', endpoints.includes("summary: '/api/billing/summary'"));
  addCheck('endpoints include /api/subscriptions/switch', endpoints.includes("switch: '/api/subscriptions/switch'"));
}

addCheck('billing gate uses summary', billingGate.includes('billingApi.getSummary'));
addCheck('enqueue hook handles SUBSCRIPTION_REQUIRED', enqueueHook.includes('SUBSCRIPTION_REQUIRED'));

console.log('# Retail Billing Frontend Usage Audit');
console.log(lines.join('\n'));

if (issues.length) {
  console.error(`\nFAIL: ${issues.length} issue(s) found.`);
  process.exit(1);
} else {
  console.log('\nPASS: Retail billing frontend usage checks passed.');
}
