#!/bin/bash
# Start script for Shopify API that works with Render monorepo deployment
# This script handles both root directory and subdirectory scenarios

set -e

# If we're in the root directory (monorepo root)
if [ -f "package.json" ] && [ -d "apps/shopify-api" ]; then
  echo "[Start] Running from monorepo root"
  npm -w @astronote/shopify-api run start
# If we're in apps/shopify-api directory
elif [ -f "package.json" ] && [ -f "index.js" ]; then
  echo "[Start] Running from apps/shopify-api directory"
  npm run start
# If we're in a different location, try to find the workspace
else
  echo "[Start] Attempting to find workspace..."
  # Try to go to root
  if [ -d "../../apps/shopify-api" ]; then
    cd ../../apps/shopify-api
    npm run start
  elif [ -d "../apps/shopify-api" ]; then
    cd ../apps/shopify-api
    npm run start
  else
    echo "[ERROR] Could not find shopify-api workspace"
    exit 1
  fi
fi

