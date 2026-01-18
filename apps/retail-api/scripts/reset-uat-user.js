#!/usr/bin/env node
/**
 * Reset a retail user and all related data (UAT-safe).
 * Default: DRY RUN (no deletions). Pass --execute to actually delete.
 *
 * Usage:
 *   node scripts/reset-uat-user.js --email kostas.pehlivanidis.dev@gmail.com --dry-run
 *   node scripts/reset-uat-user.js --email kostas.pehlivanidis.dev@gmail.com --execute
 */

const path = require('path');
// Load env from apps/api config (DATABASE_URL, STRIPE keys, etc.)
// eslint-disable-next-line import/no-dynamic-require, global-require
require('../apps/api/src/config/loadEnv')();
const { PrismaClient } = require('@prisma/client');
const Stripe = require('stripe');

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (idx === -1) return null;
  const val = args[idx].includes('=') ? args[idx].split('=').slice(1).join('=') : args[idx + 1];
  return val || true;
};

const email = getArg('--email') || getArg('-e') || 'kostas.pehlivanidis.dev@gmail.com';
const executeFlag = Boolean(getArg('--execute') || getArg('--apply'));
const dryRun = !executeFlag;

const prisma = new PrismaClient();
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

async function main() {
  if (!email) {
    console.error('Email is required. Use --email user@example.com');
    process.exit(1);
  }

  // Preflight: show env target and connectivity
  const dbUrl = process.env.DATABASE_URL || '';
  let parsed = null;
  try {
    parsed = new URL(dbUrl);
  } catch {
    parsed = null;
  }
  const sanitized = parsed
    ? {
      protocol: parsed.protocol,
      host: parsed.hostname,
      port: parsed.port,
      database: parsed.pathname.replace(/\//g, ''),
      sslmode: parsed.searchParams.get('sslmode'),
      channel_binding: parsed.searchParams.get('channel_binding'),
    }
    : null;

  console.log('--- Preflight ---');
  console.log('Env source: apps/retail-api/apps/api/src/config/loadEnv.js (root + apps/retail-api .env)');
  console.log('DATABASE_URL (sanitized):', sanitized);
  const ok = await prisma.$queryRaw`SELECT 1 as ok`.then(() => true).catch((err) => {
    console.error('DB connectivity failed:', err.message);
    return false;
  });
  if (!ok) {
    console.error('Abort: DB connectivity failed. Check NETWORK/SSL/ENV.');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });

  if (!user) {
    console.error(`User not found for email: ${email}`);
    process.exit(1);
  }

  const ownerId = user.id;
  console.log(`Target user: ${email} (id=${ownerId})`);
  console.log(`Dry run: ${dryRun ? 'YES (no deletions will occur)' : 'NO (will delete data)'}`);

  const steps = [
    { model: 'refreshToken', where: { userId: ownerId } },
    { model: 'billingTransaction', where: { ownerId } },
    { model: 'creditTransaction', where: { ownerId } },
    { model: 'wallet', where: { ownerId } },
    { model: 'purchase', where: { ownerId } },
    { model: 'invoiceRecord', where: { ownerId } },
    { model: 'taxEvidence', where: { ownerId } },
    { model: 'subscription', where: { ownerId } },
    { model: 'billingProfile', where: { ownerId } },
    { model: 'webhookEvent', where: { ownerId } },
    { model: 'campaignMessage', where: { ownerId } },
    { model: 'campaign', where: { ownerId } },
    { model: 'messageTemplate', where: { ownerId } },
    { model: 'shortLink', where: { ownerId } },
    { model: 'publicLinkToken', where: { ownerId } },
    { model: 'publicSignupEvent', where: { ownerId } },
    { model: 'retailBranding', where: { ownerId } },
    { model: 'retailAsset', where: { ownerId } },
    { model: 'retailJoinBranding', where: { ownerId } },
    { model: 'redemption', where: { ownerId } },
    { model: 'contact', where: { ownerId } },
    { model: 'list', where: { ownerId } },
    { model: 'nfcTag', where: { storeId: ownerId } },
    { model: 'nfcScan', where: { storeId: ownerId } },
    { model: 'conversionEvent', where: { storeId: ownerId } },
    { model: 'offerViewEvent', where: { ownerId } },
    { model: 'formConfig', where: { storeId: ownerId } },
    { model: 'automationMessage', where: { ownerId } },
    { model: 'automationRedemption', where: { ownerId } },
    { model: 'automation', where: { ownerId } },
    { model: 'invoiceRecord', where: { ownerId } }, // ensure re-run after tax evidence detaches
    { model: 'user', where: { id: ownerId } },
  ];

  const results = [];

  for (const step of steps) {
    const model = step.model;
    const where = step.where;
    if (typeof prisma[model]?.count !== 'function') {
      console.warn(`Skipping unknown model prisma.${model}`);
      continue;
    }
    const count = await prisma[model].count({ where });
    results.push({ model, count });
    if (dryRun || count === 0) {
      continue;
    }
    if (model === 'user') {
      await prisma.user.delete({ where: { id: ownerId } });
    } else {
      await prisma[model].deleteMany({ where });
    }
  }

  // Stripe cleanup (best-effort, non-blocking)
  const stripeActions = [];
  if (stripe && user.stripeSubscriptionId) {
    try {
      if (!dryRun) {
        await stripe.subscriptions.del(user.stripeSubscriptionId);
      }
      stripeActions.push(`subscription ${user.stripeSubscriptionId} canceled`);
    } catch (err) {
      stripeActions.push(`subscription ${user.stripeSubscriptionId} cancel failed: ${err.message}`);
    }
  }
  if (stripe && user.stripeCustomerId) {
    try {
      if (!dryRun) {
        await stripe.customers.del(user.stripeCustomerId);
      }
      stripeActions.push(`customer ${user.stripeCustomerId} deleted`);
    } catch (err) {
      stripeActions.push(`customer ${user.stripeCustomerId} delete failed: ${err.message}`);
    }
  }

  console.log('--- Deletion Summary ---');
  results.forEach((r) => {
    console.log(`${r.model}: ${r.count}${dryRun ? ' (dry-run)' : ''}`);
  });
  if (stripeActions.length) {
    console.log('Stripe:', stripeActions.join('; '));
  } else {
    console.log('Stripe: not attempted (missing STRIPE_SECRET_KEY or no ids)');
  }

  await prisma.$disconnect();
}

main()
  .catch((err) => {
    console.error('Reset script failed:', err);
    process.exit(1);
  });
