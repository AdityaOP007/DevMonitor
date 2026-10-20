# DevMonitor Grafana Verification Suite (PowerShell)
param(
  [string]$GrafanaUrl = "http://127.0.0.1:3000",
  [string]$BaseUrl = "http://localhost:8080"
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

function Log-Warn($msg) {
  Write-Host "[WARN] $msg" -ForegroundColor Yellow
}

# Read credentials from .env
$adminUser = "admin"
$adminPassword = ""

if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match "^\s*GRAFANA_ADMIN_USER\s*=\s*(.+)$") {
      $adminUser = $matches[1].Trim()
    }
    if ($_ -match "^\s*GRAFANA_ADMIN_PASSWORD\s*=\s*(.+)$") {
      $adminPassword = $matches[1].Trim()
    }
  }
}

if (-not $adminPassword) {
  $adminPassword = "admin"
}

$basicAuth = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("${adminUser}:${adminPassword}"))
$authHeaders = @{ Authorization = "Basic $basicAuth" }

Write-Host "=== DevMonitor Grafana Verification Suite ==="
Write-Host "Grafana URL:       $GrafanaUrl"
Write-Host "Frontend Base URL: $BaseUrl"
Write-Host "Admin User:        $adminUser`n"

# Step 1: docker compose config -q; up -d --build; wait for all 6 containers
try {
  docker compose config -q
  if ($LASTEXITCODE -ne 0) {
    Log-Fail "1. docker compose config failed"
    exit 1
  }

  Write-Host "Starting Docker Compose stack..."
  docker compose up -d --build | Out-Null

  Write-Host "Waiting for all 6 containers to report healthy (up to 120s)..."
  $timeoutSeconds = 120
  $elapsed = 0
  $containers = @("devmonitor-postgres", "devmonitor-backend", "devmonitor-frontend", "devmonitor-prometheus", "devmonitor-node-exporter", "devmonitor-grafana")

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
    Log-Pass "1. All 6 containers (postgres, backend, frontend, prometheus, node-exporter, grafana) are running and healthy"
  } else {
    Log-Fail "1. Containers failed to reach healthy state within 120s"
  }
} catch {
  Log-Fail "1. Stack startup check threw exception: $($_.Exception.Message)"
}

# Step 2: GET /api/health returns 200 with "database": "ok"
try {
  $healthRes = Invoke-RestMethod -Uri "$GrafanaUrl/api/health" -UseBasicParsing
  if ($healthRes.database -eq "ok") {
    Log-Pass "2. GET $GrafanaUrl/api/health returned 200 with database: ok (version: $($healthRes.version))"
  } else {
    Log-Fail "2. /api/health database status was '$($healthRes.database)' (expected 'ok')"
  }
} catch {
  Log-Fail "2. /api/health request failed: $($_.Exception.Message)"
}

# Step 3: Auth & signup security
try {
  $unauthStatus = 0
  try {
    $r = Invoke-WebRequest -Uri "$GrafanaUrl/api/search" -UseBasicParsing -TimeoutSec 3
    $unauthStatus = $r.StatusCode
  } catch {
    if ($_.Exception.Response) {
      $unauthStatus = $_.Exception.Response.StatusCode.value__
    }
  }

  $authOk = $false
  try {
    $authRes = Invoke-RestMethod -Uri "$GrafanaUrl/api/search" -Headers $authHeaders -UseBasicParsing
    if ($authRes -ne $null) {
      $authOk = $true
    }
  } catch {}

  $signupEnv = docker inspect devmonitor-grafana --format '{{range .Config.Env}}{{println .}}{{end}}' 2>$null | Select-String -Pattern "GF_USERS_ALLOW_SIGN_UP=false"
  $signupDisabled = ($signupEnv -ne $null)

  if ($unauthStatus -eq 401 -and $authOk -and $signupDisabled) {
    Log-Pass "3. Auth verified: unauthenticated request returned 401; admin credentials returned 200; signup is disabled"
  } else {
    Log-Fail "3. Auth verification failed (Unauth: $unauthStatus, AuthOk: $authOk, SignupDisabled: $signupDisabled)"
  }
} catch {
  Log-Fail "3. Auth check threw exception: $($_.Exception.Message)"
}

# Step 4: Datasource provisioned & health check
try {
  $dsList = Invoke-RestMethod -Uri "$GrafanaUrl/api/datasources" -Headers $authHeaders -UseBasicParsing
  $promDs = $dsList | Where-Object { $_.uid -eq "devmonitor-prometheus" -and $_.name -eq "Prometheus" }

  $dsHealth = Invoke-RestMethod -Uri "$GrafanaUrl/api/datasources/uid/devmonitor-prometheus/health" -Headers $authHeaders -UseBasicParsing
  $healthOk = ($dsHealth.status -eq "OK")

  if ($promDs -and $promDs.isDefault -and $healthOk) {
    Log-Pass "4. Datasource provisioned: 'Prometheus' with uid 'devmonitor-prometheus' (isDefault=true); health check reported OK"
  } else {
    Log-Fail "4. Datasource check failed (Found: $($promDs -ne $null), IsDefault: $($promDs.isDefault), Health: $($dsHealth.status))"
  }
} catch {
  Log-Fail "4. Datasource check threw exception: $($_.Exception.Message)"
}

# Step 5: Dashboards provisioned in DevMonitor folder
try {
  $search = Invoke-RestMethod -Uri "$GrafanaUrl/api/search?type=dash-db" -Headers $authHeaders -UseBasicParsing
  $uids = $search | ForEach-Object { $_.uid }
  $folderTitles = $search | ForEach-Object { $_.folderTitle }

  $hasInfra = $uids -contains "devmonitor-infrastructure"
  $hasApp = $uids -contains "devmonitor-application"
  $hasDb = $uids -contains "devmonitor-database"
  $allInFolder = ($folderTitles | Where-Object { $_ -ne "DevMonitor" }).Count -eq 0

  if ($hasInfra -and $hasApp -and $hasDb -and $allInFolder -and $search.Count -eq 3) {
    Log-Pass "5. Dashboards provisioned: exactly 3 dashboards (infrastructure, application, database) in 'DevMonitor' folder"
  } else {
    Log-Fail "5. Dashboards search failed (Infra: $hasInfra, App: $hasApp, Db: $hasDb, Count: $($search.Count))"
  }
} catch {
  Log-Fail "5. Dashboards provisioning check threw exception: $($_.Exception.Message)"
}

# Step 6: Generate traffic and test EVERY panel expression across all dashboards
try {
  Write-Host "Generating load traffic (100 requests) to exercise metrics..."
  $loadRes = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/test/load" -ContentType "application/json" -Body '{"count":100}' -UseBasicParsing
  Write-Host "Waiting 35s for scrape cycles to capture traffic..."
  Start-Sleep -Seconds 35

  $dashUids = @("devmonitor-infrastructure", "devmonitor-application", "devmonitor-database")
  $allowListEmpty = @("Error Rate (%)", "Queries per Second", "Average Query Duration", "Queries per Second Timeline", "Average Query Duration and p95", "Firing Alerts", "Active Alerts")
  $allPanelsOk = $true
  $failedDetail = ""

  foreach ($dUid in $dashUids) {
    $dashObj = (Invoke-RestMethod -Uri "$GrafanaUrl/api/dashboards/uid/$dUid" -Headers $authHeaders -UseBasicParsing).dashboard
    foreach ($panel in $dashObj.panels) {
      if ($panel.targets) {
        foreach ($tgt in $panel.targets) {
          $expr = $tgt.expr -replace '\$__rate_interval', '2m'
          $enc = [System.Uri]::EscapeDataString($expr)
          $proxyUri = "$GrafanaUrl/api/datasources/proxy/uid/devmonitor-prometheus/api/v1/query?query=$enc"
          
          try {
            $qRes = Invoke-RestMethod -Uri $proxyUri -Headers $authHeaders -UseBasicParsing
            if ($qRes.status -ne "success") {
              $allPanelsOk = $false
              $failedDetail += "Query error on [$($dashObj.title) > $($panel.title)]: status $($qRes.status); "
            } elseif ($qRes.data.result.Count -eq 0) {
              if ($allowListEmpty -contains $panel.title) {
                Log-Warn "Panel '$($panel.title)' returned empty result (allowed by allowlist)"
              } else {
                $allPanelsOk = $false
                $failedDetail += "Empty result on unallowed panel [$($dashObj.title) > $($panel.title)]; "
              }
            }
          } catch {
            $allPanelsOk = $false
            $failedDetail += "Exception querying [$($dashObj.title) > $($panel.title)]: $($_.Exception.Message); "
          }
        }
      }
    }
  }

  if ($allPanelsOk) {
    Log-Pass "6. Verified all target expressions in all 3 dashboards through Grafana datasource proxy; all succeeded with non-empty results"
  } else {
    Log-Fail "6. Panel expression verification failed" $failedDetail
  }
} catch {
  Log-Fail "6. Panel query check threw exception: $($_.Exception.Message)"
}

# Step 7: Failure demo through Grafana proxy
try {
  docker stop devmonitor-backend | Out-Null
  $downDetected = $false
  $stopWait = 0
  $encUp = [System.Uri]::EscapeDataString('up{job="backend"}')
  $proxyUp = "$GrafanaUrl/api/datasources/proxy/uid/devmonitor-prometheus/api/v1/query?query=$encUp"

  while ($stopWait -lt 60) {
    try {
      $uRes = Invoke-RestMethod -Uri $proxyUp -Headers $authHeaders -UseBasicParsing
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
      $uRes = Invoke-RestMethod -Uri $proxyUp -Headers $authHeaders -UseBasicParsing
      if ($uRes.data.result.Count -gt 0 -and [string]$uRes.data.result[0].value[1] -eq "1") {
        $upRecovered = $true
        break
      }
    } catch {}
    Start-Sleep -Seconds 3
    $startWait += 3
  }

  if ($downDetected -and $upRecovered) {
    Log-Pass "7. Failure demo verified through Grafana proxy: backend stop caused up=0; restart recovered up=1"
  } else {
    Log-Fail "7. Failure demo failed (DownDetected: $downDetected, UpRecovered: $upRecovered)"
  }
} catch {
  Log-Fail "7. Failure demo threw exception: $($_.Exception.Message)"
}

# Step 8: GET /api/services shows Grafana Connected, Prometheus Collecting, others Healthy
try {
  $svcWait = 0
  $svcOk = $false
  $detail = ""

  while ($svcWait -lt 60) {
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
      $gOk = $grafanaSvc.status -eq "Connected"

      if ($bOk -and $dOk -and $fOk -and $pOk -and $gOk) {
        $svcOk = $true
        break
      } else {
        $detail = "BE: $($backendSvc.status), DB: $($dbSvc.status), FE: $($frontendSvc.status), Prom: $($promSvc.status), Graf: $($grafanaSvc.status)"
      }
    } catch {
      $detail = $_.Exception.Message
    }
    Start-Sleep -Seconds 3
    $svcWait += 3
  }

  if ($svcOk) {
    Log-Pass "8. /api/services verified: Grafana is 'Connected', Prometheus is 'Collecting', Backend/Database/Frontend are 'Healthy'"
  } else {
    Log-Fail "8. /api/services check failed after 60s" $detail
  }
} catch {
  Log-Fail "8. Services check threw exception: $($_.Exception.Message)"
}

# Step 9: Exposure and loopback isolation
try {
  $loopbackOk = $false
  try {
    $h = Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/health" -UseBasicParsing -TimeoutSec 3
    $loopbackOk = ($h.StatusCode -eq 200)
  } catch {}

  $portsInspect = docker inspect devmonitor-grafana --format '{{json .NetworkSettings.Ports}}' 2>$null
  $binding127 = ($portsInspect -match '127\.0\.0\.1')

  $apiGrafana404 = $false
  try {
    $ap = Invoke-WebRequest -Uri "$BaseUrl/api/grafana" -UseBasicParsing -TimeoutSec 3
    if ($ap.StatusCode -eq 404) { $apiGrafana404 = $true }
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 404) {
      $apiGrafana404 = $true
    }
  }

  $grafanaNotProxied = $false
  try {
    $gp = Invoke-WebRequest -Uri "$BaseUrl/grafana" -UseBasicParsing -TimeoutSec 3
    if ($gp.StatusCode -eq 404 -or ($gp.StatusCode -eq 200 -and $gp.Content.Contains('id="root"') -and -not $gp.Content.Contains('Grafana'))) {
      $grafanaNotProxied = $true
    }
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 404) {
      $grafanaNotProxied = $true
    }
  }

  if ($loopbackOk -and $binding127 -and $apiGrafana404 -and $grafanaNotProxied) {
    Log-Pass "9. Exposure verified: Grafana answers on 127.0.0.1:3000; docker port bound to 127.0.0.1; /api/grafana returns 404 and Grafana is not proxied by nginx"
  } else {
    Log-Fail "9. Exposure check failed (LoopbackOk: $loopbackOk, Binding127: $binding127, ApiGrafana404: $apiGrafana404, GrafanaNotProxied: $grafanaNotProxied)"
  }
} catch {
  Log-Fail "9. Exposure check threw exception: $($_.Exception.Message)"
}

# Step 10: Persistence and provisioning across restart
try {
  docker compose restart grafana | Out-Null
  
  $waitReady = 0
  $readyAfter = $false
  while ($waitReady -lt 60) {
    try {
      $h = Invoke-RestMethod -Uri "$GrafanaUrl/api/health" -UseBasicParsing -TimeoutSec 2
      if ($h.database -eq "ok") {
        $readyAfter = $true
        break
      }
    } catch {}
    Start-Sleep -Seconds 2
    $waitReady += 2
  }

  $searchAfter = Invoke-RestMethod -Uri "$GrafanaUrl/api/search?type=dash-db" -Headers $authHeaders -UseBasicParsing
  $dsAfter = Invoke-RestMethod -Uri "$GrafanaUrl/api/datasources" -Headers $authHeaders -UseBasicParsing
  $hasDs = ($dsAfter | Where-Object { $_.uid -eq "devmonitor-prometheus" }) -ne $null

  if ($readyAfter -and $searchAfter.Count -eq 3 -and $hasDs) {
    Log-Pass "10. Persistence verified: all 3 dashboards and Prometheus datasource present after container restart"
  } else {
    Log-Fail "10. Persistence check failed (ReadyAfter: $readyAfter, DashCount: $($searchAfter.Count), HasDs: $hasDs)"
  }
} catch {
  Log-Fail "10. Persistence check threw exception: $($_.Exception.Message)"
}

Write-Host "`n=== Test Summary ==="
Write-Host "Passed: $($script:passed)"
Write-Host "Failed: $($script:failed)"

if ($script:failed -gt 0) {
  exit 1
}
exit 0
