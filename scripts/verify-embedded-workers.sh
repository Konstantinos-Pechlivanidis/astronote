#!/bin/bash
# Verification script for embedded workers
# Usage: ./scripts/verify-embedded-workers.sh [retail-api-url] [shopify-api-url]

set -e

RETAIL_API_URL=${1:-http://localhost:3001}
SHOPIFY_API_URL=${2:-http://localhost:8080}

echo "=========================================="
echo "Embedded Workers Verification"
echo "=========================================="
echo ""
echo "Retail API: $RETAIL_API_URL"
echo "Shopify API: $SHOPIFY_API_URL"
echo ""

# Function to check endpoint
check_endpoint() {
  local url=$1
  local name=$2
  local expected_status=$3
  
  echo "Checking $name: $url"
  response=$(curl -s -w "\n%{http_code}" "$url" || echo -e "\n000")
  body=$(echo "$response" | head -n -1)
  status=$(echo "$response" | tail -n 1)
  
  if [ "$status" = "$expected_status" ]; then
    echo "  ✓ Status: $status (expected: $expected_status)"
    echo "  Response: $body"
    return 0
  else
    echo "  ✗ Status: $status (expected: $expected_status)"
    echo "  Response: $body"
    return 1
  fi
}

# Check healthz endpoints
echo "1. Checking /healthz endpoints (liveness)..."
check_endpoint "$RETAIL_API_URL/healthz" "Retail API /healthz" "200" || exit 1
check_endpoint "$SHOPIFY_API_URL/healthz" "Shopify API /healthz" "200" || exit 1
echo ""

# Check readiness endpoints
echo "2. Checking /readiness endpoints (readiness)..."
check_endpoint "$RETAIL_API_URL/readiness" "Retail API /readiness" "200" || exit 1
check_endpoint "$SHOPIFY_API_URL/readiness" "Shopify API /readiness" "200" || exit 1
echo ""

# Check health/full endpoint (Shopify)
echo "3. Checking /health/full endpoint (Shopify)..."
response=$(curl -s "$SHOPIFY_API_URL/health/full")
if echo "$response" | grep -q '"ok":true'; then
  echo "  ✓ Health check passed"
  echo "  Response: $response"
else
  echo "  ✗ Health check failed"
  echo "  Response: $response"
  exit 1
fi
echo ""

# Check for worker mode in logs (if accessible)
echo "4. Checking worker mode configuration..."
echo "  Note: Check logs manually for 'WORKER_MODE=embedded' or 'Workers started successfully'"
echo ""

echo "=========================================="
echo "Verification Complete"
echo "=========================================="
echo ""
echo "All checks passed! ✓"
echo ""
echo "Next steps:"
echo "1. Check API logs for 'WORKER_MODE=embedded'"
echo "2. Check API logs for 'Workers started successfully'"
echo "3. Enqueue a test job and verify it's processed"
echo ""

