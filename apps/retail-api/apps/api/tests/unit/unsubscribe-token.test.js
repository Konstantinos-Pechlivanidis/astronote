const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const tokenServicePath = path.resolve(__dirname, '../../src/services/token.service.js');

function signPayload(payload, secret) {
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `${Buffer.from(payloadStr).toString('base64url')}.${signature}`;
}

test('verifyUnsubscribeToken validates token and rejects tampering', () => {
  const originalSecret = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  process.env.UNSUBSCRIBE_TOKEN_SECRET = 'test-secret';
  delete require.cache[tokenServicePath];
  const { generateUnsubscribeToken, verifyUnsubscribeToken } = require(tokenServicePath);

  try {
    const token = generateUnsubscribeToken(12, 34, 56);
    const decoded = verifyUnsubscribeToken(token);
    assert.equal(decoded.contactId, 12);
    assert.equal(decoded.storeId, 34);
    assert.equal(decoded.campaignId, 56);

    const [payload, signature] = token.split('.');
    const lastChar = signature.slice(-1);
    const replacement = lastChar === 'A' ? 'B' : 'A';
    const tampered = `${payload}.${signature.slice(0, -1)}${replacement}`;
    const invalid = verifyUnsubscribeToken(tampered);
    assert.equal(invalid, null);
  } finally {
    if (originalSecret) {process.env.UNSUBSCRIBE_TOKEN_SECRET = originalSecret;} else {delete process.env.UNSUBSCRIBE_TOKEN_SECRET;}
  }
});

test('verifyUnsubscribeTokenForStore rejects wrong store and expired tokens', () => {
  const originalSecret = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  process.env.UNSUBSCRIBE_TOKEN_SECRET = 'test-secret';
  delete require.cache[tokenServicePath];
  const { generateUnsubscribeToken, verifyUnsubscribeTokenForStore, verifyUnsubscribeToken } = require(tokenServicePath);

  try {
    const token = generateUnsubscribeToken(1, 99, 2);
    assert.ok(verifyUnsubscribeTokenForStore(token, 99));
    assert.equal(verifyUnsubscribeTokenForStore(token, 98), null);

    const expiredPayload = {
      contactId: 1,
      storeId: 99,
      campaignId: null,
      exp: Date.now() - 1000,
    };
    const expiredToken = signPayload(expiredPayload, process.env.UNSUBSCRIBE_TOKEN_SECRET);
    assert.equal(verifyUnsubscribeToken(expiredToken), null);
  } finally {
    if (originalSecret) {process.env.UNSUBSCRIBE_TOKEN_SECRET = originalSecret;} else {delete process.env.UNSUBSCRIBE_TOKEN_SECRET;}
  }
});
