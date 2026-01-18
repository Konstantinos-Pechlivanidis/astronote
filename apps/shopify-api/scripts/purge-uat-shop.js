#!/usr/bin/env node

/* eslint-disable no-console */
import os from 'os';
import { PrismaClient } from '@prisma/client';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    shopDomain: null,
    dryRun: true,
    yes: false,
    dbUrl: null,
    directUrl: null,
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--shop-domain') {
      out.shopDomain = args[i + 1];
      i += 1;
    } else if (arg === '--yes') {
      out.yes = true;
      out.dryRun = false;
    } else if (arg === '--dry-run') {
      out.dryRun = true;
    } else if (arg === '--db-url') {
      out.dbUrl = args[i + 1];
      i += 1;
    } else if (arg === '--direct-url') {
      out.directUrl = args[i + 1];
      i += 1;
    }
  }
  return out;
}

function normalizeShopDomain(value) {
  if (!value) return null;
  return value.includes('.myshopify.com') ? value : `${value}.myshopify.com`;
}

function chooseDbUrl({ dbUrl, directUrl }) {
  if (directUrl) return directUrl;
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
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
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    return await fn(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = parseArgs();
  const normalizedDomain = normalizeShopDomain(args.shopDomain);
  if (!normalizedDomain) {
    console.error('[purge] --shop-domain is required');
    process.exit(1);
  }

  const dbUrl = chooseDbUrl(args);
  logConnectionInfo(dbUrl);

  await withPrisma(dbUrl, async (prisma) => {
    const shop = await prisma.shop.findUnique({ where: { shopDomain: normalizedDomain } });
    if (!shop) {
      console.log('[purge] Shop not found, nothing to do.');
      return;
    }
    const shopId = shop.id;
    console.log(`[purge] Resolved shop ${normalizedDomain} -> id ${shopId}`);

    const tablesWithShopId = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='shopId';`,
    );

    const counts = [];
    for (const row of tablesWithShopId) {
      const table = row.table_name;
      // Skip global/system definitions
      if (table === 'Automation') continue;
      const whereSql = `"shopId" = '${shopId}'`;
      const [{ count }] = await prisma.$queryRawUnsafe(
        `SELECT count(*)::bigint AS count FROM ${quoteIdent(table)} WHERE ${whereSql};`,
      );
      const num = Number(count);
      if (num > 0) counts.push({ table, count: num });
    }

    // Shop-specific templates (shopId not null)
    const [{ count: templateCount }] = await prisma.$queryRawUnsafe(
      `SELECT count(*)::bigint AS count FROM "Template" WHERE "shopId" = '${shopId}';`,
    );
    if (Number(templateCount) > 0) counts.push({ table: 'Template (shop-scoped)', count: Number(templateCount) });

    console.log('[purge] Dry-run counts (skipping global Automation definitions):');
    counts.sort((a, b) => b.count - a.count).forEach((c) => console.log(`  ${c.table}: ${c.count}`));

    if (args.dryRun || !args.yes) {
      console.log('[purge] DRY-RUN complete. Re-run with --yes to execute.');
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Delete shop-scoped template usages first to avoid orphans
      await tx.templateUsage.deleteMany({ where: { shopId } });
      await tx.userAutomation.deleteMany({ where: { shopId } });
      await tx.automationLog.deleteMany({ where: { shopId } });

      // Delete any shop-specific templates (global templates have NULL shopId and are skipped)
      await tx.template.deleteMany({ where: { shopId } });

      for (const { table, count } of counts) {
        if (!count) continue;
        if (table === 'Template (shop-scoped)') continue; // handled above
        await tx.$executeRawUnsafe(`DELETE FROM ${quoteIdent(table)} WHERE "shopId" = '${shopId}';`);
      }

      await tx.shop.deleteMany({ where: { id: shopId } });
    });

    console.log('[purge] EXECUTE complete.');
  });
}

main().catch((err) => {
  console.error('[purge] ERROR', err);
  process.exit(1);
});
