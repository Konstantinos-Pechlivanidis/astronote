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

const billingRoutesPath = path.join(root, 'apps', 'retail-api', 'apps', 'api', 'src', 'routes', 'billing.js');
const billingRoutes = readText(billingRoutesPath);
addCheck('billing routes file exists', !!billingRoutesPath && !!billingRoutes);

const campaignsRoutesPath = path.join(root, 'apps', 'retail-api', 'apps', 'api', 'src', 'routes', 'campaigns.js');
const campaignsRoutes = readText(campaignsRoutesPath) || '';

const subscriptionServicePath = path.join(root, 'apps', 'retail-api', 'apps', 'api', 'src', 'services', 'subscription.service.js');
const subscriptionService = readText(subscriptionServicePath) || '';

if (billingRoutes) {
  const requiredRoutes = [
    "r.get('/billing/summary', requireAuth",
    "r.get('/billing/balance', requireAuth",
    "r.get('/billing/packages', requireAuth",
    "r.post('/billing/purchase', requireAuth",
    "r.post('/billing/topup', requireAuth",
    "r.get('/billing/topup/calculate', requireAuth",
    "r.get('/subscriptions/portal', requireAuth",
    "r.post('/subscriptions/switch', requireAuth",
    "r.post('/subscriptions/cancel', requireAuth",
  ];

  requiredRoutes.forEach((route) => {
    addCheck(`route present: ${route}`, billingRoutes.includes(route));
  });

  addCheck('billing summary includes credits balance', billingRoutes.includes('credits: { balance'));
  addCheck('billing summary includes allowance', billingRoutes.includes('allowance'));
  addCheck('billing summary includes billingCurrency', billingRoutes.includes('billingCurrency'));

  addCheck('billing purchase enforces Idempotency-Key', billingRoutes.includes('MISSING_IDEMPOTENCY_KEY'));
  addCheck('billing purchase reads idempotency header', billingRoutes.includes('idempotency-key'));

  addCheck('packages use resolveBillingCurrency', billingRoutes.includes('resolveBillingCurrency'));
  addCheck('packages set ETag', billingRoutes.includes("res.set('ETag'"));

  addCheck('portal returns portalUrl', billingRoutes.includes('portalUrl'));
  addCheck('portal error code STRIPE_PORTAL_ERROR', billingRoutes.includes('STRIPE_PORTAL_ERROR'));

  addCheck('switch validates INVALID_INTERVAL', billingRoutes.includes('INVALID_INTERVAL'));
  addCheck('switch validates NO_ACTIVE_SUBSCRIPTION', billingRoutes.includes('NO_ACTIVE_SUBSCRIPTION'));
  addCheck('cancel validates INACTIVE_SUBSCRIPTION', billingRoutes.includes('INACTIVE_SUBSCRIPTION'));
}

addCheck('campaign enqueue returns SUBSCRIPTION_REQUIRED', campaignsRoutes.includes('SUBSCRIPTION_REQUIRED'));

addCheck('subscription service tracks allowance fields',
  subscriptionService.includes('includedSmsPerPeriod') &&
  subscriptionService.includes('usedSmsThisPeriod') &&
  subscriptionService.includes('remainingSmsThisPeriod')
);

lines.push('');
lines.push(`Total checks: ${lines.length}`);

console.log('# Retail Billing Contract Audit');
console.log(lines.join('\n'));

if (issues.length) {
  console.error(`\nFAIL: ${issues.length} issue(s) found.`);
  process.exit(1);
} else {
  console.log('\nPASS: Retail billing contract checks passed.');
}
