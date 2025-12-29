#!/bin/bash
# Start script for Shopify API that works with Render monorepo deployment
# This script handles both root directory and subdirectory scenarios

set -e

# If we're in apps/shopify-api directory (most reliable)
if [ -f "package.json" ] && [ -f "index.js" ]; then
  echo "[Start] Running from apps/shopify-api directory"
  node index.js
# If we're in the root directory (monorepo root)
elif [ -f "package.json" ] && [ -d "apps/shopify-api" ]; then
  echo "[Start] Running from monorepo root, using direct path"
  cd apps/shopify-api
  node index.js
# If we're in a different location, try to find the workspace
else
  echo "[Start] Attempting to find workspace..."
  # Try to go to root first
  if [ -d "../../apps/shopify-api" ] && [ -f "../../package.json" ]; then
    cd ../../apps/shopify-api
    node index.js
  elif [ -d "../apps/shopify-api" ] && [ -f "../package.json" ]; then
    cd ../apps/shopify-api
    node index.js
  elif [ -d "apps/shopify-api" ] && [ -f "package.json" ]; then
    cd apps/shopify-api
    node index.js
  else
    echo "[ERROR] Could not find shopify-api workspace"
    echo "[ERROR] Current directory: $(pwd)"
    echo "[ERROR] Contents: $(ls -la)"
    exit 1
  fi
fi

