const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const prismaPath = path.resolve(__dirname, '../../src/lib/prisma.js');
const smsPath = path.resolve(__dirname, '../../src/services/sms.service.js');
const servicePath = path.resolve(__dirname, '../../src/services/automationLibrary.service.js');

function withMocks(mocks, fn) {
  const originals = {};
  for (const [key, value] of Object.entries(mocks)) {
    originals[key] = require.cache[key];
    require.cache[key] = { exports: value };
  }
  return fn().finally(() => {
    for (const [key, value] of Object.entries(originals)) {
      if (value) {
        require.cache[key] = value;
      } else {
        delete require.cache[key];
      }
    }
  });
}

test('automation library sends appointment reminder based on event timing', async () => {
  const now = new Date('2026-01-10T10:00:00Z');
  const rule = {
    id: 1,
    ownerId: 50,
    isActive: true,
    triggerType: 'event',
    eventType: 'appointment',
    eventStatus: 'scheduled',
    eventTimeField: 'startAt',
    offsetMinutes: -1440,
    messageBody: 'Reminder {{first_name}}',
    messageType: 'service',
    dedupeWindowMinutes: 1440,
    maxPerContactPerDay: 1,
    presetKey: 'appointments_reminder_24h',
  };

  let sendCalled = false;

  const prismaMock = {
    automationRule: {
      findMany: async () => [rule],
      update: async () => ({}),
    },
    customerEvent: {
      findMany: async () => ([
        {
          id: 100,
          startAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          endAt: null,
          contact: {
            id: 10,
            phone: '+15550001111',
            isSubscribed: true,
            serviceAllowed: true,
            firstName: 'Alex',
          },
        },
      ]),
    },
    automationSend: {
      count: async () => 0,
      findFirst: async () => null,
      create: async ({ data }) => ({ id: 9, ...data }),
      update: async () => ({}),
    },
  };

  const smsMock = {
    sendSMSWithCredits: async () => {
      sendCalled = true;
      return { sent: true, messageId: 'msg_1' };
    },
  };

  await withMocks({
    [prismaPath]: prismaMock,
    [smsPath]: smsMock,
  }, async () => {
    delete require.cache[servicePath];
    const { processAutomationLibraryRuns } = require(servicePath);
    const summary = await processAutomationLibraryRuns({ now });
    assert.equal(summary.sent, 1);
    assert.equal(sendCalled, true);
  });
});

test('automation library sends inactivity-based preset', async () => {
  const now = new Date('2026-01-10T10:00:00Z');
  const rule = {
    id: 2,
    ownerId: 50,
    isActive: true,
    triggerType: 'inactivity',
    inactivityDays: 14,
    messageBody: 'We miss you',
    messageType: 'marketing',
    dedupeWindowMinutes: 1440,
    maxPerContactPerDay: 1,
    meta: { eventTypes: ['visit'] },
    presetKey: 'gym_inactivity_14d',
  };

  let sendCalled = false;

  const prismaMock = {
    automationRule: {
      findMany: async () => [rule],
      update: async () => ({}),
    },
    $queryRawUnsafe: async () => [{ contactId: 12 }],
    contact: {
      findMany: async () => ([
        { id: 12, phone: '+15550002222', isSubscribed: true, serviceAllowed: true },
      ]),
    },
    automationSend: {
      count: async () => 0,
      findFirst: async () => null,
      create: async ({ data }) => ({ id: 12, ...data }),
      update: async () => ({}),
    },
  };

  const smsMock = {
    sendSMSWithCredits: async () => {
      sendCalled = true;
      return { sent: true, messageId: 'msg_2' };
    },
  };

  await withMocks({
    [prismaPath]: prismaMock,
    [smsPath]: smsMock,
  }, async () => {
    delete require.cache[servicePath];
    const { processAutomationLibraryRuns } = require(servicePath);
    const summary = await processAutomationLibraryRuns({ now });
    assert.equal(summary.sent, 1);
    assert.equal(sendCalled, true);
  });
});

test('automation library blocks marketing send for unsubscribed contact', async () => {
  const now = new Date('2026-01-10T10:00:00Z');
  const rule = {
    id: 3,
    ownerId: 50,
    isActive: true,
    triggerType: 'event',
    eventType: 'purchase',
    eventStatus: 'completed',
    eventTimeField: 'endAt',
    offsetMinutes: 1440,
    messageBody: 'Thanks',
    messageType: 'marketing',
    dedupeWindowMinutes: 1440,
    maxPerContactPerDay: 1,
    presetKey: 'post_purchase_followup_1d',
  };

  const prismaMock = {
    automationRule: {
      findMany: async () => [rule],
      update: async () => ({}),
    },
    customerEvent: {
      findMany: async () => ([
        {
          id: 200,
          startAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          endAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          contact: {
            id: 20,
            phone: '+15550003333',
            isSubscribed: false,
            serviceAllowed: true,
          },
        },
      ]),
    },
    automationSend: {
      count: async () => 0,
      findFirst: async () => null,
    },
  };

  const smsMock = {
    sendSMSWithCredits: async () => {
      throw new Error('should not send');
    },
  };

  await withMocks({
    [prismaPath]: prismaMock,
    [smsPath]: smsMock,
  }, async () => {
    delete require.cache[servicePath];
    const { processAutomationLibraryRuns } = require(servicePath);
    const summary = await processAutomationLibraryRuns({ now });
    assert.equal(summary.sent, 0);
  });
});

test('automation library dedupes sends within window', async () => {
  const now = new Date('2026-01-10T10:00:00Z');
  const rule = {
    id: 4,
    ownerId: 50,
    isActive: true,
    triggerType: 'event',
    eventType: 'appointment',
    eventStatus: 'scheduled',
    eventTimeField: 'startAt',
    offsetMinutes: -120,
    messageBody: 'Reminder',
    messageType: 'service',
    dedupeWindowMinutes: 1440,
    maxPerContactPerDay: 1,
    presetKey: 'appointments_reminder_2h',
  };

  const prismaMock = {
    automationRule: {
      findMany: async () => [rule],
      update: async () => ({}),
    },
    customerEvent: {
      findMany: async () => ([
        {
          id: 300,
          startAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
          endAt: null,
          contact: {
            id: 30,
            phone: '+15550004444',
            isSubscribed: true,
            serviceAllowed: true,
          },
        },
      ]),
    },
    automationSend: {
      count: async () => 1,
      findFirst: async () => ({ id: 99 }),
    },
  };

  const smsMock = {
    sendSMSWithCredits: async () => {
      throw new Error('should not send');
    },
  };

  await withMocks({
    [prismaPath]: prismaMock,
    [smsPath]: smsMock,
  }, async () => {
    delete require.cache[servicePath];
    const { processAutomationLibraryRuns } = require(servicePath);
    const summary = await processAutomationLibraryRuns({ now });
    assert.equal(summary.sent, 0);
  });
});
