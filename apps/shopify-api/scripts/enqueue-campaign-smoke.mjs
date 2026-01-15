/**
 * Smoke: create a minimal shop + contacts + campaign, then call POST /campaigns/:id/enqueue
 * and assert campaign status transitions to "sending".
 *
 * Usage (with API already running):
 *   SHOPIFY_API_BASE_URL=http://localhost:8080 node scripts/enqueue-campaign-smoke.mjs
 *
 * Output:
 *   /tmp/shopify_enqueue_smoke_report.md
 */

import fs from 'node:fs';

import loadEnv from '../config/loadEnv.js';
import prisma from '../services/prisma.js';

loadEnv();

const BASE_URL =
  process.env.SHOPIFY_API_BASE_URL ||
  `http://localhost:${process.env.PORT || 8080}`;

function randSuffix() {
  return `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

async function ensureShop({ shopDomain }) {
  // Minimal required fields based on store-resolution auto-create logic.
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
  const phones = ['+15550000001', '+15550000002', '+15550000003'];
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

async function createCampaign({ shopId }) {
  const name = `Smoke enqueue ${randSuffix()}`;
  const message = 'Smoke test campaign message';

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

async function main() {
  const shopDomain =
    process.env.SHOP_DOMAIN || `smoke-enqueue-${randSuffix()}.myshopify.com`;

  const shop = await ensureShop({ shopDomain });
  await seedContacts({ shopId: shop.id });

  const campaignId = process.env.CAMPAIGN_ID || (await createCampaign({ shopId: shop.id })).id;

  const idempotencyKey = `smoke-enqueue:${campaignId}:${randSuffix()}`;
  const enqueue = await apiFetch(`/campaigns/${campaignId}/enqueue`, {
    method: 'POST',
    shopDomain,
    headers: { 'Idempotency-Key': idempotencyKey },
  });

  const after = await apiFetch(`/campaigns/${campaignId}`, {
    method: 'GET',
    shopDomain,
  });

  const ok = enqueue.json?.ok === true;
  const status = after.json?.campaign?.status || after.json?.status || after.json?.data?.status;
  const statusOk = status === 'sending';

  const lines = [];
  lines.push('# Shopify enqueue smoke');
  lines.push('');
  lines.push(`Base URL: \`${BASE_URL}\``);
  lines.push(`Shop domain: \`${shopDomain}\``);
  lines.push(`Campaign ID: \`${campaignId}\``);
  lines.push(`Idempotency-Key: \`${idempotencyKey}\``);
  lines.push('');
  lines.push('## Enqueue response');
  lines.push(`- HTTP: ${enqueue.status}`);
  lines.push('```json');
  lines.push(JSON.stringify(enqueue.json ?? { raw: enqueue.text }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## Campaign after enqueue');
  lines.push(`- HTTP: ${after.status}`);
  lines.push(`- status: **${status ?? '(missing)'}**`);
  lines.push('');
  lines.push(ok && statusOk ? '✅ smoke passed' : '❌ smoke failed');
  lines.push('');

  fs.writeFileSync('/tmp/shopify_enqueue_smoke_report.md', lines.join('\n'), 'utf8');
  console.log('Wrote /tmp/shopify_enqueue_smoke_report.md');

  if (!ok) process.exit(1);
  if (!statusOk) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


