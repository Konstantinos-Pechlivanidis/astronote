#!/usr/bin/env node

/* eslint-disable no-console */
const os = require('os');
const { PrismaClient } = require('@prisma/client');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    email: null,
    dryRun: true,
    yes: false,
    dbUrl: null,
    directDbUrl: null,
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--email') {
      out.email = args[i + 1];
      i += 1;
    } else if (arg === '--yes') {
      out.yes = true;
      out.dryRun = false;
    } else if (arg === '--dry-run') {
      out.dryRun = true;
    } else if (arg === '--db-url') {
      out.dbUrl = args[i + 1];
      i += 1;
    } else if (arg === '--direct-db-url') {
      out.directDbUrl = args[i + 1];
      i += 1;
    }
  }
  return out;
}

function chooseDbUrl({ dbUrl, directDbUrl }) {
  if (directDbUrl) return directDbUrl;
  if (process.env.DIRECT_DATABASE_URL) return process.env.DIRECT_DATABASE_URL;
  if (dbUrl) return dbUrl;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return null;
}

function logConnectionInfo(url) {
  if (!url) {
    console.error('[purge] No database URL provided. Aborting.');
    process.exit(1);
  }
  const hasSsl = /sslmode=require/.test(url);
  console.log('[purge] Connecting with url host fragment:', url.replace(/(:\/\/)([^@]+)@/, '$1***@'));
  console.log('[purge] sslmode=require:', hasSsl);
  console.log('[purge] hostname:', os.hostname());
}

function quoteIdent(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

async function withPrisma(url, fn) {
  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });
  try {
    return await fn(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = parseArgs();
  if (!args.email) {
    console.error('[purge] --email is required');
    process.exit(1);
  }

  const dbUrl = chooseDbUrl(args);
  logConnectionInfo(dbUrl);

  await withPrisma(dbUrl, async (prisma) => {
    const user = await prisma.user.findUnique({ where: { email: args.email } });
    if (!user) {
      console.log('[purge] User not found, nothing to do.');
      return;
    }
    const ownerId = user.id;
    console.log(`[purge] Resolved user ${args.email} -> id ${ownerId}`);

    const ownerTablesRows = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='ownerId';`,
    );
    const createdByTablesRows = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='createdById';`,
    );
    const userIdTablesRows = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='userId';`,
    );

    const tables = Array.from(
      new Set([
        ...ownerTablesRows.map((r) => r.table_name),
        ...createdByTablesRows.map((r) => r.table_name),
        ...userIdTablesRows.map((r) => r.table_name),
      ]),
    ).filter((t) => t !== 'User'); // delete user last

    // Optional skip set for global/system definitions
    const skipTables = new Set(['MessageTemplate', 'Automation']);

    const counts = [];
    for (const table of tables) {
      if (skipTables.has(table)) continue;
      const whereClauses = [];
      if (ownerTablesRows.find((r) => r.table_name === table)) whereClauses.push(`"ownerId" = ${ownerId}`);
      if (createdByTablesRows.find((r) => r.table_name === table)) whereClauses.push(`"createdById" = ${ownerId}`);
      if (userIdTablesRows.find((r) => r.table_name === table)) whereClauses.push(`"userId" = ${ownerId}`);
      if (!whereClauses.length) continue;
      const whereSql = whereClauses.join(' OR ');
      const [{ count }] = await prisma.$queryRawUnsafe(
        `SELECT count(*)::bigint AS count FROM ${quoteIdent(table)} WHERE ${whereSql};`,
      );
      counts.push({ table, count: Number(count) });
    }

    console.log('[purge] Dry-run counts (skipping MessageTemplate, Automation):');
    counts
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .forEach((c) => console.log(`  ${c.table}: ${c.count}`));

    if (args.dryRun || !args.yes) {
      console.log('[purge] DRY-RUN complete. Re-run with --yes to execute.');
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Delete child records first to avoid restrict FKs (campaign createdById, nfc tags, etc.)
      for (const { table, count } of counts) {
        if (count === 0 || skipTables.has(table)) continue;
        const whereClauses = [];
        if (ownerTablesRows.find((r) => r.table_name === table)) whereClauses.push(`"ownerId" = ${ownerId}`);
        if (createdByTablesRows.find((r) => r.table_name === table)) whereClauses.push(`"createdById" = ${ownerId}`);
        if (userIdTablesRows.find((r) => r.table_name === table)) whereClauses.push(`"userId" = ${ownerId}`);
        if (!whereClauses.length) continue;
        const whereSql = whereClauses.join(' OR ');
        await tx.$executeRawUnsafe(`DELETE FROM ${quoteIdent(table)} WHERE ${whereSql};`);
      }

      await tx.refreshToken.deleteMany({ where: { userId: ownerId } });
      await tx.user.deleteMany({ where: { id: ownerId } });
    });

    console.log('[purge] EXECUTE complete.');
  });
}

main().catch((err) => {
  console.error('[purge] ERROR', err);
  process.exit(1);
});
