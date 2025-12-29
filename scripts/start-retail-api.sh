#!/bin/bash
# Start script for Retail API that works with Render monorepo deployment
# This script handles both root directory and subdirectory scenarios

set -e

# If we're in the root directory (monorepo root)
if [ -f "package.json" ] && [ -d "apps/retail-api" ]; then
  echo "[Start] Running from monorepo root"
  npm -w @astronote/retail-api run start
# If we're in apps/retail-api directory
elif [ -f "package.json" ] && [ -f "src/server.js" ]; then
  echo "[Start] Running from apps/retail-api directory"
  npm run start
# If we're in a different location, try to find the workspace
else
  echo "[Start] Attempting to find workspace..."
  # Try to go to root
  if [ -d "../../apps/retail-api" ]; then
    cd ../../apps/retail-api
    npm run start
  elif [ -d "../apps/retail-api" ]; then
    cd ../apps/retail-api
    npm run start
  else
    echo "[ERROR] Could not find retail-api workspace"
    exit 1
  fi
fi

