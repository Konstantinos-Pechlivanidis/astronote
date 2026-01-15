/**
 * Smoke: schedule a campaign shortly in the future, assert it becomes "scheduled" immediately,
 * then assert the scheduler transitions it to "sending".
 *
 * This script relies on the scheduler processor and campaign worker being started.
 * For local runs, start the API in embedded workers mode (default in dev) and ensure Redis is available.
 *
 * Usage (API already running):
 *   SHOPIFY_API_BASE_URL=http://localhost:8080 node scripts/scheduled-campaign-smoke.mjs
 *
 * Output:
 *   /tmp/shopify_scheduled_campaign_smoke_report.md
 */

import fs from 'node:fs';

import loadEnv from '../config/loadEnv.js';
import prisma from '../services/prisma.js';

loadEnv();

const BASE_URL =
  process.env.SHOPIFY_API_BASE_URL ||
  `http://localhost:${process.env.PORT || 8080}`;

function randSuffix() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function ensureShop({ shopDomain }) {
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

async function seedContacts({ shopId }) {
  const phones = ['+15550000011', '+15550000012'];
  await prisma.contact.createMany({
    data: phones.map((phoneE164, i) => ({
      shopId,
      phoneE164,
      firstName: `SchedSmoke${i + 1}`,
      lastName: 'User',
      smsConsent: 'opted_in',
    })),
    skipDuplicates: true,
  });
}

async function createDraftCampaign({ shopId }) {
  const name = `Smoke scheduled ${randSuffix()}`;
  const message = 'Smoke test scheduled campaign message';

  return await prisma.campaign.create({
    data: {
      shopId,
      name,
      message,
      audience: 'all',
      scheduleType: 'immediate',
      status: 'draft',
      priority: 'normal',
    },
    select: { id: true },
  });
}

async function apiFetch(path, { method = 'GET', shopDomain, headers, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(shopDomain ? { 'X-Shopify-Shop-Domain': shopDomain } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  return { status: res.status, json, text };
}

function extractCampaign(payload) {
  return payload?.campaign || payload?.data || payload;
}

async function pollUntil({ shopDomain, campaignId, timeoutMs, intervalMs, predicate }) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await apiFetch(`/campaigns/${campaignId}`, { method: 'GET', shopDomain });
    const campaign = extractCampaign(res.json);
    if (campaign && predicate(campaign)) {
      return { ok: true, res, campaign, elapsedMs: Date.now() - start };
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return { ok: false, elapsedMs: Date.now() - start };
}

async function main() {
  const shopDomain =
    process.env.SHOP_DOMAIN || `smoke-scheduled-${randSuffix()}.myshopify.com`;

  const shop = await ensureShop({ shopDomain });
  await seedContacts({ shopId: shop.id });

  const campaignId = process.env.CAMPAIGN_ID || (await createDraftCampaign({ shopId: shop.id })).id;

  // Schedule shortly in the future. The scheduler tick cadence can be overridden via env vars:
  // - SCHEDULED_CAMPAIGNS_INTERVAL_MS
  // - SCHEDULED_CAMPAIGNS_INITIAL_DELAY_MS
  const scheduleAt = new Date(Date.now() + 12_000).toISOString();

  const schedule = await apiFetch(`/campaigns/${campaignId}/schedule`, {
    method: 'PUT',
    shopDomain,
    body: {
      scheduleType: 'scheduled',
      scheduleAt,
    },
  });

  const scheduledCampaign = extractCampaign(schedule.json);
  const scheduleOk = schedule.status >= 200 && schedule.status < 300;
  const statusAfterSchedule = scheduledCampaign?.status;

  // Poll until it becomes "sending" (scheduler should flip it)
  const sendingPoll = await pollUntil({
    shopDomain,
    campaignId,
    timeoutMs: 120_000,
    intervalMs: 2_000,
    predicate: (c) => c.status === 'sending',
  });

  const lines = [];
  lines.push('# Shopify scheduled-campaign smoke');
  lines.push('');
  lines.push(`Base URL: \`${BASE_URL}\``);
  lines.push(`Shop domain: \`${shopDomain}\``);
  lines.push(`Campaign ID: \`${campaignId}\``);
  lines.push(`Requested scheduleAt (UTC): \`${scheduleAt}\``);
  lines.push('');

  lines.push('## Schedule response');
  lines.push(`- HTTP: ${schedule.status}`);
  lines.push(`- status after schedule: **${statusAfterSchedule ?? '(missing)'}**`);
  lines.push('```json');
  lines.push(JSON.stringify(schedule.json ?? { raw: schedule.text }, null, 2));
  lines.push('```');
  lines.push('');

  lines.push('## Poll: campaign becomes sending');
  if (sendingPoll.ok) {
    lines.push(`- ✅ became **sending** after ${Math.round(sendingPoll.elapsedMs / 1000)}s`);
  } else {
    lines.push(`- ❌ did not become sending within ${Math.round(sendingPoll.elapsedMs / 1000)}s`);
  }
  lines.push('');

  const finalOk = scheduleOk && statusAfterSchedule === 'scheduled' && sendingPoll.ok;
  lines.push(finalOk ? '✅ smoke passed' : '❌ smoke failed');
  lines.push('');

  fs.writeFileSync('/tmp/shopify_scheduled_campaign_smoke_report.md', lines.join('\n'), 'utf8');
  console.log('Wrote /tmp/shopify_scheduled_campaign_smoke_report.md');

  if (!finalOk) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


