import { describe, it, expect } from '@jest/globals';
import { validateBillingProfileForCheckout } from '../../services/billing-profile.js';

describe('Billing Profile VAT Validation', () => {
  describe('validateBillingProfileForCheckout', () => {
    it('returns valid for complete profile without VAT', () => {
      const profile = {
        billingEmail: 'test@example.com',
        legalName: 'Test Company',
        billingAddress: {
          country: 'US',
          line1: '123 Main St',
        },
        isBusiness: false,
      };

      const result = validateBillingProfileForCheckout(profile);
      expect(result.valid).toBe(true);
      expect(result.missingFields).toEqual([]);
      expect(result.vatRequired).toBe(false);
    });

    it('returns valid for complete profile with VAT (non-GR)', () => {
      const profile = {
        billingEmail: 'test@example.com',
        legalName: 'Test Company',
        billingAddress: {
          country: 'DE',
          line1: '123 Main St',
        },
        isBusiness: true,
        vatNumber: 'DE123456789',
        vatCountry: 'DE',
      };

      const result = validateBillingProfileForCheckout(profile);
      expect(result.valid).toBe(true);
      expect(result.missingFields).toEqual([]);
      expect(result.vatRequired).toBe(false);
    });

    it('requires VAT for Greek businesses', () => {
      const profile = {
        billingEmail: 'test@example.com',
        legalName: 'Test Company',
        billingAddress: {
          country: 'GR',
          line1: '123 Main St',
        },
        isBusiness: true,
        // Missing vatNumber
      };

      const result = validateBillingProfileForCheckout(profile);
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('vatNumber');
      expect(result.vatRequired).toBe(true);
      expect(result.vatMessage).toContain('VAT number (AFM) is required');
    });

    it('allows Greek non-business without VAT', () => {
      const profile = {
        billingEmail: 'test@example.com',
        legalName: 'Test Company',
        billingAddress: {
          country: 'GR',
          line1: '123 Main St',
        },
        isBusiness: false,
        // No VAT required for non-business
      };

      const result = validateBillingProfileForCheckout(profile);
      expect(result.valid).toBe(true);
      expect(result.missingFields).not.toContain('vatNumber');
      expect(result.vatRequired).toBe(false);
    });

    it('validates Greek business with VAT provided', () => {
      const profile = {
        billingEmail: 'test@example.com',
        legalName: 'Test Company',
        billingAddress: {
          country: 'GR',
          line1: '123 Main St',
        },
        isBusiness: true,
        vatNumber: '123456789',
        vatCountry: 'GR',
      };

      const result = validateBillingProfileForCheckout(profile);
      expect(result.valid).toBe(true);
      expect(result.missingFields).not.toContain('vatNumber');
      expect(result.vatRequired).toBe(true);
    });

    it('handles case-insensitive country codes', () => {
      const profile = {
        billingEmail: 'test@example.com',
        legalName: 'Test Company',
        billingAddress: {
          country: 'gr', // lowercase
          line1: '123 Main St',
        },
        isBusiness: true,
        // Missing VAT
      };

      const result = validateBillingProfileForCheckout(profile);
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('vatNumber');
      expect(result.vatRequired).toBe(true);
    });

    it('returns missing fields for incomplete profile', () => {
      const profile = {
        billingEmail: 'test@example.com',
        // Missing legalName, country, address
      };

      const result = validateBillingProfileForCheckout(profile);
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('legalName');
      expect(result.missingFields).toContain('country');
      expect(result.missingFields).toContain('address.line1');
    });

    it('handles null/undefined profile', () => {
      const result = validateBillingProfileForCheckout(null);
      expect(result.valid).toBe(false);
      expect(result.missingFields.length).toBeGreaterThan(0);
    });
  });
});

