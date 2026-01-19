const { buildRetailFrontendUrl } = require('../lib/frontendUrl');
const { shortenUrl } = require('./urlShortener.service');

function buildOfferUrl(trackingId) {
  return buildRetailFrontendUrl(`/tracking/offer/${trackingId}`);
}

function buildRedeemUrl(trackingId) {
  return buildRetailFrontendUrl(`/tracking/redeem/${trackingId}`);
}

function buildUnsubscribeUrl(token) {
  return buildRetailFrontendUrl(`/unsubscribe/${token}`);
}

async function buildOfferShortUrl({ trackingId, ownerId = null, campaignId = null, campaignMessageId = null }) {
  if (!trackingId) {
    return null;
  }
  if (!ownerId) {
    throw new (require('./urlShortener.service').ShortenerError)('Missing ownerId for offer short link', { trackingId });
  }
  const longUrl = buildOfferUrl(trackingId);
  try {
    const shortUrl = await shortenUrl(longUrl, {
      ownerId,
      campaignId,
      campaignMessageId,
      kind: 'offer',
      targetUrl: longUrl,
      forceShort: true,
      requireShort: true,
    });
    return { longUrl, shortUrl };
  } catch (err) {
    const logger = require('pino')({ name: 'public-link-builder' });
    logger.error({ trackingId, ownerId, campaignId, err: err?.message || String(err) }, 'shortlink_fallback_used:offer');
    return { longUrl, shortUrl: longUrl };
  }
}

async function buildUnsubscribeShortUrl({ token, ownerId = null, campaignId = null, campaignMessageId = null }) {
  if (!token) {
    return null;
  }
  if (!ownerId) {
    throw new (require('./urlShortener.service').ShortenerError)('Missing ownerId for unsubscribe short link');
  }
  const longUrl = buildUnsubscribeUrl(token);
  try {
    const shortUrl = await shortenUrl(longUrl, {
      ownerId,
      campaignId,
      campaignMessageId,
      kind: 'unsubscribe',
      targetUrl: longUrl,
      forceShort: true,
      requireShort: true,
    });
    return { longUrl, shortUrl };
  } catch (err) {
    const logger = require('pino')({ name: 'public-link-builder' });
    logger.error({ ownerId, campaignId, err: err?.message || String(err) }, 'shortlink_fallback_used:unsubscribe');
    return { longUrl, shortUrl: longUrl };
  }
}

async function buildPublicLinks({ trackingId, unsubscribeToken, ownerId, campaignId, campaignMessageId = null }) {
  const offer = trackingId ? await buildOfferShortUrl({ trackingId, ownerId, campaignId, campaignMessageId }) : null;
  const unsub = unsubscribeToken
    ? await buildUnsubscribeShortUrl({ token: unsubscribeToken, ownerId, campaignId, campaignMessageId })
    : null;

  return {
    offerUrl: offer?.shortUrl || (trackingId ? buildOfferUrl(trackingId) : null),
    unsubscribeUrl: unsub?.shortUrl || (unsubscribeToken ? buildUnsubscribeUrl(unsubscribeToken) : null),
    redeemUrl: trackingId ? buildRedeemUrl(trackingId) : null,
    raw: {
      offerLong: offer?.longUrl || (trackingId ? buildOfferUrl(trackingId) : null),
      unsubscribeLong: unsub?.longUrl || (unsubscribeToken ? buildUnsubscribeUrl(unsubscribeToken) : null),
    },
  };
}

module.exports = {
  buildOfferUrl,
  buildRedeemUrl,
  buildUnsubscribeUrl,
  buildOfferShortUrl,
  buildUnsubscribeShortUrl,
  buildPublicLinks,
};
