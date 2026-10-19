#!/usr/bin/env bash
set -e

BASE_URL="${1:-http://localhost:5000}"
PASS_COUNT=0
FAIL_COUNT=0

check_endpoint() {
  local name="$1"
  local method="$2"
  local path="$3"
  local data="$4"
  local expected_status="$5"
  local key_field="$6"

  echo -n "Testing $name ($method $path)... "

  local response
  local status

  if [ -n "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json" -d "$data")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$path")
  fi

  status=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$status" = "$expected_status" ] && ( [ -z "$key_field" ] || echo "$body" | grep -q "$key_field" ); then
    echo "PASS (status $status)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "FAIL (got status $status, expected $expected_status with '$key_field')"
    echo "Response: $body"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

echo "=== DevMonitor Smoke Test Suite ==="
echo "Target: $BASE_URL"
echo ""

# 1. Prometheus Scrape
check_endpoint "Prometheus Scrape" "GET" "/metrics" "" "200" "http_requests_total"

# 2. Core Endpoints
check_endpoint "Health Check" "GET" "/api/health" "" "200" "status"
check_endpoint "Server Resources" "GET" "/api/server" "" "200" "cpu"
check_endpoint "Dashboard Overview" "GET" "/api/dashboard" "" "200" "requests"

# 3. Series & Extended Endpoints
check_endpoint "Metrics Overview" "GET" "/api/metrics/overview" "" "200" "errorRate"
check_endpoint "Requests Series" "GET" "/api/metrics/requests-series" "" "200" "time"
check_endpoint "CPU Series" "GET" "/api/metrics/cpu-series" "" "200" "time"
check_endpoint "Response Time Series" "GET" "/api/metrics/response-time-series" "" "200" "time"
check_endpoint "Recent Errors" "GET" "/api/errors/recent" "" "200" ""
check_endpoint "Services List" "GET" "/api/services" "" "200" ""
check_endpoint "Database Stats" "GET" "/api/database/stats" "" "200" "connections"
check_endpoint "Alerts List" "GET" "/api/alerts" "" "200" ""
check_endpoint "Alert Config GET" "GET" "/api/alerts/config" "" "200" "cpuThreshold"
check_endpoint "Alert Config POST" "POST" "/api/alerts/config" '{"cpuThreshold":80,"memoryThreshold":85,"errorRateThreshold":5,"responseTimeThreshold":300,"durationMinutes":5}' "200" "cpuThreshold"

# 4. URL Monitor & SSRF Protection
check_endpoint "SSRF Block Loopback" "POST" "/api/monitor/check-url" '{"url":"http://127.0.0.1"}' "400" "reserved or private"
check_endpoint "SSRF Block Localhost" "POST" "/api/monitor/check-url" '{"url":"http://localhost:5000"}' "400" "forbidden"
check_endpoint "URL Prober Public" "POST" "/api/monitor/check-url" '{"url":"https://example.com"}' "200" "status"

# 5. Test & Simulation Endpoints
check_endpoint "Test Load Generator" "POST" "/api/test/load" '{"count":5}' "200" "sent"
check_endpoint "Simulate Errors" "POST" "/api/test/errors" "" "200" "success"
check_endpoint "Simulate Slow" "POST" "/api/test/slow" "" "200" "success"
check_endpoint "Simulate CPU" "POST" "/api/test/cpu" "" "200" "success"
check_endpoint "Simulate Stop" "POST" "/api/test/stop" "" "200" "success"
check_endpoint "Simulated Down Health" "GET" "/api/health" "" "503" "down"
check_endpoint "Simulate Restore" "POST" "/api/test/restore" "" "200" "success"
check_endpoint "Restored Health" "GET" "/api/health" "" "200" "healthy"

echo ""
echo "=== Test Summary ==="
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
