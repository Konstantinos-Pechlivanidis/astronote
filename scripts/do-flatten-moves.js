#!/usr/bin/env node
/** Perform Phase A retail monorepo flattening moves. */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function moveDir(src, dst) {
  if (!fs.existsSync(src)) {
    console.log(`⚠ Source not found: ${src}`);
    return false;
  }
  if (fs.existsSync(dst)) {
    console.log(`⚠ Destination exists: ${dst}, merging...`);
    const items = fs.readdirSync(src);
    for (const item of items) {
      const srcItem = path.join(src, item);
      const dstItem = path.join(dst, item);
      if (fs.existsSync(dstItem)) {
        console.log(`  ⚠ Skipping ${item} (already exists)`);
      } else {
        fs.renameSync(srcItem, dstItem);
        console.log(`  ✓ Moved ${item}`);
      }
    }
    try {
      fs.rmdirSync(src);
    } catch (e) {
      // Directory not empty, that's ok
    }
    return true;
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.renameSync(src, dst);
    console.log(`✓ Moved ${src} -> ${dst}`);
    return true;
  }
}

console.log('Phase A: Flattening retail monorepo...\n');

// 1. Move API src
moveDir(
  path.join(repoRoot, 'apps/retail-api/apps/api/src'),
  path.join(repoRoot, 'apps/retail-api/src')
);

// 2. Merge API scripts
const apiScripts = path.join(repoRoot, 'apps/retail-api/apps/api/scripts');
const dstScripts = path.join(repoRoot, 'apps/retail-api/scripts');
if (fs.existsSync(apiScripts)) {
  if (!fs.existsSync(dstScripts)) {
    fs.mkdirSync(dstScripts, { recursive: true });
  }
  const items = fs.readdirSync(apiScripts);
  for (const item of items) {
    const srcItem = path.join(apiScripts, item);
    const dstItem = path.join(dstScripts, item);
    if (fs.existsSync(dstItem)) {
      console.log(`  ⚠ Skipping script ${item} (already exists)`);
    } else {
      fs.renameSync(srcItem, dstItem);
      console.log(`  ✓ Moved script ${item}`);
    }
  }
  try {
    fs.rmdirSync(apiScripts);
  } catch (e) {}
}

// 3. Move worker
moveDir(
  path.join(repoRoot, 'apps/retail-api/apps/worker'),
  path.join(repoRoot, 'apps/retail-worker')
);

// 4. Move web
moveDir(
  path.join(repoRoot, 'apps/retail-api/apps/web'),
  path.join(repoRoot, 'apps/retail-web-legacy')
);

// 5. Clean up empty directories
try {
  const apiDir = path.join(repoRoot, 'apps/retail-api/apps/api');
  if (fs.existsSync(apiDir)) {
    fs.rmdirSync(apiDir);
  }
  const appsDir = path.join(repoRoot, 'apps/retail-api/apps');
  if (fs.existsSync(appsDir)) {
    fs.rmdirSync(appsDir);
  }
} catch (e) {
  // Not empty or doesn't exist, that's ok
}

console.log('\n✓ Moves complete!');

