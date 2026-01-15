/**
 * Smoke: campaign send pipeline (enqueue → status/progress → balance refresh)
 *
 * Env:
 *   API_BASE=http://localhost:8080
 *   SHOP_DOMAIN=sms-blossom-dev.myshopify.com
 *   CAMPAIGN_ID=...
 *   AUTH="Bearer <token>" (optional)
 *
 * If CAMPAIGN_ID is not provided, this script will create a small fixture (shop+contacts+campaign).
 *
 * Output:
 *   /tmp/shopify_campaign_send_smoke.md
 */

import fs from 'node:fs';

import loadEnv from '../config/loadEnv.js';
import prisma from '../services/prisma.js';

loadEnv();

const API_BASE = process.env.API_BASE || process.env.SHOPIFY_API_BASE_URL || 'http://localhost:8080';
const SHOP_DOMAIN = process.env.SHOP_DOMAIN || process.env.SHOPIFY_SHOP_DOMAIN || null;
const AUTH = process.env.AUTH || null;

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
      ...(SHOP_DOMAIN ? { 'X-Shopify-Shop-Domain': SHOP_DOMAIN } : {}),
      ...(AUTH ? { Authorization: AUTH } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = safeJsonParse(text);
  return { status: res.status, json, text };
}

async function ensureShop(shopDomain) {
  const existing = await prisma.shop.findUnique({ where: { shopDomain } });
  if (existing) return existing;
  return await prisma.shop.create({
    data: {
      shopDomain,
      shopName: shopDomain.replace('.myshopify.com', ''),
      accessToken: 'smoke',
      credits: 5000,
      currency: 'EUR',
      status: 'active',
      subscriptionStatus: 'active',
      includedSmsPerPeriod: 10000,
      usedSmsThisPeriod: 0,
      subscriptionInterval: 'month',
      settings: {
        create: {
          currency: 'EUR',
          timezone: 'UTC',
          senderNumber: process.env.MITTO_SENDER_NAME || 'Astronote',
          senderName: process.env.MITTO_SENDER_NAME || 'Astronote',
        },
      },
    },
  });
}

async function seedContacts(shopId) {
  const phones = ['+15550000101', '+15550000102'];
  await prisma.contact.createMany({
    data: phones.map((phoneE164, i) => ({
      shopId,
      phoneE164,
      firstName: `Smoke${i + 1}`,
      lastName: 'User',
      smsConsent: 'opted_in',
    })),
    skipDuplicates: true,
  });
}

async function createCampaign(shopId) {
  const c = await prisma.campaign.create({
    data: {
      shopId,
      name: `Smoke send ${Date.now()}`,
      message: 'Smoke test message',
      audience: 'all',
      scheduleType: 'immediate',
      status: 'draft',
      priority: 'normal',
    },
    select: { id: true },
  });
  return c.id;
}

async function main() {
  if (!SHOP_DOMAIN) {
    throw new Error('SHOP_DOMAIN is required (for X-Shopify-Shop-Domain).');
  }

  const shop = await ensureShop(SHOP_DOMAIN);
  await seedContacts(shop.id);

  const campaignId = process.env.CAMPAIGN_ID || (await createCampaign(shop.id));

  const t0 = Date.now();
  const lines = [];
  lines.push('# Shopify campaign send smoke');
  lines.push('');
  lines.push(`- time: \`${nowIso()}\``);
  lines.push(`- API_BASE: \`${API_BASE}\``);
  lines.push(`- SHOP_DOMAIN: \`${SHOP_DOMAIN}\``);
  lines.push(`- campaignId: \`${campaignId}\``);
  lines.push('');

  // Snapshot
  const before = await api(`/campaigns/${campaignId}`, { method: 'GET' });
  const beforeBal = await api('/billing/balance', { method: 'GET' });
  const beforeSummary = await api('/billing/summary', { method: 'GET' });
  const beforeQueues = await api('/debug/queues', { method: 'GET' });
  const beforeCredits = await api('/debug/credits', { method: 'GET' });

  lines.push('## Before');
  lines.push(`- GET /campaigns/:id → ${before.status}`);
  lines.push(`- GET /billing/balance → ${beforeBal.status}`);
  lines.push(`- GET /billing/summary → ${beforeSummary.status}`);
  lines.push(`- GET /debug/queues → ${beforeQueues.status}`);
  lines.push(`- GET /debug/credits → ${beforeCredits.status}`);
  lines.push('');

  // Enqueue
  const enqueueAt = Date.now();
  const enqueue = await api(`/campaigns/${campaignId}/enqueue`, { method: 'POST', body: {} });
  lines.push('## Enqueue');
  lines.push(`- POST /campaigns/:id/enqueue → ${enqueue.status} (t+${enqueueAt - t0}ms)`);
  lines.push('```json');
  lines.push(JSON.stringify(enqueue.json ?? { raw: enqueue.text }, null, 2));
  lines.push('```');
  lines.push('');

  // Poll
  let success = false;
  let lastStatus = null;
  let lastProgress = null;
  let lastBalance = null;
  let lastSummary = null;
  let lastCredits = null;

  lines.push('## Poll (1s interval, up to 60s)');
  for (let i = 0; i < 60; i++) {
    const statusRes = await api(`/campaigns/${campaignId}/status`, { method: 'GET' });
    const progressRes = await api(`/campaigns/${campaignId}/progress`, { method: 'GET' });
    const balRes = await api('/billing/balance', { method: 'GET' });
    const summaryRes = await api('/billing/summary', { method: 'GET' });
    const creditsRes = await api('/debug/credits', { method: 'GET' });

    const campaignStatus =
      statusRes.json?.campaign?.status ||
      statusRes.json?.data?.campaign?.status ||
      statusRes.json?.data?.status ||
      null;

    const progress = progressRes.json?.data || progressRes.json;
    const balance = balRes.json?.data || balRes.json;
    const summary = summaryRes.json?.data || summaryRes.json;
    const credits = creditsRes.json?.data || creditsRes.json;

    const sent = Number(progress?.sent ?? progress?.totals?.sent ?? 0);
    const processed = Number(progress?.processed ?? progress?.totals?.processed ?? 0);
    const allowanceUsed = Number(credits?.allowance?.usedSmsThisPeriod ?? 0);
    const allowanceRemaining = Number(credits?.allowance?.remainingAllowance ?? 0);

    const t = Date.now() - t0;
    lines.push(
      `- t+${t}ms status=${campaignStatus || '(n/a)'} sent=${sent} processed=${processed} wallet=${balance?.credits ?? balance?.balance ?? '(n/a)'} allowanceUsed=${allowanceUsed} allowanceRemaining=${allowanceRemaining}`,
    );

    lastStatus = statusRes;
    lastProgress = progressRes;
    lastBalance = balRes;
    lastSummary = summaryRes;
    lastCredits = creditsRes;

    // Success when we see sending progress AND allowance usage or wallet debit reflected.
    const creditsChanged =
      typeof allowanceUsed === 'number' ? allowanceUsed > 0 : false;
    const walletChanged =
      typeof balance?.credits === 'number' ? balance.credits !== (beforeBal.json?.data?.credits ?? beforeBal.json?.credits) : false;

    if (
      enqueue.json?.ok === true &&
      (sent > 0 || processed > 0 || campaignStatus === 'completed' || campaignStatus === 'failed') &&
      (creditsChanged || walletChanged)
    ) {
      success = true;
      break;
    }

    // stop early if we got a hard failure
    if (enqueue.json?.ok === false) break;

    await sleep(1000);
  }

  lines.push('');
  lines.push('## Final snapshots');
  lines.push('### /campaigns/:id/status');
  lines.push('```json');
  lines.push(JSON.stringify(lastStatus?.json ?? { raw: lastStatus?.text }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('### /campaigns/:id/progress');
  lines.push('```json');
  lines.push(JSON.stringify(lastProgress?.json ?? { raw: lastProgress?.text }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('### /billing/balance');
  lines.push('```json');
  lines.push(JSON.stringify(lastBalance?.json ?? { raw: lastBalance?.text }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('### /billing/summary');
  lines.push('```json');
  lines.push(JSON.stringify(lastSummary?.json ?? { raw: lastSummary?.text }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('### /debug/credits');
  lines.push('```json');
  lines.push(JSON.stringify(lastCredits?.json ?? { raw: lastCredits?.text }, null, 2));
  lines.push('```');
  lines.push('');

  lines.push(success ? '✅ smoke passed' : '❌ smoke failed');
  lines.push('');

  fs.writeFileSync('/tmp/shopify_campaign_send_smoke.md', lines.join('\n'), 'utf8');
  console.log('Wrote /tmp/shopify_campaign_send_smoke.md');

  if (!success) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


