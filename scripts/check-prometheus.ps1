# DevMonitor Prometheus & Node Exporter Verification Suite (PowerShell)
param(
  [string]$PrometheusUrl = "http://127.0.0.1:9090",
  [string]$BaseUrl = "http://localhost:8080",
  [string]$BackendLoopback = "http://127.0.0.1:5000"
)

$ErrorActionPreference = "Stop"
$script:passed = 0
$script:failed = 0

function Log-Pass($msg) {
  Write-Host "[PASS] $msg" -ForegroundColor Green
  $script:passed++
}

function Log-Fail($msg, $detail = "") {
  Write-Host "[FAIL] $msg" -ForegroundColor Red
  if ($detail) { Write-Host "       $detail" -ForegroundColor DarkRed }
  $script:failed++
}

function Query-Prometheus([string]$promQuery) {
  $encoded = [System.Uri]::EscapeDataString($promQuery)
  $uri = "$PrometheusUrl/api/v1/query?query=$encoded"
  return Invoke-RestMethod -Uri $uri -UseBasicParsing
}

Write-Host "=== DevMonitor Prometheus & Node Exporter Verification Suite ==="
Write-Host "Prometheus URL:   $PrometheusUrl"
Write-Host "Frontend Base URL: $BaseUrl"
Write-Host "Backend Loopback:  $BackendLoopback`n"

# Check 1: Verify Compose config and start 5 containers
try {
  docker compose config -q
  if ($LASTEXITCODE -ne 0) {
    Log-Fail "1. docker compose config failed"
    exit 1
  }

  Write-Host "Starting Docker Compose stack..."
  docker compose up -d --build | Out-Null

  Write-Host "Waiting for all 5 containers to report healthy (up to 120s)..."
  $timeoutSeconds = 120
  $elapsed = 0
  $containers = @("devmonitor-postgres", "devmonitor-backend", "devmonitor-frontend", "devmonitor-prometheus", "devmonitor-node-exporter")

  while ($elapsed -lt $timeoutSeconds) {
    $allHealthy = $true
    foreach ($c in $containers) {
      $inspect = docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $c 2>$null
      if ($inspect -ne "healthy" -and $inspect -ne "running") {
        $allHealthy = $false
        break
      }
    }
    if ($allHealthy) { break }
    Start-Sleep -Seconds 3
    $elapsed += 3
  }

  if ($allHealthy) {
    Log-Pass "1. All 5 containers (postgres, backend, frontend, prometheus, node-exporter) are running and healthy"
  } else {
    Log-Fail "1. Containers failed to reach healthy state within 120s"
  }
} catch {
  Log-Fail "1. Stack startup check threw exception: $($_.Exception.Message)"
}

# Check 2: Prometheus /-/ready returns 200
try {
  $readyRes = Invoke-WebRequest -Uri "$PrometheusUrl/-/ready" -UseBasicParsing
  if ($readyRes.StatusCode -eq 200) {
    Log-Pass "2. http://127.0.0.1:9090/-/ready returns 200"
  } else {
    Log-Fail "2. /-/ready returned unexpected status code $($readyRes.StatusCode)"
  }
} catch {
  Log-Fail "2. /-/ready check threw exception: $($_.Exception.Message)"
}

# Check 3: Active targets (prometheus, backend, node) up and no lastError
try {
  $targetsOk = $false
  $tgtWait = 0
  $tgtDetail = ""

  while ($tgtWait -lt 60) {
    try {
      $targetsRes = Invoke-RestMethod -Uri "$PrometheusUrl/api/v1/targets" -UseBasicParsing
      $active = $targetsRes.data.activeTargets
      $backendTgt = $active | Where-Object { $_.labels.job -eq "backend" }
      $nodeTgt = $active | Where-Object { $_.labels.job -eq "node" }
      $promTgt = $active | Where-Object { $_.labels.job -eq "prometheus" }

      if ($backendTgt -and $nodeTgt -and $promTgt -and
          $backendTgt.health -eq "up" -and [string]::IsNullOrEmpty($backendTgt.lastError) -and
          $nodeTgt.health -eq "up" -and [string]::IsNullOrEmpty($nodeTgt.lastError) -and
          $promTgt.health -eq "up" -and [string]::IsNullOrEmpty($promTgt.lastError)) {
        $targetsOk = $true
        break
      } else {
        $tgtDetail = "Backend: $($backendTgt.health), Node: $($nodeTgt.health), Prom: $($promTgt.health)"
      }
    } catch {
      $tgtDetail = $_.Exception.Message
    }
    Start-Sleep -Seconds 3
    $tgtWait += 3
  }

  if ($targetsOk) {
    Log-Pass "3. All three scrape targets (prometheus, backend, node) active with health 'up' and no lastError"
  } else {
    Log-Fail "3. Targets check failed after 60s" $tgtDetail
  }
} catch {
  Log-Fail "3. Targets check threw exception: $($_.Exception.Message)"
}

# Check 4: Query up metric for all three jobs equals 1
try {
  $upRes = Query-Prometheus "up"
  $activeJobs = @{}
  foreach ($item in $upRes.data.result) {
    $activeJobs[$item.metric.job] = [string]$item.value[1]
  }

  $bUp = $activeJobs["backend"] -eq "1"
  $nUp = $activeJobs["node"] -eq "1"
  $pUp = $activeJobs["prometheus"] -eq "1"

  if ($bUp -and $nUp -and $pUp) {
    Log-Pass "4. Query 'up' returns 1 for all three jobs (backend=1, node=1, prometheus=1)"
  } else {
    Log-Fail "4. Query 'up' mismatch" "Backend: $($activeJobs['backend']), Node: $($activeJobs['node']), Prom: $($activeJobs['prometheus'])"
  }
} catch {
  Log-Fail "4. Query 'up' threw exception: $($_.Exception.Message)"
}

# Check 5: Generate real traffic and assert counter increased by at least 90% of requested count
try {
  $requestedCount = 100
  $beforeCount = 0
  try {
    $beforeRes = Query-Prometheus 'sum(http_requests_total{job="backend",route="/api/health"})'
    if ($beforeRes.data.result.Count -gt 0) {
      $beforeCount = [double]$beforeRes.data.result[0].value[1]
    }
  } catch {}

  $loadRes = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/test/load" -ContentType "application/json" -Body (@{count=$requestedCount} | ConvertTo-Json)
  
  $trafficOk = $false
  $trafficWait = 0
  $diff = 0

  while ($trafficWait -lt 60) {
    Start-Sleep -Seconds 3
    $trafficWait += 3
    try {
      $afterRes = Query-Prometheus 'sum(http_requests_total{job="backend",route="/api/health"})'
      if ($afterRes.data.result.Count -gt 0) {
        $afterCount = [double]$afterRes.data.result[0].value[1]
        $diff = $afterCount - $beforeCount
        if ($diff -ge ($requestedCount * 0.9)) {
          $trafficOk = $true
          break
        }
      }
    } catch {}
  }

  if ($trafficOk) {
    Log-Pass "5. Real traffic generated ($requestedCount requests); counter increased by at least 90% (measured increase: $diff)"
  } else {
    Log-Fail "5. Traffic check failed: counter increased by only $diff (< $($requestedCount * 0.9)) after 60s"
  }
} catch {
  Log-Fail "5. Traffic generation check threw exception: $($_.Exception.Message)"
}

# Check 6: Query duration rate and 95th percentile latency
try {
  $rateRes = Query-Prometheus "rate(http_request_duration_seconds_count[2m])"
  $p95Res = Query-Prometheus "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[2m])) by (le))"

  $rateHasVal = ($rateRes.status -eq "success") -and ($rateRes.data.result.Count -gt 0)
  $p95HasVal = ($p95Res.status -eq "success") -and ($p95Res.data.result.Count -gt 0)

  if ($rateHasVal -and $p95HasVal) {
    $p95Num = [double]$p95Res.data.result[0].value[1]
    Log-Pass "6. Latency queries returned numeric values: duration rate and p95 ($([Math]::Round($p95Num * 1000, 2)) ms)"
  } else {
    Log-Fail "6. Latency query failed (rateHasVal: $rateHasVal, p95HasVal: $p95HasVal)"
  }
} catch {
  Log-Fail "6. Latency query check threw exception: $($_.Exception.Message)"
}

# Check 7: Node metrics exist and CPU usage calculation between 0 and 100
try {
  $cpuM = (Query-Prometheus "node_cpu_seconds_total").data.result.Count -gt 0
  $memM = (Query-Prometheus "node_memory_MemAvailable_bytes").data.result.Count -gt 0
  $fsM = (Query-Prometheus "node_filesystem_avail_bytes").data.result.Count -gt 0
  $netM = (Query-Prometheus "node_network_receive_bytes_total").data.result.Count -gt 0
  $bootM = (Query-Prometheus "node_boot_time_seconds").data.result.Count -gt 0

  $calcRes = Query-Prometheus '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)'
  $cpuPct = [double]$calcRes.data.result[0].value[1]
  $cpuPctValid = ($cpuPct -ge 0.0) -and ($cpuPct -le 100.0)

  if ($cpuM -and $memM -and $fsM -and $netM -and $bootM -and $cpuPctValid) {
    Log-Pass "7. Node Exporter metrics exist (CPU, RAM, disk, network, boot time); calculated CPU usage: $([Math]::Round($cpuPct, 2))%"
  } else {
    Log-Fail "7. Node Exporter metrics validation failed (CPU: $cpuM, RAM: $memM, FS: $fsM, Net: $netM, Boot: $bootM, PctValid: $cpuPctValid, Value: $cpuPct)"
  }
} catch {
  Log-Fail "7. Node metrics check threw exception: $($_.Exception.Message)"
}

# Check 8: Label sanity on devmonitor_service_up and Prometheus service status = 1
try {
  $svcWait = 0
  $labelClean = $false
  $promSvcUp = $false

  while ($svcWait -lt 60) {
    try {
      $svcMetrics = Query-Prometheus "devmonitor_service_up"
      $hasExported = $false
      $hasService = $true

      foreach ($s in $svcMetrics.data.result) {
        if ($s.metric.PSObject.Properties["exported_service"]) {
          $hasExported = $true
        }
        if (-not $s.metric.PSObject.Properties["service"]) {
          $hasService = $false
        }
        if ($s.metric.service -eq "Prometheus" -and [string]$s.value[1] -eq "1") {
          $promSvcUp = $true
        }
      }

      $labelClean = (-not $hasExported) -and $hasService
      if ($labelClean -and $promSvcUp) { break }
    } catch {}

    Start-Sleep -Seconds 3
    $svcWait += 3
  }

  if ($labelClean -and $promSvcUp) {
    Log-Pass "8. Label sanity confirmed: devmonitor_service_up retained clean 'service' label (no 'exported_service'); Prometheus=1"
  } else {
    Log-Fail "8. Label sanity check failed (labelClean: $labelClean, promSvcUp: $promSvcUp)"
  }
} catch {
  Log-Fail "8. Label sanity check threw exception: $($_.Exception.Message)"
}

# Check 9: GET /api/services shows Prometheus Collecting, Grafana Down, others Healthy
try {
  $feSvcWait = 0
  $svcStatusOk = $false
  $detail = ""

  while ($feSvcWait -lt 60) {
    try {
      $services = Invoke-RestMethod -Uri "$BaseUrl/api/services" -UseBasicParsing
      $backendSvc = $services | Where-Object { $_.name -eq "Backend API" }
      $dbSvc = $services | Where-Object { $_.name -eq "Database" }
      $frontendSvc = $services | Where-Object { $_.name -eq "Frontend" }
      $promSvc = $services | Where-Object { $_.name -eq "Prometheus" }
      $grafanaSvc = $services | Where-Object { $_.name -eq "Grafana" }

      $bOk = $backendSvc.status -eq "Healthy"
      $dOk = $dbSvc.status -eq "Healthy"
      $fOk = $frontendSvc.status -eq "Healthy"
      $pOk = $promSvc.status -eq "Collecting"
      $gOk = $grafanaSvc.status -eq "Down"

      if ($bOk -and $dOk -and $fOk -and $pOk -and $gOk) {
        $svcStatusOk = $true
        break
      } else {
        $detail = "BE: $($backendSvc.status), DB: $($dbSvc.status), FE: $($frontendSvc.status), Prom: $($promSvc.status), Graf: $($grafanaSvc.status)"
      }
    } catch {
      $detail = $_.Exception.Message
    }
    Start-Sleep -Seconds 3
    $feSvcWait += 3
  }

  if ($svcStatusOk) {
    Log-Pass "9. /api/services confirmed: Prometheus is 'Collecting', Grafana is 'Down', Backend/Database/Frontend are 'Healthy'"
  } else {
    Log-Fail "9. /api/services verification failed after 60s" $detail
  }
} catch {
  Log-Fail "9. Services status check threw exception: $($_.Exception.Message)"
}

# Check 10: Failure demo: stop backend -> up=0; start backend -> up=1
try {
  docker stop devmonitor-backend | Out-Null
  
  $downDetected = $false
  $stopWait = 0
  while ($stopWait -lt 60) {
    try {
      $uRes = Query-Prometheus 'up{job="backend"}'
      if ($uRes.data.result.Count -gt 0 -and [string]$uRes.data.result[0].value[1] -eq "0") {
        $downDetected = $true
        break
      }
    } catch {}
    Start-Sleep -Seconds 3
    $stopWait += 3
  }

  docker start devmonitor-backend | Out-Null

  $upRecovered = $false
  $startWait = 0
  while ($startWait -lt 60) {
    try {
      $uRes = Query-Prometheus 'up{job="backend"}'
      if ($uRes.data.result.Count -gt 0 -and [string]$uRes.data.result[0].value[1] -eq "1") {
        $upRecovered = $true
        break
      }
    } catch {}
    Start-Sleep -Seconds 3
    $startWait += 3
  }

  if ($downDetected -and $upRecovered) {
    Log-Pass "10. Failure demo verified: backend stopped caused up{job='backend'}=0; restart recovered up=1"
  } else {
    Log-Fail "10. Failure demo failed (downDetected: $downDetected, upRecovered: $upRecovered)"
  }
} catch {
  Log-Fail "10. Failure demo threw exception: $($_.Exception.Message)"
}

# Check 11: Security & Exposure isolation
try {
  $promReachable = $false
  try {
    $pTest = Invoke-WebRequest -Uri "$PrometheusUrl/-/ready" -UseBasicParsing -TimeoutSec 3
    $promReachable = ($pTest.StatusCode -eq 200)
  } catch {}

  $nodeUnpublished = $false
  try {
    $nTest = Invoke-WebRequest -Uri "http://127.0.0.1:9100/metrics" -UseBasicParsing -TimeoutSec 2
    $nodeUnpublished = $false
  } catch {
    $nodeUnpublished = $true
  }

  $portsJson = docker inspect devmonitor-node-exporter --format '{{json .NetworkSettings.Ports}}' 2>$null
  $noHostPort = ($portsJson -notmatch 'HostPort')

  $metricsBlocked = $false
  try {
    $mTest = Invoke-WebRequest -Uri "$BaseUrl/metrics" -UseBasicParsing -TimeoutSec 3
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 404) { $metricsBlocked = $true }
  }

  if ($promReachable -and $nodeUnpublished -and $noHostPort -and $metricsBlocked) {
    Log-Pass "11. Exposure verified: Prometheus on 127.0.0.1:9090; Node Exporter unpublished (no host port); frontend /metrics blocked (404)"
  } else {
    Log-Fail "11. Exposure check failed (promReachable: $promReachable, nodeUnpublished: $nodeUnpublished, noHostPort: $noHostPort, metricsBlocked: $metricsBlocked)"
  }
} catch {
  Log-Fail "11. Exposure check threw exception: $($_.Exception.Message)"
}

# Check 12: TSDB persistence across prometheus restart
try {
  $beforeRestart = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  Start-Sleep -Seconds 2

  docker compose restart prometheus | Out-Null

  $readyAfter = $false
  $waitReady = 0
  while ($waitReady -lt 60) {
    try {
      $r = Invoke-WebRequest -Uri "$PrometheusUrl/-/ready" -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -eq 200) {
        $readyAfter = $true
        break
      }
    } catch {}
    Start-Sleep -Seconds 2
    $waitReady += 2
  }

  $startTime = $beforeRestart - 180
  $rangeQuery = "up{job=""backend""}"
  $rangeEncoded = [System.Uri]::EscapeDataString($rangeQuery)
  $rangeUri = "$PrometheusUrl/api/v1/query_range?query=$rangeEncoded&start=$startTime&end=$beforeRestart&step=15s"

  $rangeRes = Invoke-RestMethod -Uri $rangeUri -UseBasicParsing
  $hasPreRestartData = $false
  if ($rangeRes.data.result.Count -gt 0) {
    $points = $rangeRes.data.result[0].values
    if ($points.Count -gt 0) {
      $hasPreRestartData = $true
    }
  }

  if ($readyAfter -and $hasPreRestartData) {
    Log-Pass "12. Persistence verified: Prometheus TSDB range query returned historical samples recorded prior to container restart"
  } else {
    Log-Fail "12. Persistence check failed (readyAfter: $readyAfter, hasPreRestartData: $hasPreRestartData)"
  }
} catch {
  Log-Fail "12. Persistence check threw exception: $($_.Exception.Message)"
}

Write-Host "`n=== Test Summary ==="
Write-Host "Passed: $($script:passed)"
Write-Host "Failed: $($script:failed)"

if ($script:failed -gt 0) {
  exit 1
}
exit 0
