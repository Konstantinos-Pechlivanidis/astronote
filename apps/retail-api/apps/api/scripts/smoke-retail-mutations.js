/**
 * Retail API mutation smoke tests (optional).
 *
 * Requirements:
 * - RETAIL_API_BASE_URL (default: http://localhost:3001)
 * - RETAIL_TEST_TOKEN (Bearer token) OR the script will SKIP protected calls.
 *
 * Output:
 * - /tmp/retail_api_smoke_results.md
 */

const fs = require('fs');
const path = require('path');

const loadEnv = require('../src/config/loadEnv');
loadEnv();

const OUTPUT_PATH = '/tmp/retail_api_smoke_results.md';

const BASE_URL = process.env.RETAIL_API_BASE_URL || process.env.NEXT_PUBLIC_RETAIL_API_BASE_URL || 'http://localhost:3001';
const TOKEN = process.env.RETAIL_TEST_TOKEN || '';

async function http(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { status: res.status, ok: res.ok, json, text };
}

function assertHasKeys(obj, keys) {
  if (!obj || typeof obj !== 'object') return false;
  return keys.every((k) => Object.prototype.hasOwnProperty.call(obj, k));
}

async function main() {
  const lines = [];
  lines.push(`# Retail API smoke results\n`);
  lines.push(`Base URL: \`${BASE_URL}\`\n`);
  lines.push(`Token provided: **${TOKEN ? 'yes' : 'no'}**\n`);
  lines.push(`Generated: ${new Date().toISOString()}\n`);

  // Health check (should be public)
  try {
    const health = await http('GET', `${BASE_URL}/api/health`, null);
    lines.push(`## GET /api/health\n- status: ${health.status}\n`);
  } catch (e) {
    lines.push(`## GET /api/health\n- ERROR: ${e?.message || String(e)}\n`);
  }

  if (!TOKEN) {
    lines.push(`\n## Protected mutation smoke\n- SKIPPED (set RETAIL_TEST_TOKEN to run)\n`);
    fs.writeFileSync(OUTPUT_PATH, lines.join('\n'));
    console.log(`Wrote ${OUTPUT_PATH}`);
    return;
  }

  // A small, safe subset that should exist if FE works (no destructive operations).
  const tests = [];

  // Billing summary (read)
  tests.push({
    name: 'GET /api/billing/summary',
    run: async () => http('GET', `${BASE_URL}/api/billing/summary`, null),
    assert: (r) => r.ok,
  });

  // Contacts create (mutation) – uses random phone to avoid collisions.
  const rnd = Math.floor(Math.random() * 1e9);
  const phone = `+1555${String(rnd).padStart(9, '0').slice(0, 9)}`;
  tests.push({
    name: 'POST /api/contacts',
    run: async () => http('POST', `${BASE_URL}/api/contacts`, { phone, firstName: 'Smoke', lastName: 'Test' }),
    assert: (r) => r.ok && (assertHasKeys(r.json, ['id']) || assertHasKeys(r.json, ['contact'])),
  });

  for (const t of tests) {
    lines.push(`\n## ${t.name}\n`);
    try {
      const r = await t.run();
      lines.push(`- status: ${r.status}`);
      lines.push(`- ok: ${r.ok}`);
      lines.push(`- bodyKeys: ${r.json && typeof r.json === 'object' ? Object.keys(r.json).slice(0, 20).join(', ') : '(non-json)'}`);
      const pass = t.assert(r);
      lines.push(`- result: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
      if (!pass) {
        lines.push(`- body: ${r.text?.slice(0, 500) || '(empty)'}`);
        fs.writeFileSync(OUTPUT_PATH, lines.join('\n'));
        console.error(`Wrote ${OUTPUT_PATH}`);
        process.exit(1);
      }
    } catch (e) {
      lines.push(`- ERROR: ${e?.message || String(e)}`);
      fs.writeFileSync(OUTPUT_PATH, lines.join('\n'));
      console.error(`Wrote ${OUTPUT_PATH}`);
      process.exit(1);
    }
  }

  fs.writeFileSync(OUTPUT_PATH, lines.join('\n'));
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


