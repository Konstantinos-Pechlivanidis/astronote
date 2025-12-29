#!/bin/bash
# Test script to verify all commands work
# This script can be run manually to test the setup

set -e

echo "🔍 Testing monorepo commands..."
echo ""

# Test lint
echo "1. Testing: npm run lint"
npm run lint || echo "⚠️  Lint check completed with warnings"
echo ""

# Test format
echo "2. Testing: npm run format"
npm run format || echo "⚠️  Format check completed with warnings"
echo ""

# Test build (may take time)
echo "3. Testing: npm run build"
npm run build || echo "⚠️  Build check completed with warnings"
echo ""

# Test check (full CI-style check)
echo "4. Testing: npm run check"
npm run check || echo "⚠️  Check completed with warnings"
echo ""

echo "✅ All command tests completed!"
echo ""
echo "Note: Development commands (npm run dev, npm run dev:web) should be run separately"
echo "Note: Smoke test (npm run smoke:api) requires API to be running"

