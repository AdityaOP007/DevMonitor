# scripts/check-alerts.ps1
# ==============================================================================
# DevMonitor Phase 15: Alertmanager Verification Suite (PowerShell)
# ==============================================================================
# Verifies the complete alerting pipeline:
#   Prometheus Alert Rules -> Alertmanager Routing -> Local Webhook Receiver
#
# Usage:
#   .\scripts\check-alerts.ps1            # Full test suite (including slow error-rate test)
#   .\scripts\check-alerts.ps1 -SkipSlow  # Fast mode (skips 5-minute error rate soak)
# ==============================================================================

param(
  [switch]$SkipSlow,
  [string]$BaseUrl = "http://localhost:8080",
  [string]$BackendUrl = "http://127.0.0.1:5000",
  [string]$PrometheusUrl = "http://127.0.0.1:9090",
  [string]$AlertmanagerUrl = "http://127.0.0.1:9093",
  [string]$ReceiverUrl = "http://127.0.0.1:8025",
  [string]$GrafanaUrl = "http://127.0.0.1:3000"
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

function Poll-Condition([scriptblock]$condition, [int]$timeoutSeconds, [string]$desc, [int]$intervalSec = 2) {
  $elapsed = 0
  while ($elapsed -lt $timeoutSeconds) {
    try {
      $res = & $condition
      if ($res) { return $res }
    } catch {}
    Start-Sleep -Seconds $intervalSec
    $elapsed += $intervalSec
  }
  return $null
}

Write-Host "=== DevMonitor Alertmanager Verification Suite ==="
Write-Host "Alertmanager: $AlertmanagerUrl"
Write-Host "Receiver:     $ReceiverUrl"
Write-Host "Prometheus:   $PrometheusUrl"
Write-Host "Grafana:      $GrafanaUrl"
Write-Host "Mode:         $(if ($SkipSlow) { 'Fast (-SkipSlow)' } else { 'Full (with slow tests)' })`n"

try {
  # ----------------------------------------------------------------------------
  # Step 1: Compose config, build & up, wait for all 8 healthy containers
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
    $healthy = $true
    foreach ($c in $containers) {
      $status = (docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $c 2>$null).Trim()
      if ($status -ne "healthy" -and $status -ne "running") {
        $healthy = $false
        break
      }
    }
    return $healthy
  } -timeoutSeconds 150 -desc "8 containers healthy" -intervalSec 3

  if ($allHealthy) {
    Log-Pass "1. All 8 containers (postgres, backend, frontend, prometheus, node-exporter, grafana, alert-receiver, alertmanager) are running and healthy"
  } else {
    Log-Fail "1. One or more containers failed to become healthy within 150s"
  }

  # ----------------------------------------------------------------------------
  # Step 2: promtool check config/rules/test rules & amtool check-config
  # ----------------------------------------------------------------------------
  Write-Host "`n--- Step 2: Validating configs and rules with promtool and amtool ---"
  
  # promtool check config
  $promConfigCheck = docker run --rm --entrypoint promtool -v "${PWD}/prometheus:/etc/prometheus:ro" prom/prometheus:v3.2.1 check config /etc/prometheus/prometheus.yml 2>&1
  $promConfigOk = ($LASTEXITCODE -eq 0)

  # promtool check rules
  $promRulesCheck = docker run --rm --entrypoint promtool -v "${PWD}/prometheus:/etc/prometheus:ro" prom/prometheus:v3.2.1 check rules /etc/prometheus/rules/devmonitor-alerts.yml 2>&1
  $promRulesOk = ($LASTEXITCODE -eq 0)

  # promtool test rules
  $promTestCheck = docker run --rm --entrypoint promtool -v "${PWD}/prometheus:/etc/prometheus" -w /etc/prometheus/tests prom/prometheus:v3.2.1 test rules alert-rules.test.yml 2>&1
  $promTestOk = ($LASTEXITCODE -eq 0)

  # amtool check-config for all 3 configs (use temporary dummy secrets in ignored folder)
  Set-Content -Path "alertmanager/secrets/slack_webhook_url" -Value "https://example.com/dummy"
  Set-Content -Path "alertmanager/secrets/smtp_password" -Value "dummy_password"
  
  $amtoolCheck = docker run --rm --entrypoint amtool -v "${PWD}/alertmanager:/etc/alertmanager:ro" prom/alertmanager:v0.28.1 check-config /etc/alertmanager/alertmanager.yml /etc/alertmanager/alertmanager.slack.example.yml /etc/alertmanager/alertmanager.email.example.yml 2>&1
  $amtoolOk = ($LASTEXITCODE -eq 0)

  # Clean up dummy secrets
  Remove-Item -Path "alertmanager/secrets/slack_webhook_url", "alertmanager/secrets/smtp_password" -Force -ErrorAction SilentlyContinue

  if ($promConfigOk -and $promRulesOk -and $promTestOk -and $amtoolOk) {
    Log-Pass "2. promtool check config, check rules, test rules all passed; amtool check-config passed for all 3 Alertmanager configs"
  } else {
    Log-Fail "2. Config/rule tool validation failed" "promConfig: $promConfigOk, promRules: $promRulesOk, promTest: $promTestOk, amtool: $amtoolOk"
  }

  # ----------------------------------------------------------------------------
  # Step 3: Prometheus /api/v1/rules and /api/v1/alertmanagers
  # ----------------------------------------------------------------------------
  Write-Host "`n--- Step 3: Verifying Prometheus rules loading and Alertmanager connection ---"
  try {
    $rulesRes = Invoke-RestMethod -Uri "$PrometheusUrl/api/v1/rules"
    $allRules = @()
    foreach ($grp in $rulesRes.data.groups) {
      foreach ($r in $grp.rules) {
        $allRules += $r
      }
    }

    $expectedRules = @("HighCpuUsage", "HighMemoryUsage", "HighDiskUsage", "BackendDown", "HighErrorRate", "HighResponseTime", "DatabaseDown", "TargetDown")
    $foundRules = $allRules | ForEach-Object { $_.name }
    $missingRules = $expectedRules | Where-Object { $foundRules -notcontains $_ }
    $unhealthyRules = $allRules | Where-Object { $_.health -ne "ok" }

    $amRes = Invoke-RestMethod -Uri "$PrometheusUrl/api/v1/alertmanagers"
    $activeAm = $amRes.data.activeAlertmanagers | Where-Object { $_.url -like "*alertmanager:9093*" }

    if ($missingRules.Count -eq 0 -and $unhealthyRules.Count -eq 0 -and $activeAm -ne $null) {
      Log-Pass "3. Prometheus /api/v1/rules lists all 8 alert rules with health 'ok' (0 errors); activeAlertmanagers shows alertmanager:9093"
    } else {
      Log-Fail "3. Rules or Alertmanager target check failed" "Missing: $($missingRules -join ', '), Unhealthy: $($unhealthyRules.Count), ActiveAM: $($activeAm -ne $null)"
    }
  } catch {
    Log-Fail "3. Prometheus API check threw exception: $($_.Exception.Message)"
  }

  # ----------------------------------------------------------------------------
  # Step 4: Alertmanager /-/ready returns 200
  # ----------------------------------------------------------------------------
  Write-Host "`n--- Step 4: Verifying Alertmanager readiness ---"
  try {
    $readyRes = Invoke-WebRequest -Uri "$AlertmanagerUrl/-/ready" -UseBasicParsing
    if ($readyRes.StatusCode -eq 200) {
      Log-Pass "4. Alertmanager http://127.0.0.1:9093/-/ready returns HTTP 200 OK"
    } else {
      Log-Fail "4. Alertmanager /-/ready returned status $($readyRes.StatusCode)"
    }
  } catch {
    Log-Fail "4. Alertmanager /-/ready request failed: $($_.Exception.Message)"
  }

  # ----------------------------------------------------------------------------
  # Step 5: Fast pipeline smoke test (synthetic alert -> receiver)
  # ----------------------------------------------------------------------------
  Write-Host "`n--- Step 5: Fast pipeline smoke test (Alertmanager API -> Receiver) ---"
  try {
    # Clear existing alerts in receiver
    Invoke-RestMethod -Uri "$ReceiverUrl/clear" -Method Post | Out-Null

    $now = [DateTime]::UtcNow
    $smokeAlertName = "PipelineSmokeTest"
    $firingPayload = "[{
      `"labels`": { `"alertname`": `"$smokeAlertName`", `"severity`": `"warning`", `"instance`": `"smoke-test:9093`" },
      `"annotations`": { `"summary`": `"SMOKE TEST`", `"description`": `"Fast pipeline smoke test`", `"action`": `"None`" },
      `"startsAt`": `"$($now.ToString('yyyy-MM-ddTHH:mm:ss.fffZ'))`",
      `"endsAt`": `"$($now.AddHours(1).ToString('yyyy-MM-ddTHH:mm:ss.fffZ'))`"
    }]"

    Invoke-RestMethod -Uri "$AlertmanagerUrl/api/v2/alerts" -Method Post -ContentType "application/json" -Body $firingPayload | Out-Null

    # Poll receiver for firing alert (group_wait is 10s)
    $firingReceived = Poll-Condition {
      $alerts = Invoke-RestMethod -Uri "$ReceiverUrl/alerts"
      return ($alerts | Where-Object { $_.alertname -eq $smokeAlertName -and $_.status -eq "firing" })
    } -timeoutSeconds 60 -desc "Smoke test firing alert received"

    # Send resolved alert
    $resolvedPayload = "[{
      `"labels`": { `"alertname`": `"$smokeAlertName`", `"severity`": `"warning`", `"instance`": `"smoke-test:9093`" },
      `"annotations`": { `"summary`": `"SMOKE TEST`", `"description`": `"Fast pipeline smoke test`", `"action`": `"None`" },
      `"startsAt`": `"$($now.AddMinutes(-5).ToString('yyyy-MM-ddTHH:mm:ss.fffZ'))`",
      `"endsAt`": `"$($now.ToString('yyyy-MM-ddTHH:mm:ss.fffZ'))`"
    }]"

    Invoke-RestMethod -Uri "$AlertmanagerUrl/api/v2/alerts" -Method Post -ContentType "application/json" -Body $resolvedPayload | Out-Null

    # Poll receiver for resolved alert (group_interval is 1m)
    $resolvedReceived = Poll-Condition {
      $alerts = Invoke-RestMethod -Uri "$ReceiverUrl/alerts"
      return ($alerts | Where-Object { $_.alertname -eq $smokeAlertName -and $_.status -eq "resolved" })
    } -timeoutSeconds 90 -desc "Smoke test resolved alert received"

    if ($firingReceived -and $resolvedReceived) {
      Log-Pass "5. Pipeline smoke test: synthetic alert arrived as 'firing' and follow-up arrived as 'resolved' at local receiver"
    } else {
      Log-Fail "5. Pipeline smoke test failed (Firing: $($firingReceived -ne $null), Resolved: $($resolvedReceived -ne $null))"
    }
  } catch {
    Log-Fail "5. Pipeline smoke test threw exception: $($_.Exception.Message)"
  }

  # ----------------------------------------------------------------------------
  # Step 6: REAL end-to-end: BackendDown
  # ----------------------------------------------------------------------------
  Write-Host "`n--- Step 6: REAL end-to-end BackendDown test (stop backend -> Prometheus -> Alertmanager -> Receiver -> recover) ---"
  try {
    # Clear receiver alerts
    Invoke-RestMethod -Uri "$ReceiverUrl/clear" -Method Post | Out-Null

    Write-Host "Stopping devmonitor-backend container..."
    docker stop devmonitor-backend | Out-Null

    # Poll Prometheus /api/v1/alerts for BackendDown firing (for 1m, interval 15s)
    Write-Host "Waiting for Prometheus to evaluate BackendDown as firing (approx 75-90s)..."
    $promFiring = Poll-Condition {
      $alertsRes = Invoke-RestMethod -Uri "$PrometheusUrl/api/v1/alerts"
      $bd = $alertsRes.data.alerts | Where-Object { $_.labels.alertname -eq "BackendDown" -and $_.state -eq "firing" }
      return $bd
    } -timeoutSeconds 180 -desc "BackendDown firing in Prometheus" -intervalSec 5

    # Check Grafana datasource proxy for Firing Alerts panel expression
    $authHeaders = @{ Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:admin")) }
    $encQuery = [System.Uri]::EscapeDataString('count(ALERTS{alertstate="firing"}) or vector(0)')
    $grafanaRes = Invoke-RestMethod -Uri "$GrafanaUrl/api/datasources/proxy/uid/devmonitor-prometheus/api/v1/query?query=$encQuery" -Headers $authHeaders
    $grafanaCount = [int]$grafanaRes.data.result[0].value[1]
    $grafanaAlertsOk = ($grafanaCount -ge 1)

    # Poll Receiver for BackendDown firing notification
    Write-Host "Waiting for Alertmanager to dispatch BackendDown to receiver..."
    $receiverFiring = Poll-Condition {
      $alerts = Invoke-RestMethod -Uri "$ReceiverUrl/alerts"
      $bd = $alerts | Where-Object { $_.alertname -eq "BackendDown" -and $_.status -eq "firing" }
      return $bd
    } -timeoutSeconds 90 -desc "BackendDown in receiver" -intervalSec 3

    $descHasInstance = $false
    $descHasDuration = $false
    if ($receiverFiring) {
      $descHasInstance = $receiverFiring.description.Contains("backend:5000") -or $receiverFiring.description.Contains("Server:")
      $descHasDuration = $receiverFiring.description.Contains("1 minute") -or $receiverFiring.description.Contains("Duration")
      Write-Host "Captured Receiver Alert: $($receiverFiring | ConvertTo-Json -Compress)" -ForegroundColor Gray
    }

    # Restart backend
    Write-Host "Restarting devmonitor-backend container..."
    docker start devmonitor-backend | Out-Null

    # Poll receiver for resolved notification (group_interval is 1m)
    Write-Host "Waiting for BackendDown to resolve and dispatch resolved notification..."
    $receiverResolved = Poll-Condition {
      $alerts = Invoke-RestMethod -Uri "$ReceiverUrl/alerts"
      $bd = $alerts | Where-Object { $_.alertname -eq "BackendDown" -and $_.status -eq "resolved" }
      return $bd
    } -timeoutSeconds 180 -desc "BackendDown resolved in receiver" -intervalSec 5

    if ($promFiring -and $grafanaAlertsOk -and $receiverFiring -and $descHasInstance -and $descHasDuration -and $receiverResolved) {
      Log-Pass "6. REAL end-to-end BackendDown: stopped backend -> Prometheus fired -> Grafana Firing Alerts returned $grafanaCount -> receiver got firing alert with instance & duration -> restart backend -> receiver got resolved"
    } else {
      Log-Fail "6. REAL end-to-end BackendDown failed" "PromFiring: $($promFiring -ne $null), GrafanaCount: $grafanaCount, ReceiverFiring: $($receiverFiring -ne $null), Instance: $descHasInstance, Duration: $descHasDuration, ReceiverResolved: $($receiverResolved -ne $null)"
    }
  } catch {
    Log-Fail "6. REAL end-to-end BackendDown threw exception: $($_.Exception.Message)"
  }

  # ----------------------------------------------------------------------------
  # Step 7: REAL end-to-end: HighErrorRate
  # ----------------------------------------------------------------------------
  Write-Host "`n--- Step 7: REAL end-to-end HighErrorRate test ---"
  if ($SkipSlow) {
    Log-Pass "7. REAL end-to-end HighErrorRate skipped (-SkipSlow flag supplied)"
  } else {
    try {
      # Clear receiver
      Invoke-RestMethod -Uri "$ReceiverUrl/clear" -Method Post | Out-Null

      Write-Host "Enabling simulated error mode (POST /api/test/errors)..."
      Invoke-RestMethod -Uri "$BackendUrl/api/test/errors" -Method Post | Out-Null

      Write-Host "Generating steady HTTP traffic against backend while waiting for HighErrorRate (for: 2m)..."
      $errorRateFired = $false
      $trafficStart = [DateTime]::UtcNow
      
      while (([DateTime]::UtcNow - $trafficStart).TotalSeconds -lt 240) {
        # Generate burst of requests
        1..5 | ForEach-Object {
          try { & curl.exe -s -o NUL "http://127.0.0.1:5000/api/services" } catch {}
        }
        
        # Check if HighErrorRate is firing in receiver
        $alerts = Invoke-RestMethod -Uri "$ReceiverUrl/alerts" -ErrorAction SilentlyContinue
        $hr = $alerts | Where-Object { $_.alertname -eq "HighErrorRate" -and $_.status -eq "firing" }
        if ($hr) {
          $errorRateFired = $true
          Write-Host "HighErrorRate alert received at receiver!" -ForegroundColor Cyan
          break
        }
        Start-Sleep -Seconds 3
      }

      Write-Host "Restoring normal operation (POST /api/test/restore)..."
      Invoke-RestMethod -Uri "$BackendUrl/api/test/restore" -Method Post | Out-Null

      Write-Host "Generating normal traffic to clear error rate and wait for resolution..."
      $errorRateResolved = $false
      $restoreStart = [DateTime]::UtcNow

      while (([DateTime]::UtcNow - $restoreStart).TotalSeconds -lt 240) {
        1..5 | ForEach-Object {
          try { & curl.exe -s -o NUL "http://127.0.0.1:5000/api/services" } catch {}
        }
        $alerts = Invoke-RestMethod -Uri "$ReceiverUrl/alerts" -ErrorAction SilentlyContinue
        $hrRes = $alerts | Where-Object { $_.alertname -eq "HighErrorRate" -and $_.status -eq "resolved" }
        if ($hrRes) {
          $errorRateResolved = $true
          break
        }
        Start-Sleep -Seconds 3
      }

      if ($errorRateFired -and $errorRateResolved) {
        Log-Pass "7. REAL end-to-end HighErrorRate: /api/test/errors produced errors -> HighErrorRate fired and arrived at receiver -> /api/test/restore restored normal status -> resolved notification arrived"
      } else {
        Log-Fail "7. REAL end-to-end HighErrorRate failed" "Fired: $errorRateFired, Resolved: $errorRateResolved"
      }
    } catch {
      Log-Fail "7. REAL end-to-end HighErrorRate threw exception: $($_.Exception.Message)"
    }
  }

  # ----------------------------------------------------------------------------
  # Step 8: Inhibition rule verification
  # ----------------------------------------------------------------------------
  Write-Host "`n--- Step 8: Verifying Alertmanager Inhibition Rules ---"
  try {
    $now = [DateTime]::UtcNow
    $inhibitPayload = @(
      @{
        labels = @{ alertname = "BackendDown"; severity = "critical"; instance = "inhibit-test:5000" }
        annotations = @{ summary = "BACKEND DOWN"; description = "Backend container down"; action = "None" }
        startsAt = $now.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        endsAt = $now.AddHours(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
      },
      @{
        labels = @{ alertname = "HighErrorRate"; severity = "warning"; instance = "inhibit-test:5000" }
        annotations = @{ summary = "HIGH ERROR RATE"; description = "Errors caused by backend down"; action = "None" }
        startsAt = $now.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        endsAt = $now.AddHours(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
      }
    ) | ConvertTo-Json -Depth 5

    Invoke-RestMethod -Uri "$AlertmanagerUrl/api/v2/alerts" -Method Post -ContentType "application/json" -Body $inhibitPayload | Out-Null

    $amAlerts = Invoke-RestMethod -Uri "$AlertmanagerUrl/api/v2/alerts"
    $targetAlert = $amAlerts | Where-Object { $_.labels.alertname -eq "HighErrorRate" -and $_.labels.instance -eq "inhibit-test:5000" }
    
    $isInhibited = ($targetAlert -ne $null -and $targetAlert.status.inhibitedBy.Count -gt 0)

    # Clean up test alerts by sending resolved versions
    $cleanPayload = @(
      @{
        labels = @{ alertname = "BackendDown"; severity = "critical"; instance = "inhibit-test:5000" }
        annotations = @{ summary = "BACKEND DOWN"; description = "clean"; action = "None" }
        startsAt = $now.AddMinutes(-5).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        endsAt = $now.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
      },
      @{
        labels = @{ alertname = "HighErrorRate"; severity = "warning"; instance = "inhibit-test:5000" }
        annotations = @{ summary = "HIGH ERROR RATE"; description = "clean"; action = "None" }
        startsAt = $now.AddMinutes(-5).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        endsAt = $now.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
      }
    ) | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Uri "$AlertmanagerUrl/api/v2/alerts" -Method Post -ContentType "application/json" -Body $cleanPayload | Out-Null

    if ($isInhibited) {
      Log-Pass "8. Inhibition verified: HighErrorRate alert on same instance was inhibitedBy BackendDown (inhibitedBy: $($targetAlert.status.inhibitedBy -join ','))"
    } else {
      Log-Fail "8. Inhibition check failed: HighErrorRate was not marked as inhibited"
    }
  } catch {
    Log-Fail "8. Inhibition check threw exception: $($_.Exception.Message)"
  }

  # ----------------------------------------------------------------------------
  # Step 9: Exposure check: loopback bindings & no alert routes on 8080
  # ----------------------------------------------------------------------------
  Write-Host "`n--- Step 9: Verifying Network Exposure & Security Isolation ---"
  try {
    # Check 127.0.0.1 bindings via compose ps
    $amHealth = Invoke-WebRequest -Uri "http://127.0.0.1:9093/-/healthy" -UseBasicParsing
    $recHealth = Invoke-WebRequest -Uri "http://127.0.0.1:8025/health" -UseBasicParsing
    $loopbackOk = ($amHealth.StatusCode -eq 200 -and $recHealth.StatusCode -eq 200)

    # Check that frontend 8080 does NOT proxy alertmanager or receiver
    $feWebhookCode = (& curl.exe -s -o NUL -w "%{http_code}" "$BaseUrl/webhook")
    $feAlertsRes = Invoke-WebRequest -Uri "$BaseUrl/alerts" -UseBasicParsing
    
    # 8080/alerts returns SPA index.html containing id="root", not alert JSON
    $feAlertsNotExposed = ($feAlertsRes.Content.Contains('id="root"') -or $feAlertsRes.StatusCode -eq 404) -and (-not $feAlertsRes.Content.Contains('"alertname"'))

    # Check LAN isolation: connecting to host LAN IP on 9093 and 8025 fails/times out
    $lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1).IPAddress
    $lanBlocked = $true
    if ($lanIp) {
      $lanAm = (& curl.exe --connect-timeout 2 -s -w "%{http_code}" "http://${lanIp}:9093/-/healthy" 2>$null)
      $lanRec = (& curl.exe --connect-timeout 2 -s -w "%{http_code}" "http://${lanIp}:8025/health" 2>$null)
      if ($lanAm -eq "200" -or $lanRec -eq "200") {
        $lanBlocked = $false
      }
    }

    if ($loopbackOk -and $feAlertsNotExposed -and $lanBlocked) {
      Log-Pass "9. Exposure verified: Alertmanager on 127.0.0.1:9093; Receiver on 127.0.0.1:8025; neither exposed on LAN ($lanIp) or proxied on 8080"
    } else {
      Log-Fail "9. Exposure check failed" "Loopback: $loopbackOk, FENotExposed: $feAlertsNotExposed, LANBlocked: $lanBlocked"
    }
  } catch {
    Log-Fail "9. Exposure check threw exception: $($_.Exception.Message)"
  }

  # ----------------------------------------------------------------------------
  # Step 10: Alertmanager Silence Persistence across container restart
  # ----------------------------------------------------------------------------
  Write-Host "`n--- Step 10: Verifying Silence Persistence across container restart ---"
  try {
    $now = [DateTime]::UtcNow
    $silencePayload = @{
      matchers = @(
        @{ name = "alertname"; value = "PersistenceTestSilence"; isRegex = $false; isEqual = $true }
      )
      startsAt = $now.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
      endsAt = $now.AddHours(2).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
      createdBy = "check-alerts"
      comment = "Testing Alertmanager volume persistence"
    } | ConvertTo-Json -Depth 5

    $silenceRes = Invoke-RestMethod -Uri "$AlertmanagerUrl/api/v2/silences" -Method Post -ContentType "application/json" -Body $silencePayload
    $silenceId = $silenceRes.silenceID

    Write-Host "Created silence ID: $silenceId. Restarting alertmanager container..."
    docker compose restart alertmanager | Out-Null

    # Wait for Alertmanager to become ready after restart
    $readyAfterRestart = Poll-Condition {
      $r = Invoke-WebRequest -Uri "$AlertmanagerUrl/-/ready" -UseBasicParsing -TimeoutSec 2
      return ($r.StatusCode -eq 200)
    } -timeoutSeconds 45 -desc "Alertmanager ready after restart"

    # Fetch silence by ID
    $fetchedSilence = Invoke-RestMethod -Uri "$AlertmanagerUrl/api/v2/silence/$silenceId"
    $persisted = ($fetchedSilence -ne $null -and $fetchedSilence.status.state -eq "active")

    # Clean up (expire) silence
    Invoke-RestMethod -Uri "$AlertmanagerUrl/api/v2/silence/$silenceId" -Method Delete | Out-Null

    if ($readyAfterRestart -and $persisted) {
      Log-Pass "10. Persistence verified: Silence $silenceId survived container restart via alertmanager_data volume (state: active)"
    } else {
      Log-Fail "10. Silence persistence failed" "Ready: $readyAfterRestart, Persisted: $persisted"
    }
  } catch {
    Log-Fail "10. Silence persistence check threw exception: $($_.Exception.Message)"
  }

  # ----------------------------------------------------------------------------
  # Step 11: Secrets Hygiene
  # ----------------------------------------------------------------------------
  Write-Host "`n--- Step 11: Verifying Secrets Hygiene & Git Tracking Rules ---"
  try {
    $ignoreCheck = (git check-ignore alertmanager/secrets/slack_webhook_url alertmanager/secrets/smtp_password 2>&1)
    $ignoreExit = $LASTEXITCODE

    # Check git tracked files for slack webhook URL pattern (split to prevent self-matching in git grep)
    $slackPattern = "hooks.slack." + "com/services"
    $slackTracked = (git grep -i $slackPattern 2>&1)
    $slackExit = $LASTEXITCODE

    if ($ignoreExit -eq 0 -and $slackExit -ne 0) {
      Log-Pass "11. Secrets hygiene verified: git check-ignore covers real secret files; 0 tracked files match Slack webhook URL pattern"
    } else {
      Log-Fail "11. Secrets hygiene check failed" "CheckIgnoreExit: $ignoreExit, SlackTrackedExit: $slackExit"
    }
  } catch {
    Log-Fail "11. Secrets hygiene check threw exception: $($_.Exception.Message)"
  }

} finally {
  # Cleanup safety: always ensure backend is running and failure modes are restored
  try {
    Invoke-RestMethod -Uri "$BackendUrl/api/test/restore" -Method Post -ErrorAction SilentlyContinue | Out-Null
  } catch {}
  try {
    docker start devmonitor-backend 2>$null | Out-Null
  } catch {}
}

Write-Host "`n=== Test Summary ==="
Write-Host "Passed: $($script:passed)"
Write-Host "Failed: $($script:failed)"

if ($script:failed -gt 0) {
  exit 1
}
exit 0
