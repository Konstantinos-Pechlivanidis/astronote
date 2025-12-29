#!/bin/bash
# Start script for Web Frontend that works with Render monorepo deployment
# This script handles both root directory and subdirectory scenarios

set -e

# If we're in apps/web directory (most reliable)
if [ -f "package.json" ] && [ -d "dist" ]; then
  echo "[Start] Running from apps/web directory"
  npm run start
# If we're in the root directory (monorepo root)
elif [ -f "package.json" ] && [ -d "apps/web" ]; then
  echo "[Start] Running from monorepo root, using direct path"
  cd apps/web
  npm run start
# If we're in a different location, try to find the workspace
else
  echo "[Start] Attempting to find workspace..."
  # Try to go to root first
  if [ -d "../../apps/web" ] && [ -f "../../package.json" ]; then
    cd ../../apps/web
    npm run start
  elif [ -d "../apps/web" ] && [ -f "../package.json" ]; then
    cd ../apps/web
    npm run start
  elif [ -d "apps/web" ] && [ -f "package.json" ]; then
    cd apps/web
    npm run start
  else
    echo "[ERROR] Could not find web workspace"
    echo "[ERROR] Current directory: $(pwd)"
    echo "[ERROR] Contents: $(ls -la)"
    exit 1
  fi
fi

