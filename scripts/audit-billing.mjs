import fs from 'fs';
import path from 'path';

const root = process.cwd();
const reportPath = path.join(root, 'reports', 'billing-e2e-verification.md');

const readText = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return null;
  }
};

const fileExists = (filePath) => fs.existsSync(filePath);

const issues = [];
const lines = [];

const addCheck = (label, ok, details = '') => {
  const status = ok ? 'OK' : 'FAIL';
  lines.push(`- ${status}: ${label}${details ? ` (${details})` : ''}`);
  if (!ok) {
    issues.push(`${label}${details ? ` (${details})` : ''}`);
  }
};

const getModelBlock = (schema, modelName) => {
  const regex = new RegExp(`model\\s+${modelName}\\s+\\{([\\s\\S]*?)\\n\\}`, 'm');
  const match = schema.match(regex);
  return match ? match[1] : null;
};

const hasField = (block, field) => new RegExp(`^\\s*${field}\\b`, 'm').test(block || '');

const hasAttribute = (block, attr) => new RegExp(attr, 'm').test(block || '');
const hasUniqueField = (block, field) =>
  new RegExp(`^\\s*${field}\\b.*@unique`, 'm').test(block || '') ||
  new RegExp(`@@unique\\(\\[\\s*${field}\\s*\\]\\)`, 'm').test(block || '');
const hasCompositeUnique = (block, fields) => {
  const joined = fields.map((f) => `\\s*${f}\\s*`).join(',');
  return new RegExp(`@@unique\\(\\[${joined}\\]\\)`, 'm').test(block || '');
};
const hasRegex = (text, regex) => regex.test(text || '');

const scanForPattern = (startPath, pattern, ignoreDirs = []) => {
  const matches = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      if (ignoreDirs.includes(entry)) {
        continue;
      }
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        const content = readText(fullPath);
        if (content && content.includes(pattern)) {
          matches.push(fullPath);
        }
      }
    }
  };
  walk(startPath);
  return matches;
};

lines.push('# Billing E2E Verification');
lines.push('');
lines.push(`Run Date: ${new Date().toISOString()}`);
lines.push('');

// Prisma checks
lines.push('## Prisma Schema Checks');
const schemaPath = path.join(root, 'apps', 'retail-api', 'prisma', 'schema.prisma');
const schema = readText(schemaPath);
addCheck('schema.prisma exists', !!schemaPath && !!schema);

if (schema) {
  const userBlock = getModelBlock(schema, 'User');
  const purchaseBlock = getModelBlock(schema, 'Purchase');
  const packageBlock = getModelBlock(schema, 'Package');
  const walletBlock = getModelBlock(schema, 'Wallet');
  const creditTxnBlock = getModelBlock(schema, 'CreditTransaction');
  const webhookBlock = getModelBlock(schema, 'WebhookEvent');
  const billingCurrencyMatch = schema.match(/enum\\s+BillingCurrency\\s+\\{([\\s\\S]*?)\\}/m);
  const billingCurrencyEnum = !!billingCurrencyMatch;
  const billingCurrencyValues = billingCurrencyMatch ? billingCurrencyMatch[1] : '';

  addCheck('User model exists', !!userBlock);
  addCheck('User.stripeCustomerId', hasField(userBlock, 'stripeCustomerId'));
  addCheck('User.stripeSubscriptionId', hasField(userBlock, 'stripeSubscriptionId'));
  addCheck('User.planType', hasField(userBlock, 'planType'));
  addCheck('User.subscriptionStatus', hasField(userBlock, 'subscriptionStatus'));
  addCheck('User.billingCurrency', hasField(userBlock, 'billingCurrency'));
  addCheck('BillingCurrency enum present', billingCurrencyEnum);
  addCheck('BillingCurrency includes EUR', billingCurrencyValues.includes('EUR'));
  addCheck('BillingCurrency includes USD', billingCurrencyValues.includes('USD'));

  addCheck('Wallet model exists', !!walletBlock);
  addCheck('Wallet.ownerId', hasField(walletBlock, 'ownerId'));
  addCheck('Wallet.balance', hasField(walletBlock, 'balance'));

  addCheck('CreditTransaction model exists', !!creditTxnBlock);
  addCheck('CreditTransaction.ownerId', hasField(creditTxnBlock, 'ownerId'));
  addCheck('CreditTransaction.amount', hasField(creditTxnBlock, 'amount'));
  addCheck('CreditTransaction.meta', hasField(creditTxnBlock, 'meta'));

  addCheck('Package model exists', !!packageBlock);
  addCheck('Package.stripePriceIdEur', hasField(packageBlock, 'stripePriceIdEur'));
  addCheck('Package.stripePriceIdUsd', hasField(packageBlock, 'stripePriceIdUsd'));
  addCheck('Package.priceCentsUsd', hasField(packageBlock, 'priceCentsUsd'));
  addCheck('Package unique name', hasUniqueField(packageBlock, 'name'));

  addCheck('Purchase model exists', !!purchaseBlock);
  addCheck('Purchase.units', hasField(purchaseBlock, 'units'));
  addCheck('Purchase.priceCents', hasField(purchaseBlock, 'priceCents'));
  addCheck('Purchase.status', hasField(purchaseBlock, 'status'));
  addCheck('Purchase.stripeSessionId', hasField(purchaseBlock, 'stripeSessionId'));
  addCheck('Purchase.stripePaymentIntentId', hasField(purchaseBlock, 'stripePaymentIntentId'));
  addCheck('Purchase.currency', hasField(purchaseBlock, 'currency'));
  addCheck('Purchase.idempotencyKey', hasField(purchaseBlock, 'idempotencyKey'));
  addCheck('Purchase ownerId+idempotencyKey unique', hasCompositeUnique(purchaseBlock, ['ownerId', 'idempotencyKey']));

  addCheck('WebhookEvent model exists', !!webhookBlock);
}

lines.push('');

// Backend route checks
lines.push('## Backend Route Checks');
const billingRoutesPath = path.join(root, 'apps', 'retail-api', 'apps', 'api', 'src', 'routes', 'billing.js');
const billingRoutes = readText(billingRoutesPath) || '';

const requiredRoutes = [
  "r.get('/billing/balance'",
  "r.get('/billing/wallet'",
  "r.get('/billing/transactions'",
  "r.get('/billing/packages'",
  "r.post('/billing/purchase'",
  "r.post('/billing/topup'",
  "r.get('/subscriptions/portal'",
  "r.post('/subscriptions/subscribe'",
  "r.post('/subscriptions/update'",
  "r.post('/subscriptions/cancel'",
];

requiredRoutes.forEach((snippet) => {
  addCheck(`Route present: ${snippet}`, billingRoutes.includes(snippet));
});

const serverPath = path.join(root, 'apps', 'retail-api', 'apps', 'api', 'src', 'server.js');
const serverText = readText(serverPath) || '';
addCheck('Billing routes registered in server', serverText.includes("app.use('/api', require('./routes/billing'))"));
addCheck('Stripe webhooks registered in server', serverText.includes("app.use(require('./routes/stripe.webhooks'))"));

const webhookPath = path.join(root, 'apps', 'retail-api', 'apps', 'api', 'src', 'routes', 'stripe.webhooks.js');
const webhookText = readText(webhookPath) || '';
addCheck('Stripe webhook endpoint present', webhookText.includes("router.post('/webhooks/stripe'"));

const stripePricesPath = path.join(root, 'apps', 'retail-api', 'apps', 'api', 'src', 'billing', 'stripePrices.js');
const stripePricesText = readText(stripePricesPath) || '';
addCheck('Stripe price mapping module exists', fileExists(stripePricesPath));
addCheck('Stripe price mapping has credit topup template', stripePricesText.includes('STRIPE_PRICE_ID_CREDIT_TOPUP_'));
addCheck('Stripe price mapping has subscription template', stripePricesText.includes('STRIPE_PRICE_ID_SUB_'));
addCheck('Stripe price mapping supports USD', stripePricesText.includes('USD'));

const packagesSeedPath = path.join(root, 'apps', 'retail-api', 'prisma', 'migrations', '20250108153000_billing_schema_alignment', 'migration.sql');
const packagesSeedText = readText(packagesSeedPath) || '';
addCheck('Package seed migration present', fileExists(packagesSeedPath));
addCheck('Package seed migration inserts packages', packagesSeedText.includes('INSERT INTO "public"."Package"'));

addCheck('Billing packages uses resolveBillingCurrency', billingRoutes.includes('resolveBillingCurrency'));
addCheck('Billing packages uses Prisma Package query', billingRoutes.includes('prisma.package.findMany'));
addCheck('Billing packages ETag guard present', billingRoutes.includes("if (enriched.length > 0)") && billingRoutes.includes("res.set('ETag'"));
addCheck('Stripe customer validation uses cus_ prefix', billingRoutes.includes("startsWith('cus_')"));
addCheck('Portal uses resolveStripeCustomerId', billingRoutes.includes("resolveStripeCustomerId") && billingRoutes.includes("r.get('/subscriptions/portal'"));
addCheck('Billing balance includes billingCurrency', billingRoutes.includes('billingCurrency'));
addCheck('Purchase route checks Idempotency-Key', billingRoutes.includes('idempotency-key'));

lines.push('');

// Frontend checks
lines.push('## Frontend Checks');
const billingPagePath = path.join(root, 'apps', 'astronote-web', 'app', 'app', 'retail', 'billing', 'page.tsx');
addCheck('Retail billing page exists', fileExists(billingPagePath));
const billingPage = readText(billingPagePath) || '';
addCheck('Billing page uses billingApi.getBalance', billingPage.includes('billingApi.getBalance'));
addCheck('Billing page uses billingApi.getPackages', billingPage.includes('billingApi.getPackages'));
addCheck('Billing page uses billingApi.purchase', billingPage.includes('billingApi.purchase'));
addCheck('Billing page uses billingApi.topup', billingPage.includes('billingApi.topup'));
addCheck('Billing page uses billingApi.calculateTopup', billingPage.includes('billingApi.calculateTopup'));
addCheck('Billing page uses subscriptionsApi.getPortal', billingPage.includes('subscriptionsApi.getPortal'));
addCheck('Billing page passes selectedCurrency', billingPage.includes('selectedCurrency'));
addCheck('Billing page passes currency to packages', billingPage.includes('billingApi.getPackages(selectedCurrency)'));
addCheck('Billing page passes currency to purchase', hasRegex(billingPage, /billingApi\.purchase\([\\s\\S]*currency/));
addCheck('Billing page passes currency to topup', hasRegex(billingPage, /billingApi\.topup\\([\\s\\S]*currency/));
addCheck('Billing page passes currency to subscribe', hasRegex(billingPage, /subscriptionsApi\.subscribe\\([\\s\\S]*currency/));

const endpointsPath = path.join(root, 'apps', 'astronote-web', 'src', 'lib', 'retail', 'api', 'endpoints.ts');
const endpoints = readText(endpointsPath) || '';
addCheck('Endpoints include /api/billing/balance', endpoints.includes("balance: '/api/billing/balance'"));
addCheck('Endpoints include /api/billing/packages', endpoints.includes("packages: '/api/billing/packages'"));
addCheck('Endpoints include /api/billing/purchase', endpoints.includes("purchase: '/api/billing/purchase'"));
addCheck('Endpoints include /api/billing/topup', endpoints.includes("topup: '/api/billing/topup'"));
addCheck('Endpoints include /api/billing/topup/calculate', endpoints.includes("topupCalculate: '/api/billing/topup/calculate'"));
addCheck('Endpoints include /api/subscriptions/portal', endpoints.includes("portal: '/api/subscriptions/portal'"));

lines.push('');
lines.push('## Env Var Checks');
const envPaths = [
  path.join(root, 'apps', 'retail-api', '.env'),
  path.join(root, 'apps', 'retail-api', '.env.example'),
];
const requiredEnvKeys = [
  'STRIPE_PRICE_ID_CREDIT_TOPUP_EUR',
  'STRIPE_PRICE_ID_CREDIT_TOPUP_USD',
  'STRIPE_PRICE_ID_SUB_STARTER_EUR',
  'STRIPE_PRICE_ID_SUB_STARTER_USD',
  'STRIPE_PRICE_ID_SUB_PRO_EUR',
  'STRIPE_PRICE_ID_SUB_PRO_USD',
];
envPaths.forEach((envPath) => {
  const envText = readText(envPath);
  if (!envText) {
    addCheck(`Env file exists: ${path.basename(envPath)}`, false);
    return;
  }
  addCheck(`Env file exists: ${path.basename(envPath)}`, true);
  requiredEnvKeys.forEach((key) => {
    addCheck(`${path.basename(envPath)} includes ${key}`, envText.includes(`${key}=`));
  });
});

lines.push('');

// Placeholder scan
lines.push('## Placeholder Scan');
const placeholderMatches = [
  ...scanForPattern(
    path.join(root, 'apps', 'retail-api', 'apps', 'api', 'src'),
    'dev_customer_',
    ['node_modules', '.git', '.next', 'dist', 'build']
  ),
  ...scanForPattern(
    path.join(root, 'apps', 'retail-api', 'apps', 'worker'),
    'dev_customer_',
    ['node_modules', '.git', '.next', 'dist', 'build']
  ),
  ...scanForPattern(
    path.join(root, 'apps', 'astronote-web'),
    'dev_customer_',
    ['node_modules', '.git', '.next', 'dist', 'build']
  ),
];
addCheck('No dev_customer_ placeholders in code', placeholderMatches.length === 0, placeholderMatches.join(', '));

lines.push('');

// Tenant scoping scan (best-effort)
lines.push('## Tenant Scoping Scan (Best-Effort)');
const tenantPatterns = [
  'ownerId: req.user.id',
  'where: { ownerId: req.user.id',
  'req.user.id',
];
const tenantMatches = tenantPatterns.some((pattern) => billingRoutes.includes(pattern));
addCheck('Billing routes reference req.user.id for tenant scoping', tenantMatches);

lines.push('');
lines.push('## Summary');
lines.push(`- Issues: ${issues.length}`);
if (issues.length > 0) {
  lines.push('- Failed Checks:');
  issues.forEach((issue) => {
    lines.push(`  - ${issue}`);
  });
} else {
  lines.push('- All checks passed');
}

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, lines.join('\n'));

console.log(lines.join('\n'));
if (issues.length > 0) {
  process.exitCode = 1;
}
