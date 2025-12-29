/**
 * PII Redaction Utilities (P1)
 * Redacts sensitive personally identifiable information from logs
 */

/**
 * Redact phone numbers (E.164 format)
 * @param {string} phone - Phone number to redact
 * @returns {string} Redacted phone (e.g., "+1234****5678")
 */
export function redactPhone(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  // Keep country code and last 4 digits, redact middle
  const match = phone.match(/^(\+\d{1,3})(\d+)(\d{4})$/);
  if (match) {
    const [, country, middle, last] = match;
    return `${country}${'*'.repeat(Math.min(middle.length, 8))}${last}`;
  }
  // Fallback: redact all but last 4
  if (phone.length > 4) {
    return '*'.repeat(phone.length - 4) + phone.slice(-4);
  }
  return '****';
}

/**
 * Redact email addresses
 * @param {string} email - Email to redact
 * @returns {string} Redacted email (e.g., "j***@example.com")
 */
export function redactEmail(email) {
  if (!email || typeof email !== 'string') return email;
  const [local, domain] = email.split('@');
  if (!domain) return '****@****';
  if (local.length <= 1) return `${local[0] || '*'}***@${domain}`;
  return `${local[0]}***@${domain}`;
}

/**
 * Redact tokens/secrets (JWT, API keys, etc.)
 * @param {string} token - Token to redact
 * @returns {string} Redacted token (e.g., "Bearer eyJ***")
 */
export function redactToken(token) {
  if (!token || typeof token !== 'string') return token;
  if (token.startsWith('Bearer ')) {
    const jwt = token.substring(7);
    if (jwt.length > 10) {
      return `Bearer ${jwt.substring(0, 6)}***${jwt.substring(jwt.length - 4)}`;
    }
    return 'Bearer ***';
  }
  if (token.length > 8) {
    return `${token.substring(0, 4)}***${token.substring(token.length - 4)}`;
  }
  return '***';
}

/**
 * Redact sensitive fields from an object
 * @param {Object} obj - Object to redact
 * @param {Array<string>} sensitiveFields - Fields to redact
 * @returns {Object} Object with redacted fields
 */
export function redactObject(obj, sensitiveFields = []) {
  if (!obj || typeof obj !== 'object') return obj;
  const defaultSensitive = [
    'phoneE164',
    'phone',
    'email',
    'authorization',
    'authorizationHeader',
    'token',
    'accessToken',
    'apiKey',
    'secret',
    'password',
    'stripeSecretKey',
    'jwtSecret',
    'sessionSecret',
  ];

  const allSensitive = [...new Set([...defaultSensitive, ...sensitiveFields])];
  const redacted = { ...obj };

  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();

    // Check if key matches any sensitive field (case-insensitive)
    if (allSensitive.some(s => lowerKey.includes(s.toLowerCase()))) {
      const value = redacted[key];
      if (typeof value === 'string') {
        if (lowerKey.includes('phone')) {
          redacted[key] = redactPhone(value);
        } else if (lowerKey.includes('email')) {
          redacted[key] = redactEmail(value);
        } else if (lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('key')) {
          redacted[key] = redactToken(value);
        } else {
          redacted[key] = '***REDACTED***';
        }
      } else {
        redacted[key] = '***REDACTED***';
      }
    }
  }

  return redacted;
}

/**
 * Redact headers (especially Authorization)
 * @param {Object} headers - Headers object
 * @returns {Object} Headers with sensitive fields redacted
 */
export function redactHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers;
  const redacted = { ...headers };
  const authKeys = ['authorization', 'x-api-key', 'x-auth-token', 'cookie'];
  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();
    if (authKeys.some(authKey => lowerKey.includes(authKey))) {
      redacted[key] = redactToken(String(redacted[key]));
    }
  }
  return redacted;
}

export default {
  redactPhone,
  redactEmail,
  redactToken,
  redactObject,
  redactHeaders,
};

