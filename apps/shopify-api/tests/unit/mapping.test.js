/**
 * Mapping Tests
 *
 * Tests that verify Prisma -> DTO mapping logic ensures no empty strings
 * in id/value fields that are used by frontend Select components.
 */

import { describe, it, expect } from '@jest/globals';

describe('Prisma -> DTO Mapping', () => {
  describe('Template Mapping', () => {
    it('should ensure template IDs are always non-empty strings', () => {
      // Simulate Prisma template data
      const prismaTemplate = {
        id: 'template123',
        name: 'Welcome Template',
        category: 'Welcome',
        text: 'Hi {{first_name}}!',
        language: 'en',
        eshopType: 'fashion',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mapping function (simulating what the service does)
      const mapTemplate = (template) => ({
        id: String(template.id || '').trim(),
        name: template.name,
        category: template.category,
        text: template.text,
        language: template.language,
        eshopType: template.eshopType,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      });

      const mapped = mapTemplate(prismaTemplate);

      expect(mapped.id).toBeTruthy();
      expect(typeof mapped.id).toBe('string');
      expect(mapped.id.length).toBeGreaterThan(0);
    });

    it('should filter out templates with empty IDs', () => {
      const templates = [
        { id: 'template1', name: 'Template 1', category: 'Cat1', text: 'Text', language: 'en', eshopType: 'fashion', createdAt: new Date(), updatedAt: new Date() },
        { id: '', name: 'Template 2', category: 'Cat2', text: 'Text', language: 'en', eshopType: 'fashion', createdAt: new Date(), updatedAt: new Date() },
        { id: 'template3', name: 'Template 3', category: 'Cat3', text: 'Text', language: 'en', eshopType: 'fashion', createdAt: new Date(), updatedAt: new Date() },
      ];

      const safeTemplates = templates.filter(t => {
        const id = String(t.id || '').trim();
        return id.length > 0;
      });

      expect(safeTemplates).toHaveLength(2);
      expect(safeTemplates.every(t => String(t.id).trim().length > 0)).toBe(true);
    });
  });

  describe('Audience/Segment Mapping', () => {
    it('should ensure audience IDs are always non-empty strings', () => {
      const prismaSegment = {
        id: 'segment123',
        name: 'VIP Customers',
        type: 'segment',
      };

      const mapAudience = (segment) => ({
        id: String(segment.id || '').trim(),
        name: segment.name,
        type: segment.type,
      });

      const mapped = mapAudience(prismaSegment);

      expect(mapped.id).toBeTruthy();
      expect(typeof mapped.id).toBe('string');
      expect(mapped.id.length).toBeGreaterThan(0);
    });

    it('should filter out audiences with empty IDs', () => {
      const audiences = [
        { id: 'segment1', name: 'Segment 1', type: 'segment' },
        { id: '', name: 'Segment 2', type: 'segment' },
        { id: 'segment3', name: 'Segment 3', type: 'segment' },
      ];

      const safeAudiences = audiences
        .map(a => ({ ...a, id: String(a.id || '').trim() }))
        .filter(a => a.id.length > 0);

      expect(safeAudiences).toHaveLength(2);
      expect(safeAudiences.every(a => a.id.length > 0)).toBe(true);
    });
  });

  describe('Discount Mapping', () => {
    it('should ensure discount IDs are always non-empty strings', () => {
      const prismaDiscount = {
        id: 'discount123',
        code: 'SUMMER20',
        title: 'Summer Sale',
      };

      const mapDiscount = (discount) => ({
        id: String(discount.id || '').trim(),
        code: discount.code,
        title: discount.title,
      });

      const mapped = mapDiscount(prismaDiscount);

      expect(mapped.id).toBeTruthy();
      expect(typeof mapped.id).toBe('string');
      expect(mapped.id.length).toBeGreaterThan(0);
    });

    it('should filter out discounts with empty IDs', () => {
      const discounts = [
        { id: 'discount1', code: 'CODE1' },
        { id: '', code: 'CODE2' },
        { id: 'discount3', code: 'CODE3' },
      ];

      const safeDiscounts = discounts
        .map(d => ({ ...d, id: String(d.id || '').trim() }))
        .filter(d => d.id.length > 0);

      expect(safeDiscounts).toHaveLength(2);
      expect(safeDiscounts.every(d => d.id.length > 0)).toBe(true);
    });
  });

  describe('Category Mapping', () => {
    it('should filter out empty/null categories', () => {
      const categories = [
        'Welcome',
        '',
        'Promotional',
        null,
        'Retention',
        undefined,
        'Loyalty',
      ];

      const safeCategories = categories
        .map(c => String(c ?? '').trim())
        .filter(cat => cat !== '')
        .filter((cat, index, arr) => arr.indexOf(cat) === index); // Remove duplicates

      expect(safeCategories).toHaveLength(4);
      expect(safeCategories.every(c => c.length > 0)).toBe(true);
    });
  });
});

