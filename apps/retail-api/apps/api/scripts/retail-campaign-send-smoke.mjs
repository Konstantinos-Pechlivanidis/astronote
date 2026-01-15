/**
 * Smoke: Retail campaign send pipeline (enqueue → status → KPIs/balance refresh)
 *
 * Env:
 *   API_BASE=http://localhost:3001
 *   AUTH="Bearer <token>"            (required)
 *   CAMPAIGN_ID=123                  (required)
 *
 * Output:
 *   /tmp/retail_campaign_send_smoke.md
 *
 * Notes:
 * - This script is report-only and does NOT create fixtures (no DB writes except enqueue).
 * - Retail credits may be consumed via allowance first, then wallet balance.
 */
import fs from 'node:fs';

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const AUTH = process.env.AUTH || null;
const CAMPAIGN_ID = process.env.CAMPAIGN_ID ? Number(process.env.CAMPAIGN_ID) : null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function nowIso() {
  return new Date().toISOString();
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
      ...(AUTH ? { Authorization: AUTH } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = safeJsonParse(text);
  return { status: res.status, json, text };
}

async function main() {
  if (!AUTH) throw new Error('AUTH is required (Bearer token).');
  if (!CAMPAIGN_ID || Number.isNaN(CAMPAIGN_ID)) throw new Error('CAMPAIGN_ID is required.');

  const t0 = Date.now();
  const lines = [];
  lines.push('# Retail campaign send smoke');
  lines.push('');
  lines.push(`- time: \`${nowIso()}\``);
  lines.push(`- API_BASE: \`${API_BASE}\``);
  lines.push(`- campaignId: \`${CAMPAIGN_ID}\``);
  lines.push('');

  const beforeCampaign = await api(`/api/campaigns/${CAMPAIGN_ID}`, { method: 'GET' });
  const beforeStatus = await api(`/api/campaigns/${CAMPAIGN_ID}/status`, { method: 'GET' });
  const beforeBalance = await api('/api/billing/balance', { method: 'GET' });
  const beforeKpis = await api('/api/dashboard/kpis', { method: 'GET' });

  lines.push('## Before');
  lines.push(`- GET /campaigns/:id → ${beforeCampaign.status}`);
  lines.push(`- GET /campaigns/:id/status → ${beforeStatus.status}`);
  lines.push(`- GET /billing/balance → ${beforeBalance.status}`);
  lines.push(`- GET /dashboard/kpis → ${beforeKpis.status}`);
  lines.push('');

  const enqueueAt = Date.now();
  const enqueue = await api(`/api/campaigns/${CAMPAIGN_ID}/enqueue`, { method: 'POST', body: {} });
  lines.push('## Enqueue');
  lines.push(`- POST /campaigns/:id/enqueue → ${enqueue.status} (t+${enqueueAt - t0}ms)`);
  lines.push('```json');
  lines.push(JSON.stringify(enqueue.json ?? { raw: enqueue.text }, null, 2));
  lines.push('```');
  lines.push('');

  let success = false;
  let lastStatus = null;
  let lastBalance = null;
  let lastKpis = null;

  const beforeCredits =
    beforeBalance.json?.credits ??
    beforeBalance.json?.balance ??
    beforeBalance.json?.data?.credits ??
    beforeBalance.json?.data?.balance ??
    null;
  const beforeAllowanceRemaining =
    beforeBalance.json?.allowance?.remainingThisPeriod ??
    beforeBalance.json?.data?.allowance?.remainingThisPeriod ??
    null;
  const beforeSent =
    beforeKpis.json?.sent ??
    beforeKpis.json?.totalMessages ??
    beforeKpis.json?.data?.sent ??
    beforeKpis.json?.data?.totalMessages ??
    null;

  lines.push('## Poll (1s interval, up to 60s)');
  for (let i = 0; i < 60; i++) {
    lastStatus = await api(`/api/campaigns/${CAMPAIGN_ID}/status`, { method: 'GET' });
    lastBalance = await api('/api/billing/balance', { method: 'GET' });
    lastKpis = await api('/api/dashboard/kpis', { method: 'GET' });

    const status = lastStatus.json?.campaign?.status || lastStatus.json?.data?.campaign?.status || null;
    const delivered =
      lastStatus.json?.stats?.delivered ??
      lastStatus.json?.data?.stats?.delivered ??
      0;
    const pendingDelivery =
      lastStatus.json?.stats?.pendingDelivery ??
      lastStatus.json?.data?.stats?.pendingDelivery ??
      0;

    const credits =
      lastBalance.json?.balance ??
      lastBalance.json?.data?.balance ??
      null;
    const allowanceRemaining =
      lastBalance.json?.allowance?.remainingThisPeriod ??
      lastBalance.json?.data?.allowance?.remainingThisPeriod ??
      null;

    const sent = lastKpis.json?.sent ?? lastKpis.json?.data?.sent ?? null;

    const t = Date.now() - t0;
    lines.push(
      `- t+${t}ms status=${status || '(n/a)'} delivered=${delivered} pendingDelivery=${pendingDelivery} wallet=${credits ?? '(n/a)'} allowanceRemaining=${allowanceRemaining ?? '(n/a)'} kpis.sent=${sent ?? '(n/a)'}`,
    );

    const creditsChanged =
      typeof credits === 'number' && typeof beforeCredits === 'number' ? credits !== beforeCredits : false;
    const allowanceChanged =
      typeof allowanceRemaining === 'number' && typeof beforeAllowanceRemaining === 'number'
        ? allowanceRemaining !== beforeAllowanceRemaining
        : false;
    const kpisChanged =
      typeof sent === 'number' && typeof beforeSent === 'number' ? sent !== beforeSent : false;

    if ((status === 'sending' || status === 'completed' || status === 'failed') && (creditsChanged || allowanceChanged || kpisChanged)) {
      success = true;
      break;
    }

    if (enqueue.status >= 400) break;
    await sleep(1000);
  }

  lines.push('');
  lines.push('## Final snapshots');
  lines.push('### /campaigns/:id/status');
  lines.push('```json');
  lines.push(JSON.stringify(lastStatus?.json ?? { raw: lastStatus?.text }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('### /billing/balance');
  lines.push('```json');
  lines.push(JSON.stringify(lastBalance?.json ?? { raw: lastBalance?.text }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('### /dashboard/kpis');
  lines.push('```json');
  lines.push(JSON.stringify(lastKpis?.json ?? { raw: lastKpis?.text }, null, 2));
  lines.push('```');
  lines.push('');

  lines.push(success ? '✅ smoke passed' : '❌ smoke failed');
  lines.push('');

  fs.writeFileSync('/tmp/retail_campaign_send_smoke.md', lines.join('\n'), 'utf8');
  console.log('Wrote /tmp/retail_campaign_send_smoke.md');
  if (!success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


