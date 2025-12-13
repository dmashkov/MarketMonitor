#!/bin/bash

# Content Fetcher Agent Test Script
# Phase 4 - Part 2 Testing
# Tests API endpoints for Content Fetcher Agent

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0
TOTAL=0

# Base URL for Content Fetcher
BASE_URL="http://localhost:54321/functions/v1/agents/content-fetcher"

# Helper function to print test results
test_case() {
  local name=$1
  local method=$2
  local url=$3
  local data=$4
  local expected_status=$5

  TOTAL=$((TOTAL + 1))

  echo -e "\n${BLUE}Test $TOTAL: $name${NC}"
  echo "URL: $url"
  echo "Method: $method"

  # Execute curl
  if [ "$method" = "POST" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
      -H "Content-Type: application/json" \
      -d "$data")
  else
    response=$(curl -s -w "\n%{http_code}" -X OPTIONS "$url" \
      -H "Access-Control-Request-Method: POST" \
      -H "Access-Control-Request-Headers: content-type")
  fi

  # Extract status code (last line)
  status_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  echo "Status: $status_code"

  # Check if status matches expected
  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}✓ Status Code: $status_code${NC}"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ Expected $expected_status but got $status_code${NC}"
    FAILED=$((FAILED + 1))
  fi

  # Print response body if JSON
  if echo "$body" | grep -q "^{"; then
    echo "Response: $body" | head -c 200
    echo "..."
  fi
}

# ============================================================================
# Tests
# ============================================================================

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Content Fetcher Agent - Test Suite${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"

# Test 1: Fetch HTML content
test_case \
  "Fetch HTML Content" \
  "POST" \
  "$BASE_URL" \
  '{"document_id":"test-001","url":"https://www.example.com","document_type":"webpage"}' \
  "200"

# Test 2: Fetch with document type PDF
test_case \
  "Fetch PDF Document" \
  "POST" \
  "$BASE_URL" \
  '{"document_id":"test-002","url":"https://example.com/document.pdf","document_type":"pdf"}' \
  "200"

# Test 3: Fetch with document type DOCX
test_case \
  "Fetch DOCX Document" \
  "POST" \
  "$BASE_URL" \
  '{"document_id":"test-003","url":"https://example.com/document.docx","document_type":"docx"}' \
  "200"

# Test 4: Error - Invalid URL (should fail to fetch)
test_case \
  "Error - Invalid URL" \
  "POST" \
  "$BASE_URL" \
  '{"document_id":"test-004","url":"https://not-exist-domain-12345.com/page","document_type":"webpage"}' \
  "400"

# Test 5: Error - Missing parameters
test_case \
  "Error - Missing Parameters" \
  "POST" \
  "$BASE_URL" \
  '{"document_id":"test-005"}' \
  "400"

# Test 6: CORS Preflight
test_case \
  "CORS Preflight" \
  "OPTIONS" \
  "$BASE_URL" \
  "" \
  "200"

# ============================================================================
# Summary
# ============================================================================

echo -e "\n${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"

echo "Passed: $PASSED/$TOTAL"
echo "Failed: $FAILED/$TOTAL"

if [ $FAILED -eq 0 ]; then
  PERCENT=100
  echo -e "${GREEN}Score: $PERCENT%${NC}"
  echo -e "\n${GREEN}✓ ALL TESTS PASSED!${NC}"
  exit 0
else
  PERCENT=$((PASSED * 100 / TOTAL))
  echo -e "${YELLOW}Score: $PERCENT%${NC}"
  echo -e "\n${RED}✗ SOME TESTS FAILED${NC}"
  exit 1
fi
