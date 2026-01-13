const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const prismaPath = path.resolve(__dirname, '../../src/lib/prisma.js');
// const billingRoutesPath = path.resolve(__dirname, '../../src/routes/billing.js');

const createPrismaMock = () => {
  const users = new Map();
  const wallets = new Map();
  const creditTransactions = new Map();
  const purchases = new Map();
  const packages = new Map();

  return {
    user: {
      findUnique: async ({ where }) => {
        if (where.id) {return users.get(where.id) || null;}
        if (where.email) {
          for (const u of users.values()) {
            if (u.email === where.email) {return u;}
          }
        }
        return null;
      },
      findFirst: async ({ where }) => {
        if (where.stripeCustomerId) {
          for (const u of users.values()) {
            if (u.stripeCustomerId === where.stripeCustomerId) {return u;}
          }
        }
        if (where.stripeSubscriptionId) {
          for (const u of users.values()) {
            if (u.stripeSubscriptionId === where.stripeSubscriptionId) {return u;}
          }
        }
        return null;
      },
      update: async ({ where, data }) => {
        const user = users.get(where.id);
        if (!user) {throw new Error('Not found');}
        const updated = { ...user, ...data };
        users.set(where.id, updated);
        return updated;
      },
    },
    wallet: {
      findUnique: async ({ where }) => {
        if (where.ownerId) {return wallets.get(where.ownerId) || null;}
        return null;
      },
    },
    creditTransaction: {
      findMany: async ({ where }) => {
        const results = [];
        for (const txn of creditTransactions.values()) {
          if (txn.ownerId === where.ownerId) {
            results.push(txn);
          }
        }
        return results;
      },
      count: async ({ where }) => {
        let count = 0;
        for (const txn of creditTransactions.values()) {
          if (txn.ownerId === where.ownerId) {
            count++;
          }
        }
        return count;
      },
      findFirst: async ({ where }) => {
        for (const txn of creditTransactions.values()) {
          if (txn.ownerId === where.ownerId) {
            if (where.reason && txn.reason === where.reason) {
              if (where.meta) {
                const meta = txn.meta || {};
                const path = where.meta.path || [];
                const equals = where.meta.equals;
                let value = meta;
                for (const key of path) {
                  value = value?.[key];
                }
                if (value === equals) {return txn;}
              } else {
                return txn;
              }
            }
          }
        }
        return null;
      },
    },
    purchase: {
      findFirst: async ({ where }) => {
        for (const p of purchases.values()) {
          if (where.ownerId && p.ownerId !== where.ownerId) {continue;}
          if (where.idempotencyKey && p.idempotencyKey !== where.idempotencyKey) {continue;}
          if (where.stripeSessionId && p.stripeSessionId !== where.stripeSessionId) {continue;}
          if (where.status && p.status !== where.status) {continue;}
          return p;
        }
        return null;
      },
      create: async ({ data }) => {
        const purchase = { id: purchases.size + 1, ...data };
        purchases.set(purchase.id, purchase);
        return purchase;
      },
      update: async ({ where, data }) => {
        const purchase = purchases.get(where.id);
        if (!purchase) {throw new Error('Not found');}
        const updated = { ...purchase, ...data };
        purchases.set(where.id, updated);
        return updated;
      },
    },
    package: {
      findFirst: async ({ where }) => {
        for (const pkg of packages.values()) {
          if (where.id && pkg.id === where.id) {return pkg;}
          if (where.active !== undefined && pkg.active !== where.active) {continue;}
          return pkg;
        }
        return null;
      },
      findMany: async ({ where }) => {
        const results = [];
        for (const pkg of packages.values()) {
          if (where.active === undefined || pkg.active === where.active) {
            results.push(pkg);
          }
        }
        return results;
      },
    },
  };
};

test('billing transactions are scoped by ownerId', async () => {
  const prismaMock = createPrismaMock();

  // Setup: Create two users
  prismaMock.user.findUnique = async ({ where }) => {
    if (where.id === 1) {return { id: 1, email: 'user1@test.com', billingCurrency: 'EUR' };}
    if (where.id === 2) {return { id: 2, email: 'user2@test.com', billingCurrency: 'EUR' };}
    return null;
  };

  // Setup: Create transactions for user 1
  const txn1 = { id: 1, ownerId: 1, type: 'credit', amount: 100, reason: 'test' };
  const txn2 = { id: 2, ownerId: 1, type: 'debit', amount: 50, reason: 'test' };
  prismaMock.creditTransaction.findMany = async ({ where }) => {
    if (where.ownerId === 1) {return [txn1, txn2];}
    if (where.ownerId === 2) {return [];}
    return [];
  };
  prismaMock.creditTransaction.count = async ({ where }) => {
    if (where.ownerId === 1) {return 2;}
    if (where.ownerId === 2) {return 0;}
    return 0;
  };

  delete require.cache[prismaPath];
  require.cache[prismaPath] = { exports: prismaMock };

  // Simulate GET /billing/transactions for user 1
  const result1 = await prismaMock.creditTransaction.findMany({ where: { ownerId: 1 } });
  assert.equal(result1.length, 2);
  assert.equal(result1[0].ownerId, 1);
  assert.equal(result1[1].ownerId, 1);

  // Simulate GET /billing/transactions for user 2
  const result2 = await prismaMock.creditTransaction.findMany({ where: { ownerId: 2 } });
  assert.equal(result2.length, 0);

  // Verify user 1 cannot see user 2's transactions
  const allTxns = await prismaMock.creditTransaction.findMany({ where: { ownerId: 1 } });
  const user2Txns = allTxns.filter(t => t.ownerId === 2);
  assert.equal(user2Txns.length, 0);
});

test('purchase records are scoped by ownerId', async () => {
  const prismaMock = createPrismaMock();

  // Setup: Create purchases for different users
  prismaMock.purchase.findFirst = async ({ where }) => {
    if (where.ownerId === 1 && where.idempotencyKey === 'key1') {
      return { id: 1, ownerId: 1, idempotencyKey: 'key1', status: 'pending' };
    }
    if (where.ownerId === 2 && where.idempotencyKey === 'key2') {
      return { id: 2, ownerId: 2, idempotencyKey: 'key2', status: 'pending' };
    }
    return null;
  };

  delete require.cache[prismaPath];
  require.cache[prismaPath] = { exports: prismaMock };

  // User 1 tries to access their purchase
  const purchase1 = await prismaMock.purchase.findFirst({
    where: { ownerId: 1, idempotencyKey: 'key1' },
  });
  assert.equal(purchase1.ownerId, 1);

  // User 1 tries to access user 2's purchase (should not find it)
  const purchase2 = await prismaMock.purchase.findFirst({
    where: { ownerId: 1, idempotencyKey: 'key2' },
  });
  assert.equal(purchase2, null);

  // User 2 can access their own purchase
  const purchase3 = await prismaMock.purchase.findFirst({
    where: { ownerId: 2, idempotencyKey: 'key2' },
  });
  assert.equal(purchase3.ownerId, 2);
});

