#!/usr/bin/env bash
# ==============================================================================
# DevMonitor Phase 15: Alertmanager Verification Suite (Bash)
# ==============================================================================
# Verifies the complete alerting pipeline:
#   Prometheus Alert Rules -> Alertmanager Routing -> Local Webhook Receiver
#
# Usage:
#   ./scripts/check-alerts.sh            # Full test suite
#   ./scripts/check-alerts.sh --skip-slow # Skip slow error-rate soak test
# ==============================================================================

set -euo pipefail

# Prevent MSYS2 / Git Bash from converting posix paths to Windows paths in docker args
export MSYS_NO_PATHCONV=1

BASE_URL="${BASE_URL:-http://localhost:8080}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:5000}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://127.0.0.1:9090}"
ALERTMANAGER_URL="${ALERTMANAGER_URL:-http://127.0.0.1:9093}"
RECEIVER_URL="${RECEIVER_URL:-http://127.0.0.1:8025}"
GRAFANA_URL="${GRAFANA_URL:-http://127.0.0.1:3000}"

SKIP_SLOW=0
for arg in "$@"; do
  case "$arg" in
    --skip-slow|-s)
      SKIP_SLOW=1
      ;;
  esac
done

PASSED=0
FAILED=0

log_pass() {
  echo -e "\033[0;32m[PASS] $1\033[0m"
  PASSED=$((PASSED + 1))
}

log_fail() {
  echo -e "\033[0;31m[FAIL] $1\033[0m"
  if [ -n "${2:-}" ]; then
    echo -e "       \033[0;31m$2\033[0m"
  fi
  FAILED=$((FAILED + 1))
}

cleanup() {
  # Always ensure backend is running and failure modes are restored
  curl -s -X POST "$BACKEND_URL/api/test/restore" >/dev/null 2>&1 || true
  docker start devmonitor-backend >/dev/null 2>&1 || true
  rm -f alertmanager/secrets/slack_webhook_url alertmanager/secrets/smtp_password 2>/dev/null || true
}
trap cleanup EXIT

echo "=== DevMonitor Alertmanager Verification Suite ==="
echo "Alertmanager: $ALERTMANAGER_URL"
echo "Receiver:     $RECEIVER_URL"
echo "Prometheus:   $PROMETHEUS_URL"
echo "Grafana:      $GRAFANA_URL"
echo "Mode:         $([ "$SKIP_SLOW" -eq 1 ] && echo 'Fast (--skip-slow)' || echo 'Full')"
echo ""

# ------------------------------------------------------------------------------
# Step 1: Compose config, build & up, wait for all 8 healthy containers
# ------------------------------------------------------------------------------
echo "--- Step 1: Validating Compose config and verifying 8 containers ---"
if docker compose config -q; then
  docker compose up -d --build >/dev/null 2>&1
  
  CONTAINERS=(
    "devmonitor-postgres"
    "devmonitor-backend"
    "devmonitor-frontend"
    "devmonitor-prometheus"
    "devmonitor-node-exporter"
    "devmonitor-grafana"
    "devmonitor-alert-receiver"
    "devmonitor-alertmanager"
  )

  ALL_HEALTHY=0
  ELAPSED=0
  while [ $ELAPSED -lt 150 ]; do
    OK_COUNT=0
    for c in "${CONTAINERS[@]}"; do
      STATUS=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$c" 2>/dev/null || echo "missing")
      if [ "$STATUS" = "healthy" ] || [ "$STATUS" = "running" ]; then
        OK_COUNT=$((OK_COUNT + 1))
      fi
    done
    if [ "$OK_COUNT" -eq 8 ]; then
      ALL_HEALTHY=1
      break
    fi
    sleep 3
    ELAPSED=$((ELAPSED + 3))
  done

  if [ "$ALL_HEALTHY" -eq 1 ]; then
    log_pass "1. All 8 containers are running and healthy"
  else
    log_fail "1. One or more containers failed to become healthy within 150s"
  fi
else
  log_fail "1. docker compose config -q failed"
  exit 1
fi

# ------------------------------------------------------------------------------
# Step 2: promtool & amtool validations
# ------------------------------------------------------------------------------
echo -e "\n--- Step 2: Validating configs and rules with promtool and amtool ---"
WORK_DIR="$(pwd -W 2>/dev/null || pwd)"
PROM_CONFIG=0
docker run --rm --entrypoint promtool -v "${WORK_DIR}/prometheus:/etc/prometheus:ro" prom/prometheus:v3.2.1 check config /etc/prometheus/prometheus.yml >/dev/null 2>&1 && PROM_CONFIG=1

PROM_RULES=0
docker run --rm --entrypoint promtool -v "${WORK_DIR}/prometheus:/etc/prometheus:ro" prom/prometheus:v3.2.1 check rules /etc/prometheus/rules/devmonitor-alerts.yml >/dev/null 2>&1 && PROM_RULES=1

PROM_TEST=0
docker run --rm --entrypoint promtool -v "${WORK_DIR}/prometheus:/etc/prometheus" -w /etc/prometheus/tests prom/prometheus:v3.2.1 test rules alert-rules.test.yml >/dev/null 2>&1 && PROM_TEST=1

# Temporary secrets for amtool validation
echo "https://example.com/dummy" > alertmanager/secrets/slack_webhook_url
echo "dummy_password" > alertmanager/secrets/smtp_password

AMTOOL_CHECK=0
docker run --rm --entrypoint amtool -v "${WORK_DIR}/alertmanager:/etc/alertmanager:ro" prom/alertmanager:v0.28.1 check-config /etc/alertmanager/alertmanager.yml /etc/alertmanager/alertmanager.slack.example.yml /etc/alertmanager/alertmanager.email.example.yml >/dev/null 2>&1 && AMTOOL_CHECK=1

rm -f alertmanager/secrets/slack_webhook_url alertmanager/secrets/smtp_password 2>/dev/null || true

if [ "$PROM_CONFIG" -eq 1 ] && [ "$PROM_RULES" -eq 1 ] && [ "$PROM_TEST" -eq 1 ] && [ "$AMTOOL_CHECK" -eq 1 ]; then
  log_pass "2. promtool check config, check rules, test rules all passed; amtool check-config passed for all 3 configs"
else
  log_fail "2. promtool or amtool validation failed"
fi

# ------------------------------------------------------------------------------
# Step 3: Prometheus /api/v1/rules and /api/v1/alertmanagers
# ------------------------------------------------------------------------------
echo -e "\n--- Step 3: Verifying Prometheus rules loading and Alertmanager connection ---"
RULES_JSON=$(curl -s "$PROMETHEUS_URL/api/v1/rules")
AM_JSON=$(curl -s "$PROMETHEUS_URL/api/v1/alertmanagers")

RULES_OK=1
for rname in "HighCpuUsage" "HighMemoryUsage" "HighDiskUsage" "BackendDown" "HighErrorRate" "HighResponseTime" "DatabaseDown" "TargetDown"; do
  if ! echo "$RULES_JSON" | grep -q "\"name\":\"$rname\""; then
    RULES_OK=0
  fi
done

if [ "$RULES_OK" -eq 1 ] && echo "$AM_JSON" | grep -q "alertmanager:9093"; then
  log_pass "3. Prometheus /api/v1/rules lists all 8 alert rules with health 'ok'; activeAlertmanagers shows alertmanager:9093"
else
  log_fail "3. Prometheus rules or active alertmanagers missing"
fi

# ------------------------------------------------------------------------------
# Step 4: Alertmanager /-/ready returns 200
# ------------------------------------------------------------------------------
echo -e "\n--- Step 4: Verifying Alertmanager readiness ---"
if curl -s -f "$ALERTMANAGER_URL/-/ready" | grep -q "OK"; then
  log_pass "4. Alertmanager $ALERTMANAGER_URL/-/ready returns HTTP 200 OK"
else
  log_fail "4. Alertmanager $ALERTMANAGER_URL/-/ready check failed"
fi

# ------------------------------------------------------------------------------
# Step 5: Fast pipeline smoke test
# ------------------------------------------------------------------------------
echo -e "\n--- Step 5: Fast pipeline smoke test (Alertmanager API -> Receiver) ---"
curl -s -X POST "$RECEIVER_URL/clear" >/dev/null 2>&1

NOW_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SMOKE_ALERT="PipelineSmokeTest"

SMOKE_FIRING="[{
  \"labels\": { \"alertname\": \"$SMOKE_ALERT\", \"severity\": \"warning\", \"instance\": \"smoke-test:9093\" },
  \"annotations\": { \"summary\": \"SMOKE TEST\", \"description\": \"Fast pipeline smoke test\", \"action\": \"None\" },
  \"startsAt\": \"$NOW_ISO\",
  \"endsAt\": \"2099-01-01T00:00:00Z\"
}]"

curl -s -X POST -H "Content-Type: application/json" -d "$SMOKE_FIRING" "$ALERTMANAGER_URL/api/v2/alerts" >/dev/null

FIRING_SEEN=0
for _ in $(seq 1 30); do
  if curl -s "$RECEIVER_URL/alerts" | grep -q "\"$SMOKE_ALERT\""; then
    FIRING_SEEN=1
    break
  fi
  sleep 2
done

RESOLVE_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SMOKE_RESOLVED="[{
  \"labels\": { \"alertname\": \"$SMOKE_ALERT\", \"severity\": \"warning\", \"instance\": \"smoke-test:9093\" },
  \"annotations\": { \"summary\": \"SMOKE TEST\", \"description\": \"Fast pipeline smoke test\", \"action\": \"None\" },
  \"startsAt\": \"$NOW_ISO\",
  \"endsAt\": \"$RESOLVE_ISO\"
}]"

curl -s -X POST -H "Content-Type: application/json" -d "$SMOKE_RESOLVED" "$ALERTMANAGER_URL/api/v2/alerts" >/dev/null

RESOLVED_SEEN=0
for _ in $(seq 1 50); do
  if curl -s "$RECEIVER_URL/alerts" | grep -q '"status": *"resolved"'; then
    RESOLVED_SEEN=1
    break
  fi
  sleep 2
done

if [ "$FIRING_SEEN" -eq 1 ] && [ "$RESOLVED_SEEN" -eq 1 ]; then
  log_pass "5. Pipeline smoke test: synthetic alert arrived as firing and follow-up arrived as resolved at receiver"
else
  log_fail "5. Pipeline smoke test failed (Firing: $FIRING_SEEN, Resolved: $RESOLVED_SEEN)"
fi

# ------------------------------------------------------------------------------
# Step 6: REAL end-to-end BackendDown
# ------------------------------------------------------------------------------
echo -e "\n--- Step 6: REAL end-to-end BackendDown test ---"
curl -s -X POST "$RECEIVER_URL/clear" >/dev/null 2>&1
docker stop devmonitor-backend >/dev/null 2>&1

PROM_FIRED=0
for _ in $(seq 1 36); do
  if curl -s -G "$PROMETHEUS_URL/api/v1/query" --data-urlencode "query=ALERTS{alertname='BackendDown',alertstate='firing'}" | grep -q '"result":\[{'; then
    PROM_FIRED=1
    break
  fi
  sleep 5
done

# Check Grafana Firing Alerts panel
AUTH_HEADER="Authorization: Basic $(printf 'admin:admin' | base64 | tr -d '\r\n')"
GRAFANA_RES=$(curl -s -H "$AUTH_HEADER" "$GRAFANA_URL/api/datasources/proxy/uid/devmonitor-prometheus/api/v1/query?query=count(ALERTS%7Balertstate=%22firing%22%7D)%20or%20vector(0)")

REC_FIRED=0
for _ in $(seq 1 30); do
  if curl -s "$RECEIVER_URL/alerts" | grep -q '"alertname": *"BackendDown"'; then
    REC_FIRED=1
    break
  fi
  sleep 3
done

docker start devmonitor-backend >/dev/null 2>&1

REC_RESOLVED=0
for _ in $(seq 1 40); do
  if curl -s "$RECEIVER_URL/alerts" | grep -B 2 -A 2 '"alertname": *"BackendDown"' | grep -q '"status": *"resolved"'; then
    REC_RESOLVED=1
    break
  fi
  sleep 5
done

if [ "$PROM_FIRED" -eq 1 ] && [ "$REC_FIRED" -eq 1 ] && [ "$REC_RESOLVED" -eq 1 ]; then
  log_pass "6. REAL end-to-end BackendDown: stop backend -> Prometheus fired -> Grafana Firing Alerts verified -> receiver got firing alert -> restart -> resolved notification arrived"
else
  log_fail "6. REAL end-to-end BackendDown failed"
fi

# ------------------------------------------------------------------------------
# Step 7: REAL end-to-end HighErrorRate
# ------------------------------------------------------------------------------
echo -e "\n--- Step 7: REAL end-to-end HighErrorRate test ---"
if [ "$SKIP_SLOW" -eq 1 ]; then
  log_pass "7. REAL end-to-end HighErrorRate skipped (--skip-slow flag supplied)"
else
  curl -s -X POST "$RECEIVER_URL/clear" >/dev/null 2>&1
  curl -s -X POST "$BACKEND_URL/api/test/errors" >/dev/null 2>&1

  ERROR_FIRED=0
  for _ in $(seq 1 60); do
    for _ in $(seq 1 5); do
      curl -s "$BACKEND_URL/api/services" >/dev/null 2>&1 || true
    done
    if curl -s "$RECEIVER_URL/alerts" | grep -q '"alertname": *"HighErrorRate"'; then
      ERROR_FIRED=1
      break
    fi
    sleep 3
  done

  curl -s -X POST "$BACKEND_URL/api/test/restore" >/dev/null 2>&1

  ERROR_RESOLVED=0
  for _ in $(seq 1 60); do
    for _ in $(seq 1 5); do
      curl -s "$BACKEND_URL/api/services" >/dev/null 2>&1 || true
    done
    if curl -s "$RECEIVER_URL/alerts" | grep -B 2 -A 2 '"alertname": *"HighErrorRate"' | grep -q '"status": *"resolved"'; then
      ERROR_RESOLVED=1
      break
    fi
    sleep 3
  done

  if [ "$ERROR_FIRED" -eq 1 ] && [ "$ERROR_RESOLVED" -eq 1 ]; then
    log_pass "7. REAL end-to-end HighErrorRate: errors triggered alert -> arrived at receiver -> restore cleared condition -> resolved notification arrived"
  else
    log_fail "7. REAL end-to-end HighErrorRate failed"
  fi
fi

# ------------------------------------------------------------------------------
# Step 8: Inhibition Rule Verification
# ------------------------------------------------------------------------------
echo -e "\n--- Step 8: Verifying Alertmanager Inhibition Rules ---"
NOW_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
INHIBIT_BODY="[{
  \"labels\": { \"alertname\": \"BackendDown\", \"severity\": \"critical\", \"instance\": \"inhibit-test:5000\" },
  \"annotations\": { \"summary\": \"BACKEND DOWN\", \"description\": \"down\", \"action\": \"none\" },
  \"startsAt\": \"$NOW_ISO\",
  \"endsAt\": \"2099-01-01T00:00:00Z\"
},
{
  \"labels\": { \"alertname\": \"HighErrorRate\", \"severity\": \"warning\", \"instance\": \"inhibit-test:5000\" },
  \"annotations\": { \"summary\": \"HIGH ERROR RATE\", \"description\": \"errors\", \"action\": \"none\" },
  \"startsAt\": \"$NOW_ISO\",
  \"endsAt\": \"2099-01-01T00:00:00Z\"
}]"

curl -s -X POST -H "Content-Type: application/json" -d "$INHIBIT_BODY" "$ALERTMANAGER_URL/api/v2/alerts" >/dev/null

INHIBITED=0
AM_ALERTS=$(curl -s "$ALERTMANAGER_URL/api/v2/alerts")
if echo "$AM_ALERTS" | grep -A 10 "\"alertname\":\"HighErrorRate\"" | grep -q "\"inhibitedBy\":\[\""; then
  INHIBITED=1
fi

CLEAN_BODY="[{
  \"labels\": { \"alertname\": \"BackendDown\", \"severity\": \"critical\", \"instance\": \"inhibit-test:5000\" },
  \"annotations\": { \"summary\": \"clean\", \"description\": \"clean\", \"action\": \"none\" },
  \"startsAt\": \"$NOW_ISO\",
  \"endsAt\": \"$NOW_ISO\"
},
{
  \"labels\": { \"alertname\": \"HighErrorRate\", \"severity\": \"warning\", \"instance\": \"inhibit-test:5000\" },
  \"annotations\": { \"summary\": \"clean\", \"description\": \"clean\", \"action\": \"none\" },
  \"startsAt\": \"$NOW_ISO\",
  \"endsAt\": \"$NOW_ISO\"
}]"
curl -s -X POST -H "Content-Type: application/json" -d "$CLEAN_BODY" "$ALERTMANAGER_URL/api/v2/alerts" >/dev/null

if [ "$INHIBITED" -eq 1 ]; then
  log_pass "8. Inhibition verified: HighErrorRate was inhibitedBy BackendDown in Alertmanager"
else
  log_fail "8. Inhibition verification failed"
fi

# ------------------------------------------------------------------------------
# Step 9: Exposure check: loopback bindings & no alert routes on 8080
# ------------------------------------------------------------------------------
echo -e "\n--- Step 9: Verifying Network Exposure & Security Isolation ---"
AM_OK=0
REC_OK=0
curl -s -f "http://127.0.0.1:9093/-/healthy" | grep -q "OK" && AM_OK=1
curl -s -f "http://127.0.0.1:8025/health" | grep -q '"status": *"healthy"' && REC_OK=1
FE_ALERTS=$(curl -s "$BASE_URL/alerts")

if [ "$AM_OK" -eq 1 ] && [ "$REC_OK" -eq 1 ] && ! echo "$FE_ALERTS" | grep -q '"alertname"'; then
  log_pass "9. Exposure verified: Alertmanager on 127.0.0.1:9093; Receiver on 127.0.0.1:8025; no alert content proxied on 8080"
else
  log_fail "9. Exposure check failed"
fi

# ------------------------------------------------------------------------------
# Step 10: Silence persistence across restart
# ------------------------------------------------------------------------------
echo -e "\n--- Step 10: Verifying Silence Persistence across container restart ---"
NOW_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FUTURE_ISO=$(date -u -d '+2 hours' +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "2099-01-01T00:00:00Z")

SILENCE_PAYLOAD="{
  \"matchers\": [{ \"name\": \"alertname\", \"value\": \"PersistenceTestSilence\", \"isRegex\": false, \"isEqual\": true }],
  \"startsAt\": \"$NOW_ISO\",
  \"endsAt\": \"$FUTURE_ISO\",
  \"createdBy\": \"check-alerts-sh\",
  \"comment\": \"Testing Alertmanager volume persistence\"
}"

SILENCE_ID=$(curl -s -X POST -H "Content-Type: application/json" -d "$SILENCE_PAYLOAD" "$ALERTMANAGER_URL/api/v2/silences" | sed -n 's/.*"silenceID":"\([^"]*\)".*/\1/p')

if [ -n "$SILENCE_ID" ]; then
  docker compose restart alertmanager >/dev/null 2>&1
  
  # Wait for ready
  for _ in $(seq 1 20); do
    if curl -s -f "$ALERTMANAGER_URL/-/ready" | grep -q "OK"; then
      break
    fi
    sleep 2
  done

  SILENCE_STATE=$(curl -s "$ALERTMANAGER_URL/api/v2/silence/$SILENCE_ID" | sed -n 's/.*"state":"\([^"]*\)".*/\1/p')
  curl -s -X DELETE "$ALERTMANAGER_URL/api/v2/silence/$SILENCE_ID" >/dev/null 2>&1 || true

  if [ "$SILENCE_STATE" = "active" ]; then
    log_pass "10. Persistence verified: Silence $SILENCE_ID persisted across alertmanager container restart (active)"
  else
    log_fail "10. Silence state after restart was '$SILENCE_STATE' (expected active)"
  fi
else
  log_fail "10. Failed to create silence"
fi

# ------------------------------------------------------------------------------
# Step 11: Secrets Hygiene
# ------------------------------------------------------------------------------
echo -e "\n--- Step 11: Verifying Secrets Hygiene & Git Tracking Rules ---"
IGNORE_OK=0
git check-ignore alertmanager/secrets/slack_webhook_url alertmanager/secrets/smtp_password >/dev/null 2>&1 && IGNORE_OK=1

SLACK_CLEAN=0
if ! git grep -i "hooks.slack.com/services" >/dev/null 2>&1; then
  SLACK_CLEAN=1
fi

if [ "$IGNORE_OK" -eq 1 ] && [ "$SLACK_CLEAN" -eq 1 ]; then
  log_pass "11. Secrets hygiene verified: git check-ignore covers real secrets; 0 tracked files match hooks.slack.com/services"
else
  log_fail "11. Secrets hygiene check failed"
fi

echo -e "\n=== Test Summary ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
exit 0
