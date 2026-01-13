const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const prismaPath = path.resolve(__dirname, '../../src/lib/prisma.js');
const walletPath = path.resolve(__dirname, '../../src/services/wallet.service.js');
const invoicesPath = path.resolve(__dirname, '../../src/services/invoices.service.js');

const createPrismaMock = () => {
  const records = new Map();
  let idCounter = 1;

  const createTransaction = async ({ data }) => {
    if (records.has(data.idempotencyKey)) {
      const err = new Error('Unique constraint');
      err.code = 'P2002';
      throw err;
    }
    const record = { id: idCounter++, ...data };
    records.set(data.idempotencyKey, record);
    return record;
  };

  const findFirst = async ({ where }) => records.get(where.idempotencyKey) || null;

  return {
    billingTransaction: {
      create: createTransaction,
      findFirst,
    },
    $transaction: async (fn) => fn({
      billingTransaction: {
        create: createTransaction,
      },
    }),
  };
};

test('recordSubscriptionInvoiceTransaction is idempotent and credits once', async () => {
  const prismaMock = createPrismaMock();
  const creditCalls = [];

  delete require.cache[prismaPath];
  require.cache[prismaPath] = { exports: prismaMock };
  delete require.cache[walletPath];
  require.cache[walletPath] = {
    exports: {
      credit: async (...args) => {
        creditCalls.push(args);
      },
    },
  };
  delete require.cache[invoicesPath];

  const { recordSubscriptionInvoiceTransaction } = require(invoicesPath);

  const invoice = {
    id: 'in_123',
    amount_paid: 1200,
    currency: 'eur',
    payment_intent: 'pi_123',
    subscription: 'sub_123',
  };

  await recordSubscriptionInvoiceTransaction(1, invoice, { creditsAdded: 10 });
  await recordSubscriptionInvoiceTransaction(1, invoice, { creditsAdded: 10 });

  assert.equal(creditCalls.length, 1);
});

test('listInvoices scopes by ownerId', async () => {
  const calls = { findMany: [], count: [] };
  const prismaMock = {
    invoiceRecord: {
      findMany: async (args) => {
        calls.findMany.push(args);
        return [];
      },
      count: async (args) => {
        calls.count.push(args);
        return 0;
      },
    },
  };

  delete require.cache[prismaPath];
  require.cache[prismaPath] = { exports: prismaMock };
  delete require.cache[invoicesPath];

  const { listInvoices } = require(invoicesPath);
  await listInvoices(42, { page: 1, pageSize: 10 });

  assert.equal(calls.findMany[0].where.ownerId, 42);
  assert.equal(calls.count[0].where.ownerId, 42);
});
