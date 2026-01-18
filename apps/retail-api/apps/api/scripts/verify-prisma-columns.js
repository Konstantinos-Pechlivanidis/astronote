#!/usr/bin/env node
/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  try {
    const profile = await prisma.billingProfile.findFirst({ select: { id: true, isBusiness: true, vatNumber: true, billingAddress: true } });
    if (!profile) {
      console.log('[verify-prisma-columns] OK: BillingProfile table accessible (no rows found).');
    } else {
      console.log('[verify-prisma-columns] OK: BillingProfile fields present', profile);
    }
    console.log('[verify-prisma-columns] SUCCESS');
  } catch (err) {
    console.error('[verify-prisma-columns] FAIL', err.code || err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
