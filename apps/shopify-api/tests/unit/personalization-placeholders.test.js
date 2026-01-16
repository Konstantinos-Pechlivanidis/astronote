import { describe, expect, it } from '@jest/globals';
import { replacePlaceholders } from '../../utils/personalization.js';

describe('replacePlaceholders', () => {
  it('replaces common token variants', () => {
    const message = 'Hi {{First_Name}} {{LASTNAME}} code {{discountCode}} {{DISCOUNT_CODE}}';
    const result = replacePlaceholders(message, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      discountCode: 'SAVE10',
    });

    expect(result).toBe('Hi Ada Lovelace code SAVE10 SAVE10');
  });

  it('handles missing values without leaving tokens', () => {
    const message = 'Hello {{firstName}} {{last_name}}!';
    const result = replacePlaceholders(message, {});
    expect(result).toBe('Hello !');
  });
});
