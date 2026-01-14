import { describe, it, expect } from '@jest/globals';

import {
  isDeliveredDeliveryStatus,
  isFailedDeliveryStatus,
  buildCanonicalCampaignMetrics,
} from '../../services/campaign-status-metrics.js';

describe('Campaign delivery status mapping', () => {
  it('classifies delivered statuses (case-insensitive)', () => {
    expect(isDeliveredDeliveryStatus('Delivered')).toBe(true);
    expect(isDeliveredDeliveryStatus('delivrd')).toBe(true);
    expect(isDeliveredDeliveryStatus('completed')).toBe(true);
    expect(isDeliveredDeliveryStatus('ok')).toBe(true);
  });

  it('classifies failed statuses (case-insensitive)', () => {
    expect(isFailedDeliveryStatus('Failed')).toBe(true);
    expect(isFailedDeliveryStatus('failure')).toBe(true);
    expect(isFailedDeliveryStatus('undelivered')).toBe(true);
    expect(isFailedDeliveryStatus('expired')).toBe(true);
  });

  it('builds canonical metrics with pendingDelivery = accepted - delivered - failed', () => {
    const out = buildCanonicalCampaignMetrics({
      recipients: 10,
      accepted: 8,
      delivered: 5,
      failed: 2,
    });
    expect(out.totals).toEqual({
      recipients: 10,
      accepted: 8,
      sent: 8,
      delivered: 5,
      failed: 2,
    });
    expect(out.delivery.pendingDelivery).toBe(1);
    expect(out.sourceOfTruth).toBe('mitto');
  });
});


