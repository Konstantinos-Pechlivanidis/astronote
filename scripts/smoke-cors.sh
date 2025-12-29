#!/bin/bash
# CORS Smoke Test Script
# Tests CORS preflight requests from frontend origin

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
  fi
}

# Helper function to check CORS headers
check_cors() {
  local url=$1
  local test_name=$2
  
  local response=$(curl -s -X OPTIONS \
    -H "Origin: $WEB_URL" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: Authorization,Content-Type" \
    -v "$url" 2>&1)
  
  # Check for Access-Control-Allow-Origin header
  if echo "$response" | grep -qi "access-control-allow-origin.*$WEB_URL"; then
    print_result "$test_name" "PASS"
    return 0
  else
    # Check if CORS headers exist at all
    if echo "$response" | grep -qi "access-control-allow-origin"; then
      local allowed_origin=$(echo "$response" | grep -i "access-control-allow-origin" | head -1)
      print_result "$test_name" "FAIL" "CORS header exists but doesn't match. Found: $allowed_origin"
    else
      print_result "$test_name" "FAIL" "No Access-Control-Allow-Origin header found"
    fi
    return 1
  fi
}

echo "=========================================="
echo "CORS Smoke Tests"
echo "=========================================="
echo "Frontend Origin: $WEB_URL"
echo "Shopify API: $SHOPIFY_API_URL"
echo "Retail API: $RETAIL_API_URL"
echo ""

# E1: Shopify API CORS
check_cors "$SHOPIFY_API_URL/health" "E1: Shopify API CORS"

# E2: Retail API CORS
check_cors "$RETAIL_API_URL/healthz" "E2: Retail API CORS"

echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All CORS tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some CORS tests failed!${NC}"
  exit 1
fi

