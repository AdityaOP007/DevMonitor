# scripts/check-alert-page.ps1
# ==============================================================================
# DevMonitor: Alert Receiver Page & Nginx Proxy Verification Suite (PowerShell)
# ==============================================================================
# Verifies the Alert Receiver frontend integration:
#   1. All 8 containers healthy
#   2. GET /receiver/alerts proxy returns 200 with JSON array
#   3. Method/path restrictions (403 on POST, 404 on /clear, /webhook, etc.)
#   4. SPA deep link /alert-receiver returns 200
#   5. Pipeline test with synthetic alert (<script> plain text preservation)
#   6. Independence from backend (backend down -> /receiver/alerts still 200)
#   7. Receiver outage resilience (receiver down -> app survives, recovers)
#   8. Summary and cleanup
# ==============================================================================

param(
  [switch]$SkipSlow,
  [string]$BaseUrl = "http://localhost:8080",
  [string]$AlertmanagerUrl = "http://127.0.0.1:9093",
  [string]$ReceiverDirectUrl = "http://127.0.0.1:8025"
)

$ErrorActionPreference = "Stop"
$script:passed = 0
$script:skipped = 0
$script:failed = 0

function Log-Pass($msg) {
  Write-Host "[PASS] $msg" -ForegroundColor Green
  $script:passed++
}

function Log-Skip($msg) {
  Write-Host "[SKIP] $msg" -ForegroundColor Yellow
  $script:skipped++
}

function Log-Fail($msg, $detail = "") {
  Write-Host "[FAIL] $msg" -ForegroundColor Red
  if ($detail) { Write-Host "       $detail" -ForegroundColor DarkRed }
  $script:failed++
}

function Poll-Condition([scriptblock]$condition, [int]$timeoutSeconds, [string]$desc, [int]$intervalSec = 2) {
  $elapsed = 0
  while ($elapsed -lt $timeoutSeconds) {
    try {
      $val = & $condition
      if ($val) { return $val }
    } catch {}
    Start-Sleep -Seconds $intervalSec
    $elapsed += $intervalSec
  }
  return $null
}

Write-Host "=== DevMonitor Alert Receiver Page Verification Suite ==="
Write-Host "Frontend Base URL:   $BaseUrl"
Write-Host "Alertmanager URL:    $AlertmanagerUrl"
Write-Host "Direct Receiver URL: $ReceiverDirectUrl"
Write-Host "Mode:                $(if ($SkipSlow) { 'Fast (-SkipSlow)' } else { 'Full (with slow backend down soak)' })`n"

try {
  # ----------------------------------------------------------------------------
  # Step 1: Compose config & 8 healthy containers
  # ----------------------------------------------------------------------------
  Write-Host "--- Step 1: Validating Compose config and verifying 8 containers ---"
  docker compose config -q
  if ($LASTEXITCODE -ne 0) {
    Log-Fail "1. docker compose config -q failed"
    exit 1
  }

  docker compose up -d --build | Out-Null

  $containers = @(
    "devmonitor-postgres",
    "devmonitor-backend",
    "devmonitor-frontend",
    "devmonitor-prometheus",
    "devmonitor-node-exporter",
    "devmonitor-grafana",
    "devmonitor-alert-receiver",
    "devmonitor-alertmanager"
  )

  $allHealthy = Poll-Condition {
    foreach ($c in $containers) {
      $status = (docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $c 2>$null).Trim()
      if ($status -ne "healthy" -and $status -ne "running") {
        return $false
      }
    }
    return $true
  } -timeoutSeconds 150 -desc "8 containers running/healthy" -intervalSec 3

  if ($allHealthy) {
    Log-Pass "1. All 8 containers are running and healthy"
  } else {
    Log-Fail "1. Timeout waiting for all 8 containers to report healthy"
  }

  # ----------------------------------------------------------------------------
  # Step 2: GET /receiver/alerts proxy
  # ----------------------------------------------------------------------------
  Write-Host "`n--- Step 2: Testing GET /receiver/alerts through Nginx proxy ---"
  try {
    $res = Invoke-RestMethod -Uri "$BaseUrl/receiver/alerts" -Method Get
    if ($res -is [System.Array] -or $null -eq $res) {
      Log-Pass "2. GET $BaseUrl/receiver/alerts returned 200 with JSON array"
    } else {
      Log-Fail "2. GET $BaseUrl/receiver/alerts did not return array JSON"
    }
  } catch {
    Log-Fail "2. GET $BaseUrl/receiver/alerts failed: $($_.Exception.Message)"
  }

  # ----------------------------------------------------------------------------
  # Step 3: Method and path restrictions
  # ----------------------------------------------------------------------------
  Write-Host "`n--- Step 3: Verifying Nginx method and path restrictions ---"
  try {
    # 3a. POST to /receiver/alerts should return 403 or 405
    $postAlertsCode = (& curl.exe -s -o NUL -w "%{http_code}" -X POST "$BaseUrl/receiver/alerts").Trim()
    $postAlertsBlocked = ($postAlertsCode -eq "403" -or $postAlertsCode -eq "405")

    # 3b. Probed restricted paths must return 404
    $clearGetCode   = (& curl.exe -s -o NUL -w "%{http_code}" "$BaseUrl/receiver/clear").Trim()
    $webhookGetCode = (& curl.exe -s -o NUL -w "%{http_code}" "$BaseUrl/receiver/webhook").Trim()
    $healthGetCode  = (& curl.exe -s -o NUL -w "%{http_code}" "$BaseUrl/receiver/health").Trim()
    $rootGetCode    = (& curl.exe -s -o NUL -w "%{http_code}" "$BaseUrl/receiver/").Trim()

    $pathsBlocked = ($clearGetCode -eq "404" -and $webhookGetCode -eq "404" -and $healthGetCode -eq "404" -and $rootGetCode -eq "404")

    # 3c. POST to /receiver/clear must return 404 or 405, and receiver alert count unchanged
    $beforeAlerts = Invoke-RestMethod -Uri "$ReceiverDirectUrl/alerts" -Method Get
    $beforeCount = if ($beforeAlerts) { $beforeAlerts.Count } else { 0 }

    $postClearCode = (& curl.exe -s -o NUL -w "%{http_code}" -X POST "$BaseUrl/receiver/clear").Trim()
    $postClearBlocked = ($postClearCode -eq "404" -or $postClearCode -eq "405")

    $afterAlerts = Invoke-RestMethod -Uri "$ReceiverDirectUrl/alerts" -Method Get
    $afterCount = if ($afterAlerts) { $afterAlerts.Count } else { 0 }
    $clearUntouched = ($beforeCount -eq $afterCount)

    if ($postAlertsBlocked -and $pathsBlocked -and $postClearBlocked -and $clearUntouched) {
      Log-Pass "3. Method and path restrictions verified: POST /receiver/alerts returned $postAlertsCode; /receiver/{clear,webhook,health,''} returned 404; receiver list untouched"
    } else {
      Log-Fail "3. Path/method restriction violation" "POST /alerts: $postAlertsCode, ClearGet: $clearGetCode, WebhookGet: $webhookGetCode, HealthGet: $healthGetCode, RootGet: $rootGetCode, PostClear: $postClearCode, Untouched: $clearUntouched"
    }
  } catch {
    Log-Fail "3. Method and path restriction check failed: $($_.Exception.Message)"
  }

  # ----------------------------------------------------------------------------
  # Step 4: SPA deep link /alert-receiver
  # ----------------------------------------------------------------------------
  Write-Host "`n--- Step 4: Verifying SPA deep link /alert-receiver ---"
  try {
    $spaRes = Invoke-WebRequest -Uri "$BaseUrl/alert-receiver" -UseBasicParsing
    $is200 = ($spaRes.StatusCode -eq 200)
    $hasHtml = $spaRes.Content.Contains("<div id=""root"">") -or $spaRes.Content.Contains("DevMonitor")
    if ($is200 -and $hasHtml) {
      Log-Pass "4. GET $BaseUrl/alert-receiver returned 200 with SPA HTML"
    } else {
      Log-Fail "4. GET $BaseUrl/alert-receiver failed" "StatusCode: $($spaRes.StatusCode)"
    }
  } catch {
    Log-Fail "4. SPA deep link failed: $($_.Exception.Message)"
  }

  # ----------------------------------------------------------------------------
  # Step 5: Pipeline test with synthetic alert (<script> plain text check)
  # ----------------------------------------------------------------------------
  Write-Host "`n--- Step 5: Testing alert pipeline with synthetic alert and script tag ---"
  try {
    $testId = [Guid]::NewGuid().ToString().Substring(0, 8)
    $syntheticAlertName = "DevMonitorPageTest-$testId"
    $scriptTag = "<script>alert('xss-$testId')</script>"
    $nowIso = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

    $singleAlertJson = @{
      labels = @{
        alertname = $syntheticAlertName
        severity = "warning"
        instance = "test-host:8080"
      }
      annotations = @{
        summary = $scriptTag
        description = "Pipeline verification for DevMonitor Alert Receiver page"
        action = "Verify plain text rendering in JSON and UI"
      }
      startsAt = $nowIso
      endsAt = "2099-01-01T00:00:00Z"
    } | ConvertTo-Json -Depth 5 -Compress

    $payload = "[$singleAlertJson]"

    # Send to Alertmanager API
    $postRes = Invoke-WebRequest -Uri "$AlertmanagerUrl/api/v2/alerts" -Method Post -ContentType "application/json" -Body $payload -UseBasicParsing
    if ($postRes.StatusCode -ne 200) {
      Log-Fail "5. Failed to post synthetic alert to Alertmanager (Status: $($postRes.StatusCode))"
    } else {
      # Poll /receiver/alerts through Nginx proxy
      $foundFiring = Poll-Condition {
        $items = Invoke-RestMethod -Uri "$BaseUrl/receiver/alerts" -Method Get -ErrorAction SilentlyContinue
        $matched = $items | Where-Object { $_.alertname -eq $syntheticAlertName -and $_.status -eq "firing" }
        return $matched
      } -timeoutSeconds 60 -desc "Synthetic firing alert via /receiver/alerts" -intervalSec 2

      if ($foundFiring -and $foundFiring.summary -eq $scriptTag) {
        Write-Host "Synthetic firing alert arrived via proxy with unmodified script tag: $($foundFiring.summary)" -ForegroundColor Cyan

        # Send resolved version
        $singleResolvedJson = @{
          labels = @{
            alertname = $syntheticAlertName
            severity = "warning"
            instance = "test-host:8080"
          }
          annotations = @{
            summary = $scriptTag
            description = "Pipeline verification for DevMonitor Alert Receiver page"
            action = "Verify plain text rendering in JSON and UI"
          }
          startsAt = $nowIso
          endsAt = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        } | ConvertTo-Json -Depth 5 -Compress

        $resolvedPayload = "[$singleResolvedJson]"

        Invoke-WebRequest -Uri "$AlertmanagerUrl/api/v2/alerts" -Method Post -ContentType "application/json" -Body $resolvedPayload -UseBasicParsing | Out-Null

        $foundResolved = Poll-Condition {
          $items = Invoke-RestMethod -Uri "$BaseUrl/receiver/alerts" -Method Get -ErrorAction SilentlyContinue
          $matched = $items | Where-Object { $_.alertname -eq $syntheticAlertName -and $_.status -eq "resolved" }
          return $matched
        } -timeoutSeconds 90 -desc "Synthetic resolved alert via /receiver/alerts" -intervalSec 2

        if ($foundResolved) {
          Log-Pass "5. Pipeline test passed: synthetic firing alert with <script> tag arrived via Nginx proxy, plain text was preserved, and resolved alert arrived"
        } else {
          Log-Fail "5. Resolved notification did not arrive within 90s"
        }
      } else {
        Log-Fail "5. Firing synthetic alert did not arrive via proxy or script tag was corrupted"
      }
    }
  } catch {
    Log-Fail "5. Pipeline test failed: $($_.Exception.Message)"
  }

  # ----------------------------------------------------------------------------
  # Step 6: Independence from the backend
  # ----------------------------------------------------------------------------
  Write-Host "`n--- Step 6: Verifying independence from backend container ---"
  try {
    Write-Host "Stopping devmonitor-backend container..."
    docker stop devmonitor-backend | Out-Null
    Start-Sleep -Seconds 2

    $backendDownCode = (& curl.exe -s -o NUL -w "%{http_code}" "$BaseUrl/api/health").Trim()
    $receiverUpCode  = (& curl.exe -s -o NUL -w "%{http_code}" "$BaseUrl/receiver/alerts").Trim()

    $independenceOk = (($backendDownCode -eq "502" -or $backendDownCode -eq "504") -and $receiverUpCode -eq "200")

    if ($independenceOk) {
      Log-Pass "6a. Backend independence confirmed: /api/health returned $backendDownCode while /receiver/alerts returned 200"
    } else {
      Log-Fail "6a. Backend independence failed: /api/health returned $backendDownCode, /receiver/alerts returned $receiverUpCode"
    }

    if ($SkipSlow) {
      Log-Skip "6b. Real BackendDown soak test skipped (-SkipSlow flag supplied)"
      Write-Host "Restarting devmonitor-backend container..."
      docker start devmonitor-backend | Out-Null
    } else {
      Write-Host "Waiting for REAL BackendDown alert to fire while backend remains stopped (approx 90-120s)..."
      $bdFired = Poll-Condition {
        $items = Invoke-RestMethod -Uri "$BaseUrl/receiver/alerts" -Method Get -ErrorAction SilentlyContinue
        $matched = $items | Where-Object { $_.alertname -eq "BackendDown" -and $_.status -eq "firing" }
        return $matched
      } -timeoutSeconds 180 -desc "BackendDown firing via /receiver/alerts" -intervalSec 5

      if ($bdFired) {
        $capturedJson = ($bdFired | ConvertTo-Json -Compress)
        Write-Host "Captured real BackendDown via proxy while backend DOWN: $capturedJson" -ForegroundColor Cyan

        Write-Host "Restarting devmonitor-backend container..."
        docker start devmonitor-backend | Out-Null

        Write-Host "Waiting for BackendDown to resolve and dispatch notification..."
        $bdResolved = Poll-Condition {
          $items = Invoke-RestMethod -Uri "$BaseUrl/receiver/alerts" -Method Get -ErrorAction SilentlyContinue
          $matched = $items | Where-Object { $_.alertname -eq "BackendDown" -and $_.status -eq "resolved" }
          return $matched
        } -timeoutSeconds 240 -desc "BackendDown resolved via /receiver/alerts" -intervalSec 5

        if ($bdResolved) {
          Log-Pass "6b. Real BackendDown verified: appeared firing via Nginx proxy while backend DOWN; resolved after restart"
        } else {
          Log-Fail "6b. BackendDown did not resolve within timeout"
        }
      } else {
        Log-Fail "6b. Real BackendDown alert did not fire within timeout"
        docker start devmonitor-backend | Out-Null
      }
    }
  } catch {
    Log-Fail "6. Backend independence test threw exception: $($_.Exception.Message)"
  }

  # ----------------------------------------------------------------------------
  # Step 7: Receiver outage resilience
  # ----------------------------------------------------------------------------
  Write-Host "`n--- Step 7: Verifying resilience during alert-receiver outage ---"
  try {
    Write-Host "Stopping devmonitor-alert-receiver container..."
    docker stop devmonitor-alert-receiver | Out-Null
    Start-Sleep -Seconds 2

    # /receiver/alerts should return non-200 (e.g. 502 Bad Gateway) within 5s
    $recDownCode = (& curl.exe -s -m 5 -o NUL -w "%{http_code}" "$BaseUrl/receiver/alerts").Trim()
    $feSurvivesCode = (& curl.exe -s -m 5 -o NUL -w "%{http_code}" "$BaseUrl/").Trim()

    $restartCount = (docker inspect --format '{{.RestartCount}}' devmonitor-frontend 2>$null).Trim()

    $resilienceOk = ($recDownCode -ne "200" -and $feSurvivesCode -eq "200" -and $restartCount -eq "0")

    Write-Host "Restarting devmonitor-alert-receiver container..."
    docker start devmonitor-alert-receiver | Out-Null

    # Verify recovery within 60s
    $recovered = Poll-Condition {
      $code = (& curl.exe -s -m 3 -o NUL -w "%{http_code}" "$BaseUrl/receiver/alerts").Trim()
      return ($code -eq "200")
    } -timeoutSeconds 60 -desc "Recovery of /receiver/alerts" -intervalSec 2

    if ($resilienceOk -and $recovered) {
      Log-Pass "7. Receiver outage verified: /receiver/alerts returned $recDownCode when receiver stopped; frontend root returned 200 with restartCount=0; recovered to 200 within 60s"
    } else {
      Log-Fail "7. Receiver outage check failed" "DownCode: $recDownCode, FeRoot: $feSurvivesCode, RestartCount: $restartCount, Recovered: $recovered"
    }
  } catch {
    Log-Fail "7. Receiver outage check threw exception: $($_.Exception.Message)"
  }

} finally {
  # Cleanup safety: always ensure containers are running
  docker start devmonitor-backend 2>$null | Out-Null
  docker start devmonitor-alert-receiver 2>$null | Out-Null
}

Write-Host "`n=== Test Summary ==="
Write-Host "Passed:  $($script:passed)"
Write-Host "Skipped: $($script:skipped)"
Write-Host "Failed:  $($script:failed)"

if ($script:failed -gt 0) {
  exit 1
}
exit 0
