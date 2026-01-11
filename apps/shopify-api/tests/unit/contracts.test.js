/**
 * Contract Tests
 *
 * Tests that verify API response DTOs match expected schemas.
 * Ensures frontend can safely parse responses without crashes.
 */

import { describe, it, expect } from '@jest/globals';
import {
  templatesListResponseSchema,
  campaignsListResponseSchema,
  audiencesListResponseSchema,
  discountsListResponseSchema,
} from '../../schemas/responses.schema.js';

describe('API Response Contracts', () => {
  describe('Templates List Response', () => {
    it('should validate valid templates list response', () => {
      const validResponse = {
        items: [
          {
            id: 'template123',
            name: 'Welcome Template',
            title: 'Welcome Template',
            category: 'Welcome',
            text: 'Hi {{first_name}}!',
            language: 'en',
            eshopType: 'fashion',
            tags: ['welcome'],
            useCount: 5,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };

      expect(() => templatesListResponseSchema.parse(validResponse)).not.toThrow();
    });

    it('should reject response with empty template ID', () => {
      const invalidResponse = {
        items: [
          {
            id: '', // Empty ID - should fail
            name: 'Welcome Template',
            category: 'Welcome',
            text: 'Hi {{first_name}}!',
            language: 'en',
            eshopType: 'fashion',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };

      expect(() => templatesListResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should reject response with missing required fields', () => {
      const invalidResponse = {
        items: [
          {
            id: 'template123',
            // Missing name, category, text
          },
        ],
        total: 1,
      };

      expect(() => templatesListResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should ensure all template IDs are non-empty strings', () => {
      const response = {
        items: [
          { id: 'template1', name: 'Template 1', category: 'Cat1', text: 'Text', language: 'en', eshopType: 'fashion', createdAt: new Date(), updatedAt: new Date() },
          { id: 'template2', name: 'Template 2', category: 'Cat2', text: 'Text', language: 'en', eshopType: 'fashion', createdAt: new Date(), updatedAt: new Date() },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      };

      const validated = templatesListResponseSchema.parse(response);
      validated.items.forEach(item => {
        expect(item.id).toBeTruthy();
        expect(typeof item.id).toBe('string');
        expect(item.id.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Campaigns List Response', () => {
    it('should validate valid campaigns list response', () => {
      const validResponse = {
        success: true,
        data: [
          {
            id: 'campaign123',
            name: 'Summer Sale',
            message: 'Get 20% off!',
            status: 'draft',
            audience: 'all',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };

      expect(() => campaignsListResponseSchema.parse(validResponse)).not.toThrow();
    });

    it('should reject response with empty campaign ID', () => {
      const invalidResponse = {
        success: true,
        data: [
          {
            id: '', // Empty ID - should fail
            name: 'Summer Sale',
            message: 'Get 20% off!',
            status: 'draft',
            audience: 'all',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };

      expect(() => campaignsListResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should ensure all campaign IDs are non-empty strings', () => {
      const response = {
        success: true,
        data: [
          { id: 'campaign1', name: 'Campaign 1', message: 'Message', status: 'draft', audience: 'all', createdAt: new Date(), updatedAt: new Date() },
          { id: 'campaign2', name: 'Campaign 2', message: 'Message', status: 'sent', audience: 'all', createdAt: new Date(), updatedAt: new Date() },
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 2,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };

      const validated = campaignsListResponseSchema.parse(response);
      validated.data.forEach(item => {
        expect(item.id).toBeTruthy();
        expect(typeof item.id).toBe('string');
        expect(item.id.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Audiences List Response', () => {
    it('should validate valid audiences list response', () => {
      const validResponse = {
        success: true,
        data: [
          {
            id: 'segment123',
            name: 'VIP Customers',
            type: 'segment',
            count: 100,
          },
        ],
      };

      expect(() => audiencesListResponseSchema.parse(validResponse)).not.toThrow();
    });

    it('should reject response with empty audience ID', () => {
      const invalidResponse = {
        success: true,
        data: [
          {
            id: '', // Empty ID - should fail
            name: 'VIP Customers',
            type: 'segment',
          },
        ],
      };

      expect(() => audiencesListResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should ensure all audience IDs are non-empty strings', () => {
      const response = {
        success: true,
        data: [
          { id: 'segment1', name: 'Segment 1', type: 'segment' },
          { id: 'segment2', name: 'Segment 2', type: 'segment' },
        ],
      };

      const validated = audiencesListResponseSchema.parse(response);
      validated.data.forEach(item => {
        expect(item.id).toBeTruthy();
        expect(typeof item.id).toBe('string');
        expect(item.id.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Discounts List Response', () => {
    it('should validate valid discounts list response', () => {
      const validResponse = {
        success: true,
        data: [
          {
            id: 'discount123',
            code: 'SUMMER20',
            title: 'Summer Sale',
            value: '20%',
            type: 'percentage',
          },
        ],
      };

      expect(() => discountsListResponseSchema.parse(validResponse)).not.toThrow();
    });

    it('should reject response with empty discount ID', () => {
      const invalidResponse = {
        success: true,
        data: [
          {
            id: '', // Empty ID - should fail
            code: 'SUMMER20',
          },
        ],
      };

      expect(() => discountsListResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should ensure all discount IDs are non-empty strings', () => {
      const response = {
        success: true,
        data: [
          { id: 'discount1', code: 'CODE1' },
          { id: 'discount2', code: 'CODE2' },
        ],
      };

      const validated = discountsListResponseSchema.parse(response);
      validated.data.forEach(item => {
        expect(item.id).toBeTruthy();
        expect(typeof item.id).toBe('string');
        expect(item.id.length).toBeGreaterThan(0);
      });
    });
  });
});

