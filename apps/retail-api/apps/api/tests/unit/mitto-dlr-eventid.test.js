const { test } = require('node:test');
const assert = require('node:assert/strict');

const { resolveMittoDlrEventId } = require('../../src/services/mitto-dlr-eventid.service');

test('resolveMittoDlrEventId prefers explicit eventId when provided', () => {
  const payload = { eventId: 'evt_abc', deliveryStatus: 'Delivered' };
  const out = resolveMittoDlrEventId(payload, 'msg_1', new Date('2026-01-14T10:10:10Z'));
  assert.equal(out, 'evt_abc');
});

test('resolveMittoDlrEventId generates deterministic id when eventId missing', () => {
  const payload = { deliveryStatus: 'Delivered' };
  const doneAt = new Date('2026-01-14T10:10:59Z');
  const out = resolveMittoDlrEventId(payload, 'msg_1', doneAt);
  // Bucketed by minute => 2026-01-14T10:10:xxZ
  const expectedBucket = Math.floor(doneAt.getTime() / 60000);
  assert.equal(out, `msg_1:Delivered:${expectedBucket}`);
});


