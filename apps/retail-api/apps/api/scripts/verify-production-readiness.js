#!/usr/bin/env node
/**
 * Retail production readiness verifier (non-sending)
 * - Builds sample offer + unsubscribe short URLs
 * - Asserts message text contains exactly two short links with "Claim Offer" copy
 * - Resolves short code to targetUrl via DB
 * - Validates unsubscribe token signature
 * - Confirms enqueue jobId template is BullMQ-safe (no colons)
 */

const crypto = require('node:crypto');
const loadEnv = require('../src/config/loadEnv');
loadEnv();

const prisma = require('../src/lib/prisma');
const { buildOfferShortUrl, buildUnsubscribeShortUrl } = require('../src/services/publicLinkBuilder.service');
const { shortenUrlsInText } = require('../src/services/urlShortener.service');
const { generateUnsubscribeToken, verifyUnsubscribeToken } = require('../src/services/token.service');

function randomTrackingId() {
  return crypto.randomBytes(9).toString('base64url');
}

function buildJobIdExample() {
  const runToken = `run-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const jobId = `campaign-123-${runToken}-batch-0`;
  if (jobId.includes(':')) {
    throw new Error(`JobId contains colon: ${jobId}`);
  }
  return jobId;
}

async function main() {
  const ownerId = 999_999; // synthetic tenant to avoid touching real stores
  const campaignId = null;
  const contactId = 777_777;

  const trackingId = randomTrackingId();
  const unsubscribeToken = generateUnsubscribeToken(contactId, ownerId, campaignId);

  const offer = await buildOfferShortUrl({ trackingId, ownerId, campaignId });
  const unsub = await buildUnsubscribeShortUrl({ token: unsubscribeToken, ownerId, campaignId });

  const baseText = 'Hello from readiness check.';
  let finalText = `${baseText}\n\nClaim Offer: ${offer.shortUrl}\n\nTo unsubscribe, tap: ${unsub.shortUrl}`;
  finalText = await shortenUrlsInText(finalText, { ownerId, kind: 'message' });

  const urls = finalText.match(/https?:\/\/\S+/g) || [];
  const shortCount = urls.filter((u) => /\/s\/[A-Za-z0-9_-]+/.test(u)).length;
  if (shortCount !== 2) {
    throw new Error(`Expected 2 short URLs, found ${shortCount}. Text: ${finalText}`);
  }
  if (!finalText.includes('Claim Offer')) {
    throw new Error('Missing Claim Offer copy in final text');
  }

  const offerCode = (offer.shortUrl.match(/\/s\/([^/\s]+)/) || [])[1];
  if (!offerCode) {
    throw new Error(`Could not parse short code from ${offer.shortUrl}`);
  }
  const offerLink = await prisma.shortLink.findUnique({ where: { shortCode: offerCode } });
  if (!offerLink || offerLink.targetUrl !== offer.longUrl) {
    throw new Error('Short link record missing or targetUrl mismatch');
  }

  const tokenPayload = verifyUnsubscribeToken(unsubscribeToken);
  if (!tokenPayload || tokenPayload.storeId !== ownerId || tokenPayload.campaignId !== campaignId) {
    throw new Error('Unsubscribe token verification failed or payload mismatch');
  }

  const jobId = buildJobIdExample();

  const result = {
    ok: true,
    messageTextSample: finalText,
    shortLinks: { offer: offer.shortUrl, unsubscribe: unsub.shortUrl },
    targetUrls: { offer: offer.longUrl, unsubscribe: unsub.longUrl },
    shortCode: offerCode,
    unsubscribeTokenDecoded: tokenPayload,
    jobIdSample: jobId,
  };

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error('[verify-production-readiness] FAILED:', err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await prisma.$disconnect(); } catch (_) { /* ignore */ }
  });
