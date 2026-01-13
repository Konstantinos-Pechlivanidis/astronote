const normalizeBaseUrl = (input) => {
  if (!input || typeof input !== 'string') {
    return null;
  }

  let normalized = input.trim();

  normalized = normalized.replace(/\/+$/, '');

  if (!normalized.match(/^https?:\/\//)) {
    const localhostPattern = /^localhost(:\d+)?$/i;
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
    const domainPattern = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(?::\d+)?$/;

    if (
      localhostPattern.test(normalized) ||
      ipPattern.test(normalized) ||
      domainPattern.test(normalized)
    ) {
      normalized = `https://${normalized}`;
    } else {
      return null;
    }
  }

  return normalized;
};

const buildUrl = (base, path, query = null) => {
  if (!base) {
    throw new Error('Base URL is required');
  }

  const normalizedBase = normalizeBaseUrl(base);
  if (!normalizedBase) {
    throw new Error(`Invalid base URL: ${base}`);
  }

  const baseUrl = new URL(normalizedBase);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(normalizedPath, baseUrl);

  if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
};

const isValidAbsoluteUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

module.exports = {
  normalizeBaseUrl,
  buildUrl,
  isValidAbsoluteUrl,
};
