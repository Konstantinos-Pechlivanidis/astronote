#!/bin/bash
# Start script for Retail API that works with Render monorepo deployment
# This script handles both root directory and subdirectory scenarios

set -e

# If we're in apps/retail-api directory (most reliable)
if [ -f "package.json" ] && [ -f "src/server.js" ]; then
  echo "[Start] Running from apps/retail-api directory"
  DOTENV_CONFIG_PATH=../../.env node -r dotenv/config src/server.js
# If we're in the root directory (monorepo root)
elif [ -f "package.json" ] && [ -d "apps/retail-api" ]; then
  echo "[Start] Running from monorepo root, using direct path"
  cd apps/retail-api
  DOTENV_CONFIG_PATH=../../.env node -r dotenv/config src/server.js
# If we're in a different location, try to find the workspace
else
  echo "[Start] Attempting to find workspace..."
  # Try to go to root first
  if [ -d "../../apps/retail-api" ] && [ -f "../../package.json" ]; then
    cd ../../apps/retail-api
    npm run start
  elif [ -d "../apps/retail-api" ] && [ -f "../package.json" ]; then
    cd ../apps/retail-api
    npm run start
  elif [ -d "apps/retail-api" ] && [ -f "package.json" ]; then
    cd apps/retail-api
    npm run start
  else
    echo "[ERROR] Could not find retail-api workspace"
    echo "[ERROR] Current directory: $(pwd)"
    echo "[ERROR] Contents: $(ls -la)"
    exit 1
  fi
fi

