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

const buildRetailFrontendUrl = (path, baseUrl = null, query = null) => {
  const fallbackBase =
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    'https://astronote-retail-frontend.onrender.com';
  const base = normalizeRetailBaseUrl(baseUrl || fallbackBase);
  const validBase = normalizeBaseUrl(base);

  if (!validBase) {
    throw new Error(
      `Invalid frontend base URL. Please set FRONTEND_URL or APP_URL. Current value: ${base || '(empty)'}`,
    );
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const finalPath =
    normalizedPath.startsWith('/retail') ||
    normalizedPath.startsWith('/app/retail')
      ? normalizedPath
      : `/retail${normalizedPath}`;

  return buildUrl(validBase, finalPath, query);
};

module.exports = {
  normalizeRetailBaseUrl,
  buildRetailFrontendUrl,
};
