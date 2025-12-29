import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../services/prisma.js';
import {
  createShortLink,
  getShortLinkByToken,
  incrementClickCount,
} from '../../services/shortLinks.js';

describe('Short Links Service', () => {
  let testShop;
  let testCampaign;
  let testContact;

  beforeEach(async () => {
    // Create test shop
    testShop = await prisma.shop.create({
      data: {
        shopDomain: 'test-shop.myshopify.com',
        shopName: 'Test Shop',
        credits: 1000,
        currency: 'EUR',
        status: 'active',
      },
    });

    // Create test campaign
    testCampaign = await prisma.campaign.create({
      data: {
        shopId: testShop.id,
        name: 'Test Campaign',
        message: 'Test message',
        audience: 'all',
        scheduleType: 'immediate',
        status: 'draft',
      },
    });

    // Create test contact
    testContact = await prisma.contact.create({
      data: {
        shopId: testShop.id,
        phoneE164: '+1234567890',
        smsConsent: 'opted_in',
      },
    });
  });

  afterEach(async () => {
    // Cleanup
    await prisma.shortLink.deleteMany({
      where: { shopId: testShop.id },
    });
    await prisma.campaign.deleteMany({
      where: { shopId: testShop.id },
    });
    await prisma.contact.deleteMany({
      where: { shopId: testShop.id },
    });
    await prisma.shop.delete({
      where: { id: testShop.id },
    });
  });

  describe('createShortLink', () => {
    it('should create a short link with valid HTTPS URL', async () => {
      const result = await createShortLink({
        destinationUrl: 'https://example.com/page',
        shopId: testShop.id,
      });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('shortUrl');
      expect(result.shortUrl).toContain('/r/');
      expect(result.destinationUrl).toBe('https://example.com/page');
      expect(result.clicks).toBe(0);
    });

    it('should reject non-HTTPS URL in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(
        createShortLink({
          destinationUrl: 'http://example.com',
          shopId: testShop.id,
        }),
      ).rejects.toThrow();

      process.env.NODE_ENV = originalEnv;
    });

    it('should create short link with campaign and contact context', async () => {
      const result = await createShortLink({
        destinationUrl: 'https://example.com',
        shopId: testShop.id,
        campaignId: testCampaign.id,
        contactId: testContact.id,
      });

      expect(result).toHaveProperty('token');
      const link = await getShortLinkByToken(result.token);
      expect(link.campaignId).toBe(testCampaign.id);
      expect(link.contactId).toBe(testContact.id);
    });

    it('should generate unique tokens', async () => {
      const results = await Promise.all([
        createShortLink({
          destinationUrl: 'https://example.com/1',
          shopId: testShop.id,
        }),
        createShortLink({
          destinationUrl: 'https://example.com/2',
          shopId: testShop.id,
        }),
        createShortLink({
          destinationUrl: 'https://example.com/3',
          shopId: testShop.id,
        }),
      ]);

      const tokens = results.map(r => r.token);
      expect(new Set(tokens).size).toBe(3); // All unique
    });
  });

  describe('incrementClickCount', () => {
    it('should increment click count atomically', async () => {
      const shortLink = await createShortLink({
        destinationUrl: 'https://example.com',
        shopId: testShop.id,
      });

      const initialClicks = shortLink.clicks;

      // Increment multiple times
      await Promise.all([
        incrementClickCount(shortLink.token),
        incrementClickCount(shortLink.token),
        incrementClickCount(shortLink.token),
      ]);

      const updated = await getShortLinkByToken(shortLink.token);
      expect(updated.clicks).toBe(initialClicks + 3);
      expect(updated.lastClickedAt).toBeTruthy();
    });
  });
});

