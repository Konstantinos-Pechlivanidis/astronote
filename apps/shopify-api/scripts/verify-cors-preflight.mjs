/**
 * Verify CORS preflight for critical authenticated routes.
 *
 * Usage:
 *   SHOPIFY_API_BASE_URL=http://localhost:8080 node scripts/verify-cors-preflight.mjs
 *
 * Output:
 *   /tmp/shopify_cors_preflight_report.md
 */

import fs from 'node:fs';

const BASE_URL = process.env.SHOPIFY_API_BASE_URL || `http://localhost:${process.env.PORT || 8080}`;
const ORIGIN = 'https://astronote.onrender.com';

const checks = [
  {
    name: 'campaign enqueue',
    path: '/campaigns/test-campaign-id/enqueue',
    method: 'POST',
    requestHeaders: 'authorization,content-type,x-shopify-shop-domain,idempotency-key',
  },
  {
    name: 'subscriptions subscribe',
    path: '/subscriptions/subscribe',
    method: 'POST',
    requestHeaders: 'authorization,content-type,x-shopify-shop-domain',
  },
  {
    name: 'billing summary',
    path: '/billing/summary',
    method: 'GET',
    requestHeaders: 'authorization,x-shopify-shop-domain',
  },
];

function header(h, name) {
  return h.get(name) || '';
}

function includesToken(h, token) {
  return h
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(token.toLowerCase());
}

async function runOne(c) {
  const res = await fetch(`${BASE_URL}${c.path}`, {
    method: 'OPTIONS',
    headers: {
      Origin: ORIGIN,
      'Access-Control-Request-Method': c.method,
      'Access-Control-Request-Headers': c.requestHeaders,
    },
  });

  const allowOrigin = header(res.headers, 'access-control-allow-origin');
  const allowMethods = header(res.headers, 'access-control-allow-methods');
  const allowHeaders = header(res.headers, 'access-control-allow-headers');
  const allowCredentials = header(res.headers, 'access-control-allow-credentials');

  const okOrigin = allowOrigin === ORIGIN;
  const okMethods = includesToken(allowMethods, c.method);
  const okHeaders =
    includesToken(allowHeaders, 'authorization') &&
    (c.requestHeaders.includes('content-type') ? includesToken(allowHeaders, 'content-type') : true) &&
    (c.requestHeaders.includes('x-shopify-shop-domain')
      ? includesToken(allowHeaders, 'x-shopify-shop-domain')
      : true);

  return {
    ...c,
    status: res.status,
    allowOrigin,
    allowMethods,
    allowHeaders,
    allowCredentials,
    ok: okOrigin && okMethods && okHeaders,
  };
}

async function main() {
  const results = [];
  let allOk = true;

  for (const c of checks) {
    const r = await runOne(c);
    results.push(r);
    if (!r.ok) allOk = false;
  }

  const lines = [];
  lines.push('# Shopify CORS preflight verification');
  lines.push('');
  lines.push(`Base URL: \`${BASE_URL}\``);
  lines.push(`Origin: \`${ORIGIN}\``);
  lines.push('');
  lines.push('| check | path | method | status | allow-origin | allow-methods | allow-headers | allow-credentials | ok |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of results) {
    lines.push(
      `| ${r.name} | \`${r.path}\` | ${r.method} | ${r.status} | ${r.allowOrigin || ''} | ${r.allowMethods || ''} | ${r.allowHeaders || ''} | ${r.allowCredentials || ''} | ${r.ok ? '✅' : '❌'} |`,
    );
  }

  lines.push('');
  lines.push(allOk ? '✅ All preflight checks passed' : '❌ One or more preflight checks failed');
  lines.push('');

  fs.writeFileSync('/tmp/shopify_cors_preflight_report.md', lines.join('\n'), 'utf8');
  console.log('Wrote /tmp/shopify_cors_preflight_report.md');

  if (!allOk) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


