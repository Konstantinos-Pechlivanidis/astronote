const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const frontendUrlPath = path.resolve(__dirname, '../../src/lib/frontendUrl.js');
const urlHelpersPath = path.resolve(__dirname, '../../src/lib/url-helpers.js');

test('buildRetailFrontendUrl normalizes base URL correctly', () => {
  delete require.cache[frontendUrlPath];
  delete require.cache[urlHelpersPath];

  // Mock environment variables
  const originalEnv = process.env.FRONTEND_URL;
  const originalAppUrl = process.env.APP_URL;

  try {
    // Test with FRONTEND_URL
    process.env.FRONTEND_URL = 'https://example.com';
    delete process.env.APP_URL;
    delete require.cache[frontendUrlPath];
    const { buildRetailFrontendUrl } = require(frontendUrlPath);
    const url1 = buildRetailFrontendUrl('/billing/success');
    assert.ok(url1.includes('https://example.com'));
    assert.ok(url1.includes('/retail/billing/success'));

    // Test with APP_URL
    delete process.env.FRONTEND_URL;
    process.env.APP_URL = 'https://app.example.com';
    delete require.cache[frontendUrlPath];
    const { buildRetailFrontendUrl: build2 } = require(frontendUrlPath);
    const url2 = build2('/billing/success');
    assert.ok(url2.includes('https://app.example.com'));
    assert.ok(url2.includes('/retail/billing/success'));

    // Test with trailing slash
    process.env.FRONTEND_URL = 'https://example.com/';
    delete process.env.APP_URL;
    delete require.cache[frontendUrlPath];
    const { buildRetailFrontendUrl: build3 } = require(frontendUrlPath);
    const url3 = build3('/billing/success');
    assert.ok(url3.includes('https://example.com'));
    assert.ok(url3.includes('/retail/billing/success'));
  } finally {
    if (originalEnv) {process.env.FRONTEND_URL = originalEnv;}
    else {delete process.env.FRONTEND_URL;}
    if (originalAppUrl) {process.env.APP_URL = originalAppUrl;}
    else {delete process.env.APP_URL;}
  }
});

test('isValidAbsoluteUrl validates URLs correctly', () => {
  delete require.cache[urlHelpersPath];
  const { isValidAbsoluteUrl } = require(urlHelpersPath);

  // Valid URLs
  assert.equal(isValidAbsoluteUrl('https://example.com/path'), true);
  assert.equal(isValidAbsoluteUrl('http://example.com/path'), true);
  assert.equal(isValidAbsoluteUrl('https://example.com:3000/path'), true);

  // Invalid URLs
  assert.equal(isValidAbsoluteUrl('/relative/path'), false);
  assert.equal(isValidAbsoluteUrl('not-a-url'), false);
  assert.equal(isValidAbsoluteUrl(''), false);
  assert.equal(isValidAbsoluteUrl(null), false);
  assert.equal(isValidAbsoluteUrl(undefined), false);
});

