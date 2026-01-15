/**
 * Smoke: verify Shopify campaigns + billing stay consistent and fresh after a send.
 *
 * Env:
 *   API_BASE=http://localhost:8080
 *   SHOP_DOMAIN=sms-blossom-dev.myshopify.com
 *   CAMPAIGN_ID=...
 *   AUTH="Bearer <token>" (optional; can use shopify_token via shopifyApi in web, but here it's explicit)
 *
 * Output:
 *   /tmp/shopify_campaigns_billing_consistency.md
 */
import fs from 'node:fs';

const API_BASE = process.env.API_BASE || 'http://localhost:8080';
const SHOP_DOMAIN = process.env.SHOP_DOMAIN || null;
const CAMPAIGN_ID = process.env.CAMPAIGN_ID || null;
const AUTH = process.env.AUTH || null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(SHOP_DOMAIN ? { 'X-Shopify-Shop-Domain': SHOP_DOMAIN } : {}),
      ...(AUTH ? { Authorization: AUTH } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = safeJsonParse(text);
  return { status: res.status, json, text, headers: res.headers };
}

function getByPath(obj, path, fallback = null) {
  let cur = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object' || !(key in cur)) return fallback;
    cur = cur[key];
  }
  return cur ?? fallback;
}

function availableToSendFromSummary(summary) {
  const wallet = Number(getByPath(summary, ['credits', 'balance'], 0)) || 0;
  const remaining = Number(getByPath(summary, ['allowance', 'remainingThisPeriod'], 0)) || 0;
  return wallet + remaining;
}

async function main() {
  if (!SHOP_DOMAIN) throw new Error('SHOP_DOMAIN is required.');
  if (!CAMPAIGN_ID) throw new Error('CAMPAIGN_ID is required.');

  const lines = [];
  const t0 = Date.now();
  const now = new Date().toISOString();

  lines.push('# Shopify campaigns + billing consistency smoke');
  lines.push('');
  lines.push(`- time: \`${now}\``);
  lines.push(`- API_BASE: \`${API_BASE}\``);
  lines.push(`- SHOP_DOMAIN: \`${SHOP_DOMAIN}\``);
  lines.push(`- CAMPAIGN_ID: \`${CAMPAIGN_ID}\``);
  lines.push('');

  const beforeStats = await api('/campaigns/stats/summary');
  const beforeList = await api('/campaigns', { method: 'GET' });
  const beforeBilling = await api('/billing/summary', { method: 'GET' });

  const beforeAvail = availableToSendFromSummary(beforeBilling.json || {});
  lines.push('## Before');
  lines.push(`- GET /campaigns/stats/summary → ${beforeStats.status}`);
  lines.push(`- GET /campaigns → ${beforeList.status}`);
  lines.push(`- GET /billing/summary → ${beforeBilling.status}`);
  lines.push(`- availableToSend (allowance + wallet): ${beforeAvail}`);
  lines.push('');

  // Enqueue
  const enqueue = await api(`/campaigns/${CAMPAIGN_ID}/enqueue`, { method: 'POST', body: {} });
  lines.push('## Enqueue');
  lines.push(`- POST /campaigns/:id/enqueue → ${enqueue.status} (t+${Date.now() - t0}ms)`);
  lines.push('```json');
  lines.push(JSON.stringify(enqueue.json ?? { raw: enqueue.text }, null, 2));
  lines.push('```');
  lines.push('');

  let ok = false;
  let lastStatus = null;
  let lastStats = null;
  let lastBilling = null;
  let lastList = null;

  lines.push('## Poll (1s interval, up to 60s)');
  for (let i = 0; i < 60; i++) {
    lastStatus = await api(`/campaigns/${CAMPAIGN_ID}/status`);
    lastStats = await api('/campaigns/stats/summary');
    lastList = await api('/campaigns');
    lastBilling = await api('/billing/summary');

    const campaignStatus =
      getByPath(lastStatus.json, ['data', 'campaign', 'status'], null) ??
      getByPath(lastStatus.json, ['campaign', 'status'], null);

    const accepted =
      Number(getByPath(lastStatus.json, ['data', 'canonical', 'totals', 'accepted'], 0)) ||
      Number(getByPath(lastStatus.json, ['canonical', 'totals', 'accepted'], 0)) ||
      0;

    const byStatus =
      getByPath(lastStats.json, ['data', 'byStatus'], null) ??
      getByPath(lastStats.json, ['byStatus'], null) ??
      {};

    const sendingCount = Number(byStatus.sending || 0);
    const completedCount = Number((byStatus.completed ?? byStatus.sent) || 0);

    const avail = availableToSendFromSummary(getByPath(lastBilling.json, ['data'], lastBilling.json) || {});

    const t = Date.now() - t0;
    lines.push(`- t+${t}ms campaignStatus=${campaignStatus || '(n/a)'} accepted=${accepted} stats.sending=${sendingCount} stats.completed=${completedCount} availableToSend=${avail}`);

    const availableChanged = avail !== beforeAvail;
    const hasSendProgress = accepted > 0;
    const statsMoved = sendingCount > 0 || completedCount > 0;

    if (hasSendProgress && availableChanged && statsMoved) {
      ok = true;
      break;
    }

    await sleep(1000);
  }

  lines.push('');
  lines.push('## Final snapshots');
  lines.push('### /campaigns/:id/status');
  lines.push('```json');
  lines.push(JSON.stringify(lastStatus?.json ?? { raw: lastStatus?.text }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('### /campaigns/stats/summary');
  lines.push('```json');
  lines.push(JSON.stringify(lastStats?.json ?? { raw: lastStats?.text }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('### /billing/summary');
  lines.push('```json');
  lines.push(JSON.stringify(lastBilling?.json ?? { raw: lastBilling?.text }, null, 2));
  lines.push('```');
  lines.push('');

  lines.push(ok ? '✅ smoke passed' : '❌ smoke failed');
  lines.push('');

  fs.writeFileSync('/tmp/shopify_campaigns_billing_consistency.md', lines.join('\n'), 'utf8');
  console.log('Wrote /tmp/shopify_campaigns_billing_consistency.md');
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


