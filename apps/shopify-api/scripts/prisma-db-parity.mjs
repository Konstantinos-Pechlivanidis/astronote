/**
 * Shopify Prisma ↔ DB parity scan (focused, automated).
 *
 * Why this exists:
 * - Prevent runtime Prisma errors like "column does not exist"
 * - Prevent Postgres type mismatches like `operator does not exist text = "MessageDirection"`
 *
 * Notes:
 * - This repo's Shopify API is ESM JS (no ts-node/tsx installed). This script is `.mjs` and runnable via `node`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import loadEnv from '../config/loadEnv.js';
import prisma from '../services/prisma.js';

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');

function parseModelFields(schemaText, modelName) {
  const modelRegex = new RegExp(`model\\s+${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const match = schemaText.match(modelRegex);
  if (!match) return null;

  const body = match[1];
  const lines = body
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('//'));

  const fields = [];
  for (const line of lines) {
    // stop before @@ blocks / closing
    if (line.startsWith('@@') || line.startsWith('}')) continue;
    // field line is: <name> <type> ...
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*|\w+\?)(\s|$)/);
    if (!m) continue;
    const name = m[1];
    const type = m[2];
    // Skip relation fields (best-effort): they usually have type equal to another model name
    fields.push({ name, type });
  }
  return fields;
}

function parseEnumNames(schemaText) {
  const enums = new Set();
  const enumRegex = /^\s*enum\s+(\w+)\s*\{/gm;
  let m;
  while ((m = enumRegex.exec(schemaText)) !== null) {
    enums.add(m[1]);
  }
  return enums;
}

function isScalarFieldType(type, enumNames) {
  const base = type.endsWith('?') ? type.slice(0, -1) : type;
  if (enumNames.has(base)) return true;
  return (
    base === 'String' ||
    base === 'Int' ||
    base === 'Boolean' ||
    base === 'DateTime' ||
    base === 'Json' ||
    base === 'Float'
  );
}

function sqlForMissingColumn({ table, column, prismaType, enumNames }) {
  const isOptional = prismaType.endsWith('?');
  const base = isOptional ? prismaType.slice(0, -1) : prismaType;

  // For enums, suggest TEXT as a safe default unless you explicitly want to create/convert enums.
  // (Enum/text operator mismatches are handled explicitly in focus checks.)
  if (enumNames.has(base)) {
    const nullability = isOptional ? '' : ' NOT NULL';
    const def = isOptional ? '' : ` DEFAULT '${base}'`;
    return `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" TEXT${nullability}${def};`;
  }

  if (base === 'String') {
    if (isOptional) return `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" TEXT;`;
    return `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" TEXT NOT NULL DEFAULT '';`;
  }
  if (base === 'Int') {
    if (isOptional) return `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" INTEGER;`;
    return `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" INTEGER NOT NULL DEFAULT 0;`;
  }
  if (base === 'Boolean') {
    if (isOptional) return `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" BOOLEAN;`;
    return `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" BOOLEAN NOT NULL DEFAULT false;`;
  }
  if (base === 'DateTime') {
    if (isOptional) return `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" TIMESTAMP(3);`;
    return `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`;
  }
  if (base === 'Json') {
    if (isOptional) return `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" JSONB;`;
    return `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" JSONB NOT NULL DEFAULT '{}'::jsonb;`;
  }
  if (base === 'Float') {
    if (isOptional) return `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" DOUBLE PRECISION;`;
    return `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" DOUBLE PRECISION NOT NULL DEFAULT 0;`;
  }
  return null;
}

async function getTableColumns(tableName) {
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT
      column_name,
      data_type,
      udt_name,
      is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position
    `,
    tableName,
  );
  const byName = new Map();
  for (const r of rows) {
    byName.set(r.column_name, r);
  }
  return { rows, byName };
}

async function getDistinctDirectionValues() {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT "direction"::text AS direction FROM "MessageLog" WHERE "direction" IS NOT NULL ORDER BY 1 LIMIT 50`,
    );
    return rows.map(r => r.direction);
  } catch (e) {
    return { error: e?.message || String(e) };
  }
}

function mdRow(cells) {
  return `| ${cells.map(c => String(c).replace(/\|/g, '\\|')).join(' | ')} |`;
}

async function main() {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const enumNames = parseEnumNames(schema);

  const checks = [
    {
      model: 'BillingTransaction',
      table: 'BillingTransaction',
      requiredColumns: ['packageType'],
      typeExpectations: [
        // Prisma defines packageType as String => Postgres usually `text` or `character varying`
        { column: 'packageType', allowed: ['text', 'character varying'] },
      ],
    },
    {
      model: 'MessageLog',
      table: 'MessageLog',
      requiredColumns: ['direction', 'status'],
      typeExpectations: [
        // Prisma defines direction as enum MessageDirection => expect USER-DEFINED udt MessageDirection
        { column: 'direction', expectUserDefined: 'MessageDirection' },
        // Prisma defines status as enum MessageStatus? => expect USER-DEFINED udt MessageStatus (nullable is OK)
        { column: 'status', expectUserDefined: 'MessageStatus' },
      ],
    },
    {
      model: 'Template',
      table: 'Template',
      requiredColumns: ['isSystemDefault'],
      typeExpectations: [{ column: 'isSystemDefault', allowed: ['boolean'] }],
    },
  ];

  const findings = [];
  let hasMissing = false;
  let hasTypeMismatch = false;

  // ------------------------------------------------------------
  // FULL SWEEP: Stop repeated "column does not exist" crashes.
  // ------------------------------------------------------------
  const sweepModels = [
    { model: 'Shop', table: 'Shop' },
    { model: 'Contact', table: 'Contact' },
    { model: 'Campaign', table: 'Campaign' },
    { model: 'CampaignRecipient', table: 'CampaignRecipient' },
    { model: 'CampaignMetrics', table: 'CampaignMetrics' },
    { model: 'MessageLog', table: 'MessageLog' },
    { model: 'Subscription', table: 'Subscription' },
    { model: 'InvoiceRecord', table: 'InvoiceRecord' },
    { model: 'BillingTransaction', table: 'BillingTransaction' },
    { model: 'CreditTransaction', table: 'CreditTransaction' },
    { model: 'Wallet', table: 'Wallet' },
    { model: 'WebhookEvent', table: 'WebhookEvent' },
  ];

  const sweepFindings = [];
  let hasSweepMissing = false;

  for (const t of sweepModels) {
    const modelFields = parseModelFields(schema, t.model);
    if (!modelFields) {
      sweepFindings.push({
        ...t,
        missingColumns: [],
        suggestedSql: [],
        note: 'Prisma model not found in schema (skipped)',
      });
      continue;
    }

    const { rows, byName } = await getTableColumns(t.table);
    if (!rows.length) {
      hasSweepMissing = true;
      sweepFindings.push({
        ...t,
        missingColumns: ['(table missing or no columns found)'],
        suggestedSql: [`-- Table "${t.table}" missing: create via migrations / deploy baseline.`],
      });
      continue;
    }

    const missingColumns = [];
    const suggestedSql = [];

    for (const f of modelFields) {
      if (!isScalarFieldType(f.type, enumNames)) continue;
      if (!byName.has(f.name)) {
        missingColumns.push(f.name);
        const sql = sqlForMissingColumn({
          table: t.table,
          column: f.name,
          prismaType: f.type,
          enumNames,
        });
        if (sql) suggestedSql.push(sql);
      }
    }

    if (missingColumns.length) hasSweepMissing = true;
    sweepFindings.push({ ...t, missingColumns, suggestedSql });
  }

  for (const check of checks) {
    const modelFields = parseModelFields(schema, check.model);
    const { rows, byName } = await getTableColumns(check.table);

    const missingColumns = [];
    for (const col of check.requiredColumns) {
      if (!byName.has(col)) missingColumns.push(col);
    }
    if (missingColumns.length) hasMissing = true;

    const typeMismatches = [];
    for (const te of check.typeExpectations) {
      const actual = byName.get(te.column);
      if (!actual) continue;

      if (te.expectUserDefined) {
        const ok = actual.data_type === 'USER-DEFINED' && actual.udt_name === te.expectUserDefined;
        if (!ok) {
          hasTypeMismatch = true;
          typeMismatches.push({
            column: te.column,
            expected: `USER-DEFINED:${te.expectUserDefined}`,
            actual: `${actual.data_type}:${actual.udt_name}`,
          });
        }
      } else if (te.allowed) {
        const ok = te.allowed.includes(actual.data_type);
        if (!ok) {
          hasTypeMismatch = true;
          typeMismatches.push({
            column: te.column,
            expected: te.allowed.join(' OR '),
            actual: `${actual.data_type}:${actual.udt_name}`,
          });
        }
      }
    }

    findings.push({
      model: check.model,
      table: check.table,
      modelFields: modelFields ? modelFields.map(f => `${f.name}:${f.type}`) : [],
      dbColumns: rows.map(r => `${r.column_name}:${r.data_type}:${r.udt_name}:${r.is_nullable}`),
      missingColumns,
      typeMismatches,
    });
  }

  const directionValues = await getDistinctDirectionValues();

  const lines = [];
  lines.push('# Shopify Prisma ↔ DB Parity Report');
  lines.push('');
  lines.push(`Schema: \`${schemaPath}\``);
  lines.push('');
  lines.push('## Full sweep (missing Prisma scalar fields in DB)');
  lines.push('Tables checked:');
  for (const t of sweepModels) {
    lines.push(`- \`${t.table}\``);
  }
  lines.push('');

  for (const f of sweepFindings) {
    lines.push(`### ${f.model} → "${f.table}"`);
    if (f.note) {
      lines.push(`- Note: ${f.note}`);
      lines.push('');
      continue;
    }
    if (!f.missingColumns.length) {
      lines.push('- Missing: none ✅');
      lines.push('');
      continue;
    }
    lines.push(`- Missing: **${f.missingColumns.join(', ')}**`);
    lines.push('');
    lines.push('Suggested SQL (for a safe additive migration bundle):');
    lines.push('```sql');
    for (const s of f.suggestedSql) lines.push(s);
    lines.push('```');
    lines.push('');
  }

  lines.push('## Focus checks');
  lines.push('- `BillingTransaction.packageType` exists and is text-like');
  lines.push('- `MessageLog.direction` is stored as Postgres enum `MessageDirection` (matches Prisma enum)');
  lines.push('');

  for (const f of findings) {
    lines.push(`## ${f.model} → "${f.table}"`);
    lines.push('');
    lines.push('### Missing required columns');
    if (!f.missingColumns.length) {
      lines.push('- none ✅');
    } else {
      lines.push(`- **MISSING**: ${f.missingColumns.join(', ')}`);
    }
    lines.push('');
    lines.push('### Type mismatches');
    if (!f.typeMismatches.length) {
      lines.push('- none ✅');
    } else {
      lines.push(mdRow(['column', 'expected', 'actual']));
      lines.push(mdRow(['---', '---', '---']));
      for (const m of f.typeMismatches) {
        lines.push(mdRow([m.column, m.expected, m.actual]));
      }
    }
    lines.push('');
  }

  lines.push('## MessageLog.direction sample values');
  if (Array.isArray(directionValues)) {
    lines.push(directionValues.length ? `- ${directionValues.join(', ')}` : '- (no rows)');
  } else {
    lines.push(`- (error reading values): ${directionValues.error}`);
  }
  lines.push('');

  const outPath = '/tmp/shopify_prisma_db_parity.md';
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`Wrote ${outPath}`);

  if (hasSweepMissing || hasMissing || hasTypeMismatch) {
    console.error(
      `Parity check failed: sweepMissing=${hasSweepMissing} missing=${hasMissing} typeMismatch=${hasTypeMismatch}`,
    );
    process.exit(1);
  }
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


