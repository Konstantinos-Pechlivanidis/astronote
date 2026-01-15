import { describe, it, expect } from '@jest/globals';
import { decideChangeMode } from '../../services/subscription-change-policy.js';

describe('subscription-change-policy decideChangeMode', () => {
  it('returns scheduled for Pro Yearly downgrade to Starter', () => {
    expect(
      decideChangeMode(
        { planCode: 'pro', interval: 'year' },
        { planCode: 'starter', interval: 'month' },
      ),
    ).toBe('scheduled');
  });

  it('returns checkout for month → year changes', () => {
    expect(
      decideChangeMode(
        { planCode: 'starter', interval: 'month' },
        { planCode: 'starter', interval: 'year' },
      ),
    ).toBe('checkout');

    expect(
      decideChangeMode(
        { planCode: 'pro', interval: 'month' },
        { planCode: 'pro', interval: 'year' },
      ),
    ).toBe('checkout');
  });

  it('returns scheduled for year → month changes (downgrade)', () => {
    expect(
      decideChangeMode(
        { planCode: 'starter', interval: 'year' },
        { planCode: 'starter', interval: 'month' },
      ),
    ).toBe('scheduled');
  });

  it('returns immediate for upgrades that do not change month → year', () => {
    expect(
      decideChangeMode(
        { planCode: 'starter', interval: 'year' },
        { planCode: 'pro', interval: 'year' },
      ),
    ).toBe('immediate');
  });
});


