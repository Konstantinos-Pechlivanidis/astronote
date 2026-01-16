/**
 * Replace personalization placeholders in message with contact data and discount code
 * @param {string} message - Message template with placeholders
 * @param {Object} contact - Contact object with firstName, lastName, discountCode, etc.
 * @returns {string} Message with placeholders replaced
 */
export function replacePlaceholders(message, contact) {
  if (!message || typeof message !== 'string') {
    return message || '';
  }

  const firstName = contact?.firstName || '';
  const lastName = contact?.lastName || '';
  const discountCode = contact?.discountCode || '';

  // Support common casing/underscore variants
  const patterns = {
    firstName: /\{\{\s*(first[_\s]?name|firstname|FIRSTNAME|FIRST_NAME|FirstName|First_Name)\s*\}\}/gi,
    lastName: /\{\{\s*(last[_\s]?name|lastname|LASTNAME|LAST_NAME|LastName|Last_Name)\s*\}\}/gi,
    discountCode: /\{\{\s*(discount[_\s]?code|discountcode|DISCOUNT_CODE|DISCOUNTCODE|DiscountCode|Discount_Code)\s*\}\}/gi,
  };

  let personalizedMessage = message;
  personalizedMessage = personalizedMessage.replace(patterns.firstName, firstName);
  personalizedMessage = personalizedMessage.replace(patterns.lastName, lastName);
  personalizedMessage = personalizedMessage.replace(patterns.discountCode, discountCode);

  // Clean up extra spaces that might result from empty replacements
  personalizedMessage = personalizedMessage.replace(/\s+/g, ' ').trim();

  return personalizedMessage;
}
