const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const prismaPath = path.resolve(__dirname, '../../src/lib/prisma.js');
const metricsPath = path.resolve(__dirname, '../../src/services/campaignMetrics.service.js');

test('computeCampaignMetrics returns accepted/delivered/failedDelivery/pendingDelivery with correct math', async () => {
  // Mock prisma.campaignMessage.count with deterministic outputs based on where clause
  const prismaMock = {
    campaignMessage: {
      count: async ({ where }) => {
        if (where.status === 'queued') {
          return 2;
        }
        if (where.status === 'processing') {
          return 1;
        }
        if (where.providerMessageId && where.providerMessageId.not === null) {
          return 8; // accepted
        }
        if (where.deliveryStatus && where.deliveryStatus.in) {
          // deliveredStatuses or failedDeliveryStatuses
          const set = new Set(where.deliveryStatus.in.map(String));
          if (set.has('Delivered') || set.has('delivered')) {
            return 5;
          }
          if (set.has('failure') || set.has('Failed')) {
            return 2;
          }
        }
        return 10; // total
      },
    },
  };

  delete require.cache[prismaPath];
  require.cache[prismaPath] = { exports: prismaMock };
  delete require.cache[metricsPath];

  const { computeCampaignMetrics } = require(metricsPath);
  const out = await computeCampaignMetrics({ campaignId: 1, ownerId: 123 });

  assert.equal(out.total, 10);
  assert.equal(out.queued, 2);
  assert.equal(out.processing, 1);
  assert.equal(out.accepted, 8);
  assert.equal(out.delivered, 5);
  assert.equal(out.deliveryFailed, 2);
  assert.equal(out.pendingDelivery, 1); // 8 - 5 - 2
  assert.equal(out.processed, 7); // 5 + 2
});


