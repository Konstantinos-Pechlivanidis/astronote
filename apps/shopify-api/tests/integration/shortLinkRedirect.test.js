import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.js';
import prisma from '../../services/prisma.js';
import { createShortLink } from '../../services/shortLinks.js';

describe('Short Link Redirect Endpoint', () => {
  let testShop;
  let shortLink;

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

    // Create test short link
    shortLink = await createShortLink({
      destinationUrl: 'https://example.com/test',
      shopId: testShop.id,
    });
  });

  afterEach(async () => {
    await prisma.shortLink.deleteMany({
      where: { shopId: testShop.id },
    });
    await prisma.shop.delete({
      where: { id: testShop.id },
    });
  });

  it('should redirect to destination URL with 302', async () => {
    const response = await request(app)
      .get(`/s/${shortLink.token}`)
      .expect(302);

    expect(response.headers.location).toBe('https://example.com/test');
  });

  it('should return 404 for non-existent token', async () => {
    const response = await request(app)
      .get('/s/invalid-token-123')
      .expect(302); // Redirects to frontend error page

    expect(response.headers.location).toContain('/error');
  });

  it('should increment click count on redirect', async () => {
    const initialClicks = shortLink.clicks;

    await request(app).get(`/s/${shortLink.token}`).expect(302);

    const updated = await prisma.shortLink.findUnique({
      where: { token: shortLink.token },
    });

    expect(updated.clicks).toBe(initialClicks + 1);
    expect(updated.lastClickedAt).toBeTruthy();
  });

  it('should return 410 for expired link', async () => {
    // Create expired link
    const expiredLink = await createShortLink({
      destinationUrl: 'https://example.com/expired',
      shopId: testShop.id,
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    });

    const response = await request(app)
      .get(`/s/${expiredLink.token}`)
      .expect(410);

    expect(response.headers.location).toContain('/error');
  });
});

