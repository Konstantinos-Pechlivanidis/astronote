const { buildUrl, normalizeBaseUrl } = require('./url-helpers');

const normalizeRetailBaseUrl = (baseUrl) => {
  if (!baseUrl || typeof baseUrl !== 'string') {
    return baseUrl;
  }

  let normalized = baseUrl.trim().replace(/\/+$/, '');

  if (normalized.endsWith('/app/retail')) {
    normalized = normalized.slice(0, -11);
  }

  if (normalized.endsWith('/retail')) {
    normalized = normalized.slice(0, -7);
  }

  return normalized;
};

const getRetailFrontendBaseUrl = (baseUrl = null) => {
  const fallbackBase =
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    'https://astronote.onrender.com';
  const base = normalizeRetailBaseUrl(baseUrl || fallbackBase);
  const validBase = normalizeBaseUrl(base);

  if (!validBase) {
    throw new Error(
      `Invalid frontend base URL. Please set FRONTEND_URL or APP_URL. Current value: ${base || '(empty)'}`,
    );
  }

  return validBase.replace(/\/+$/, '');
};

const buildRetailFrontendUrl = (path, baseUrl = null, query = null) => {
  const validBase = getRetailFrontendBaseUrl(baseUrl);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const finalPath =
    normalizedPath.startsWith('/retail') ||
    normalizedPath.startsWith('/app/retail')
      ? normalizedPath
      : `/retail${normalizedPath}`;

  return buildUrl(validBase, finalPath, query);
};

const buildRetailSuccessUrl = (baseUrl = null) =>
  `${getRetailFrontendBaseUrl(baseUrl)}/app/retail/billing/success?session_id={CHECKOUT_SESSION_ID}`;

const buildRetailCancelUrl = (baseUrl = null) =>
  `${getRetailFrontendBaseUrl(baseUrl)}/app/retail/billing/cancel`;

const warnIfEncodedCheckoutPlaceholder = (label, url) => {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  if (!url) {
    return;
  }
  if (url.includes('%7B') || url.includes('%7D')) {
    // eslint-disable-next-line no-console
    console.warn(`[billing-url] ${label} contains encoded braces: ${url}`);
  }
};

module.exports = {
  normalizeRetailBaseUrl,
  buildRetailFrontendUrl,
  getRetailFrontendBaseUrl,
  buildRetailSuccessUrl,
  buildRetailCancelUrl,
  warnIfEncodedCheckoutPlaceholder,
};
