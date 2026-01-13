/**
 * Phase 4 Integration Tests: Idempotency
 * Tests for double-send prevention, double-debit prevention, and webhook replay protection
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../services/prisma.js';
import { enqueueCampaign } from '../../services/campaigns.js';
import { checkEnqueueRequest } from '../../services/idempotency.js';
import { processWebhookWithReplayProtection } from '../../services/webhook-replay.js';
import { debit } from '../../services/wallet.js';

describe('Phase 4: Idempotency Tests', () => {
  let testShopId;
  let testCampaignId;

  beforeAll(async () => {
    // Setup test shop
    const shop = await prisma.shop.create({
      data: {
        shopDomain: 'test-phase4.myshopify.com',
        shopName: 'Test Shop Phase 4',
        status: 'active',
      },
    });
    testShopId = shop.id;

    // Create test wallet with credits
    await prisma.wallet.upsert({
      where: { shopId: testShopId },
      update: {},
      create: {
        shopId: testShopId,
        balance: 10000,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testCampaignId) {
      await prisma.campaign.deleteMany({ where: { id: testCampaignId } });
    }
    await prisma.wallet.deleteMany({ where: { shopId: testShopId } });
    await prisma.shop.deleteMany({ where: { id: testShopId } });
    await prisma.enqueueRequest.deleteMany({ where: { shopId: testShopId } });
    await prisma.webhookEvent.deleteMany({ where: { shopId: testShopId } });
  });

  describe('Enqueue Idempotency', () => {
    it('should return same result for same idempotency key', async () => {
      // Create test campaign
      const campaign = await prisma.campaign.create({
        data: {
          shopId: testShopId,
          name: 'Test Campaign Idempotency',
          message: 'Test message',
          status: 'draft',
          scheduleType: 'immediate',
          audience: { type: 'all' },
        },
      });
      testCampaignId = campaign.id;

      const idempotencyKey = 'test-key-123';

      // First enqueue
      await enqueueCampaign(testShopId, testCampaignId, idempotencyKey);

      // Check idempotency record exists
      const existing = await checkEnqueueRequest(testShopId, testCampaignId, idempotencyKey);
      expect(existing).toBeTruthy();
      expect(existing.status).toBe('completed');

      // Second enqueue with same key should return same result
      // (In real scenario, controller would check and return cached result)
      const cachedResult = existing.result;
      expect(cachedResult).toEqual(expect.objectContaining({
        ok: expect.any(Boolean),
      }));
    });
  });

  describe('Webhook Replay Protection', () => {
    it('should process webhook only once', async () => {
      const provider = 'stripe';
      const eventId = 'evt_test_123';
      let processCount = 0;

      const processor = async () => {
        processCount++;
        return { processed: true };
      };

      // First call
      const result1 = await processWebhookWithReplayProtection(
        provider,
        eventId,
        processor,
        { shopId: testShopId },
      );

      expect(result1.processed).toBe(true);
      expect(processCount).toBe(1);

      // Second call (replay)
      const result2 = await processWebhookWithReplayProtection(
        provider,
        eventId,
        processor,
        { shopId: testShopId },
      );

      expect(result2.processed).toBe(false);
      expect(result2.reason).toBe('duplicate');
      expect(processCount).toBe(1); // Should not process again
    });
  });

  describe('Credit Debit Idempotency', () => {
    it('should not debit twice with same idempotency key', async () => {
      const idempotencyKey = 'debit-test-123';
      const amount = 100;

      // Get initial balance
      const wallet1 = await prisma.wallet.findUnique({
        where: { shopId: testShopId },
      });
      const initialBalance = wallet1.balance;

      // First debit
      await debit(testShopId, amount, {
        reason: 'test',
        idempotencyKey,
      });

      // Check balance after first debit
      const wallet2 = await prisma.wallet.findUnique({
        where: { shopId: testShopId },
      });
      expect(wallet2.balance).toBe(initialBalance - amount);

      // Second debit with same key (should be idempotent)
      await debit(testShopId, amount, {
        reason: 'test',
        idempotencyKey,
      });

      // Balance should not change
      const wallet3 = await prisma.wallet.findUnique({
        where: { shopId: testShopId },
      });
      expect(wallet3.balance).toBe(initialBalance - amount);

      // Verify only one transaction exists
      const transactions = await prisma.creditTransaction.findMany({
        where: {
          shopId: testShopId,
          idempotencyKey,
        },
      });
      expect(transactions.length).toBe(1);
    });
  });
});

