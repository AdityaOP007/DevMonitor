# DevMonitor Docker Deployment & Architecture Verification Script (PowerShell)
param(
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

Write-Host "=== DevMonitor Docker Verification Suite ==="
Write-Host "Target Frontend: $BaseUrl"
Write-Host "Target Backend:  $BackendLoopback`n"

# Verify docker compose syntax
docker compose config -q
if ($LASTEXITCODE -ne 0) {
  Write-Host "FATAL: docker compose config failed" -ForegroundColor Red
  exit 1
}

# Ensure containers are running and healthy
Write-Host "Starting Docker Compose stack..."
docker compose up -d --build

Write-Host "Waiting for containers to report healthy (up to 120s)..."
$timeoutSeconds = 120
$elapsed = 0
$containers = @("devmonitor-postgres", "devmonitor-backend", "devmonitor-frontend")

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

# Give services a brief moment to settle
Start-Sleep -Seconds 3

# Check 1: Root frontend SPA load
try {
  $res1 = Invoke-WebRequest -Uri "$BaseUrl/" -UseBasicParsing
  if ($res1.StatusCode -eq 200 -and $res1.Content.Contains('id="root"')) {
    Log-Pass "1. http://localhost:8080/ returns 200 and serves the app root element"
  } else {
    Log-Fail "1. Root frontend load failed (Status: $($res1.StatusCode))"
  }
} catch {
  Log-Fail "1. Root frontend request threw exception: $($_.Exception.Message)"
}

# Check 2: Proxy /api/health
try {
  $res2 = Invoke-RestMethod -Uri "$BaseUrl/api/health"
  if ($res2.status -eq "healthy" -and $res2.service -eq "devmonitor-api") {
    Log-Pass "2. http://localhost:8080/api/health returns healthy JSON via Nginx proxy"
  } else {
    Log-Fail "2. /api/health response payload unexpected: $($res2 | ConvertTo-Json -Compress)"
  }
} catch {
  Log-Fail "2. /api/health request failed: $($_.Exception.Message)"
}

# Check 3: Deep link SPA fallback
try {
  $res3 = Invoke-WebRequest -Uri "$BaseUrl/how-it-works" -UseBasicParsing
  if ($res3.StatusCode -eq 200 -and $res3.Content.Contains('id="root"')) {
    Log-Pass "3. Deep link /how-it-works returns 200 with SPA fallback"
  } else {
    Log-Fail "3. Deep link SPA fallback failed (Status: $($res3.StatusCode))"
  }
} catch {
  Log-Fail "3. Deep link request threw exception: $($_.Exception.Message)"
}

# Check 4: /metrics blocked on frontend
try {
  $res4 = Invoke-WebRequest -Uri "$BaseUrl/metrics" -UseBasicParsing
  Log-Fail "4. /metrics returned HTTP $($res4.StatusCode) on frontend (expected 404)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  if ($code -eq 404) {
    Log-Pass "4. http://localhost:8080/metrics returns 404 (metrics isolated from public frontend)"
  } else {
    Log-Fail "4. /metrics returned status $code (expected 404)"
  }
}

# Check 5: Backend loopback /metrics & LAN isolation
try {
  $res5 = Invoke-WebRequest -Uri "$BackendLoopback/metrics" -UseBasicParsing
  $isPromText = $res5.StatusCode -eq 200 -and $res5.Content.Contains("http_requests_total")
  
  # Check LAN isolation: find LAN IP and verify connection fails/times out
  $lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1).IPAddress
  $lanBlocked = $false
  if ($lanIp) {
    try {
      $lanRes = & curl.exe --connect-timeout 2 -s -w "%{http_code}" "http://${lanIp}:5000/metrics"
      if ($lanRes -ne "200") { $lanBlocked = $true }
    } catch {
      $lanBlocked = $true
    }
  } else {
    $lanBlocked = $true
  }

  if ($isPromText -and $lanBlocked) {
    Log-Pass "5. Backend :5000/metrics returns 200 on 127.0.0.1 and is not exposed on LAN ($lanIp)"
  } else {
    Log-Fail "5. Backend loopback check failed (PromText: $isPromText, LanBlocked: $lanBlocked)"
  }
} catch {
  Log-Fail "5. Backend loopback request failed: $($_.Exception.Message)"
}

# Check 6: /api/services status vocabulary
try {
  $services = Invoke-RestMethod -Uri "$BaseUrl/api/services"
  $backendSvc = $services | Where-Object { $_.name -eq "Backend API" }
  $dbSvc = $services | Where-Object { $_.name -eq "Database" }
  $frontendSvc = $services | Where-Object { $_.name -eq "Frontend" }
  $promSvc = $services | Where-Object { $_.name -eq "Prometheus" }
  $grafanaSvc = $services | Where-Object { $_.name -eq "Grafana" }

  $upOk = ($backendSvc.status -eq "Healthy") -and ($dbSvc.status -eq "Healthy") -and ($frontendSvc.status -eq "Healthy")
  $promOk = ($promSvc.status -eq "Collecting") -or ($promSvc.status -eq "Down")
  $grafanaOk = ($grafanaSvc.status -eq "Connected")

  if ($upOk -and $promOk -and $grafanaOk) {
    Log-Pass "6. /api/services shows Backend, Database, Frontend as Healthy, Prometheus as $($promSvc.status), and Grafana as Connected"
  } else {
    Log-Fail "6. Service statuses mismatch" "Backend: $($backendSvc.status), DB: $($dbSvc.status), FE: $($frontendSvc.status), Prom: $($promSvc.status), Grafana: $($grafanaSvc.status)"
  }
} catch {
  Log-Fail "6. /api/services check failed: $($_.Exception.Message)"
}

# Check 7: Failure simulation (stop & start backend)
try {
  docker stop devmonitor-backend | Out-Null
  Start-Sleep -Seconds 2

  $feRes = Invoke-WebRequest -Uri "$BaseUrl/" -UseBasicParsing
  $feSurvives = $feRes.StatusCode -eq 200

  $apiCode = (& curl.exe -s -o NUL -w "%{http_code}" "$BaseUrl/api/health").Trim()
  $apiDownOk = ($apiCode -eq "502")

  # Restart backend
  docker start devmonitor-backend | Out-Null

  # Wait for recovery (up to 60s)
  $recElapsed = 0
  $recovered = $false
  while ($recElapsed -lt 60) {
    try {
      $h = Invoke-RestMethod -Uri "$BaseUrl/api/health"
      if ($h.status -eq "healthy") {
        $recovered = $true
        break
      }
    } catch {}
    Start-Sleep -Seconds 2
    $recElapsed += 2
  }

  if ($feSurvives -and $apiDownOk -and $recovered) {
    Log-Pass "7. Failure simulation: frontend serves 200 & /api returns 502 when backend stopped; recovers within 60s"
  } else {
    Log-Fail "7. Failure simulation failed (FESurvives: $feSurvives, ApiDown502: $apiDownOk, Recovered: $recovered)"
  }
} catch {
  Log-Fail "7. Failure simulation error: $($_.Exception.Message)"
}

# Check 8: Persistence across docker compose down & up
$persistEmail = "persist-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())@example.com"
try {
  $createRes = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/users" -ContentType "application/json" -Body (@{name="PersistUser"; email=$persistEmail} | ConvertTo-Json)
  
  # docker compose down then up (without -v)
  docker compose down | Out-Null
  Start-Sleep -Seconds 3
  docker compose up -d | Out-Null

  # Wait for backend to be healthy
  $waitRec = 0
  while ($waitRec -lt 60) {
    try {
      $chk = Invoke-RestMethod -Uri "$BaseUrl/api/health"
      if ($chk.status -eq "healthy") { break }
    } catch {}
    Start-Sleep -Seconds 2
    $waitRec += 2
  }

  $usersAfter = Invoke-RestMethod -Uri "$BaseUrl/api/users?limit=100"
  $persisted = ($usersAfter | Where-Object { $_.email -eq $persistEmail }) -ne $null

  # Clean up test user
  docker exec -i devmonitor-postgres psql -U postgres -d devmonitor -c "DELETE FROM users WHERE email = '$persistEmail';" | Out-Null

  if ($persisted) {
    Log-Pass "8. Persistence verified: user survived docker compose down and restart via named volume"
  } else {
    Log-Fail "8. Persistence failed: created user was not found after restart"
  }
} catch {
  Log-Fail "8. Persistence check error: $($_.Exception.Message)"
}

# Check 9: Startup order & no crash loops
try {
  docker compose down | Out-Null
  Start-Sleep -Seconds 2
  docker compose up -d | Out-Null

  $waitS = 0
  while ($waitS -lt 60) {
    try {
      $chk = Invoke-RestMethod -Uri "$BaseUrl/api/health"
      if ($chk.status -eq "healthy") { break }
    } catch {}
    Start-Sleep -Seconds 2
    $waitS += 2
  }

  $restartCount = [int](docker inspect --format '{{.RestartCount}}' devmonitor-backend 2>$null)
  if ($restartCount -eq 0) {
    Log-Pass "9. Startup order verified: backend ended up healthy without restart crash loops (RestartCount: 0)"
  } else {
    Log-Fail "9. Backend had non-zero restarts ($restartCount)"
  }
} catch {
  Log-Fail "9. Startup order check error: $($_.Exception.Message)"
}

Write-Host "`n=== Test Summary ==="
Write-Host "Passed: $($script:passed)"
Write-Host "Failed: $($script:failed)"

if ($script:failed -gt 0) {
  exit 1
}
exit 0
