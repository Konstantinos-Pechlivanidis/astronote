const path = require('node:path');
const assert = require('node:assert/strict');

process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-secret';

const prismaPath = path.resolve(__dirname, '../src/lib/prisma.js');
const webhookServicePath = path.resolve(__dirname, '../src/services/webhook-replay.service.js');

let updateCalls = 0;

require.cache[prismaPath] = {
  exports: {
    contact: {
      updateMany: async () => {
        updateCalls += 1;
        return { count: 0 };
      },
    },
  },
};

require.cache[webhookServicePath] = {
  exports: {
    generateEventHash: () => 'hash',
    processWebhookWithReplayProtection: async () => ({ ok: true, processed: true }),
    markWebhookProcessed: async () => {},
  },
};

const router = require('../src/routes/mitto.webhooks');

const inboundLayer = router.stack.find(
  (layer) => layer.route && layer.route.path === '/webhooks/mitto/inbound',
);

if (!inboundLayer) {
  // eslint-disable-next-line no-console
  console.error('Inbound webhook route not found');
  process.exit(1);
}

const handler = inboundLayer.route.stack[inboundLayer.route.stack.length - 1].handle;

const req = {
  body: { from: '+306900000000', text: 'STOP' },
  query: {},
  headers: { 'x-webhook-token': process.env.WEBHOOK_SECRET },
  header(name) {
    return this.headers[name.toLowerCase()] || this.headers[name];
  },
  ip: '127.0.0.1',
};

const res = {
  statusCode: 0,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
};

(async () => {
  await handler(req, res);

  assert.equal(updateCalls, 0, 'Inbound webhook should not update contacts');
  assert.equal(res.statusCode, 200, 'Inbound webhook should respond with 200');

  // eslint-disable-next-line no-console
  console.log('OK: inbound STOP does not unsubscribe contacts');
})();
