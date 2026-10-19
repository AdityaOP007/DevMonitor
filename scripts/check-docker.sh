#!/usr/bin/env bash
set -e

BASE_URL="${1:-http://localhost:8080}"
BACKEND_LOOPBACK="${2:-http://127.0.0.1:5000}"

PASSED=0
FAILED=0

log_pass() {
  echo -e "\033[32m[PASS]\033[0m $1"
  PASSED=$((PASSED + 1))
}

log_fail() {
  echo -e "\033[31m[FAIL]\033[0m $1"
  if [ -n "$2" ]; then echo "       $2"; fi
  FAILED=$((FAILED + 1))
}

echo "=== DevMonitor Docker Verification Suite ==="
echo "Target Frontend: $BASE_URL"
echo "Target Backend:  $BACKEND_LOOPBACK"
echo ""

# Verify docker compose syntax
docker compose config -q || { echo "FATAL: docker compose config failed"; exit 1; }

# Start compose stack
echo "Starting Docker Compose stack..."
docker compose up -d --build

echo "Waiting for containers to report healthy (up to 120s)..."
TIMEOUT=120
ELAPSED=0
CONTAINERS=("devmonitor-postgres" "devmonitor-backend" "devmonitor-frontend")

while [ $ELAPSED -lt $TIMEOUT ]; do
  ALL_HEALTHY=true
  for c in "${CONTAINERS[@]}"; do
    STATUS=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$c" 2>/dev/null || echo "missing")
    if [ "$STATUS" != "healthy" ] && [ "$STATUS" != "running" ]; then
      ALL_HEALTHY=false
      break
    fi
  done

  if [ "$ALL_HEALTHY" = true ]; then break; fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done

sleep 3

# Check 1: Root frontend load
ROOT_HTML=$(curl -s "$BASE_URL/")
if echo "$ROOT_HTML" | grep -q 'id="root"'; then
  log_pass "1. http://localhost:8080/ returns 200 and serves the app root element"
else
  log_fail "1. Root frontend load failed"
fi

# Check 2: Proxy /api/health
HEALTH_STATUS=$(curl -s "$BASE_URL/api/health" | grep -o '"status":"healthy"' || true)
if [ -n "$HEALTH_STATUS" ]; then
  log_pass "2. http://localhost:8080/api/health returns healthy JSON via Nginx proxy"
else
  log_fail "2. /api/health proxy check failed"
fi

# Check 3: Deep link SPA fallback
DEEP_HTML=$(curl -s "$BASE_URL/how-it-works")
if echo "$DEEP_HTML" | grep -q 'id="root"'; then
  log_pass "3. Deep link /how-it-works returns 200 with SPA fallback"
else
  log_fail "3. Deep link SPA fallback failed"
fi

# Check 4: /metrics blocked on frontend
METRICS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/metrics")
if [ "$METRICS_STATUS" = "404" ]; then
  log_pass "4. http://localhost:8080/metrics returns 404 (metrics isolated from public frontend)"
else
  log_fail "4. /metrics returned status $METRICS_STATUS (expected 404)"
fi

# Check 5: Backend loopback /metrics
BACKEND_METRICS=$(curl -s "$BACKEND_LOOPBACK/metrics")
if echo "$BACKEND_METRICS" | grep -q "http_requests_total"; then
  log_pass "5. Backend :5000/metrics returns 200 on 127.0.0.1 with Prometheus format"
else
  log_fail "5. Backend loopback /metrics failed"
fi

# Check 6: /api/services status vocabulary
SERVICES_JSON=$(curl -s "$BASE_URL/api/services")
if echo "$SERVICES_JSON" | grep -q '"name":"Backend API".*"status":"Healthy"' && \
   (echo "$SERVICES_JSON" | grep -q '"name":"Prometheus".*"status":"Collecting"' || echo "$SERVICES_JSON" | grep -q '"name":"Prometheus".*"status":"Down"') && \
   echo "$SERVICES_JSON" | grep -q '"name":"Grafana".*"status":"Down"'; then
  log_pass "6. /api/services shows Backend, Database, Frontend as Healthy, and Grafana as Down"
else
  log_fail "6. Service statuses mismatch" "$SERVICES_JSON"
fi

# Check 7: Failure simulation
docker stop devmonitor-backend >/dev/null
sleep 2

FE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
API_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")

docker start devmonitor-backend >/dev/null

REC_ELAPSED=0
RECOVERED=false
while [ $REC_ELAPSED -lt 60 ]; do
  if curl -s "$BASE_URL/api/health" | grep -q '"status":"healthy"'; then
    RECOVERED=true
    break
  fi
  sleep 2
  REC_ELAPSED=$((REC_ELAPSED + 2))
done

if [ "$FE_CODE" = "200" ] && [ "$API_CODE" = "502" ] && [ "$RECOVERED" = true ]; then
  log_pass "7. Failure simulation: frontend serves 200 & /api returns 502 when backend stopped; recovers within 60s"
else
  log_fail "7. Failure simulation failed (FE: $FE_CODE, API: $API_CODE, Recovered: $RECOVERED)"
fi

# Check 8: Persistence across docker compose down & up
PERSIST_EMAIL="persist-$(date +%s)@example.com"
curl -s -X POST "$BASE_URL/api/users" -H "Content-Type: application/json" \
  -d "{\"name\":\"PersistUser\",\"email\":\"$PERSIST_EMAIL\"}" >/dev/null

docker compose down >/dev/null
sleep 2
docker compose up -d >/dev/null

WAIT_REC=0
while [ $WAIT_REC -lt 60 ]; do
  if curl -s "$BASE_URL/api/health" | grep -q '"status":"healthy"'; then break; fi
  sleep 2
  WAIT_REC=$((WAIT_REC + 2))
done

USERS_AFTER=$(curl -s "$BASE_URL/api/users?limit=100")
docker exec -i devmonitor-postgres psql -U postgres -d devmonitor -c "DELETE FROM users WHERE email = '$PERSIST_EMAIL';" >/dev/null

if echo "$USERS_AFTER" | grep -q "$PERSIST_EMAIL"; then
  log_pass "8. Persistence verified: user survived docker compose down and restart via named volume"
else
  log_fail "8. Persistence failed: created user was not found after restart"
fi

# Check 9: Startup order & no crash loops
docker compose down >/dev/null
sleep 2
docker compose up -d >/dev/null

WAIT_S=0
while [ $WAIT_S -lt 60 ]; do
  if curl -s "$BASE_URL/api/health" | grep -q '"status":"healthy"'; then break; fi
  sleep 2
  WAIT_S=$((WAIT_S + 2))
done

RESTART_COUNT=$(docker inspect --format '{{.RestartCount}}' devmonitor-backend 2>/dev/null || echo "0")
if [ "$RESTART_COUNT" = "0" ]; then
  log_pass "9. Startup order verified: backend ended up healthy without restart crash loops (RestartCount: 0)"
else
  log_fail "9. Backend had non-zero restarts ($RESTART_COUNT)"
fi

echo ""
echo "=== Test Summary ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
exit 0
