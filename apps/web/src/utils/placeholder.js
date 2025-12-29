/**
 * Insert placeholder into text at cursor position
 */
export function insertPlaceholder(text, cursorPosition, placeholder) {
  const before = text.substring(0, cursorPosition);
  const after = text.substring(cursorPosition);
  return before + placeholder + after;
}

/**
 * Replace placeholders in text with values
 */
export function replacePlaceholders(text, values) {
  let result = text;
  Object.entries(values).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  });
  return result;
}

/**
 * Get available placeholders
 */
export const AVAILABLE_PLACEHOLDERS = [
  { key: 'firstName', label: 'First Name', placeholder: '{{firstName}}' },
  { key: 'lastName', label: 'Last Name', placeholder: '{{lastName}}' },
  { key: 'discount', label: 'Discount Code', placeholder: '{{discount}}' },
];

