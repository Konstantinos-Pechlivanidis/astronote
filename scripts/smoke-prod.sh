#!/bin/bash
# Production Smoke Test Script
# Safe, no secrets printed

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Production URLs
WEB_URL="${WEB_URL:-https://astronote.onrender.com}"
SHOPIFY_API_URL="${SHOPIFY_API_URL:-https://astronote-shopify.onrender.com}"
RETAIL_API_URL="${RETAIL_API_URL:-https://astronote-retail.onrender.com}"

# Test results
PASSED=0
FAILED=0
SKIPPED=0

# Helper function to print test result
print_result() {
  local test_name=$1
  local status=$2
  local message=$3
  
  if [ "$status" = "PASS" ]; then
    echo -e "${GREEN}✓${NC} $test_name: PASS"
    ((PASSED++))
  elif [ "$status" = "FAIL" ]; then
    echo -e "${RED}✗${NC} $test_name: FAIL - $message"
    ((FAILED++))
  elif [ "$status" = "SKIP" ]; then
    echo -e "${YELLOW}⊘${NC} $test_name: SKIP - $message"
    ((SKIPPED++))
  fi
}

# Helper function to check HTTP status
check_http_status() {
  local url=$1
  local expected_status=$2
  local test_name=$3
  
  local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  
  if [ "$status_code" = "$expected_status" ]; then
    print_result "$test_name" "PASS"
    return 0
  else
    print_result "$test_name" "FAIL" "Expected $expected_status, got $status_code"
    return 1
  fi
}

# Helper function to check JSON response
check_json_response() {
  local url=$1
  local jq_filter=$2
  local test_name=$3
  
  local response=$(curl -s "$url")
  local result=$(echo "$response" | jq -r "$jq_filter" 2>/dev/null)
  
  if [ "$result" != "null" ] && [ "$result" != "" ]; then
    print_result "$test_name" "PASS"
    return 0
  else
    print_result "$test_name" "FAIL" "JSON check failed"
    return 1
  fi
}

echo "=========================================="
echo "Production Smoke Tests"
echo "=========================================="
echo "WEB: $WEB_URL"
echo "Shopify API: $SHOPIFY_API_URL"
echo "Retail API: $RETAIL_API_URL"
echo ""

# D) API Health Endpoints
echo "--- Health Checks ---"

# D1: Shopify API Basic Health
check_http_status "$SHOPIFY_API_URL/health" "200" "D1: Shopify API /health"

# D2: Shopify API Full Health
check_json_response "$SHOPIFY_API_URL/health/full" ".ok" "D2: Shopify API /health/full"

# D3: Retail API Liveness
check_http_status "$RETAIL_API_URL/healthz" "200" "D3: Retail API /healthz"

# D4: Retail API Readiness
check_json_response "$RETAIL_API_URL/readiness" ".status" "D4: Retail API /readiness"

# D5: Retail API DB Health
check_json_response "$RETAIL_API_URL/health/db" ".status" "D5: Retail API /health/db"

echo ""

# A) Web Landing Page
echo "--- Web Frontend ---"

# A1: Marketing Landing
check_http_status "$WEB_URL/" "200" "A1: Web Landing Page"

echo ""

# F) Authentication (401 Behavior)
echo "--- Authentication (401 Checks) ---"

# F1: Shopify API Protected Route (no token)
status_code=$(curl -s -o /dev/null -w "%{http_code}" "$SHOPIFY_API_URL/dashboard")
if [ "$status_code" = "401" ]; then
  print_result "F1: Shopify API 401 (no token)" "PASS"
else
  print_result "F1: Shopify API 401 (no token)" "FAIL" "Expected 401, got $status_code"
fi

# F2: Retail API Protected Route (no token)
status_code=$(curl -s -o /dev/null -w "%{http_code}" "$RETAIL_API_URL/api/dashboard/kpis")
if [ "$status_code" = "401" ]; then
  print_result "F2: Retail API 401 (no token)" "PASS"
else
  print_result "F2: Retail API 401 (no token)" "FAIL" "Expected 401, got $status_code"
fi

echo ""

# J) Shortener Redirect (if test token provided)
if [ -n "$SHORT_LINK_TOKEN" ]; then
  echo "--- Shortener Redirect ---"
  
  # J1: Short Link Redirect
  status_code=$(curl -s -o /dev/null -w "%{http_code}" -L "$SHOPIFY_API_URL/r/$SHORT_LINK_TOKEN")
  if [ "$status_code" = "200" ] || [ "$status_code" = "302" ]; then
    print_result "J1: Short Link Redirect" "PASS"
  else
    print_result "J1: Short Link Redirect" "FAIL" "Expected 200/302, got $status_code"
  fi
else
  print_result "J1: Short Link Redirect" "SKIP" "SHORT_LINK_TOKEN not provided"
fi

echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
fi

