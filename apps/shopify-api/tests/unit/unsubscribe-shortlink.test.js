import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Unsubscribe short link (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.SKIP_REDIS = 'true';
    process.env.SKIP_QUEUES = 'true';
    process.env.FRONTEND_URL = 'https://astronote.onrender.com';
  });

  it('appendUnsubscribeLink appends a system-owned short link (/r/:token) when available', async () => {
    const createShortLinkMock = jest.fn().mockResolvedValue({
      shortUrl: 'https://astronote.onrender.com/s/abc123defg',
    });

    jest.unstable_mockModule('../../services/shortLinks.js', () => ({
      getOrCreateDeterministicShortLink: createShortLinkMock,
      buildShortUrl: (token) => `https://astronote.onrender.com/s/${token}`,
    }));

    const { appendUnsubscribeLink } = await import('../../utils/unsubscribe.js');

    const out = await appendUnsubscribeLink(
      'Hello there',
      'contact_1',
      'shop_1',
      '+15550000001',
      null,
    );

    expect(out).toContain('Unsubscribe: https://astronote.onrender.com/s/abc123defg');
    expect(out).not.toContain('/shopify/unsubscribe/');
    expect(createShortLinkMock).toHaveBeenCalled();
  });
});
