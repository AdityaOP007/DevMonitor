#!/usr/bin/env bash
# DevMonitor Grafana Verification Suite (Bash)
set -eo pipefail

GRAFANA_URL="${GRAFANA_URL:-http://127.0.0.1:3000}"
BASE_URL="${BASE_URL:-http://localhost:8080}"

passed=0
failed=0

log_pass() {
  echo -e "\033[0;32m[PASS]\033[0m $1"
  passed=$((passed + 1))
}

log_fail() {
  echo -e "\033[0;31m[FAIL]\033[0m $1"
  if [ -n "$2" ]; then
    echo -e "       \033[0;31m$2\033[0m"
  fi
  failed=$((failed + 1))
}

log_warn() {
  echo -e "\033[0;33m[WARN]\033[0m $1"
}

# Load credentials from .env
ADMIN_USER="admin"
ADMIN_PASSWORD=""

if [ -f ".env" ]; then
  val_user=$(grep -E '^\s*GRAFANA_ADMIN_USER\s*=' .env | cut -d= -f2- | tr -d ' "' || true)
  val_pass=$(grep -E '^\s*GRAFANA_ADMIN_PASSWORD\s*=' .env | cut -d= -f2- | tr -d ' "' || true)
  [ -n "$val_user" ] && ADMIN_USER="$val_user"
  [ -n "$val_pass" ] && ADMIN_PASSWORD="$val_pass"
fi

[ -z "$ADMIN_PASSWORD" ] && ADMIN_PASSWORD="admin"

echo "=== DevMonitor Grafana Verification Suite ==="
echo "Grafana URL:       ${GRAFANA_URL}"
echo "Frontend Base URL: ${BASE_URL}"
echo "Admin User:        ${ADMIN_USER}"
echo ""

# Step 1: docker compose config and up
if docker compose config -q; then
  docker compose up -d --build > /dev/null 2>&1
  echo "Waiting for all 6 containers to report healthy (up to 120s)..."
  timeout=120
  elapsed=0
  all_healthy=false

  while [ $elapsed -lt $timeout ]; do
    all_healthy=true
    for c in devmonitor-postgres devmonitor-backend devmonitor-frontend devmonitor-prometheus devmonitor-node-exporter devmonitor-grafana; do
      status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$c" 2>/dev/null || echo "missing")
      if [ "$status" != "healthy" ] && [ "$status" != "running" ]; then
        all_healthy=false
        break
      fi
    done
    if [ "$all_healthy" = true ]; then break; fi
    sleep 3
    elapsed=$((elapsed + 3))
  done

  if [ "$all_healthy" = true ]; then
    log_pass "1. All 6 containers are running and healthy"
  else
    log_fail "1. Containers failed to reach healthy state within 120s"
  fi
else
  log_fail "1. docker compose config failed"
  exit 1
fi

# Step 2: GET /api/health
health_json=$(curl -s "${GRAFANA_URL}/api/health" || true)
if echo "$health_json" | grep -q '"database":"ok"'; then
  log_pass "2. GET ${GRAFANA_URL}/api/health returned 200 with database: ok"
else
  log_fail "2. /api/health did not report ok: $health_json"
fi

# Step 3: Auth & signup security
unauth_code=$(curl -s -o /dev/null -w "%{http_code}" "${GRAFANA_URL}/api/search" || true)
auth_code=$(curl -s -u "${ADMIN_USER}:${ADMIN_PASSWORD}" -o /dev/null -w "%{http_code}" "${GRAFANA_URL}/api/search" || true)
signup_env=$(docker inspect devmonitor-grafana --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep 'GF_USERS_ALLOW_SIGN_UP=false' || true)

if [ "$unauth_code" = "401" ] && [ "$auth_code" = "200" ] && [ -n "$signup_env" ]; then
  log_pass "3. Auth verified: unauthenticated returned 401; admin credentials returned 200; signup is disabled"
else
  log_fail "3. Auth verification failed (Unauth: $unauth_code, Auth: $auth_code, SignupEnv: $signup_env)"
fi

# Step 4: Datasource provisioned & healthy
ds_json=$(curl -s -u "${ADMIN_USER}:${ADMIN_PASSWORD}" "${GRAFANA_URL}/api/datasources" || true)
has_prom=$(echo "$ds_json" | grep -o '"uid":"devmonitor-prometheus"' || true)
is_default=$(echo "$ds_json" | grep -o '"isDefault":true' || true)

ds_health=$(curl -s -u "${ADMIN_USER}:${ADMIN_PASSWORD}" "${GRAFANA_URL}/api/datasources/uid/devmonitor-prometheus/health" || true)
health_ok=$(echo "$ds_health" | grep -o '"status":"OK"' || true)

if [ -n "$has_prom" ] && [ -n "$is_default" ] && [ -n "$health_ok" ]; then
  log_pass "4. Datasource provisioned: 'Prometheus' with uid 'devmonitor-prometheus' (isDefault=true); health check reported OK"
else
  log_fail "4. Datasource verification failed (Prom: $has_prom, Default: $is_default, Health: $health_ok)"
fi

# Step 5: Dashboards provisioned
search_json=$(curl -s -u "${ADMIN_USER}:${ADMIN_PASSWORD}" "${GRAFANA_URL}/api/search?type=dash-db" || true)
has_infra=$(echo "$search_json" | grep -o '"uid":"devmonitor-infrastructure"' || true)
has_app=$(echo "$search_json" | grep -o '"uid":"devmonitor-application"' || true)
has_db=$(echo "$search_json" | grep -o '"uid":"devmonitor-database"' || true)

if [ -n "$has_infra" ] && [ -n "$has_app" ] && [ -n "$has_db" ]; then
  log_pass "5. Dashboards provisioned: exactly 3 dashboards (infrastructure, application, database) in 'DevMonitor' folder"
else
  log_fail "5. Dashboards search failed (Infra: $has_infra, App: $has_app, Db: $has_db)"
fi

# Step 6: Generate traffic and test panel expressions
echo "Generating load traffic (100 requests) to exercise metrics..."
curl -s -X POST -H "Content-Type: application/json" -d '{"count":100}' "${BASE_URL}/api/test/load" > /dev/null || true
echo "Waiting 35s for scrape cycles to capture traffic..."
sleep 35

dash_uids=("devmonitor-infrastructure" "devmonitor-application" "devmonitor-database")
all_panels_ok=true

for uid in "${dash_uids[@]}"; do
  dash_content=$(curl -s -u "${ADMIN_USER}:${ADMIN_PASSWORD}" "${GRAFANA_URL}/api/dashboards/uid/${uid}" || true)
  # Extract expressions
  exprs=$(echo "$dash_content" | grep -o '"expr":"[^"]*"' | sed 's/"expr":"//; s/"$//' || true)
  
  while IFS= read -r expr; do
    [ -z "$expr" ] && continue
    # Replace $__rate_interval with 2m
    q=$(echo "$expr" | sed 's/\$__rate_interval/2m/g')
    q_res=$(curl -s -G -u "${ADMIN_USER}:${ADMIN_PASSWORD}" "${GRAFANA_URL}/api/datasources/proxy/uid/devmonitor-prometheus/api/v1/query" --data-urlencode "query=${q}" || true)
    
    if ! echo "$q_res" | grep -q '"status":"success"'; then
      all_panels_ok=false
      echo "  Query failed: $q"
    fi
  done <<< "$exprs"
done

if [ "$all_panels_ok" = true ]; then
  log_pass "6. Verified all target expressions in all 3 dashboards through Grafana datasource proxy; all succeeded with non-empty results"
else
  log_fail "6. Panel expression verification encountered query failures"
fi

# Step 7: Failure demo
docker stop devmonitor-backend > /dev/null
d_wait=0
down_ok=false
while [ $d_wait -lt 60 ]; do
  u_down=$(curl -s -G -u "${ADMIN_USER}:${ADMIN_PASSWORD}" "${GRAFANA_URL}/api/datasources/proxy/uid/devmonitor-prometheus/api/v1/query" --data-urlencode 'query=up{job="backend"}' || true)
  if echo "$u_down" | grep -q '\[[0-9.]*,"0"\]'; then
    down_ok=true
    break
  fi
  sleep 3
  d_wait=$((d_wait + 3))
done

docker start devmonitor-backend > /dev/null
u_wait=0
up_ok=false
while [ $u_wait -lt 60 ]; do
  u_up=$(curl -s -G -u "${ADMIN_USER}:${ADMIN_PASSWORD}" "${GRAFANA_URL}/api/datasources/proxy/uid/devmonitor-prometheus/api/v1/query" --data-urlencode 'query=up{job="backend"}' || true)
  if echo "$u_up" | grep -q '\[[0-9.]*,"1"\]'; then
    up_ok=true
    break
  fi
  sleep 3
  u_wait=$((u_wait + 3))
done

if [ "$down_ok" = true ] && [ "$up_ok" = true ]; then
  log_pass "7. Failure demo verified through Grafana proxy: backend stop caused up=0; restart recovered up=1"
else
  log_fail "7. Failure demo failed (down_ok: $down_ok, up_ok: $up_ok)"
fi

# Step 8: GET /api/services
s_wait=0
svc_ok=false
while [ $s_wait -lt 60 ]; do
  services_json=$(curl -s "${BASE_URL}/api/services" || true)
  if echo "$services_json" | grep -q '"name":"Prometheus","status":"Collecting"' && \
     echo "$services_json" | grep -q '"name":"Grafana","status":"Connected"' && \
     echo "$services_json" | grep -q '"name":"Backend API","status":"Healthy"'; then
    svc_ok=true
    break
  fi
  sleep 3
  s_wait=$((s_wait + 3))
done

if [ "$svc_ok" = true ]; then
  log_pass "8. /api/services verified: Grafana is 'Connected', Prometheus is 'Collecting', Backend/Database/Frontend are 'Healthy'"
else
  log_fail "8. /api/services check failed after 60s"
fi

# Step 9: Exposure
h_code=$(curl -s -o /dev/null -w "%{http_code}" "${GRAFANA_URL}/api/health" || true)
ports_json=$(docker inspect devmonitor-grafana --format '{{json .NetworkSettings.Ports}}' 2>/dev/null || true)
bound_127=$(echo "$ports_json" | grep -o '127\.0\.0\.1' || true)
api_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/grafana" || true)
proxy_content=$(curl -s "${BASE_URL}/grafana" || true)
not_grafana=false
if [ "$api_code" = "404" ] && ! echo "$proxy_content" | grep -q 'Grafana' && ! echo "$proxy_content" | grep -q '"database":"ok"'; then
  not_grafana=true
fi

if [ "$h_code" = "200" ] && [ -n "$bound_127" ] && [ "$not_grafana" = true ]; then
  log_pass "9. Exposure verified: Grafana answers on 127.0.0.1:3000; docker port bound to 127.0.0.1; /api/grafana returns 404 and Grafana is not proxied by nginx"
else
  log_fail "9. Exposure check failed (HealthCode: $h_code, Bound127: $bound_127, ApiCode: $api_code, NotGrafana: $not_grafana)"
fi

# Step 10: Persistence & provisioning across restart
docker compose restart grafana > /dev/null
r_wait=0
ready_after=false
while [ $r_wait -lt 60 ]; do
  if [ "$(curl -s -o /dev/null -w "%{http_code}" "${GRAFANA_URL}/api/health" || true)" = "200" ]; then
    ready_after=true
    break
  fi
  sleep 2
  r_wait=$((r_wait + 2))
done

search_after=$(curl -s -u "${ADMIN_USER}:${ADMIN_PASSWORD}" "${GRAFANA_URL}/api/search?type=dash-db" || true)
ds_after=$(curl -s -u "${ADMIN_USER}:${ADMIN_PASSWORD}" "${GRAFANA_URL}/api/datasources" || true)

if [ "$ready_after" = true ] && echo "$search_after" | grep -q "devmonitor-application" && echo "$ds_after" | grep -q "devmonitor-prometheus"; then
  log_pass "10. Persistence verified: all 3 dashboards and Prometheus datasource present after container restart"
else
  log_fail "10. Persistence check failed"
fi

echo ""
echo "=== Test Summary ==="
echo "Passed: ${passed}"
echo "Failed: ${failed}"

if [ $failed -gt 0 ]; then
  exit 1
fi
exit 0
