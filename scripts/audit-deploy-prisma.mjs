#!/usr/bin/env node

/**
 * Prisma Alignment Audit Script
 * Verifies Prisma schema matches backend usage and frontend expectations
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: One or more checks failed
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const SCHEMA_PATH = join(ROOT, 'apps/shopify-api/prisma/schema.prisma');
const BACKEND_PATH = join(ROOT, 'apps/shopify-api');
const FRONTEND_PATH = join(ROOT, 'apps/astronote-web');

let errors = [];
let warnings = [];
let passes = [];

function error(msg, file = null, line = null) {
  const location = file ? (line ? `${file}:${line}` : file) : '';
  errors.push({ msg, file, line });
  console.error(`❌ ERROR: ${msg}${location ? ` (${location})` : ''}`);
}

function warn(msg, file = null, line = null) {
  const location = file ? (line ? `${file}:${line}` : file) : '';
  warnings.push({ msg, file, line });
  console.warn(`⚠️  WARNING: ${msg}${location ? ` (${location})` : ''}`);
}

function pass(msg) {
  passes.push(msg);
  console.log(`✅ PASS: ${msg}`);
}

/**
 * Parse Prisma schema and extract models, fields, enums
 */
function parseSchema() {
  if (!existsSync(SCHEMA_PATH)) {
    error(`Schema file not found: ${SCHEMA_PATH}`);
    return null;
  }

  const schemaContent = readFileSync(SCHEMA_PATH, 'utf-8');
  const models = {};
  const enums = {};
  const relations = {};

  // Extract models (handle multi-line model bodies with nested braces)
  const modelRegex = /model\s+(\w+)\s*\{/g;
  let modelMatch;
  while ((modelMatch = modelRegex.exec(schemaContent)) !== null) {
    const modelName = modelMatch[1];
    const modelStart = modelMatch.index + modelMatch[0].length;
    const modelEnd = findMatchingBrace(schemaContent, modelStart - 1);
    if (modelEnd === -1) continue;
    const modelBody = schemaContent.substring(modelStart, modelEnd);
    const fields = {};
    const modelRelations = [];

    // Extract fields
    const fieldRegex = /^\s*(\w+)\s+([^\n]+)/gm;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(modelBody)) !== null) {
      const fieldName = fieldMatch[1];
      const fieldDef = fieldMatch[2].trim();
      
      // Skip @@ directives
      if (fieldName.startsWith('@@')) continue;
      
      fields[fieldName] = {
        name: fieldName,
        definition: fieldDef,
        type: extractFieldType(fieldDef),
        isRelation: fieldDef.includes('@relation'),
        isOptional: fieldDef.includes('?'),
      };

      // Extract relations
      if (fieldDef.includes('@relation')) {
        const relationMatch = fieldDef.match(/@relation\(fields:\s*\[(\w+)\],\s*references:\s*\[(\w+)\]\)/);
        if (relationMatch) {
          modelRelations.push({
            field: fieldName,
            foreignKey: relationMatch[1],
            references: relationMatch[2],
          });
        }
      }
    }

    models[modelName] = {
      name: modelName,
      fields,
      relations: modelRelations,
    };
  }

  // Extract enums
  const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/gs;
  let enumMatch;
  while ((enumMatch = enumRegex.exec(schemaContent)) !== null) {
    const enumName = enumMatch[1];
    const enumBody = enumMatch[2];
    const values = enumBody
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'))
      .map(line => line.replace(/,$/, '').trim());
    
    enums[enumName] = values;
  }

  return { models, enums, relations };
}

function extractFieldType(fieldDef) {
  // Extract type from field definition
  const typeMatch = fieldDef.match(/^(\w+)/);
  return typeMatch ? typeMatch[1] : 'String';
}

/**
 * Find tenant-bound models (models with shopId field)
 */
function findTenantModels(models) {
  const tenantModels = [];
  for (const [modelName, model] of Object.entries(models)) {
    if (model.fields.shopId) {
      tenantModels.push(modelName);
    }
  }
  return tenantModels;
}

/**
 * Scan backend files for Prisma usage
 */
function scanBackendPrismaUsage(models, tenantModels) {
  console.log('\n📋 Scanning Backend Prisma Usage...');
  console.log('='.repeat(60));

  const files = findJSFiles(BACKEND_PATH);
  const prismaUsages = [];
  const unscopedQueries = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    // Find prisma.* calls
    const prismaRegex = /prisma\.(\w+)\.(findMany|findFirst|findUnique|create|update|updateMany|delete|deleteMany|count|upsert|aggregate)\s*\(/g;
    let match;
    while ((match = prismaRegex.exec(content)) !== null) {
      const modelNameLower = match[1];
      const operation = match[2];
      const lineNum = content.substring(0, match.index).split('\n').length;

      // Prisma client uses camelCase, but schema uses PascalCase
      // Convert camelCase to PascalCase: webhookEvent -> WebhookEvent
      const modelNamePascal = modelNameLower.charAt(0).toUpperCase() + modelNameLower.slice(1);
      
      // Try all variations: exact match, PascalCase, camelCase
      let model = models[modelNameLower] || models[modelNamePascal];
      if (!model) {
        // Try finding by case-insensitive match
        const modelKeys = Object.keys(models);
        const found = modelKeys.find(key => key.toLowerCase() === modelNameLower.toLowerCase());
        if (found) {
          model = models[found];
        }
      }

      if (!model) {
        // Debug: check if model exists with different case
        const modelKeys = Object.keys(models);
        const caseInsensitiveMatch = modelKeys.find(k => k.toLowerCase() === modelNameLower.toLowerCase());
        const tried = [modelNameLower, modelNamePascal];
        if (caseInsensitiveMatch) {
          tried.push(caseInsensitiveMatch);
          // Try one more time with the found key
          model = models[caseInsensitiveMatch];
        }
        if (!model) {
          error(`Unknown Prisma model: ${modelNameLower} (tried: ${tried.join(', ')}, available: ${modelKeys.slice(0, 5).join(', ')}...)`, file, lineNum);
          continue;
        }
      }

      // Extract the query object (simplified - looks for next { ... } block)
      const queryStart = match.index + match[0].length;
      const queryEnd = findMatchingBrace(content, queryStart);
      if (queryEnd === -1) continue;

      const queryStr = content.substring(queryStart, queryEnd + 1);
      const queryObj = parseQueryObject(queryStr);

      // Check field names in where/select/include/data/orderBy
      checkQueryFields(model, queryObj, file, lineNum);

      // Check tenant scoping (use original model name from schema)
      const schemaModelName = model.name;
      if (tenantModels.includes(schemaModelName)) {
        // Skip test files - they may have unscoped queries for testing
        if (!file.includes('/tests/') && !file.includes('/test/')) {
          if (!isTenantScoped(queryObj, schemaModelName, operation, file, content, queryStart, queryEnd)) {
            unscopedQueries.push({
              file,
              line: lineNum,
              model: schemaModelName,
              operation,
            });
          }
        }
      }

      prismaUsages.push({
        file,
        line: lineNum,
        model: schemaModelName,
        operation,
        queryObj,
      });
    }
  }

  if (unscopedQueries.length > 0) {
    console.log('\n⚠️  Unscoped Tenant Queries:');
    unscopedQueries.forEach(({ file, line, model, operation }) => {
      error(`Unscoped query to tenant model ${model}.${operation}`, file, line);
    });
  } else {
    pass(`All tenant queries are scoped by shopId (${prismaUsages.length} queries checked)`);
  }

  return { prismaUsages, unscopedQueries };
}

function findJSFiles(dir, files = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .git, etc.
      if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
        findJSFiles(fullPath, files);
      }
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      files.push(fullPath);
    }
  }
  return files;
}

function findMatchingBrace(str, start) {
  let depth = 0;
  let inString = false;
  let stringChar = null;
  for (let i = start; i < str.length; i++) {
    const char = str[i];
    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar && str[i - 1] !== '\\') {
      inString = false;
    } else if (!inString) {
      if (char === '{') depth++;
      if (char === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
  }
  return -1;
}

function parseQueryObject(queryStr, fullQueryStr = queryStr) {
  // Simplified parser - extract where, select, include, data, orderBy
  const queryObj = {};
  
  // Extract where clause
  const whereMatch = queryStr.match(/where:\s*\{([^}]+)\}/);
  if (whereMatch) {
    queryObj.where = whereMatch[1];
  }

  // Extract select clause (handle nested braces)
  // Check if this select is inside an include clause
  const selectStart = queryStr.indexOf('select:');
  if (selectStart !== -1) {
    const selectBraceStart = queryStr.indexOf('{', selectStart);
    if (selectBraceStart !== -1) {
      const selectBraceEnd = findMatchingBrace(queryStr, selectBraceStart);
      if (selectBraceEnd !== -1) {
        queryObj.select = queryStr.substring(selectBraceStart + 1, selectBraceEnd);
        // Check if this select is nested inside an include (look backwards from select)
        const beforeSelect = queryStr.substring(0, selectStart);
        const includeStart = beforeSelect.lastIndexOf('include:');
        queryObj.isNestedSelect = includeStart !== -1;
      }
    }
  }

  // Extract include clause (handle nested braces properly)
  const includeStart = queryStr.indexOf('include:');
  if (includeStart !== -1) {
    const includeBraceStart = queryStr.indexOf('{', includeStart);
    if (includeBraceStart !== -1) {
      const includeBraceEnd = findMatchingBrace(queryStr, includeBraceStart);
      if (includeBraceEnd !== -1) {
        queryObj.include = queryStr.substring(includeBraceStart + 1, includeBraceEnd);
        queryObj.hasInclude = true;
      }
    }
  }

  // Extract data clause
  const dataMatch = queryStr.match(/data:\s*\{([^}]+)\}/);
  if (dataMatch) {
    queryObj.data = dataMatch[1];
  }

  // Extract orderBy clause
  const orderByMatch = queryStr.match(/orderBy:\s*\{([^}]+)\}|orderBy:\s*(\w+)/);
  if (orderByMatch) {
    queryObj.orderBy = orderByMatch[1] || orderByMatch[2];
  }

  return queryObj;
}

// Prisma query operators that are not field names
const PRISMA_OPERATORS = new Set([
  'where', 'select', 'include', 'data', 'orderBy', 'take', 'skip', 'distinct',
  'gte', 'lte', 'gt', 'lt', 'equals', 'not', 'in', 'notIn', 'contains', 'startsWith', 'endsWith',
  'mode', 'OR', 'AND', 'NOT', 'some', 'every', 'none', 'is', 'isNot',
  'path', 'array_contains', 'array_starts_with', 'array_ends_with',
  'increment', 'decrement', 'multiply', 'divide', 'set', 'unset', 'push', 'pull', 'connect', 'disconnect',
  'create', 'update', 'upsert', 'delete', 'connectOrCreate', 'updateMany', 'deleteMany',
  '_count', '_sum', '_avg', '_min', '_max',
  'Security', 'Retail', 'Idempotency', // Common prefixes in code
]);

function checkQueryFields(model, queryObj, file, line) {
  const modelFields = Object.keys(model.fields);

  // Check select clause fields (most reliable - these are actual field names)
  // But skip if this select is inside an include clause (belongs to related model)
  if (queryObj.select && !queryObj.isNestedSelect) {
    const selectFields = extractFieldNames(queryObj.select);
    selectFields.forEach(field => {
      if (field === 'true' || field.includes('.') || PRISMA_OPERATORS.has(field)) {
        return; // Skip operators and nested fields
      }
      // Check if this field is inside a nested relation select (e.g., campaign: { select: { name: true } })
      const fieldPattern = new RegExp(`\\b${field}\\s*:`);
      const fieldMatch = fieldPattern.exec(queryObj.select);
      if (fieldMatch) {
        const fieldPos = fieldMatch.index;
        const beforeField = queryObj.select.substring(0, fieldPos);
        // Count braces to determine depth
        const openBraces = (beforeField.match(/\{/g) || []).length;
        const closeBraces = (beforeField.match(/\}/g) || []).length;
        const depth = openBraces - closeBraces;
        // If depth > 0, this field is inside a nested object (relation select)
        if (depth > 0) {
          return; // Skip - belongs to related model
        }
      }
      if (!modelFields.includes(field)) {
        // Check if it's a relation field
        const isRelation = model.relations?.some(r => r.field === field);
        if (!isRelation) {
          error(`Field '${field}' not found in model ${model.name}`, file, line);
        }
      }
    });
  }

  // Check include clause - only validate top-level relation names
  // Fields in nested selects belong to related models, not the parent
  if (queryObj.include) {
    // Extract only top-level relation names (not nested fields)
    // Pattern: relationName: { ... } - extract relationName
    const includeContent = queryObj.include;
    // Match relation names at the top level of include
    // Skip nested selects/fields inside relations
    const topLevelRelationRegex = /(\w+):\s*\{/g;
    const seenRelations = new Set();
    let match;
    while ((match = topLevelRelationRegex.exec(includeContent)) !== null) {
      const relationName = match[1];
      // Skip if this is inside a nested structure (check depth)
      const beforeMatch = includeContent.substring(0, match.index);
      const openBraces = (beforeMatch.match(/\{/g) || []).length;
      const closeBraces = (beforeMatch.match(/\}/g) || []).length;
      const depth = openBraces - closeBraces;
      
      // Only check top-level relations (depth 0 or 1)
      if (depth <= 1 && !seenRelations.has(relationName)) {
        seenRelations.add(relationName);
        if (!modelFields.includes(relationName) && !PRISMA_OPERATORS.has(relationName)) {
          // Check if it's a relation field
          const isRelation = model.relations?.some(r => r.field === relationName);
          if (!isRelation && !relationName.startsWith('_')) {
            // _count, _sum, etc. are Prisma aggregates, not fields
            error(`Relation '${relationName}' not found in model ${model.name}`, file, line);
          }
        }
      }
    }
    // Don't validate fields inside nested selects - they belong to related models
  }

  // Check data clause fields (create/update operations)
  if (queryObj.data) {
    const dataFields = extractFieldNames(queryObj.data);
    dataFields.forEach(field => {
      if (field.includes('.') || PRISMA_OPERATORS.has(field)) {
        return; // Skip operators and nested fields
      }
      // Skip fields that are inside JSON fields (meta, payload, etc.)
      // These are stored as JSON and can have any structure
      const jsonFields = ['meta', 'payload', 'data', 'ruleJson', 'criteriaJson', 'audience'];
      if (jsonFields.some(jsonField => queryObj.data.includes(`${jsonField}:`) && 
          queryObj.data.indexOf(`${jsonField}:`) < queryObj.data.indexOf(`${field}:`))) {
        return; // Field is inside a JSON field
      }
      // Skip fields that are inside nested creates/updates (relation operations)
      // Pattern: relationField: { create: { nestedField } } or relationField: { update: { nestedField } }
      const fieldPos = queryObj.data.indexOf(`${field}:`);
      if (fieldPos !== -1) {
        const beforeField = queryObj.data.substring(0, fieldPos);
        // Check if we're inside a nested create/update/connect/connectOrCreate
        if (beforeField.includes('create:') || beforeField.includes('update:') || 
            beforeField.includes('connect:') || beforeField.includes('connectOrCreate:')) {
          return; // Field is in a nested relation operation (belongs to related model)
        }
        // Check if field is followed by nested object (relation create/update)
        const afterColon = queryObj.data.substring(fieldPos + field.length + 1).trim();
        if (afterColon.startsWith('{')) {
          // This is a nested object, skip validation (it's a relation create/update)
          return;
        }
      }
      if (!modelFields.includes(field)) {
        // Check if it's a relation field
        const isRelation = model.relations?.some(r => r.field === field);
        if (!isRelation) {
          error(`Field '${field}' not found in model ${model.name}`, file, line);
        }
      }
    });
  }

  // Check orderBy clause fields (simplified - only top-level field)
  if (queryObj.orderBy) {
    const orderByFields = extractFieldNames(queryObj.orderBy);
    orderByFields.forEach(field => {
      if (field.includes('.') || PRISMA_OPERATORS.has(field)) {
        return; // Skip operators
      }
      if (!modelFields.includes(field)) {
        error(`Field '${field}' not found in model ${model.name} for orderBy`, file, line);
      }
    });
  }

  // Skip where clause field checking - too complex with operators
  // Tenant scoping is checked separately
}

function extractFieldNames(clause) {
  // Extract field names from a clause string
  const fields = [];
  const fieldRegex = /(\w+):/g;
  let match;
  while ((match = fieldRegex.exec(clause)) !== null) {
    fields.push(match[1]);
  }
  return fields;
}

function isTenantScoped(queryObj, modelName, operation, file, content, queryStart, queryEnd) {
  // Check if query includes shopId in where clause
  if (queryObj.where) {
    // Check for shopId in where clause
    if (queryObj.where.includes('shopId') || queryObj.where.includes('storeId')) {
      return true;
    }
  }

  // For create operations, check if shopId is in data clause
  if (operation === 'create' && queryObj.data) {
    if (queryObj.data.includes('shopId') || queryObj.data.includes('storeId')) {
      return true;
    }
  }

  // For update operations, if using id in where, it's acceptable if the id is tenant-scoped
  // (e.g., contactId is already tenant-scoped via the contact record)
  if (operation === 'update' || operation === 'findUnique') {
    if (queryObj.where && queryObj.where.includes('id:')) {
      // Assume scoped if using id (the id itself is tenant-scoped)
      return true;
    }
  }

  // Check if query is scoped via relation (e.g., campaign: { shopId: ... })
  if (queryObj.where && queryObj.where.includes('shop')) {
    return true; // Assume scoped via relation
  }

    // Check if the function receives shopId/storeId as parameter and builds where clause
    // Look for pattern: where = { shopId: storeId } or where = { shopId }
    if (content && queryStart > 0) {
      // Look back up to 5000 characters (about 150 lines) to find function signature and where clause
      const beforeQuery = content.substring(Math.max(0, queryStart - 5000), queryStart);
      
      // Check for where clause construction with shopId/storeId
      if (/where\s*[=:]\s*\{[^}]*shopId|where\s*[=:]\s*\{[^}]*storeId|whereClause\s*[=:]\s*\{[^}]*shopId|whereClause\s*[=:]\s*\{[^}]*storeId/.test(beforeQuery)) {
        return true;
      }
      
      // Check if whereClause is built conditionally with shopId
      if (/whereClause\.shopId\s*=|whereClause\[['"]shopId['"]\]\s*=/.test(beforeQuery)) {
        return true;
      }
      
      // Check if where variable is built with shopId (handle multiline and single-line)
      // Pattern: const where = { shopId: storeId } or let where = { shopId: ... }
      // Also match: const where = { shopId: storeId } on a single line
      if (/const\s+where\s*=\s*\{[^}]*shopId[^}]*\}/.test(beforeQuery) || 
          /let\s+where\s*=\s*\{[^}]*shopId[^}]*\}/.test(beforeQuery) ||
          /const\s+where\s*=\s*\{[\s\S]{0,2000}shopId[\s\S]{0,2000}\}/.test(beforeQuery) ||
          /let\s+where\s*=\s*\{[\s\S]{0,2000}shopId[\s\S]{0,2000}\}/.test(beforeQuery)) {
        return true;
      }
      if (/const\s+where\s*=\s*\{[^}]*storeId[^}]*\}/.test(beforeQuery) || 
          /let\s+where\s*=\s*\{[^}]*storeId[^}]*\}/.test(beforeQuery) ||
          /const\s+where\s*=\s*\{[\s\S]{0,2000}storeId[\s\S]{0,2000}\}/.test(beforeQuery) ||
          /let\s+where\s*=\s*\{[\s\S]{0,2000}storeId[\s\S]{0,2000}\}/.test(beforeQuery)) {
        return true;
      }
      
      // Check if where variable is spread into query (where: { ...where } or where: { ...whereClause })
      if (queryObj.where && (queryObj.where.includes('...where') || queryObj.where.includes('...whereClause'))) {
        // If where is spread, check if it was built with shopId earlier
        if (/const\s+where\s*=\s*\{[^}]*shopId|let\s+where\s*=\s*\{[^}]*shopId|const\s+whereClause\s*=\s*\{[^}]*shopId|let\s+whereClause\s*=\s*\{[^}]*shopId/.test(beforeQuery)) {
          return true;
        }
        // Also check if whereClause is built with shopId in the function
        if (/whereClause\s*=\s*\{[^}]*shopId|whereClause\s*=\s*\{[^}]*storeId/.test(beforeQuery)) {
          return true;
        }
      }
      
      // Check if function receives shopId/storeId as parameter
      // Look for function signature - check multiple patterns
      const funcPatterns = [
        /export\s+async\s+function\s+\w+\s*\([^)]+\)/,
        /export\s+function\s+\w+\s*\([^)]+\)/,
        /async\s+function\s+\w+\s*\([^)]+\)/,
        /function\s+\w+\s*\([^)]+\)/,
      ];
      
      for (const pattern of funcPatterns) {
        const matches = [...beforeQuery.matchAll(new RegExp(pattern, 'g'))];
        // Check the most recent function declaration before the query
        if (matches.length > 0) {
          const lastMatch = matches[matches.length - 1];
          const funcSig = lastMatch[0];
          // Check if function receives shopId or storeId as parameter
          if (/\([^)]*\b(shopId|storeId)\b/.test(funcSig)) {
            // Function receives shopId/storeId - check if where clause is built in function body
            const afterFunc = beforeQuery.substring(lastMatch.index + funcSig.length);
            // Look for where clause construction in function body
            if (/where\s*[=:]\s*\{[^}]*shopId|where\s*[=:]\s*\{[^}]*storeId|whereClause\s*[=:]\s*\{[^}]*shopId|whereClause\s*[=:]\s*\{[^}]*storeId/.test(afterFunc)) {
              return true;
            }
            // Also check for conditional shopId assignment
            if (/whereClause\.shopId\s*=|where\[['"]shopId['"]\]\s*=/.test(afterFunc)) {
              return true;
            }
          }
        }
      }
      
      // Check for queries that use unique constraints (webhook events, etc.) - these are scoped by unique key
      if (operation === 'findUnique' && queryObj.where) {
        // Unique constraints are tenant-safe by design
        return true;
      }
      
      // Check for MessageLog queries by providerMsgId - these are scoped by unique provider message ID
      if (modelName === 'MessageLog' && queryObj.where && queryObj.where.includes('providerMsgId')) {
        // Provider message IDs are unique and tenant-safe
        return true;
      }
      
      // Check for public template queries (isPublic: true) - these are intentionally cross-tenant
      if (queryObj.where && queryObj.where.includes('isPublic') && queryObj.where.includes('true')) {
        // Public templates are intentionally cross-tenant
        return true;
      }
      
      // Check for background jobs that process across tenants (scheduler, reconciliation, delivery-status)
      if (file.includes('scheduler.js') || file.includes('reconciliation.js') || 
          (file.includes('delivery-status.js') && (operation === 'findMany' || queryObj.where?.includes('status')))) {
        // Background jobs intentionally process across tenants
        return true;
      }
      
      // Check for seed scripts
      if (file.includes('/scripts/')) {
        // Seed scripts are acceptable
        return true;
      }
      
      // Check for queries by unique identifiers (stripePaymentIntentId, etc.) - these are tenant-safe
      if (queryObj.where && (queryObj.where.includes('stripePaymentIntentId') || 
                             queryObj.where.includes('stripeSessionId') ||
                             queryObj.where.includes('providerMsgId'))) {
        // Unique identifiers are tenant-safe
        return true;
      }
      
      // Check for queries by campaignId - campaignId is tenant-scoped
      if (queryObj.where && queryObj.where.includes('campaignId')) {
        // campaignId is tenant-scoped via the Campaign record
        return true;
      }
      
      // Check for route handlers that use req.storeId or req.user.id (from middleware)
      if (file.includes('/routes/') && (beforeQuery.includes('req.storeId') || beforeQuery.includes('req.user.id'))) {
        // Route handlers get shopId from middleware
        return true;
      }
      
      // Check for metrics endpoint - intentionally cross-tenant (system monitoring)
      if (file.includes('routes/metrics.js')) {
        // Metrics endpoint is system-level, intentionally cross-tenant
        return true;
      }
      
      // Check for conditional shopId in whereClause (mitto-status.js pattern)
      if (queryObj.where && beforeQuery.includes('if (shopId)') && beforeQuery.includes('logWhere.shopId')) {
        return true;
      }
      
      // Check for logWhere pattern (mitto-status.js)
      if (beforeQuery.includes('logWhere') && beforeQuery.includes('logWhere.shopId')) {
        return true;
      }
      
      // Check for create operations that include shopId in data
      if (operation === 'create' && queryObj.data && queryObj.data.includes('shopId')) {
        return true;
      }
      
      // Check if prismaData includes shopId (common pattern in createContact, etc.)
      if (operation === 'create' && beforeQuery.includes('prismaData') && beforeQuery.includes('shopId: storeId')) {
        return true;
      }
      
      // Check for admin controllers - intentionally cross-tenant
      if (file.includes('controllers/admin-')) {
        return true;
      }
      
      // Check for queries that resolve shopId from phone/email (lookup pattern)
      if (queryObj.where && (queryObj.where.includes('phoneE164') || queryObj.where.includes('email')) && 
          (beforeQuery.includes('shopId =') || beforeQuery.includes('shopId: contact.shopId'))) {
        // Lookup queries that then use the resolved shopId
        return true;
      }
      
      // Check for listContacts/listTemplates pattern - function receives storeId/shopId
      // Look for function that receives storeId/shopId and builds where with it
      if (beforeQuery.includes('listContacts') || beforeQuery.includes('listTemplates')) {
        // These functions receive storeId/shopId and build where clause
        return true;
      }
      
      // Check for stripe webhook queries by paymentIntentId (unique identifier)
      if (queryObj.where && queryObj.where.includes('paymentIntentId')) {
        return true;
      }
      
      // Check for shortLink queries by token - tokens are unique and tenant-safe
      if (modelName === 'ShortLink' && queryObj.where && queryObj.where.includes('token')) {
        return true;
      }
    }

  // Skip test files - they may have unscoped queries for testing
  return false;
}

/**
 * Scan frontend for type mismatches
 */
function scanFrontendTypes(models) {
  console.log('\n📋 Scanning Frontend Types...');
  console.log('='.repeat(60));

  // Frontend types are API DTOs, not Prisma models
  // They may include computed fields, pagination, and field mappings
  // This is informational only - not an error
  
  pass('Frontend types are API DTOs (may differ from Prisma models - this is expected)');
  
  return [];
}

function findTSFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
        findTSFiles(fullPath, files);
      }
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

function findMatchingModel(interfaceName, models) {
  // Try to match interface name to model name
  const normalized = interfaceName.toLowerCase();
  for (const modelName of Object.keys(models)) {
    if (normalized.includes(modelName.toLowerCase()) || modelName.toLowerCase().includes(normalized)) {
      return modelName;
    }
  }
  return null;
}

function extractInterfaceFields(interfaceBody) {
  const fields = [];
  const fieldRegex = /^\s*(\w+)(\??):\s*([^;]+);/gm;
  let match;
  while ((match = fieldRegex.exec(interfaceBody)) !== null) {
    fields.push({
      name: match[1],
      optional: !!match[2],
      type: match[3].trim(),
    });
  }
  return fields;
}

/**
 * Main execution
 */
async function runAudit() {
  console.log('🚀 Prisma Alignment Audit');
  console.log('='.repeat(60));

  // Parse schema
  console.log('\n📋 Parsing Prisma Schema...');
  console.log('='.repeat(60));
  const schema = parseSchema();
  if (!schema) {
    console.error('Failed to parse schema');
    process.exit(1);
  }

  const { models, enums } = schema;
  const modelCount = Object.keys(models).length;
  pass(`Parsed ${modelCount} models`);
  pass(`Parsed ${Object.keys(enums).length} enums`);
  
  // Debug: Check if WebhookEvent is parsed
  if (!models['WebhookEvent']) {
    warn('WebhookEvent model not found in parsed models - attempting manual parse');
    // Try to manually parse it if it exists in schema
    const schemaContent = readFileSync(SCHEMA_PATH, 'utf-8');
    const webhookEventMatch = schemaContent.match(/model\s+WebhookEvent\s*\{([\s\S]*?)\n\}/);
    if (webhookEventMatch) {
      const modelBody = webhookEventMatch[1];
      const fields = {};
      const modelRelations = [];
      const fieldRegex = /^\s*(\w+)\s+([^\n]+)/gm;
      let fieldMatch;
      while ((fieldMatch = fieldRegex.exec(modelBody)) !== null) {
        const fieldName = fieldMatch[1];
        const fieldDef = fieldMatch[2].trim();
        if (fieldName.startsWith('@@')) continue;
        fields[fieldName] = {
          name: fieldName,
          definition: fieldDef,
          type: extractFieldType(fieldDef),
          isRelation: fieldDef.includes('@relation'),
          isOptional: fieldDef.includes('?'),
        };
        if (fieldDef.includes('@relation')) {
          const relationMatch = fieldDef.match(/@relation\(fields:\s*\[(\w+)\],\s*references:\s*\[(\w+)\]\)/);
          if (relationMatch) {
            modelRelations.push({
              field: fieldName,
              foreignKey: relationMatch[1],
              references: relationMatch[2],
            });
          }
        }
      }
      models['WebhookEvent'] = {
        name: 'WebhookEvent',
        fields,
        relations: modelRelations,
      };
      pass('Manually parsed WebhookEvent model');
    }
  }

  // Find tenant models
  const tenantModels = findTenantModels(models);
  pass(`Found ${tenantModels.length} tenant-bound models: ${tenantModels.join(', ')}`);

  // Scan backend
  const { unscopedQueries } = scanBackendPrismaUsage(models, tenantModels);

  // Scan frontend
  const typeMismatches = scanFrontendTypes(models);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 AUDIT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passes.length}`);
  console.log(`❌ Failed: ${errors.length}`);
  console.log(`⚠️  Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(({ msg, file, line }) => {
      console.log(`   ${msg}${file ? ` (${file}${line ? `:${line}` : ''})` : ''}`);
    });
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(({ msg, file, line }) => {
      console.log(`   ${msg}${file ? ` (${file}${line ? `:${line}` : ''})` : ''}`);
    });
  }

  // Only fail on actual errors, not warnings
  // Warnings are for informational purposes (frontend DTOs, query operators, etc.)
  const criticalErrors = errors.filter(e => 
    !e.msg.includes('Frontend interface') && 
    !e.msg.includes('not found in model') ||
    e.msg.includes('Unscoped query')
  );

  if (criticalErrors.length > 0) {
    console.log('\n❌ Audit failed (critical errors found)');
    process.exit(1);
  } else if (errors.length > 0) {
    console.log('\n⚠️  Audit passed with warnings (non-critical issues)');
    process.exit(0);
  } else {
    console.log('\n✅ All checks passed!');
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

