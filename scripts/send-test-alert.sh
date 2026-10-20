#!/usr/bin/env bash
# ==============================================================================
# DevMonitor - Send Test Alert to Alertmanager (Bash)
# ==============================================================================
# Sends a synthetic TestAlert directly to Alertmanager's v2 API (port 9093).
#
# Usage:
#   ./scripts/send-test-alert.sh            # Send firing alert
#   ./scripts/send-test-alert.sh --resolved # Send resolved alert
# ==============================================================================

set -euo pipefail

ALERTMANAGER_URL="${ALERTMANAGER_URL:-http://127.0.0.1:9093}"
RESOLVED=0

for arg in "$@"; do
  case "$arg" in
    --resolved|-r)
      RESOLVED=1
      ;;
  esac
done

NOW_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ "$RESOLVED" -eq 1 ]; then
  STARTS_AT=$(date -u -d '5 minutes ago' +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v-5M +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "$NOW_ISO")
  ENDS_AT="$NOW_ISO"
  STATUS_MSG="RESOLVED"
else
  STARTS_AT="$NOW_ISO"
  ENDS_AT=$(date -u -d '+1 hour' +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v+1H +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "2099-01-01T00:00:00Z")
  STATUS_MSG="FIRING"
fi

PAYLOAD="[{
  \"labels\": {
    \"alertname\": \"TestAlert\",
    \"severity\": \"warning\",
    \"instance\": \"manual-test:9093\"
  },
  \"annotations\": {
    \"summary\": \"TEST ALERT\",
    \"description\": \"This is a test of the alert pipeline\",
    \"action\": \"Verify that your webhook receiver, Slack channel, or email received this notification.\"
  },
  \"startsAt\": \"$STARTS_AT\",
  \"endsAt\": \"$ENDS_AT\"
}]"

echo "Sending $STATUS_MSG TestAlert to Alertmanager ($ALERTMANAGER_URL/api/v2/alerts)..."

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "$ALERTMANAGER_URL/api/v2/alerts")

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "[SUCCESS] Test alert posted successfully ($STATUS_MSG, HTTP $HTTP_CODE)."
  echo "Check local receiver at: http://127.0.0.1:8025/"
else
  echo "[ERROR] Failed to post test alert (HTTP $HTTP_CODE)."
  exit 1
fi
