# scripts/send-test-alert.ps1
# ==============================================================================
# DevMonitor - Send Test Alert to Alertmanager
# ==============================================================================
# Sends a synthetic TestAlert directly to Alertmanager's v2 API (port 9093).
# Used to verify that Alertmanager and its notification receivers (local webhook,
# Slack, or email) are functioning correctly.
#
# Usage:
#   .\scripts\send-test-alert.ps1            # Send firing alert
#   .\scripts\send-test-alert.ps1 -Resolved  # Send resolved alert
# ==============================================================================

param(
  [switch]$Resolved,
  [string]$AlertmanagerUrl = "http://127.0.0.1:9093"
)

$ErrorActionPreference = "Stop"

$now = [DateTime]::UtcNow
$nowIso = $now.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

if ($Resolved) {
  # Resolved alert has endsAt in the past/present
  $startsAt = $now.AddMinutes(-5).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
  $endsAt = $nowIso
  $statusMsg = "RESOLVED"
} else {
  # Firing alert has endsAt far into the future (or null)
  $startsAt = $nowIso
  $endsAt = $now.AddHours(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
  $statusMsg = "FIRING"
}

$alertPayload = @(
  @{
    labels = @{
      alertname = "TestAlert"
      severity  = "warning"
      instance  = "manual-test:9093"
    }
    annotations = @{
      summary     = "TEST ALERT"
      description = "This is a test of the alert pipeline"
      action      = "Verify that your webhook receiver, Slack channel, or email received this notification."
    }
    startsAt = $startsAt
    endsAt   = $endsAt
  }
)

$jsonBody = $alertPayload | ConvertTo-Json -Depth 5 -Compress

Write-Host "Sending $statusMsg TestAlert to Alertmanager ($AlertmanagerUrl/api/v2/alerts)..." -ForegroundColor Cyan

try {
  $response = Invoke-RestMethod -Uri "$AlertmanagerUrl/api/v2/alerts" `
    -Method Post `
    -ContentType "application/json" `
    -Body $jsonBody

  Write-Host "[SUCCESS] Test alert posted successfully ($statusMsg)." -ForegroundColor Green
  Write-Host "Check local receiver at: http://127.0.0.1:8025/" -ForegroundColor Gray
} catch {
  Write-Host "[ERROR] Failed to post test alert to Alertmanager: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
