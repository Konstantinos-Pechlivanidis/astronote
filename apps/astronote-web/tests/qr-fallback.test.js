const { test } = require('node:test');
const assert = require('node:assert/strict');

const { getQrFallbackState } = require('../src/features/retail/public/qrFallback');

test('qr fallback shows image when loaded and not failed', () => {
  const state = getQrFallbackState({
    redeemUrl: 'https://example.com/redeem',
    qrImageUrl: 'https://qr.example.com',
    qrFailed: false,
    qrTimedOut: false,
  });
  assert.equal(state.showQr, true);
  assert.equal(state.showFallback, false);
});

test('qr fallback shows link when image fails', () => {
  const state = getQrFallbackState({
    redeemUrl: 'https://example.com/redeem',
    qrImageUrl: 'https://qr.example.com',
    qrFailed: true,
    qrTimedOut: false,
  });
  assert.equal(state.showQr, false);
  assert.equal(state.showFallback, true);
});

test('qr fallback shows link when timed out', () => {
  const state = getQrFallbackState({
    redeemUrl: 'https://example.com/redeem',
    qrImageUrl: 'https://qr.example.com',
    qrFailed: false,
    qrTimedOut: true,
  });
  assert.equal(state.showQr, false);
  assert.equal(state.showFallback, true);
});
