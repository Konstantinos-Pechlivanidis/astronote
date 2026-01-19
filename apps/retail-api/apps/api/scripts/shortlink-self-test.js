#!/usr/bin/env node
/**
 * Shortlink self-test (safe, local)
 * - Inserts a short link for a dummy ownerId/targetUrl
 * - Prints web URLs for /o and /s using PUBLIC_WEB_BASE (no network calls)
 */

const { nanoid } = require('nanoid');
const prisma = require('../src/lib/prisma');
const { normalizeUrl, hashUrl } = require('../src/services/urlShortener.service');

async function main() {
  const ownerId = Number(process.env.SELF_TEST_OWNER_ID || 999999);
  const targetUrl = process.env.SELF_TEST_TARGET_URL || 'https://astronote.onrender.com/retail/tracking/offer/self-test';
  const publicWebBase =
    (process.env.PUBLIC_WEB_BASE_URL ||
     process.env.PUBLIC_RETAIL_BASE_URL ||
     process.env.FRONTEND_URL ||
     'https://astronote.onrender.com').replace(/\/+$/, '').replace(/\/api$/i, '');

  const normalized = normalizeUrl(targetUrl);
  const hash = hashUrl(normalized);
  const existing = await prisma.shortLink.findFirst({
    where: { ownerId, kind: 'self-test', longUrlHash: hash },
  });

  const shortCode = existing?.shortCode || nanoid(8);

  if (!existing) {
    await prisma.shortLink.create({
      data: {
        shortCode,
        kind: 'self-test',
        ownerId,
        targetUrl: normalized,
        originalUrl: normalized,
        longUrlHash: hash,
        longUrlNormalized: normalized,
      },
    });
  }

  const shortBase = publicWebBase;
  const offerUrl = `${shortBase}/o/${shortCode}`;
  const unsubscribeUrl = `${shortBase}/s/${shortCode}`;

  console.log(JSON.stringify({ ownerId, targetUrl: normalized, shortCode, offerUrl, unsubscribeUrl }, null, 2));
}

main()
  .catch((err) => {
    console.error('Self-test failed:', err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await prisma.$disconnect(); } catch (_) {}
  });
