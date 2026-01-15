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

  if (hasMissing || hasTypeMismatch) {
    console.error(
      `Parity check failed: missing=${hasMissing} typeMismatch=${hasTypeMismatch}`,
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


