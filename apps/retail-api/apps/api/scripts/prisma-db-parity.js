/**
 * Retail Prisma ↔ DB parity scanner (read-only).
 *
 * Goal: detect "column does not exist" / enum↔text mismatches before runtime.
 *
 * Output:
 * - /tmp/retail_prisma_db_parity.md
 *
 * Exit codes:
 * - 0: parity OK
 * - 1: missing tables/columns or type mismatches
 */

const fs = require('fs');
const path = require('path');
const loadEnv = require('../src/config/loadEnv');
const { PrismaClient } = require('@prisma/client');

loadEnv();

const prisma = new PrismaClient();

const RETAIL_API_ROOT = path.resolve(__dirname, '..'); // apps/retail-api/apps/api
const RETAIL_REPO_ROOT = path.resolve(RETAIL_API_ROOT, '../..'); // apps/retail-api
const PRISMA_SCHEMA_PATH = path.resolve(RETAIL_REPO_ROOT, 'prisma/schema.prisma');
const OUTPUT_PATH = '/tmp/retail_prisma_db_parity.md';

function parsePrismaSchema(schemaText) {
  const enums = new Set();
  const models = {};

  const lines = schemaText.split('\n');
  let currentEnum = null;
  let currentModel = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const enumMatch = line.match(/^enum\s+(\w+)\s*{/);
    if (enumMatch) {
      currentEnum = enumMatch[1];
      enums.add(currentEnum);
      currentModel = null;
      continue;
    }

    const modelMatch = line.match(/^model\s+(\w+)\s*{/);
    if (modelMatch) {
      currentModel = modelMatch[1];
      models[currentModel] = {};
      currentEnum = null;
      continue;
    }

    if (line === '}') {
      currentEnum = null;
      currentModel = null;
      continue;
    }

    // Parse model fields (skip @@ and comments)
    if (currentModel && line && !line.startsWith('//') && !line.startsWith('@@')) {
      // Field grammar is complex; we intentionally implement a conservative parser:
      // <name> <type>[?]? ...
      const fieldMatch = line.match(/^(\w+)\s+([A-Za-z]\w*)(\?)?\s*(.*)?$/);
      if (!fieldMatch) continue;

      const name = fieldMatch[1];
      const type = fieldMatch[2];

      // Skip relation list fields and virtual fields: they do not map to columns.
      // Heuristic: if the raw line contains '[]' it's not a column.
      if (rawLine.includes('[]')) continue;

      // Skip relation-only fields using @relation without an underlying scalar column.
      // We keep scalar fields (including foreign keys like ownerId).
      if (rawLine.includes('@relation') && !rawLine.includes('fields:')) continue;

      models[currentModel][name] = type;
    }
  }

  return { enums, models };
}

async function getDbColumns(tableName) {
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position;
    `,
    tableName,
  );
  return rows;
}

function isScalarPrismaType(typeName, enumNames) {
  if (enumNames.has(typeName)) return true;
  return [
    'String',
    'Boolean',
    'Int',
    'BigInt',
    'Float',
    'Decimal',
    'DateTime',
    'Json',
    'Bytes',
  ].includes(typeName);
}

function normalizeExpectedDbType(prismaType, enumNames) {
  if (enumNames.has(prismaType)) return { kind: 'enum', enumName: prismaType };
  switch (prismaType) {
    case 'String':
      return { kind: 'scalar', dbTypes: ['text', 'character varying'] };
    case 'Boolean':
      return { kind: 'scalar', dbTypes: ['boolean'] };
    case 'Int':
      return { kind: 'scalar', dbTypes: ['integer'] };
    case 'BigInt':
      return { kind: 'scalar', dbTypes: ['bigint'] };
    case 'Float':
      return { kind: 'scalar', dbTypes: ['double precision', 'real'] };
    case 'DateTime':
      return {
        kind: 'scalar',
        dbTypes: ['timestamp without time zone', 'timestamp with time zone'],
      };
    case 'Json':
      return { kind: 'scalar', dbTypes: ['jsonb'] };
    default:
      return { kind: 'unknown', dbTypes: [] };
  }
}

function formatTable(header, rows) {
  return [
    header,
    '| column | expected | actual |',
    '| --- | --- | --- |',
    ...rows.map((r) => `| ${r.column} | ${r.expected} | ${r.actual} |`),
    '',
  ].join('\n');
}

async function main() {
  const report = [];
  report.push(`# Retail Prisma ↔ DB Parity Report\n`);
  report.push(`Schema: \`${PRISMA_SCHEMA_PATH}\`\n`);
  report.push(`Generated: ${new Date().toISOString()}\n`);

  if (!process.env.DATABASE_URL) {
    report.push(`## ERROR\n`);
    report.push(`- DATABASE_URL is not set. Cannot run parity scan.\n`);
    fs.writeFileSync(OUTPUT_PATH, report.join('\n'));
    console.error(`Wrote ${OUTPUT_PATH}`);
    process.exit(1);
  }

  const schemaText = fs.readFileSync(PRISMA_SCHEMA_PATH, 'utf8');
  const { enums, models } = parsePrismaSchema(schemaText);

  const tablesToCheck = [
    'User',
    'Wallet',
    'CreditTransaction',
    'BillingTransaction',
    'InvoiceRecord',
    'WebhookEvent',
    'Campaign',
    'CampaignMessage',
    'Contact',
    'List',
    'ListMembership',
  ];

  let ok = true;

  report.push(`## Focus tables\n`);
  report.push(tablesToCheck.map((t) => `- \`${t}\``).join('\n'));
  report.push('\n');

  for (const modelName of tablesToCheck) {
    const prismaFields = models[modelName];
    report.push(`## ${modelName}\n`);

    if (!prismaFields) {
      report.push(`- Prisma model not found in schema (skipping DB check)\n`);
      report.push('\n');
      continue;
    }

    const dbColumns = await getDbColumns(modelName);
    if (!dbColumns || dbColumns.length === 0) {
      ok = false;
      report.push(`- **MISSING TABLE**: \`${modelName}\` (no columns found in DB public schema)\n\n`);
      continue;
    }

    const dbMap = new Map(dbColumns.map((c) => [c.column_name, c]));

    const missing = [];
    const mismatches = [];

    for (const [fieldName, prismaType] of Object.entries(prismaFields)) {
      if (!isScalarPrismaType(prismaType, enums)) continue;

      const dbCol = dbMap.get(fieldName);
      if (!dbCol) {
        ok = false;
        missing.push(fieldName);
        continue;
      }

      const expected = normalizeExpectedDbType(prismaType, enums);
      if (expected.kind === 'enum') {
        // information_schema uses udt_name for enum type name, lowercased in postgres typically
        const actualEnum = dbCol.udt_name;
        if (dbCol.data_type !== 'USER-DEFINED' || actualEnum.toLowerCase() !== prismaType.toLowerCase()) {
          ok = false;
          mismatches.push({
            column: fieldName,
            expected: `enum:${prismaType}`,
            actual: `${dbCol.data_type}:${dbCol.udt_name}`,
          });
        }
      } else if (expected.kind === 'scalar' && expected.dbTypes.length > 0) {
        if (!expected.dbTypes.includes(dbCol.data_type)) {
          ok = false;
          mismatches.push({
            column: fieldName,
            expected: expected.dbTypes.join(' | '),
            actual: `${dbCol.data_type}${dbCol.udt_name ? ':' + dbCol.udt_name : ''}`,
          });
        }
      }
    }

    if (missing.length) {
      report.push(`### Missing columns\n`);
      for (const m of missing) report.push(`- **MISSING**: \`${m}\``);
      report.push('\n');
    } else {
      report.push(`### Missing columns\n- none ✅\n\n`);
    }

    if (mismatches.length) {
      report.push(`### Type mismatches\n`);
      report.push(formatTable('', mismatches));
      report.push('\n');
    } else {
      report.push(`### Type mismatches\n- none ✅\n\n`);
    }
  }

  fs.writeFileSync(OUTPUT_PATH, report.join('\n'));
  console.log(`Wrote ${OUTPUT_PATH}`);

  if (!ok) {
    console.error('Parity check failed ❌');
    process.exit(1);
  }
  console.log('Parity check passed ✅');
}

main()
  .catch(async (e) => {
    console.error(e);
    try {
      await prisma.$disconnect();
    } catch {}
    process.exit(1);
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {}
  });


