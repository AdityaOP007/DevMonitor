param(
  [string]$BaseUrl = "http://localhost:5000"
)

$passed = 0
$failed = 0

function Test-Endpoint {
  param(
    [string]$Name,
    [string]$Method,
    [string]$Path,
    [string]$Body,
    [int]$ExpectedStatus,
    [string]$KeyField
  )

  Write-Host -NoNewline "Testing $Name ($Method $Path)... "

  $argsList = @("-s", "-w", "`n%{http_code}", "-X", $Method, "$BaseUrl$Path")
  if ($Body) {
    $argsList += @("-H", "Content-Type: application/json", "-d", $Body)
  }

  $output = & curl.exe $argsList
  if ($output -is [array]) {
    $statusStr = $output[-1].Trim()
    $bodyText = ($output[0..($output.Length - 2)] -join "`n")
  } else {
    $parts = $output -split "`n"
    $statusStr = $parts[-1].Trim()
    $bodyText = ($parts[0..($parts.Length - 2)] -join "`n")
  }

  $status = [int]$statusStr

  if ($status -eq $ExpectedStatus -and (-not $KeyField -or $bodyText.Contains($KeyField))) {
    Write-Host "PASS (status $status)" -ForegroundColor Green
    $script:passed++
  } else {
    Write-Host "FAIL (status $status, expected $ExpectedStatus with '$KeyField')" -ForegroundColor Red
    Write-Host "Response: $bodyText"
    $script:failed++
  }
}

Write-Host "=== DevMonitor PowerShell Smoke Test Suite ==="
Write-Host "Target: $BaseUrl`n"

Test-Endpoint -Name "Prometheus Scrape" -Method "GET" -Path "/metrics" -ExpectedStatus 200 -KeyField "http_requests_total"
Test-Endpoint -Name "Health Check" -Method "GET" -Path "/api/health" -ExpectedStatus 200 -KeyField "status"
Test-Endpoint -Name "Server Resources" -Method "GET" -Path "/api/server" -ExpectedStatus 200 -KeyField "cpu"
Test-Endpoint -Name "Dashboard Overview" -Method "GET" -Path "/api/dashboard" -ExpectedStatus 200 -KeyField "requests"
Test-Endpoint -Name "Metrics Overview" -Method "GET" -Path "/api/metrics/overview" -ExpectedStatus 200 -KeyField "errorRate"
Test-Endpoint -Name "Requests Series" -Method "GET" -Path "/api/metrics/requests-series" -ExpectedStatus 200 -KeyField "time"
Test-Endpoint -Name "CPU Series" -Method "GET" -Path "/api/metrics/cpu-series" -ExpectedStatus 200 -KeyField "time"
Test-Endpoint -Name "Response Time Series" -Method "GET" -Path "/api/metrics/response-time-series" -ExpectedStatus 200 -KeyField "time"
Test-Endpoint -Name "Recent Errors" -Method "GET" -Path "/api/errors/recent" -ExpectedStatus 200
Test-Endpoint -Name "Services List (DB offline fallback)" -Method "GET" -Path "/api/services" -ExpectedStatus 503
Test-Endpoint -Name "Database Stats" -Method "GET" -Path "/api/database/stats" -ExpectedStatus 200 -KeyField "connections"
Test-Endpoint -Name "Alerts List (DB offline fallback)" -Method "GET" -Path "/api/alerts" -ExpectedStatus 503
Test-Endpoint -Name "Alert Config GET (DB offline fallback)" -Method "GET" -Path "/api/alerts/config" -ExpectedStatus 503

# SSRF Protection
Test-Endpoint -Name "SSRF Block Loopback" -Method "POST" -Path "/api/monitor/check-url" -Body '{\"url\":\"http://127.0.0.1\"}' -ExpectedStatus 400 -KeyField "reserved or private"
Test-Endpoint -Name "SSRF Block Localhost" -Method "POST" -Path "/api/monitor/check-url" -Body '{\"url\":\"http://localhost:5000\"}' -ExpectedStatus 400 -KeyField "forbidden"
Test-Endpoint -Name "URL Prober Public" -Method "POST" -Path "/api/monitor/check-url" -Body '{\"url\":\"https://example.com\"}' -ExpectedStatus 200 -KeyField "status"

# Test Actions
Test-Endpoint -Name "Test Load" -Method "POST" -Path "/api/test/load" -Body '{\"count\":5}' -ExpectedStatus 200 -KeyField "sent"
Test-Endpoint -Name "Simulate Errors" -Method "POST" -Path "/api/test/errors" -ExpectedStatus 200 -KeyField "success"
Test-Endpoint -Name "Simulate Slow" -Method "POST" -Path "/api/test/slow" -ExpectedStatus 200 -KeyField "success"
Test-Endpoint -Name "Simulate CPU" -Method "POST" -Path "/api/test/cpu" -ExpectedStatus 200 -KeyField "success"
Test-Endpoint -Name "Simulate Stop" -Method "POST" -Path "/api/test/stop" -ExpectedStatus 200 -KeyField "success"
Test-Endpoint -Name "Simulated Down Health" -Method "GET" -Path "/api/health" -ExpectedStatus 503 -KeyField "down"
Test-Endpoint -Name "Simulate Restore" -Method "POST" -Path "/api/test/restore" -ExpectedStatus 200 -KeyField "success"
Test-Endpoint -Name "Restored Health" -Method "GET" -Path "/api/health" -ExpectedStatus 200 -KeyField "status"

Write-Host "`n=== Test Summary ==="
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red

if ($failed -gt 0) { exit 1 }
