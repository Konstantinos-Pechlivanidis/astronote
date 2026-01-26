function getQrFallbackState({ redeemUrl, qrImageUrl, qrFailed, qrTimedOut }) {
  const showQr = Boolean(qrImageUrl) && !qrFailed && !qrTimedOut;
  const showFallback = Boolean(redeemUrl) && !showQr;
  return { showQr, showFallback };
}

module.exports = { getQrFallbackState };
