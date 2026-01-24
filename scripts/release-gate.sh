#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT_DIR"

normalize_path() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

ROOT_DIR_NORM="$(normalize_path "$ROOT_DIR")"

LAST_STEP=""
trap 'echo "FAILED: ${LAST_STEP}" >&2' ERR
FAILURES=0
LOG_DIR="$ROOT_DIR/.release-gate-logs"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

print_header() {
  printf '\n== %s ==\n' "$1"
}

print_header "Environment"
if command -v node >/dev/null 2>&1; then
  echo "Node: $(node -v)"
else
  echo "Node: not found"
  exit 1
fi
if command -v npm >/dev/null 2>&1; then
  echo "npm: $(npm -v)"
else
  echo "npm: not found"
  exit 1
fi

print_header "Install"
LAST_STEP="npm install"
if [ -f package-lock.json ]; then
  echo "Running npm ci"
  if npm ci; then
    echo "npm ci completed"
  else
    echo "npm ci failed; falling back to npm install to sync lockfile"
    npm install
  fi
else
  echo "Running npm install"
  npm install
fi

print_header "Load Env"
load_env_file() {
  local env_file="$1"
  if [ ! -f "$env_file" ]; then
    return 0
  fi
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|\#*) continue ;;
    esac
    if [[ "$line" != *"="* ]]; then
      continue
    fi
    local key="${line%%=*}"
    local val="${line#*=}"
    key="$(printf '%s' "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    if [ -z "$key" ]; then
      continue
    fi
    export "$key=$val"
  done < "$env_file"
  echo "Loaded env names from $env_file"
}

load_env_file "$ROOT_DIR/.env"
load_env_file "$ROOT_DIR/apps/retail-api/.env"
load_env_file "$ROOT_DIR/apps/retail-api/.env.local"

print_header "Billing Env Sanity"
REQUIRED_ENV_VARS=(
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_WEBHOOK_ENDPOINT_PATH
  STRIPE_CURRENCY
  PUBLIC_BASE_URL
  STRIPE_PRICE_SUB_MONTHLY_EUR
  STRIPE_PRICE_SUB_YEARLY_EUR
  STRIPE_PRICE_TOPUP_10_EUR
  STRIPE_PRICE_TOPUP_25_EUR
  STRIPE_PRICE_TOPUP_50_EUR
  STRIPE_PRICE_TOPUP_100_EUR
  CREDITS_INCLUDED_MONTHLY
  CREDITS_INCLUDED_YEARLY
  CREDITS_TOPUP_10
  CREDITS_TOPUP_25
  CREDITS_TOPUP_50
  CREDITS_TOPUP_100
  ADMIN_EXPORT_TOKEN
  EXPORT_EMAIL_TO
  EXPORT_EMAIL_FROM
  EXPORT_WEEKLY_ENABLED
  EXPORT_WEEKLY_CRON
  SMTP_HOST
  SMTP_PORT
  SMTP_USER
  SMTP_PASS
  SMTP_SECURE
  SMTP_FROM
)

MISSING=()
for VAR in "${REQUIRED_ENV_VARS[@]}"; do
  if [ -z "${!VAR:-}" ]; then
    MISSING+=("$VAR")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "Missing required env vars:"
  for VAR in "${MISSING[@]}"; do
    echo "- $VAR"
  done
  exit 1
fi

echo "All required billing env vars are present (names only)."

print_header "Discover Packages"
PACKAGE_JSONS=()
while IFS= read -r pkg; do
  PACKAGE_JSONS+=("$pkg")
done < <(find "$ROOT_DIR" -name package.json -not -path "*/node_modules/*" -not -path "*/.git/*" | sort)

if [ ${#PACKAGE_JSONS[@]} -eq 0 ]; then
  echo "No package.json files found."
  exit 1
fi

echo "Detected packages: ${#PACKAGE_JSONS[@]}"

WORKSPACE_DIRS=()
while IFS= read -r ws; do
  if [ -d "$ws" ]; then
    WORKSPACE_DIRS+=("$(cd "$ws" && pwd -P)")
  fi
done < <(node -e "const fs=require('fs');const path=require('path');const p=JSON.parse(fs.readFileSync(path.join(process.cwd(),'package.json'),'utf8'));const workspaces=p.workspaces||[];for (const ws of workspaces){console.log(path.join(process.cwd(),ws));}")

is_workspace_root() {
  local dir="$1"
  local dir_norm
  dir_norm="$(normalize_path "$dir")"
  if [ "$dir_norm" = "$ROOT_DIR_NORM" ]; then
    return 0
  fi
  for ws in "${WORKSPACE_DIRS[@]}"; do
    if [ "$dir_norm" = "$(normalize_path "$ws")" ]; then
      return 0
    fi
  done
  return 1
}

run_script_if_present() {
  local pkg_json="$1"
  local script_name="$2"
  node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const s=p.scripts||{};process.exit(s[process.argv[2]]?0:1);" "$pkg_json" "$script_name"
}

get_pkg_name() {
  node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));console.log(p.name||process.argv[1]);" "$1"
}

run_cmd() {
  local dir="$1"
  local label="$2"
  local cmd="$3"
  local slug
  slug="$(printf '%s' "$label" | tr ' /:' '___' | tr -cd '[:alnum:]_-.')"
  local log="$LOG_DIR/${slug}.log"
  LAST_STEP="$label"
  echo "- Running: $label"
  if (cd "$dir" && bash -lc "$cmd") >"$log" 2>&1; then
    echo "- Passed: $label"
    return 0
  else
    FAILURES=$((FAILURES + 1))
    echo "- Failed: $label"
    cat "$log"
    return 1
  fi
}

print_header "Package Scripts"
for pkg_json in "${PACKAGE_JSONS[@]}"; do
  pkg_dir="$(dirname "$pkg_json")"
  pkg_dir="$(cd "$pkg_dir" && pwd -P)"
  pkg_name="$(get_pkg_name "$pkg_json")"
  if ! is_workspace_root "$pkg_dir"; then
    echo "Package: $pkg_name ($pkg_dir)"
    echo "- Skipped (not a workspace root)"
    echo ""
    continue
  fi
  echo "Package: $pkg_name ($pkg_dir)"
  if run_script_if_present "$pkg_json" "prisma:generate"; then
    run_cmd "$pkg_dir" "$pkg_name: npm run prisma:generate" "npm run prisma:generate" || true
  fi
  for script in lint typecheck test build; do
    if run_script_if_present "$pkg_json" "$script"; then
      run_cmd "$pkg_dir" "$pkg_name: npm run $script" "npm run $script" || true
    else
      echo "- Skipped (not defined): npm run $script"
    fi
  done
  echo ""
done

print_header "Repo Gate"
if run_script_if_present "$ROOT_DIR/package.json" "release:gate"; then
  run_cmd "$ROOT_DIR" "root: npm run release:gate" "npm run release:gate" || true
else
  echo "Skipped: release:gate not defined in root package.json"
fi

print_header "Release Gate Completed"
if [ "$FAILURES" -gt 0 ]; then
  echo "Release gate completed with $FAILURES failure(s)."
  exit 1
fi
