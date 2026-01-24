import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const prismaMock = {
  shortLink: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('Short Links Service (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.PUBLIC_BASE_URL = 'https://example.test';
    process.env.SHORTLINK_BASE_URL = 'https://example.test';
    process.env.URL_SHORTENER_BASE_URL = 'https://example.test';

    jest.unstable_mockModule('../../services/prisma.js', () => ({
      default: prismaMock,
    }));
  });

  it('createShortLink creates a short link and returns a shortUrl', async () => {
    prismaMock.shortLink.findUnique.mockResolvedValue(null);
    prismaMock.shortLink.create.mockImplementation(async ({ data }) => ({
      id: 'sl_1',
      token: data.token,
      destinationUrl: data.destinationUrl,
      clicks: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: data.expiresAt ?? null,
      campaignId: data.campaignId ?? null,
      contactId: data.contactId ?? null,
    }));

    const { createShortLink } = await import('../../services/shortLinks.js');
    const result = await createShortLink({
      destinationUrl: 'https://example.com/page',
      shopId: 'shop_123',
    });

    expect(result.token).toBeTruthy();
    expect(result.token.length).toBe(10);
    expect(result.shortUrl).toBe(`https://example.test/s/${result.token}`);
    expect(result.destinationUrl).toBe('https://example.com/page');
    expect(result.clicks).toBe(0);
  });

  it('createOrGetShortLink is idempotent for the same destinationUrl', async () => {
    prismaMock.shortLink.findUnique.mockResolvedValue(null);
    prismaMock.shortLink.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'sl_1', token: 'tok_abc', destinationUrl: 'https://example.com/page', clicks: 0, createdAt: new Date(), expiresAt: null });
    prismaMock.shortLink.create.mockImplementation(async ({ data }) => ({
      id: 'sl_1',
      token: data.token,
      destinationUrl: data.destinationUrl,
      clicks: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: data.expiresAt ?? null,
      campaignId: data.campaignId ?? null,
      contactId: data.contactId ?? null,
    }));

    const { createOrGetShortLink } = await import('../../services/shortLinks.js');
    const first = await createOrGetShortLink({
      destinationUrl: 'https://example.com/page',
      shopId: 'shop_123',
    });
    const second = await createOrGetShortLink({
      destinationUrl: 'https://example.com/page',
      shopId: 'shop_123',
    });

    expect(first.shortUrl).toBeTruthy();
    expect(second.shortUrl).toBe('https://example.test/s/tok_abc');
    expect(prismaMock.shortLink.findFirst).toHaveBeenCalled();
  });

  it('createShortLink rejects non-HTTPS URL in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const { createShortLink } = await import('../../services/shortLinks.js');
    await expect(
      createShortLink({
        destinationUrl: 'http://example.com',
        shopId: 'shop_123',
      }),
    ).rejects.toThrow();

    process.env.NODE_ENV = originalEnv;
  });

  it('getShortLinkByToken calls prisma.shortLink.findUnique', async () => {
    prismaMock.shortLink.findUnique.mockResolvedValue({ token: 'tok_123' });
    const { getShortLinkByToken } = await import('../../services/shortLinks.js');

    const result = await getShortLinkByToken('tok_123');
    expect(prismaMock.shortLink.findUnique).toHaveBeenCalledWith({
      where: { token: 'tok_123' },
    });
    expect(result).toEqual({ token: 'tok_123' });
  });

  it('incrementClickCount calls prisma.shortLink.update with atomic increment', async () => {
    prismaMock.shortLink.update.mockResolvedValue({
      token: 'tok_123',
      clicks: 5,
      lastClickedAt: new Date(),
    });
    const { incrementClickCount } = await import('../../services/shortLinks.js');

    await incrementClickCount('tok_123');
    expect(prismaMock.shortLink.update).toHaveBeenCalledWith({
      where: { token: 'tok_123' },
      data: {
        clicks: { increment: 1 },
        lastClickedAt: expect.any(Date),
      },
    });
  });
});
