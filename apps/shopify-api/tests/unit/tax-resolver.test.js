import { describe, it, expect } from '@jest/globals';
import { resolveTaxTreatment } from '../../services/tax-resolver.js';

describe('Tax Resolver', () => {
  it('returns domestic VAT for Greece', () => {
    const result = resolveTaxTreatment({ billingCountry: 'GR' });
    expect(result.mode).toBe('domestic_vat');
    expect(result.taxRate).toBeCloseTo(0.24, 2);
  });

  it('returns reverse charge for EU B2B with valid VAT ID', () => {
    const result = resolveTaxTreatment({
      billingCountry: 'DE',
      vatId: 'DE123456789',
      vatIdValidated: true,
    });
    expect(result.mode).toBe('eu_reverse_charge');
    expect(result.taxRate).toBe(0);
  });

  it('returns EU B2C VAT when no VAT ID is provided', () => {
    const result = resolveTaxTreatment({ billingCountry: 'DE' });
    expect(result.mode).toBe('eu_b2c');
    expect(result.taxRate).toBeGreaterThan(0);
  });

  it('returns non-EU for US', () => {
    const result = resolveTaxTreatment({ billingCountry: 'US' });
    expect(result.mode).toBe('non_eu');
    expect(result.taxRate).toBe(0);
  });
});
