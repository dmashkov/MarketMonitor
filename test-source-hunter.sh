#!/bin/bash

# ============================================================================
# Source Hunter Agent Test Script
#
# Автоматизированное тестирование Source Hunter Agent Edge Function
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="http://localhost:54321/functions/v1/agents/source-hunter"
RESULTS_FILE="test-results.json"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Source Hunter Agent Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================================================
# Helper Functions
# ============================================================================

test_endpoint() {
  local test_name=$1
  local test_body=$2
  local expected_status=$3

  echo -e "${YELLOW}[TEST]${NC} $test_name"

  # Send request
  response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "$test_body" \
    "$API_URL")

  # Parse response
  http_code=$(echo "$response" | tail -n1)
  response_body=$(echo "$response" | sed '$d')

  # Check status code
  if [ "$http_code" = "$expected_status" ]; then
    echo -e "${GREEN}✓ Status Code: $http_code${NC}"
    result="PASS"
  else
    echo -e "${RED}✗ Status Code: $http_code (expected $expected_status)${NC}"
    result="FAIL"
  fi

  # Pretty print response
  echo -e "${BLUE}Response:${NC}"
  echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
  echo ""

  echo "$result"
}

# ============================================================================
# Tests
# ============================================================================

echo -e "${BLUE}Running Tests...${NC}"
echo ""

# Test 1: Basic Search
echo -e "${YELLOW}[1/4]${NC} Basic Search"
result1=$(test_endpoint "Basic Search" \
  '{
    "prompt": "новые кондиционеры на рынке России 2025",
    "date_range_days": 7
  }' \
  "200")

# Test 2: Search with Segments
echo -e "${YELLOW}[2/4]${NC} Search with Segment Filters"
result2=$(test_endpoint "Search with Segments" \
  '{
    "prompt": "тепловые насосы в промышленности",
    "segment_ids": ["seg-heat-pumps"],
    "date_range_days": 30
  }' \
  "200")

# Test 3: Search with Geography
echo -e "${YELLOW}[3/4]${NC} Search with Geography Filters"
result3=$(test_endpoint "Search with Geography" \
  '{
    "prompt": "события на климатическом рынке",
    "geography_ids": ["geo-moscow", "geo-spb"],
    "date_range_days": 14
  }' \
  "200")

# Test 4: Error - Empty Prompt
echo -e "${YELLOW}[4/4]${NC} Error Handling - Empty Prompt"
result4=$(test_endpoint "Error - Empty Prompt" \
  '{
    "prompt": ""
  }' \
  "400")

# ============================================================================
# Summary
# ============================================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Results Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Count results
passed=0
failed=0

[[ "$result1" == "PASS" ]] && ((passed++)) || ((failed++))
[[ "$result2" == "PASS" ]] && ((passed++)) || ((failed++))
[[ "$result3" == "PASS" ]] && ((passed++)) || ((failed++))
[[ "$result4" == "PASS" ]] && ((passed++)) || ((failed++))

echo "Test 1 (Basic Search): $result1"
echo "Test 2 (Segments): $result2"
echo "Test 3 (Geography): $result3"
echo "Test 4 (Error): $result4"
echo ""

total=$((passed + failed))
percentage=$((passed * 100 / total))

echo -e "Passed: ${GREEN}$passed${NC}/$total"
echo -e "Failed: ${RED}$failed${NC}/$total"
echo -e "Score: ${BLUE}${percentage}%${NC}"
echo ""

if [ $failed -eq 0 ]; then
  echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
  exit 0
else
  echo -e "${RED}✗ SOME TESTS FAILED!${NC}"
  exit 1
fi
