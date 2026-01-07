const { shortenUrl } = require('./urlShortener.service');

const PUBLIC_BASE_URL =
  (process.env.PUBLIC_WEB_BASE_URL || process.env.FRONTEND_URL || 'https://astronote-retail-frontend.onrender.com').replace(/\/$/, '');
const PUBLIC_RETAIL_PREFIX = (process.env.PUBLIC_RETAIL_PREFIX || '/retail').replace(/\/$/, '');

function buildBase(path) {
  return `${PUBLIC_BASE_URL}${PUBLIC_RETAIL_PREFIX}${path}`;
}

function offerUrl(trackingId) {
  return buildBase(`/o/${trackingId}`);
}

function unsubscribeUrl(token) {
  return buildBase(`/unsubscribe/${token}`);
}

function redeemUrl(trackingId) {
  return buildBase(`/tracking/redeem/${trackingId}`);
}

async function buildPublicLinks({ trackingId, unsubscribeToken, ownerId, campaignId }) {
  const offer = offerUrl(trackingId);
  const unsubLong = unsubscribeUrl(unsubscribeToken);
  const unsubShort = await shortenUrl(unsubLong, { ownerId, campaignId });
  return {
    offerUrl: offer,
    unsubscribeUrl: unsubShort || unsubLong,
    redeemUrl: redeemUrl(trackingId)
  };
}

module.exports = {
  buildPublicLinks,
  offerUrl,
  unsubscribeUrl,
  redeemUrl
};
