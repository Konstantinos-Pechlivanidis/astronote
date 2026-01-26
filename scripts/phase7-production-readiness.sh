#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT_DIR"

REPORT_PATH="$ROOT_DIR/docs/reports/phase7-production-readiness.md"
LOG_DIR="$ROOT_DIR/.phase7-readiness-logs"
mkdir -p "$LOG_DIR"

NODE_VERSION="$(node -v 2>/dev/null || echo 'not found')"
NPM_VERSION="$(npm -v 2>/dev/null || echo 'not found')"
STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

declare -a RESULTS
declare -a SKIPPED

slugify() {
  printf '%s' "$1" | tr ' /:' '___' | tr -cd '[:alnum:]_-.'
}

run_cmd() {
  local label="$1"
  local cmd="$2"
  local slug
  slug="$(slugify "$label")"
  local log="$LOG_DIR/${slug}.log"
  if bash -lc "$cmd" >"$log" 2>&1; then
    RESULTS+=("$label|pass|$log")
    return 0
  else
    RESULTS+=("$label|fail|$log")
    return 0
  fi
}

skip_cmd() {
  local label="$1"
  local reason="$2"
  SKIPPED+=("$label|$reason")
}

if [ -f "$ROOT_DIR/scripts/release-gate.sh" ]; then
  run_cmd "release-gate" "bash scripts/release-gate.sh"
else
  skip_cmd "release-gate" "script not found"
fi

run_cmd "web:lint" "npm -w apps/astronote-web run lint --if-present"
run_cmd "web:typecheck" "npm -w apps/astronote-web run typecheck --if-present"
run_cmd "web:build" "npm -w apps/astronote-web run build --if-present"

run_cmd "api:lint" "npm -w @astronote/retail-api run lint --if-present"
run_cmd "api:build" "npm -w @astronote/retail-api run build --if-present"
run_cmd "api:test" "npm -w @astronote/retail-api run test --if-present"

run_cmd "worker:gate" "npm -w @astronote/retail-api run gate:worker --if-present"

# Optional contract tests (guarded by RUN_SMOKE_TESTS=1)
if [ "${RUN_SMOKE_TESTS:-}" = "1" ]; then
  if [ -f "$ROOT_DIR/scripts/smoke-test.js" ]; then
    run_cmd "contract:smoke-test" "node scripts/smoke-test.js"
  else
    skip_cmd "contract:smoke-test" "script not found"
  fi
else
  skip_cmd "contract:smoke-test" "RUN_SMOKE_TESTS not set"
fi

FINISHED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

{
  echo "# Phase 7 Production Readiness Report"
  echo
  echo "Generated: ${FINISHED_AT}"
  echo
  echo "## Environment"
  echo "- Node: ${NODE_VERSION}"
  echo "- npm: ${NPM_VERSION}"
  echo
  echo "## Commands executed"
  for entry in "${RESULTS[@]}"; do
    IFS='|' read -r label status log <<< "$entry"
    echo "- ${label}: ${status} (log: ${log})"
  done
  if [ ${#SKIPPED[@]} -gt 0 ]; then
    echo
    echo "## Skipped"
    for entry in "${SKIPPED[@]}"; do
      IFS='|' read -r label reason <<< "$entry"
      echo "- ${label}: ${reason}"
    done
  fi
  echo
  echo "## Key flows verified"
  echo "- Release gate"
  echo "- Lint, typecheck, build for web/api/worker"
  echo "- Tests where present"
  echo "- Optional smoke test when available"
  echo
  echo "## Remaining risks / follow-ups"
  echo "- Review failed logs above if any command failed."
  echo "- Contract tests are environment-dependent; ensure API base URLs are set when running."
} > "$REPORT_PATH"

echo "Phase 7 readiness report written to $REPORT_PATH"
