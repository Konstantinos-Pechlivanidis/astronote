#!/usr/bin/env node

/**
 * Prisma Field Mismatch Checker
 * Scans shopify-api codebase for Prisma queries using incorrect field names
 * 
 * Known mismatches to check:
 * - UserAutomation: should use `isActive`, not `active`
 * - Segment: should use `isActive`, not `active`
 * - SmsPackage: should use `isActive`, not `active`
 * - Package: should use `active` (correct)
 * - Wallet: should use `active` (correct)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_ROOT = join(__dirname, '..');
const EXCLUDE_DIRS = ['node_modules', '.git', 'prisma', 'logs', 'dist', 'build'];
const EXCLUDE_FILES = ['.test.js', '.spec.js', '.md'];

// Known field mappings from Prisma schema
const FIELD_MAPPINGS = {
  'userAutomation': {
    'active': 'isActive', // ❌ active -> ✅ isActive
  },
  'UserAutomation': {
    'active': 'isActive',
  },
  'segment': {
    'active': 'isActive', // ❌ active -> ✅ isActive
  },
  'Segment': {
    'active': 'isActive',
  },
  'smsPackage': {
    'active': 'isActive', // ❌ active -> ✅ isActive
  },
  'SmsPackage': {
    'active': 'isActive',
  },
  // Package and Wallet use 'active' correctly, so we don't flag them
};

// Patterns to detect Prisma queries
const PRISMA_PATTERNS = [
  /prisma\.(\w+)\.(findMany|findFirst|findUnique|count|update|create|delete|upsert)\s*\(/g,
  /prisma\.(\w+)\.(findMany|findFirst|findUnique|count|update|create|delete|upsert)\s*\(/g,
];

function shouldExclude(filePath) {
  const fileName = filePath.split(/[/\\]/).pop();
  const dirName = filePath.split(/[/\\]/).slice(-2, -1)[0];
  
  if (EXCLUDE_DIRS.some(dir => filePath.includes(dir))) {
    return true;
  }
  
  if (EXCLUDE_FILES.some(ext => fileName.includes(ext))) {
    return true;
  }
  
  return false;
}

function findFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  
  files.forEach(file => {
    const filePath = join(dir, file);
    
    if (shouldExclude(filePath)) {
      return;
    }
    
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      findFiles(filePath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const issues = [];
  
  // Check for Prisma queries with incorrect field names
  for (const pattern of PRISMA_PATTERNS) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const modelName = match[1];
      const method = match[2];
      const startPos = match.index;
      
      // Find the where clause or data clause
      const remainingContent = content.substring(startPos);
      const whereMatch = remainingContent.match(/where:\s*\{[^}]*active[^}]*\}/);
      const dataMatch = remainingContent.match(/data:\s*\{[^}]*active[^}]*\}/);
      
      if (whereMatch || dataMatch) {
        const clauseMatch = whereMatch || dataMatch;
        const clause = clauseMatch[0];
        
        // Check if this model has a field mapping issue
        const mapping = FIELD_MAPPINGS[modelName];
        if (mapping && clause.includes('active:') && !clause.includes('isActive:')) {
          // Extract line number
          const lineNumber = content.substring(0, startPos).split('\n').length;
          
          issues.push({
            file: filePath.replace(API_ROOT + '/', ''),
            line: lineNumber,
            model: modelName,
            method,
            issue: `Using 'active' instead of 'isActive' for ${modelName}`,
            clause: clause.substring(0, 100), // First 100 chars
          });
        }
      }
    }
  }
  
  // Also check for direct field references in where clauses
  const directPattern = /(userAutomation|UserAutomation|segment|Segment|smsPackage|SmsPackage)\.(findMany|findFirst|findUnique|count|update|create|delete|upsert)\s*\([^)]*where:\s*\{[^}]*active:\s*(true|false)/g;
  let directMatch;
  while ((directMatch = directPattern.exec(content)) !== null) {
    const modelName = directMatch[1];
    const startPos = directMatch.index;
    const lineNumber = content.substring(0, startPos).split('\n').length;
    
    const mapping = FIELD_MAPPINGS[modelName];
    if (mapping && mapping.active) {
      issues.push({
        file: filePath.replace(API_ROOT + '/', ''),
        line: lineNumber,
        model: modelName,
        method: directMatch[2],
        issue: `Using 'active' instead of 'isActive' for ${modelName}`,
        clause: directMatch[0].substring(0, 100),
      });
    }
  }
  
  return issues;
}

function main() {
  console.log('🔍 Checking for Prisma field mismatches in shopify-api...\n');
  
  const files = findFiles(API_ROOT);
  const allIssues = [];
  
  files.forEach(file => {
    const issues = checkFile(file);
    if (issues.length > 0) {
      allIssues.push(...issues);
    }
  });
  
  if (allIssues.length === 0) {
    console.log('✅ No Prisma field mismatches found!\n');
    process.exit(0);
  }
  
  console.log(`❌ Found ${allIssues.length} Prisma field mismatch(es):\n`);
  
  allIssues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue.file}:${issue.line}`);
    console.log(`   Model: ${issue.model}`);
    console.log(`   Method: ${issue.method}`);
    console.log(`   Issue: ${issue.issue}`);
    console.log(`   Context: ${issue.clause}...`);
    console.log('');
  });
  
  console.log('\n💡 Fix: Replace "active" with "isActive" in the where/data clause');
  console.log('   Example: where: { shopId, isActive: true }');
  console.log('');
  
  process.exit(1);
}

main();

