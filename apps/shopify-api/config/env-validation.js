import { logger } from '../utils/logger.js';
import { validateUrlConfig } from '../utils/url-helpers.js';

/**
 * Environment Variable Validation
 * Validates required environment variables on startup
 */

const REQUIRED_ENV_VARS = {
  production: [
    'DATABASE_URL',
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'STRIPE_SECRET_KEY',
  ],
  development: ['DATABASE_URL'],
  test: ['DATABASE_URL'],
};

const OPTIONAL_ENV_VARS = {
  production: [
    'REDIS_URL',
    'MITTO_API_KEY',
    'MITTO_API_BASE',
    'STRIPE_WEBHOOK_SECRET',
    'JWT_SECRET',
    'SESSION_SECRET',
    'LOG_LEVEL',
    'SENTRY_DSN',
    'HOST',
    'ALLOWED_ORIGINS',
  ],
  development: [
    'REDIS_URL',
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'MITTO_API_KEY',
    'STRIPE_SECRET_KEY',
  ],
  test: ['REDIS_URL', 'SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET'],
};

/**
 * Validate environment variables
 * @param {string} env - Environment (production, development, test)
 * @returns {Object} Validation result
 */
export function validateEnvironment(
  env = process.env.NODE_ENV || 'development',
) {
  const required = REQUIRED_ENV_VARS[env] || REQUIRED_ENV_VARS.development;
  const optional = OPTIONAL_ENV_VARS[env] || OPTIONAL_ENV_VARS.development;

  const missing = [];
  const warnings = [];

  // Check required variables
  for (const varName of required) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check optional variables and warn if missing in production
  if (env === 'production') {
    for (const varName of optional) {
      if (!process.env[varName]) {
        warnings.push(varName);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
    environment: env,
  };
}

/**
 * Validate and log environment configuration
 * Throws error if required variables are missing
 */
export async function validateAndLogEnvironment() {
  const env = process.env.NODE_ENV || 'development';
  const validation = validateEnvironment(env);

  if (!validation.valid) {
    logger.error('Missing required environment variables', {
      environment: env,
      missing: validation.missing,
    });

    throw new Error(
      `Missing required environment variables: ${validation.missing.join(', ')}\n` +
        'Please check your .env file or environment configuration.',
    );
  }

  if (validation.warnings.length > 0) {
    logger.warn(
      'Missing optional environment variables (recommended for production)',
      {
        environment: env,
        missing: validation.warnings,
      },
    );
  }

  logger.info('Environment validation passed', {
    environment: env,
    required: validation.missing.length === 0,
    optional: validation.warnings.length,
  });

  // Validate URL configurations (critical for Stripe redirects)
  await validateUrlConfigurations(env);

  return validation;
}

/**
 * Validate URL configurations (FRONTEND_URL, etc.)
 * Critical for Stripe checkout redirects
 * @param {string} env - Environment
 */
async function validateUrlConfigurations(env) {
  // Check FRONTEND_URL (used for Stripe redirects)
  const frontendUrl =
    process.env.FRONTEND_URL ||
    process.env.FRONTEND_BASE_URL ||
    process.env.WEB_APP_URL;

  if (env === 'production') {
    if (!frontendUrl) {
      logger.warn(
        'FRONTEND_URL, FRONTEND_BASE_URL, or WEB_APP_URL is not set. Stripe checkout redirects may fail.',
      );
    } else {
      const validated = validateUrlConfig(frontendUrl, 'FRONTEND_URL');
      if (!validated) {
        logger.error(
          `FRONTEND_URL is invalid: "${frontendUrl}". Stripe checkout will fail. Please set a valid absolute URL (e.g., https://astronote.onrender.com).`,
        );
      } else {
        logger.info('FRONTEND_URL validated', {
          url: validated,
          // Don't log full URL in production for security, just confirm it's set
          configured: true,
        });
      }
    }
  } else {
    // In development/test, just warn
    if (frontendUrl) {
      const validated = validateUrlConfig(frontendUrl, 'FRONTEND_URL');
      if (!validated) {
        logger.warn(
          `FRONTEND_URL is invalid: "${frontendUrl}". Stripe checkout redirects may fail.`,
        );
      }
    }
  }

  // Validate Stripe configuration
  if (process.env.STRIPE_SECRET_KEY) {
    // Plan catalog validation:
    // - Prefer simplified (Retail parity): STRIPE_PRICE_ID_SUB_{STARTER,PRO}_{EUR,USD}
    //   with implied intervals (starter=month, pro=year)
    // - Still support full matrix (Billing v2): starter/pro × month/year × EUR/USD
    //   if those vars exist (matrix-only installs remain supported).
    const planCatalog = await import('../services/plan-catalog.js');
    const validation = planCatalog.validateCatalog();
    if (!validation.valid) {
      const missing = validation.missingEnvVars || validation.missing || [];
      const mode = validation.mode || 'unknown';
      const message =
        `Missing required Stripe price env vars for plan catalog (mode=${mode}): ${missing.join(', ')}`;

      // Fail fast in production AND CI when Stripe is enabled.
      // This prevents deployments/tests with partial plan catalogs.
      if (env === 'production' || process.env.CI) {
        logger.error(message, { missing });
        throw new Error(message);
      } else {
        logger.warn(message, { missing });
      }
    }
  }
}

/**
 * Get environment variable with validation
 * @param {string} name - Variable name
 * @param {string} defaultValue - Default value
 * @param {boolean} required - Whether variable is required
 * @returns {string} Environment variable value
 */
export function getEnv(name, defaultValue = null, required = false) {
  const value = process.env[name];

  if (required && !value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }

  return value || defaultValue;
}

export default {
  validateEnvironment,
  validateAndLogEnvironment,
  getEnv,
};
