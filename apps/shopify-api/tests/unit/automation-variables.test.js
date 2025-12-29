/**
 * Unit tests for automation variables service
 *
 * Tests verify that the correct variables are returned for each trigger type
 */

import { describe, it, expect } from '@jest/globals';
import {
  getAvailableVariables,
  getVariableDescription,
  getVariableDescriptions,
  isVariableAvailable,
} from '../../services/automation-variables.js';

describe('Automation Variables Service', () => {
  describe('getAvailableVariables', () => {
    it('should return variables for order_placed trigger', () => {
      const variables = getAvailableVariables('order_placed');
      expect(variables).toContain('order.name');
      expect(variables).toContain('customer.firstName');
      expect(variables).toContain('lineItems');
      expect(variables).toContain('totalPrice');
    });

    it('should return variables for order_fulfilled trigger', () => {
      const variables = getAvailableVariables('order_fulfilled');
      expect(variables).toContain('tracking.number');
      expect(variables).toContain('tracking.url');
      expect(variables).toContain('estimatedDeliveryAt');
    });

    it('should return variables for cart_abandoned trigger', () => {
      const variables = getAvailableVariables('cart_abandoned');
      expect(variables).toContain('abandonedCheckoutUrl');
      expect(variables).toContain('subtotalPrice');
    });

    it('should return empty array for unknown trigger', () => {
      const variables = getAvailableVariables('unknown_trigger');
      expect(variables).toEqual([]);
    });
  });

  describe('getVariableDescription', () => {
    it('should return description for known variable', () => {
      const desc = getVariableDescription('order.name');
      expect(desc).toHaveProperty('name');
      expect(desc).toHaveProperty('description');
      expect(desc).toHaveProperty('example');
      expect(desc.name).toBe('order.name');
    });

    it('should return default description for unknown variable', () => {
      const desc = getVariableDescription('unknown.variable');
      expect(desc).toHaveProperty('name');
      expect(desc).toHaveProperty('description');
      expect(desc.description).toBe('Variable description not available');
    });
  });

  describe('getVariableDescriptions', () => {
    it('should return all variable descriptions for a trigger', () => {
      const descriptions = getVariableDescriptions('order_placed');
      expect(descriptions).toBeInstanceOf(Array);
      expect(descriptions.length).toBeGreaterThan(0);
      descriptions.forEach(desc => {
        expect(desc).toHaveProperty('name');
        expect(desc).toHaveProperty('description');
      });
    });
  });

  describe('isVariableAvailable', () => {
    it('should return true for available variable', () => {
      const available = isVariableAvailable('order_placed', 'order.name');
      expect(available).toBe(true);
    });

    it('should return false for unavailable variable', () => {
      const available = isVariableAvailable('welcome', 'order.name');
      expect(available).toBe(false);
    });
  });
});
