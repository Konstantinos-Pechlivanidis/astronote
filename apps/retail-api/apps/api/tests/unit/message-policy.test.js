const { test } = require('node:test');
const assert = require('node:assert/strict');

const policy = require('../../src/services/messagePolicy');

test('message policy defaults to marketing when messageType is missing', () => {
  const normalized = policy.normalizeMessageType(undefined);
  assert.equal(normalized, 'marketing');

  const p = policy.getMessagePolicy(undefined, true);
  assert.equal(p.appendUnsubscribe, true);
  assert.equal(p.appendOffer, true);
});

test('marketing message appends unsubscribe and offer when provided', () => {
  const p = policy.getMessagePolicy('marketing', true);
  const result = policy.normalizeMessageBody('Hello', p, {
    offerUrl: 'https://example.com/o/abc',
    unsubscribeUrl: 'https://example.com/s/xyz',
  });

  assert.match(result.text, /Claim Offer: https:\/\/example\.com\/o\/abc/);
  assert.match(result.text, /To unsubscribe, tap: https:\/\/example\.com\/s\/xyz/);
  assert.equal(result.appended.offer, true);
  assert.equal(result.appended.unsubscribe, true);
});

test('service message does not append unsubscribe or offer', () => {
  const p = policy.getMessagePolicy('service', true);
  const result = policy.normalizeMessageBody('Hello', p, {
    offerUrl: 'https://example.com/o/abc',
    unsubscribeUrl: 'https://example.com/s/xyz',
  });

  assert.equal(result.appended.offer, false);
  assert.equal(result.appended.unsubscribe, false);
  assert.equal(result.text, 'Hello');
});
