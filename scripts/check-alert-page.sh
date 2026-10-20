#!/usr/bin/env bash
# scripts/check-alert-page.sh
# ==============================================================================
# DevMonitor: Alert Receiver Page & Nginx Proxy Verification Suite (Bash)
# ==============================================================================

set -euo pipefail
export MSYS_NO_PATHCONV=1

BASE_URL="${BASE_URL:-http://localhost:8080}"
ALERTMANAGER_URL="${ALERTMANAGER_URL:-http://127.0.0.1:9093}"
RECEIVER_DIRECT_URL="${RECEIVER_DIRECT_URL:-http://127.0.0.1:8025}"

SKIP_SLOW=0
for arg in "$@"; do
  case "$arg" in
    --skip-slow|-s)
      SKIP_SLOW=1
      ;;
  esac
done

PASSED=0
SKIPPED=0
FAILED=0

log_pass() {
  echo -e "\033[0;32m[PASS] $1\033[0m"
  PASSED=$((PASSED + 1))
}

log_skip() {
  echo -e "\033[0;33m[SKIP] $1\033[0m"
  SKIPPED=$((SKIPPED + 1))
}

log_fail() {
  echo -e "\033[0;31m[FAIL] $1\033[0m"
  if [ -n "${2:-}" ]; then
    echo -e "       \033[0;31m$2\033[0m"
  fi
  FAILED=$((FAILED + 1))
}

cleanup() {
  docker start devmonitor-backend >/dev/null 2>&1 || true
  docker start devmonitor-alert-receiver >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "=== DevMonitor Alert Receiver Page Verification Suite ==="
echo "Frontend Base URL:   $BASE_URL"
echo "Alertmanager URL:    $ALERTMANAGER_URL"
echo "Direct Receiver URL: $RECEIVER_DIRECT_URL"
echo -e "Mode:                $([ "$SKIP_SLOW" -eq 1 ] && echo "Fast (--skip-slow)" || echo "Full (with slow backend down soak)")\n"

# ------------------------------------------------------------------------------
# Step 1: Compose config & 8 healthy containers
# ------------------------------------------------------------------------------
echo "--- Step 1: Validating Compose config and verifying 8 containers ---"
if ! docker compose config -q; then
  log_fail "1. docker compose config -q failed"
  exit 1
fi

docker compose up -d --build >/dev/null 2>&1

CONTAINERS=(
  devmonitor-postgres
  devmonitor-backend
  devmonitor-frontend
  devmonitor-prometheus
  devmonitor-node-exporter
  devmonitor-grafana
  devmonitor-alert-receiver
  devmonitor-alertmanager
)

ALL_HEALTHY=0
for _ in $(seq 1 50); do
  COUNT=0
  for c in "${CONTAINERS[@]}"; do
    STATUS=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$c" 2>/dev/null || echo "down")
    if [ "$STATUS" = "healthy" ] || [ "$STATUS" = "running" ]; then
      COUNT=$((COUNT + 1))
    fi
  done
  if [ "$COUNT" -eq 8 ]; then
    ALL_HEALTHY=1
    break
  fi
  sleep 3
done

if [ "$ALL_HEALTHY" -eq 1 ]; then
  log_pass "1. All 8 containers are running and healthy"
else
  log_fail "1. Timeout waiting for all 8 containers to become healthy"
fi

# ------------------------------------------------------------------------------
# Step 2: GET /receiver/alerts proxy
# ------------------------------------------------------------------------------
echo -e "\n--- Step 2: Testing GET /receiver/alerts through Nginx proxy ---"
if curl -s -f "$BASE_URL/receiver/alerts" | grep -q '^\['; then
  log_pass "2. GET $BASE_URL/receiver/alerts returned 200 with JSON array"
else
  log_fail "2. GET $BASE_URL/receiver/alerts did not return array JSON"
fi

# ------------------------------------------------------------------------------
# Step 3: Method and path restrictions
# ------------------------------------------------------------------------------
echo -e "\n--- Step 3: Verifying Nginx method and path restrictions ---"
POST_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/receiver/alerts" || true)
CLEAR_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/receiver/clear" || true)
WEBHOOK_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/receiver/webhook" || true)
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/receiver/health" || true)
ROOT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/receiver/" || true)
POST_CLEAR_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/receiver/clear" || true)

POST_BLOCKED=0
if [ "$POST_CODE" = "403" ] || [ "$POST_CODE" = "405" ]; then
  POST_BLOCKED=1
fi

RESTRICTED_404=0
if [ "$CLEAR_CODE" = "404" ] && [ "$WEBHOOK_CODE" = "404" ] && [ "$HEALTH_CODE" = "404" ] && [ "$ROOT_CODE" = "404" ]; then
  RESTRICTED_404=1
fi

if [ "$POST_BLOCKED" -eq 1 ] && [ "$RESTRICTED_404" -eq 1 ]; then
  log_pass "3. Method and path restrictions verified: POST /receiver/alerts returned $POST_CODE; /receiver/{clear,webhook,health,''} returned 404"
else
  log_fail "3. Path/method restriction violation" "POST /alerts: $POST_CODE, clear: $CLEAR_CODE, webhook: $WEBHOOK_CODE, health: $HEALTH_CODE, root: $ROOT_CODE, postClear: $POST_CLEAR_CODE"
fi

# ------------------------------------------------------------------------------
# Step 4: SPA deep link /alert-receiver
# ------------------------------------------------------------------------------
echo -e "\n--- Step 4: Verifying SPA deep link /alert-receiver ---"
SPA_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/alert-receiver" || true)
if [ "$SPA_CODE" = "200" ] && curl -s "$BASE_URL/alert-receiver" | grep -q 'DevMonitor'; then
  log_pass "4. GET $BASE_URL/alert-receiver returned 200 with SPA HTML"
else
  log_fail "4. GET $BASE_URL/alert-receiver failed" "Code: $SPA_CODE"
fi

# ------------------------------------------------------------------------------
# Step 5: Pipeline test with synthetic alert (<script> plain text check)
# ------------------------------------------------------------------------------
echo -e "\n--- Step 5: Testing alert pipeline with synthetic alert and script tag ---"
TEST_ID="bash-test-$RANDOM"
NOW_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PAYLOAD="[{
  \"labels\": { \"alertname\": \"$TEST_ID\", \"severity\": \"warning\", \"instance\": \"test-host:8080\" },
  \"annotations\": { \"summary\": \"<script>alert(1)</script>\", \"description\": \"Pipeline check\", \"action\": \"None\" },
  \"startsAt\": \"$NOW_ISO\",
  \"endsAt\": \"2099-01-01T00:00:00Z\"
}]"

curl -s -X POST -H "Content-Type: application/json" -d "$PAYLOAD" "$ALERTMANAGER_URL/api/v2/alerts" >/dev/null

FOUND_SYNTHETIC=0
for _ in $(seq 1 30); do
  if curl -s "$BASE_URL/receiver/alerts" | grep -q "\"alertname\": *\"$TEST_ID\""; then
    FOUND_SYNTHETIC=1
    break
  fi
  sleep 2
done

if [ "$FOUND_SYNTHETIC" -eq 1 ]; then
  # Verify <script> tag remains intact in the JSON
  if curl -s "$BASE_URL/receiver/alerts" | grep -q "<script>alert(1)</script>"; then
    # Send resolved alert
    RESOLVED_PAYLOAD="[{
      \"labels\": { \"alertname\": \"$TEST_ID\", \"severity\": \"warning\", \"instance\": \"test-host:8080\" },
      \"annotations\": { \"summary\": \"<script>alert(1)</script>\", \"description\": \"Pipeline check\", \"action\": \"None\" },
      \"startsAt\": \"$NOW_ISO\",
      \"endsAt\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"
    }]"
    curl -s -X POST -H "Content-Type: application/json" -d "$RESOLVED_PAYLOAD" "$ALERTMANAGER_URL/api/v2/alerts" >/dev/null

    FOUND_RESOLVED=0
    for _ in $(seq 1 45); do
      if curl -s "$BASE_URL/receiver/alerts" | grep -B 2 -A 2 "\"alertname\": *\"$TEST_ID\"" | grep -q '"status": *"resolved"'; then
        FOUND_RESOLVED=1
        break
      fi
      sleep 2
    done

    if [ "$FOUND_RESOLVED" -eq 1 ]; then
      log_pass "5. Pipeline test passed: synthetic firing alert with <script> tag arrived via Nginx proxy, plain text was preserved, and resolved alert arrived"
    else
      log_fail "5. Resolved synthetic alert did not arrive within timeout"
    fi
  else
    log_fail "5. Synthetic alert arrived but script tag was corrupted"
  fi
else
  log_fail "5. Synthetic alert did not arrive within 60s"
fi

# ------------------------------------------------------------------------------
# Step 6: Independence from backend container
# ------------------------------------------------------------------------------
echo -e "\n--- Step 6: Verifying independence from backend container ---"
docker stop devmonitor-backend >/dev/null
sleep 2

BACKEND_DOWN_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" || true)
RECEIVER_UP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/receiver/alerts" || true)

if { [ "$BACKEND_DOWN_CODE" = "502" ] || [ "$BACKEND_DOWN_CODE" = "504" ]; } && [ "$RECEIVER_UP_CODE" = "200" ]; then
  log_pass "6a. Backend independence confirmed: /api/health returned $BACKEND_DOWN_CODE while /receiver/alerts returned 200"
else
  log_fail "6a. Backend independence failed: /api/health returned $BACKEND_DOWN_CODE, /receiver/alerts returned $RECEIVER_UP_CODE"
fi

if [ "$SKIP_SLOW" -eq 1 ]; then
  log_skip "6b. Real BackendDown soak test skipped (--skip-slow flag supplied)"
  docker start devmonitor-backend >/dev/null
else
  echo "Waiting for REAL BackendDown alert to fire while backend remains stopped (approx 90-120s)..."
  BD_FIRED=0
  for _ in $(seq 1 36); do
    if curl -s "$BASE_URL/receiver/alerts" | grep -q '"alertname": *"BackendDown"'; then
      BD_FIRED=1
      break
    fi
    sleep 5
  done

  if [ "$BD_FIRED" -eq 1 ]; then
    echo "Real BackendDown alert captured via proxy while backend DOWN!"
    docker start devmonitor-backend >/dev/null

    BD_RESOLVED=0
    for _ in $(seq 1 48); do
      if curl -s "$BASE_URL/receiver/alerts" | grep -B 2 -A 2 '"alertname": *"BackendDown"' | grep -q '"status": *"resolved"'; then
        BD_RESOLVED=1
        break
      fi
      sleep 5
    done

    if [ "$BD_RESOLVED" -eq 1 ]; then
      log_pass "6b. Real BackendDown verified: appeared firing via Nginx proxy while backend DOWN; resolved after restart"
    else
      log_fail "6b. BackendDown did not resolve within timeout"
    fi
  else
    log_fail "6b. Real BackendDown alert did not fire within timeout"
    docker start devmonitor-backend >/dev/null
  fi
fi

# ------------------------------------------------------------------------------
# Step 7: Receiver outage resilience
# ------------------------------------------------------------------------------
echo -e "\n--- Step 7: Verifying resilience during alert-receiver outage ---"
docker stop devmonitor-alert-receiver >/dev/null
sleep 2

REC_DOWN_CODE=$(curl -s -m 5 -o /dev/null -w "%{http_code}" "$BASE_URL/receiver/alerts" || true)
FE_SURVIVES_CODE=$(curl -s -m 5 -o /dev/null -w "%{http_code}" "$BASE_URL/" || true)
RESTART_COUNT=$(docker inspect --format '{{.RestartCount}}' devmonitor-frontend 2>/dev/null || echo "0")

docker start devmonitor-alert-receiver >/dev/null

RECOVERED=0
for _ in $(seq 1 30); do
  if [ "$(curl -s -m 3 -o /dev/null -w "%{http_code}" "$BASE_URL/receiver/alerts" || true)" = "200" ]; then
    RECOVERED=1
    break
  fi
  sleep 2
done

if [ "$REC_DOWN_CODE" != "200" ] && [ "$FE_SURVIVES_CODE" = "200" ] && [ "$RESTART_COUNT" = "0" ] && [ "$RECOVERED" -eq 1 ]; then
  log_pass "7. Receiver outage verified: /receiver/alerts returned $REC_DOWN_CODE when receiver stopped; frontend root returned 200 with restartCount=0; recovered to 200 within 60s"
else
  log_fail "7. Receiver outage check failed" "DownCode: $REC_DOWN_CODE, FeRoot: $FE_SURVIVES_CODE, RestartCount: $RESTART_COUNT, Recovered: $RECOVERED"
fi

echo -e "\n=== Test Summary ==="
echo "Passed:  $PASSED"
echo "Skipped: $SKIPPED"
echo "Failed:  $FAILED"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
exit 0
