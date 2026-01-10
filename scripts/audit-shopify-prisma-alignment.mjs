#!/usr/bin/env node

/**
 * Shopify Prisma Alignment Audit Script
 * Verifies that Prisma schema matches backend code usage and frontend expectations
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

let errors = [];
let warnings = [];

function error(msg) {
  errors.push(msg);
  console.error(`❌ ERROR: ${msg}`);
}

function warn(msg) {
  warnings.push(msg);
  console.warn(`⚠️  WARNING: ${msg}`);
}

function info(msg) {
  console.log(`ℹ️  ${msg}`);
}

/**
 * Parse Prisma schema to extract model fields
 */
function parsePrismaSchema(schemaPath) {
  if (!existsSync(schemaPath)) {
    error(`Prisma schema not found: ${schemaPath}`);
    return {};
  }

  const content = readFileSync(schemaPath, 'utf-8');
  const models = {};
  let currentModel = null;
  let inModel = false;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect model start
    if (line.startsWith('model ')) {
      const modelMatch = line.match(/^model\s+(\w+)/);
      if (modelMatch) {
        currentModel = modelMatch[1];
        models[currentModel] = {
          fields: [],
          relations: [],
          uniqueConstraints: [],
          indexes: [],
        };
        inModel = true;
      }
      continue;
    }

    // Detect model end
    if (line === '}' && inModel) {
      inModel = false;
      currentModel = null;
      continue;
    }

    if (!inModel || !currentModel) continue;

    // Extract field
    if (line && !line.startsWith('//') && !line.startsWith('@@')) {
      const fieldMatch = line.match(/^\s*(\w+)\s+(\w+[?]?|\[.*?\]|Json)/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const fieldType = fieldMatch[2];
        models[currentModel].fields.push({
          name: fieldName,
          type: fieldType,
          optional: fieldType.includes('?'),
        });
      }
    }

    // Extract unique constraints
    if (line.includes('@@unique')) {
      const uniqueMatch = line.match(/@@unique\(\[([^\]]+)\]/);
      if (uniqueMatch) {
        const fields = uniqueMatch[1].split(',').map(f => f.trim().replace(/['"]/g, ''));
        models[currentModel].uniqueConstraints.push(fields);
      }
    }

    // Extract indexes
    if (line.includes('@@index')) {
      const indexMatch = line.match(/@@index\(\[([^\]]+)\]/);
      if (indexMatch) {
        const fields = indexMatch[1].split(',').map(f => f.trim().replace(/['"]/g, ''));
        models[currentModel].indexes.push(fields);
      }
    }
  }

  return models;
}

/**
 * Find all JavaScript/TypeScript files
 */
function findFiles(dir, pattern, files = []) {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        // Skip node_modules, .git, etc.
        if (!entry.startsWith('.') && entry !== 'node_modules' && entry !== 'dist' && entry !== 'build') {
          findFiles(fullPath, pattern, files);
        }
      } else if (pattern.test(entry)) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Ignore errors
  }
  return files;
}

/**
 * Extract Prisma queries from file
 */
function extractPrismaQueries(filePath, models) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const issues = [];

    // Pattern: prisma.<Model>.<method>({ ... where: { field: ... } })
    const prismaPattern = /prisma\.(\w+)\.(\w+)\s*\(/g;
    let match;

    while ((match = prismaPattern.exec(content)) !== null) {
      const modelName = match[1];
      const method = match[2];
      const startPos = match.index;

      // Get the model schema
      const model = models[modelName];
      if (!model) {
        // Model not in schema - might be a false positive or dynamic usage
        continue;
      }

      // Extract the query block (where, select, include, data, orderBy)
      const remainingContent = content.substring(startPos);
      const blockMatch = remainingContent.match(/\{[\s\S]{0,2000}\}/);
      if (!blockMatch) continue;

      const block = blockMatch[0];

      // Check for field references in where clause
      const whereMatch = block.match(/where:\s*\{([^}]+)\}/);
      if (whereMatch) {
        const whereClause = whereMatch[1];
        const fieldMatches = whereClause.match(/(\w+):/g);
        if (fieldMatches) {
          fieldMatches.forEach(fieldMatch => {
            const fieldName = fieldMatch.replace(':', '');
            // Skip operators and special keys
            if (['OR', 'AND', 'NOT', 'in', 'not', 'gte', 'lte', 'gt', 'lt'].includes(fieldName)) {
              return;
            }
            // Check if field exists in model
            const fieldExists = model.fields.some(f => f.name === fieldName);
            if (!fieldExists) {
              const lineNumber = content.substring(0, startPos).split('\n').length;
              issues.push({
                file: filePath.replace(rootDir + '/', ''),
                line: lineNumber,
                model: modelName,
                method,
                issue: `Field '${fieldName}' not found in ${modelName} model`,
                context: whereClause.substring(0, 100),
              });
            }
          });
        }
      }

      // Check for field references in data clause
      const dataMatch = block.match(/data:\s*\{([^}]+)\}/);
      if (dataMatch) {
        const dataClause = dataMatch[1];
        const fieldMatches = dataClause.match(/(\w+):/g);
        if (fieldMatches) {
          fieldMatches.forEach(fieldMatch => {
            const fieldName = fieldMatch.replace(':', '');
            // Check if field exists in model
            const fieldExists = model.fields.some(f => f.name === fieldName);
            if (!fieldExists) {
              const lineNumber = content.substring(0, startPos).split('\n').length;
              issues.push({
                file: filePath.replace(rootDir + '/', ''),
                line: lineNumber,
                model: modelName,
                method,
                issue: `Field '${fieldName}' not found in ${modelName} model (data clause)`,
                context: dataClause.substring(0, 100),
              });
            }
          });
        }
      }

      // Check for field references in select clause
      const selectMatch = block.match(/select:\s*\{([^}]+)\}/);
      if (selectMatch) {
        const selectClause = selectMatch[1];
        const fieldMatches = selectClause.match(/(\w+):/g);
        if (fieldMatches) {
          fieldMatches.forEach(fieldMatch => {
            const fieldName = fieldMatch.replace(':', '');
            // Skip true/false values
            if (['true', 'false'].includes(fieldName)) return;
            // Check if field exists in model
            const fieldExists = model.fields.some(f => f.name === fieldName);
            if (!fieldExists) {
              const lineNumber = content.substring(0, startPos).split('\n').length;
              issues.push({
                file: filePath.replace(rootDir + '/', ''),
                line: lineNumber,
                model: modelName,
                method,
                issue: `Field '${fieldName}' not found in ${modelName} model (select clause)`,
                context: selectClause.substring(0, 100),
              });
            }
          });
        }
      }

      // Check for field references in orderBy clause
      const orderByMatch = block.match(/orderBy:\s*\{([^}]+)\}/);
      if (orderByMatch) {
        const orderByClause = orderByMatch[1];
        const fieldMatches = orderByClause.match(/(\w+):/g);
        if (fieldMatches) {
          fieldMatches.forEach(fieldMatch => {
            const fieldName = fieldMatch.replace(':', '');
            // Skip asc/desc
            if (['asc', 'desc'].includes(fieldName)) return;
            // Check if field exists in model
            const fieldExists = model.fields.some(f => f.name === fieldName);
            if (!fieldExists) {
              const lineNumber = content.substring(0, startPos).split('\n').length;
              issues.push({
                file: filePath.replace(rootDir + '/', ''),
                line: lineNumber,
                model: modelName,
                method,
                issue: `Field '${fieldName}' not found in ${modelName} model (orderBy clause)`,
                context: orderByClause.substring(0, 100),
              });
            }
          });
        }
      }
    }

    return issues;
  } catch (err) {
    return [];
  }
}

/**
 * Check for known mismatch patterns
 */
function checkKnownMismatches(filePath, models) {
  const issues = [];
  try {
    const content = readFileSync(filePath, 'utf-8');

    // Check for active vs isActive mismatches
    const activeMismatches = [
      { model: 'UserAutomation', wrong: 'active', correct: 'isActive' },
      { model: 'Segment', wrong: 'active', correct: 'isActive' },
      { model: 'SmsPackage', wrong: 'active', correct: 'isActive' },
    ];

    activeMismatches.forEach(({ model, wrong, correct }) => {
      const modelSchema = models[model];
      if (!modelSchema) return;

      // Check if model uses isActive (correct)
      const hasIsActive = modelSchema.fields.some(f => f.name === correct);
      if (!hasIsActive) return;

      // Check for wrong field usage
      const pattern = new RegExp(`prisma\\.${model}\\.\\w+\\s*\\([^)]*where:\\s*\\{[^}]*${wrong}:`, 'g');
      if (pattern.test(content)) {
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes(`${wrong}:`) && line.includes(model)) {
            issues.push({
              file: filePath.replace(rootDir + '/', ''),
              line: idx + 1,
              model,
              issue: `Using '${wrong}' instead of '${correct}' for ${model}`,
            });
          }
        });
      }
    });

    // Check for missing tenant scoping (shopId)
    const tenantScopedModels = ['Contact', 'Campaign', 'Template', 'UserAutomation', 'Segment', 'Purchase'];
    tenantScopedModels.forEach(modelName => {
      const modelSchema = models[modelName];
      if (!modelSchema) return;

      const hasShopId = modelSchema.fields.some(f => f.name === 'shopId');
      if (!hasShopId) return;

      // Check for queries without shopId in where clause
      const pattern = new RegExp(`prisma\\.${modelName}\\.(findMany|findFirst|findUnique|count|update|delete)\\s*\\([^)]*where:\\s*\\{[^}]*\\}(?!.*shopId)`, 'gs');
      // This is complex - simplified check
      const queries = content.match(new RegExp(`prisma\\.${modelName}\\.(findMany|findFirst|findUnique|count)\\s*\\([^)]*\\)`, 'gs'));
      if (queries) {
        queries.forEach((query, idx) => {
          // Check if shopId is in the where clause
          if (query.includes('where:') && !query.includes('shopId')) {
            // This might be a false positive (shopId could be in nested where)
            // Only warn if it's clearly missing
            if (!query.includes('shopId') && !query.includes('contact:') && !query.includes('campaign:')) {
              warn(`Potential missing tenant scoping in ${filePath.replace(rootDir + '/', '')}: ${modelName} query may be missing shopId`);
            }
          }
        });
      }
    });
  } catch (err) {
    // Ignore errors
  }
  return issues;
}

/**
 * Check frontend types for field mismatches
 */
function checkFrontendTypes(frontendDir, models) {
  const issues = [];
  const typeFiles = findFiles(frontendDir, /\.ts$/);

  // Known type mappings to check
  const typeChecks = [
    {
      file: 'contacts.ts',
      interface: 'Contact',
      fields: [
        { name: 'id', expectedType: 'string', note: 'Prisma uses String (cuid)' },
        { name: 'phoneE164', expectedType: 'string' },
        { name: 'smsConsentStatus', expectedType: 'string | null' },
        { name: 'isSubscribed', expectedType: 'boolean' },
      ],
    },
    {
      file: 'campaigns.ts',
      interface: 'Campaign',
      fields: [
        { name: 'id', expectedType: 'string' },
        { name: 'status', expectedType: 'CampaignStatus' },
        { name: 'scheduleType', expectedType: 'ScheduleType' },
      ],
    },
    {
      file: 'automations.ts',
      interface: 'Automation',
      fields: [
        { name: 'id', expectedType: 'string' },
        { name: 'isActive', expectedType: 'boolean' },
      ],
    },
  ];

  typeChecks.forEach(check => {
    const filePath = typeFiles.find(f => f.includes(check.file));
    if (!filePath) {
      warn(`Frontend type file not found: ${check.file}`);
      return;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      check.fields.forEach(field => {
        // Check if field is defined in interface
        const interfaceMatch = content.match(new RegExp(`interface\\s+${check.interface}[^{]*\\{[^}]*\\}`, 's'));
        if (interfaceMatch) {
          const interfaceContent = interfaceMatch[0];
          const fieldMatch = interfaceContent.match(new RegExp(`${field.name}[^:]*:([^;]+)`, 's'));
          if (fieldMatch) {
            const actualType = fieldMatch[1].trim();
            // Basic type check (simplified)
            if (field.expectedType === 'string' && !actualType.includes('string')) {
              warn(`Frontend type mismatch in ${check.file}: ${check.interface}.${field.name} is ${actualType}, expected string`);
            }
          } else {
            // Field might be optional or missing
            if (!interfaceContent.includes(field.name)) {
              warn(`Frontend type missing field: ${check.interface}.${field.name} in ${check.file}`);
            }
          }
        }
      });
    } catch (err) {
      // Ignore errors
    }
  });

  return issues;
}

/**
 * Main audit function
 */
async function main() {
  console.log('🔍 Shopify Prisma Alignment Audit\n');

  const schemaPath = join(rootDir, 'apps/shopify-api/prisma/schema.prisma');
  const apiDir = join(rootDir, 'apps/shopify-api');
  const frontendDir = join(rootDir, 'apps/astronote-web/src/lib/shopify/api');

  // Parse Prisma schema
  info('Parsing Prisma schema...');
  const models = parsePrismaSchema(schemaPath);
  const modelNames = Object.keys(models);
  info(`✓ Found ${modelNames.length} models in schema`);

  // Scan backend code
  info('Scanning backend code for Prisma usage...');
  const backendFiles = findFiles(apiDir, /\.(js|ts)$/);
  let allIssues = [];

  backendFiles.forEach(file => {
    const issues = extractPrismaQueries(file, models);
    allIssues.push(...issues);

    const mismatchIssues = checkKnownMismatches(file, models);
    allIssues.push(...mismatchIssues);
  });

  if (allIssues.length > 0) {
    console.log(`\n❌ Found ${allIssues.length} Prisma field mismatch(es):\n`);
    allIssues.forEach((issue, idx) => {
      console.log(`${idx + 1}. ${issue.file}:${issue.line}`);
      console.log(`   Model: ${issue.model}`);
      console.log(`   Issue: ${issue.issue}`);
      if (issue.context) {
        console.log(`   Context: ${issue.context}...`);
      }
      console.log('');
    });
  } else {
    info('✓ No Prisma field mismatches found in backend');
  }

  // Check frontend types
  info('Checking frontend types...');
  checkFrontendTypes(frontendDir, models);
  info('✓ Frontend type checks completed');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Audit Summary');
  console.log('='.repeat(60));
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Field Mismatches: ${allIssues.length}`);

  if (errors.length > 0 || allIssues.length > 0) {
    console.log('\n❌ Audit FAILED');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('\n⚠️  Audit PASSED with warnings');
    process.exit(0);
  } else {
    console.log('\n✅ Audit PASSED');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

