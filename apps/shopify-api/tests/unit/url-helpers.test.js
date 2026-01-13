import { describe, it, expect } from '@jest/globals';
import {
  normalizeBaseUrl,
  buildUrl,
  isValidAbsoluteUrl,
  validateUrlConfig,
} from '../../utils/url-helpers.js';

describe('URL Helpers', () => {
  describe('normalizeBaseUrl', () => {
    it('should add https:// to domain without protocol', () => {
      expect(normalizeBaseUrl('astronote.onrender.com')).toBe(
        'https://astronote.onrender.com',
      );
    });

    it('should preserve https:// protocol', () => {
      expect(normalizeBaseUrl('https://astronote.onrender.com')).toBe(
        'https://astronote.onrender.com',
      );
    });

    it('should preserve http:// protocol', () => {
      expect(normalizeBaseUrl('http://localhost:3000')).toBe(
        'http://localhost:3000',
      );
    });

    it('should remove trailing slashes', () => {
      expect(normalizeBaseUrl('https://astronote.onrender.com/')).toBe(
        'https://astronote.onrender.com',
      );
      expect(normalizeBaseUrl('https://astronote.onrender.com///')).toBe(
        'https://astronote.onrender.com',
      );
    });

    it('should return null for invalid input', () => {
      expect(normalizeBaseUrl('')).toBeNull();
      expect(normalizeBaseUrl(null)).toBeNull();
      expect(normalizeBaseUrl(undefined)).toBeNull();
      expect(normalizeBaseUrl('not-a-url')).toBeNull();
    });
  });

  describe('buildUrl', () => {
    it('should build valid absolute URL from base and path', () => {
      const result = buildUrl(
        'https://astronote.onrender.com',
        '/app/billing/success',
      );
      expect(result).toBe('https://astronote.onrender.com/app/billing/success');
    });

    it('should handle path without leading slash', () => {
      const result = buildUrl(
        'https://astronote.onrender.com',
        'app/billing/success',
      );
      expect(result).toBe('https://astronote.onrender.com/app/billing/success');
    });

    it('should add query parameters', () => {
      const result = buildUrl(
        'https://astronote.onrender.com',
        '/app/billing/success',
        { session_id: 'test123', type: 'subscription' },
      );
      expect(result).toContain('https://astronote.onrender.com/app/billing/success');
      expect(result).toContain('session_id=test123');
      expect(result).toContain('type=subscription');
    });

    it('should throw error for invalid base URL', () => {
      expect(() => buildUrl('', '/path')).toThrow('Base URL is required');
      expect(() => buildUrl('not-a-url', '/path')).toThrow('Invalid base URL');
    });

    it('should normalize base URL automatically', () => {
      const result = buildUrl('astronote.onrender.com', '/path');
      expect(result).toBe('https://astronote.onrender.com/path');
    });
  });

  describe('isValidAbsoluteUrl', () => {
    it('should validate absolute URLs', () => {
      expect(isValidAbsoluteUrl('https://astronote.onrender.com/path')).toBe(
        true,
      );
      expect(isValidAbsoluteUrl('http://localhost:3000/path')).toBe(true);
    });

    it('should reject relative URLs', () => {
      expect(isValidAbsoluteUrl('/path')).toBe(false);
      expect(isValidAbsoluteUrl('path')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(isValidAbsoluteUrl('')).toBe(false);
      expect(isValidAbsoluteUrl(null)).toBe(false);
      expect(isValidAbsoluteUrl('not-a-url')).toBe(false);
    });
  });

  describe('validateUrlConfig', () => {
    it('should return normalized URL for valid input', () => {
      const result = validateUrlConfig(
        'https://astronote.onrender.com',
        'FRONTEND_URL',
      );
      expect(result).toBe('https://astronote.onrender.com');
    });

    it('should normalize URL without protocol', () => {
      const result = validateUrlConfig(
        'astronote.onrender.com',
        'FRONTEND_URL',
      );
      expect(result).toBe('https://astronote.onrender.com');
    });

    it('should return null for invalid URL', () => {
      const result = validateUrlConfig('not-a-url', 'FRONTEND_URL');
      expect(result).toBeNull();
    });

    it('should return null for empty URL', () => {
      const result = validateUrlConfig('', 'FRONTEND_URL');
      expect(result).toBeNull();
    });
  });
});

