import { describe, it, expect } from '@jest/globals';

import {
  CAMPAIGN_STATUS_VALUES,
  normalizeCampaignStatus,
} from '../../constants/campaign-status.js';

describe('Shopify Campaign Status Contract', () => {
  it('contains the full canonical vocabulary including legacy sent', () => {
    expect(CAMPAIGN_STATUS_VALUES).toEqual(
      expect.arrayContaining([
        'draft',
        'scheduled',
        'sending',
        'paused',
        'completed',
        'failed',
        'cancelled',
        'sent',
      ]),
    );
  });

  it('normalizes legacy sent -> completed for API output', () => {
    expect(normalizeCampaignStatus('sent')).toEqual({
      status: 'completed',
      statusRaw: 'sent',
      legacy: true,
    });
  });

  it('passes through canonical values unchanged', () => {
    expect(normalizeCampaignStatus('completed')).toEqual({
      status: 'completed',
      statusRaw: 'completed',
      legacy: false,
    });
  });
});


