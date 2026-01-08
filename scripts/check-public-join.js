#!/usr/bin/env node
/**
 * Lightweight architecture check for public join flow.
 * Fails if expected routes/files/endpoints are missing.
 */
const fs = require('fs');
const path = require('path');

function exists(file) {
  return fs.existsSync(path.resolve(__dirname, '..', file));
}

const missing = [];

const frontendRoute = 'apps/astronote-web/app/(retail)/join/[token]/page.tsx';
if (!exists(frontendRoute)) {
  missing.push(`Frontend route missing: ${frontendRoute}`);
}

const backendRoute = 'apps/retail-api/apps/api/src/routes/publicJoin.routes.js';
if (!exists(backendRoute)) {
  missing.push(`Backend route missing: ${backendRoute}`);
}

const endpointsFile = 'apps/astronote-web/src/lib/retail/api/endpoints.ts';
const endpointsText = exists(endpointsFile) ? fs.readFileSync(path.resolve(__dirname, '..', endpointsFile), 'utf8') : '';
if (!/\/public\/join\/\$\{token\}/.test(endpointsText)) {
  missing.push('Frontend endpoints.ts does not reference /public/join/${token}');
}

if (missing.length) {
  console.error('Public join check FAILED:\n- ' + missing.join('\n- '));
  process.exit(1);
}

console.log('Public join check OK');
