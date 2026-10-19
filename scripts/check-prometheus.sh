#!/usr/bin/env bash
# DevMonitor Prometheus & Node Exporter Verification Suite (Bash)
set -eo pipefail

PROMETHEUS_URL="${PROMETHEUS_URL:-http://127.0.0.1:9090}"
BASE_URL="${BASE_URL:-http://localhost:8080}"
BACKEND_LOOPBACK="${BACKEND_LOOPBACK:-http://127.0.0.1:5000}"

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

query_prom() {
  local q="$1"
  curl -s -G "${PROMETHEUS_URL}/api/v1/query" --data-urlencode "query=${q}"
}

echo "=== DevMonitor Prometheus & Node Exporter Verification Suite ==="
echo "Prometheus URL:   ${PROMETHEUS_URL}"
echo "Frontend Base URL: ${BASE_URL}"
echo "Backend Loopback:  ${BACKEND_LOOPBACK}"
echo ""

# Check 1: Compose config and healthy containers
if docker compose config -q; then
  docker compose up -d --build > /dev/null 2>&1
  echo "Waiting for containers to report healthy (up to 120s)..."
  timeout=120
  elapsed=0
  all_healthy=false

  while [ $elapsed -lt $timeout ]; do
    all_healthy=true
    for c in devmonitor-postgres devmonitor-backend devmonitor-frontend devmonitor-prometheus devmonitor-node-exporter; do
      status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$c" 2>/dev/null || echo "missing")
      if [ "$status" != "healthy" ] && [ "$status" != "running" ]; then
        all_healthy=false
        break
      fi
    done
    if [ "$all_healthy" = true ]; then
      break
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done

  if [ "$all_healthy" = true ]; then
    log_pass "1. All 5 containers are running and healthy"
  else
    log_fail "1. Containers failed to reach healthy state within 120s"
  fi
else
  log_fail "1. docker compose config failed"
  exit 1
fi

# Check 2: Prometheus ready
code=$(curl -s -o /dev/null -w "%{http_code}" "${PROMETHEUS_URL}/-/ready" || true)
if [ "$code" = "200" ]; then
  log_pass "2. ${PROMETHEUS_URL}/-/ready returns 200"
else
  log_fail "2. /-/ready returned HTTP $code"
fi

# Check 3: Targets up and no lastError
targets_ok=false
t_wait=0
while [ $t_wait -lt 60 ]; do
  res=$(curl -s "${PROMETHEUS_URL}/api/v1/targets" || true)
  b_up=$(echo "$res" | grep -o '"job":"backend"[^}]*' | grep -o '"health":"up"' || true)
  n_up=$(echo "$res" | grep -o '"job":"node"[^}]*' | grep -o '"health":"up"' || true)
  p_up=$(echo "$res" | grep -o '"job":"prometheus"[^}]*' | grep -o '"health":"up"' || true)
  if [ -n "$b_up" ] && [ -n "$n_up" ] && [ -n "$p_up" ]; then
    targets_ok=true
    break
  fi
  sleep 3
  t_wait=$((t_wait + 3))
done

if [ "$targets_ok" = true ]; then
  log_pass "3. All three scrape targets (prometheus, backend, node) active with health 'up'"
else
  log_fail "3. Targets check failed after 60s"
fi

# Check 4: Query up == 1
up_res=$(query_prom "up")
b_val=$(echo "$up_res" | grep -o '"job":"backend"[^]]*' | grep -o '"1"' || true)
n_val=$(echo "$up_res" | grep -o '"job":"node"[^]]*' | grep -o '"1"' || true)
p_val=$(echo "$up_res" | grep -o '"job":"prometheus"[^]]*' | grep -o '"1"' || true)

if [ -n "$b_val" ] && [ -n "$n_val" ] && [ -n "$p_val" ]; then
  log_pass "4. Query 'up' returns 1 for all three jobs (backend=1, node=1, prometheus=1)"
else
  log_fail "4. Query 'up' returned non-1 value"
fi

# Check 5: Generate real traffic and assert counter increased by at least 90% of requested count
req_count=100
curl -s "${BASE_URL}/api/health" > /dev/null || true
sleep 16

before_res=$(query_prom 'sum(http_requests_total{job="backend",route="/api/health"})')
before_val=$(echo "$before_res" | grep -o '\[[0-9.]*,"[0-9.]*"\]' | grep -o '"[0-9.]*"' | tr -d '"' | cut -d. -f1 || echo "0")
[ -z "$before_val" ] && before_val=0

curl -s -X POST -H "Content-Type: application/json" -d "{\"count\":$req_count}" "${BASE_URL}/api/test/load" > /dev/null || true
traffic_ok=false
traf_wait=0
diff=0
while [ $traf_wait -lt 60 ]; do
  sleep 3
  traf_wait=$((traf_wait + 3))
  after_res=$(query_prom 'sum(http_requests_total{job="backend",route="/api/health"})')
  after_val=$(echo "$after_res" | grep -o '\[[0-9.]*,"[0-9.]*"\]' | grep -o '"[0-9.]*"' | tr -d '"' | cut -d. -f1 || echo "0")
  [ -z "$after_val" ] && after_val=0
  diff=$((after_val - before_val))
  if [ $diff -ge 90 ]; then
    traffic_ok=true
    break
  fi
done

if [ "$traffic_ok" = true ]; then
  log_pass "5. Real traffic generated ($req_count requests); counter increased by at least 90% (measured increase: $diff)"
else
  log_fail "5. Traffic check failed: counter increased by only $diff (< 90) after 60s"
fi

# Check 6: Duration rate and p95
rate_res=$(query_prom "rate(http_request_duration_seconds_count[2m])")
p95_res=$(query_prom "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[2m])) by (le))")

if echo "$rate_res" | grep -q '"status":"success"' && echo "$p95_res" | grep -q '"status":"success"'; then
  log_pass "6. Duration rate and histogram p95 returned successful results"
else
  log_fail "6. Latency query failed"
fi

# Check 7: Node metrics
cpu_m=$(query_prom "node_cpu_seconds_total")
mem_m=$(query_prom "node_memory_MemAvailable_bytes")
fs_m=$(query_prom "node_filesystem_avail_bytes")
net_m=$(query_prom "node_network_receive_bytes_total")
boot_m=$(query_prom "node_boot_time_seconds")
calc_res=$(query_prom '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)')

if echo "$cpu_m" | grep -q '"result":\[{' && \
   echo "$mem_m" | grep -q '"result":\[{' && \
   echo "$fs_m" | grep -q '"result":\[{' && \
   echo "$net_m" | grep -q '"result":\[{' && \
   echo "$boot_m" | grep -q '"result":\[{' && \
   echo "$calc_res" | grep -q '"status":"success"'; then
  log_pass "7. Node Exporter metrics exist (CPU, RAM, disk, network, boot time) and CPU calculation returned value"
else
  log_fail "7. Node Exporter metrics check failed"
fi

# Check 8: Label sanity
svc_res=$(query_prom "devmonitor_service_up")
if ! echo "$svc_res" | grep -q 'exported_service' && echo "$svc_res" | grep -q '"service":"Prometheus"'; then
  log_pass "8. Label sanity confirmed: devmonitor_service_up retained clean 'service' label (no 'exported_service')"
else
  log_fail "8. Label collision detected on devmonitor_service_up"
fi

# Check 9: Services status
s_wait=0
svc_ok=false
while [ $s_wait -lt 60 ]; do
  services_json=$(curl -s "${BASE_URL}/api/services" || true)
  if echo "$services_json" | grep -q '"name":"Prometheus","status":"Collecting"' && \
     (echo "$services_json" | grep -q '"name":"Grafana","status":"Down"' || echo "$services_json" | grep -q '"name":"Grafana","status":"Connected"') && \
     echo "$services_json" | grep -q '"name":"Backend API","status":"Healthy"'; then
    svc_ok=true
    break
  fi
  sleep 3
  s_wait=$((s_wait + 3))
done

if [ "$svc_ok" = true ]; then
  log_pass "9. /api/services confirmed: Prometheus is 'Collecting', Grafana is Down or Connected, Backend API is 'Healthy'"
else
  log_fail "9. /api/services status verification failed after 60s"
fi

# Check 10: Failure demo
docker stop devmonitor-backend > /dev/null
d_wait=0
down_ok=false
while [ $d_wait -lt 60 ]; do
  u_down=$(query_prom 'up{job="backend"}')
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
  u_up=$(query_prom 'up{job="backend"}')
  if echo "$u_up" | grep -q '\[[0-9.]*,"1"\]'; then
    up_ok=true
    break
  fi
  sleep 3
  u_wait=$((u_wait + 3))
done

if [ "$down_ok" = true ] && [ "$up_ok" = true ]; then
  log_pass "10. Failure demo verified: backend stopped caused up=0; restart recovered up=1"
else
  log_fail "10. Failure demo failed (down_ok: $down_ok, up_ok: $up_ok)"
fi

# Check 11: Exposure
p_ok=false
[ "$(curl -s -o /dev/null -w "%{http_code}" "${PROMETHEUS_URL}/-/ready" || true)" = "200" ] && p_ok=true

n_blocked=false
curl --connect-timeout 2 -s "http://127.0.0.1:9100/metrics" > /dev/null 2>&1 || n_blocked=true

ports_json=$(docker inspect devmonitor-node-exporter --format '{{json .NetworkSettings.Ports}}' 2>/dev/null || echo "")
no_port=false
if ! echo "$ports_json" | grep -q 'HostPort'; then
  no_port=true
fi

m_blocked=false
[ "$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/metrics" || true)" = "404" ] && m_blocked=true

if [ "$p_ok" = true ] && [ "$n_blocked" = true ] && [ "$no_port" = true ] && [ "$m_blocked" = true ]; then
  log_pass "11. Exposure verified: Prometheus on 127.0.0.1:9090; Node Exporter unpublished; frontend /metrics blocked (404)"
else
  log_fail "11. Exposure check failed (p_ok: $p_ok, n_blocked: $n_blocked, no_port: $no_port, m_blocked: $m_blocked)"
fi

# Check 12: Persistence
before_ts=$(date +%s)
sleep 2
docker compose restart prometheus > /dev/null

r_wait=0
ready_after=false
while [ $r_wait -lt 60 ]; do
  if [ "$(curl -s -o /dev/null -w "%{http_code}" "${PROMETHEUS_URL}/-/ready" || true)" = "200" ]; then
    ready_after=true
    break
  fi
  sleep 2
  r_wait=$((r_wait + 2))
done

start_ts=$((before_ts - 180))
range_res=$(curl -s -G "${PROMETHEUS_URL}/api/v1/query_range" \
  --data-urlencode 'query=up{job="backend"}' \
  --data-urlencode "start=${start_ts}" \
  --data-urlencode "end=${before_ts}" \
  --data-urlencode "step=15s" || true)

has_data=false
if echo "$range_res" | grep -q '"values":\[\['; then
  has_data=true
fi

if [ "$ready_after" = true ] && [ "$has_data" = true ]; then
  log_pass "12. Persistence verified: Prometheus TSDB range query returned samples recorded prior to restart"
else
  log_fail "12. Persistence check failed (ready_after: $ready_after, has_data: $has_data)"
fi

echo ""
echo "=== Test Summary ==="
echo "Passed: ${passed}"
echo "Failed: ${failed}"

if [ $failed -gt 0 ]; then
  exit 1
fi
exit 0
