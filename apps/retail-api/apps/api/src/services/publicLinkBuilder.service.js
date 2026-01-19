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
  const longUrl = buildOfferUrl(trackingId);
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
}

async function buildUnsubscribeShortUrl({ token, ownerId = null, campaignId = null, campaignMessageId = null }) {
  if (!token) {
    return null;
  }
  const longUrl = buildUnsubscribeUrl(token);
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
