// alert-receiver/server.js
// ==============================================================================
// DevMonitor Local Alert Receiver Webhook Server
// ==============================================================================
// A lightweight, dependency-free webhook receiver built with Node.js built-ins.
// Receives JSON alert payloads from Alertmanager (v4 format), parses them, and
// keeps the most recent 100 alerts IN MEMORY for local inspection.
//
// NOTE: Alert history is stored in memory only. All received alerts will be
// cleared when the alert-receiver container is restarted.
// ==============================================================================

const http = require('http');

const PORT = 8080;
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB payload limit
const MAX_ALERTS = 100;

// In-memory alert store (newest first). Disappears on container restart.
let alerts = [];

/**
 * Escapes untrusted text to prevent HTML injection (XSS).
 * Alert text originates from external Prometheus scrapes and must be treated as untrusted.
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders the HTML inspection page.
 */
function renderHtmlPage() {
  const alertRows = alerts.map((a) => {
    const isFiring = a.status === 'firing';
    const badgeStyle = isFiring
      ? 'background: #dc2626; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: bold; text-transform: uppercase; font-size: 11px;'
      : 'background: #16a34a; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: bold; text-transform: uppercase; font-size: 11px;';
    const severityStyle = a.severity === 'critical'
      ? 'color: #ef4444; font-weight: 600;'
      : 'color: #f59e0b; font-weight: 600;';

    return `<tr>
      <td><span style="${badgeStyle}">${escapeHtml(a.status)}</span></td>
      <td style="${severityStyle}">${escapeHtml(a.severity)}</td>
      <td><strong>${escapeHtml(a.alertname)}</strong></td>
      <td><code>${escapeHtml(a.instance || 'n/a')}</code></td>
      <td>${escapeHtml(a.summary)}</td>
      <td>${escapeHtml(a.description)}</td>
      <td><em>${escapeHtml(a.action || 'None')}</em></td>
      <td style="white-space: nowrap; font-size: 12px; color: #94a3b8;">${escapeHtml(a.receivedAt)}</td>
    </tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="5">
  <title>DevMonitor Alert Receiver</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      background: #0f172a;
      color: #e2e8f0;
    }
    h1 {
      margin-top: 0;
      font-size: 24px;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .badge-count {
      background: #1e293b;
      color: #94a3b8;
      font-size: 14px;
      padding: 4px 10px;
      border-radius: 12px;
      font-weight: normal;
    }
    .explainer {
      background: #1e293b;
      border-left: 4px solid #38bdf8;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 20px;
      color: #cbd5e1;
      font-size: 14px;
      line-height: 1.5;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #1e293b;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    }
    th, td {
      padding: 12px 14px;
      text-align: left;
      border-bottom: 1px solid #334155;
      font-size: 13px;
    }
    th {
      background: #0b1329;
      color: #94a3b8;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    tr:last-child td {
      border-bottom: none;
    }
    tr:hover td {
      background: #27354f;
    }
    code {
      background: #0b1329;
      padding: 2px 6px;
      border-radius: 4px;
      color: #f1f5f9;
      font-size: 12px;
    }
    .empty-state {
      padding: 48px;
      text-align: center;
      color: #64748b;
      font-size: 15px;
    }
    .footer {
      margin-top: 16px;
      font-size: 12px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <h1>DevMonitor Alert Receiver <span class="badge-count">${alerts.length} / 100 alerts</span></h1>
  <div class="explainer">
    <strong>What is this page?</strong> This is DevMonitor's local webhook receiver. When Prometheus detects an anomaly (e.g., backend container down or high error rate), it hands the alert to Alertmanager, which posts the webhook here. Alerts are stored in memory and auto-refresh every 5 seconds.
  </div>

  ${alerts.length === 0 ? '<div class="empty-state">No alerts received yet. The pipeline is idle and healthy.</div>' : `
  <table>
    <thead>
      <tr>
        <th>Status</th>
        <th>Severity</th>
        <th>Alert Name</th>
        <th>Instance</th>
        <th>Summary</th>
        <th>Description</th>
        <th>Action</th>
        <th>Received At</th>
      </tr>
    </thead>
    <tbody>
      ${alertRows}
    </tbody>
  </table>`}

  <div class="footer">
    <span>Auto-refreshes every 5s &bull; In-memory store (cleared on restart)</span>
    <span>Bound to 127.0.0.1:8025 only</span>
  </div>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const method = req.method || 'GET';

  // GET /health - Container healthcheck endpoint
  if (method === 'GET' && url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
    return;
  }

  // GET / - Web UI table
  if (method === 'GET' && url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderHtmlPage());
    return;
  }

  // GET /alerts - JSON alert array, newest first
  if (method === 'GET' && url === '/alerts') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(alerts, null, 2));
    return;
  }

  // POST /clear - Empty in-memory list
  if (method === 'POST' && url === '/clear') {
    alerts = [];
    console.log(`[${new Date().toISOString()}] Cleared in-memory alerts store`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'Alerts cleared' }));
    return;
  }

  // POST /webhook - Alertmanager webhook notification endpoint
  if (method === 'POST' && url === '/webhook') {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Request: Content-Type must be application/json' }));
      return;
    }

    let rawBody = '';
    let bodyBytes = 0;
    let exceeded = false;

    req.on('data', (chunk) => {
      bodyBytes += chunk.length;
      if (bodyBytes > MAX_BODY_BYTES) {
        exceeded = true;
        req.destroy();
        return;
      }
      rawBody += chunk;
    });

    req.on('end', () => {
      if (exceeded) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large: exceeds 1 MB limit' }));
        return;
      }

      let payload;
      try {
        payload = JSON.parse(rawBody);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad Request: Invalid JSON body' }));
        return;
      }

      const receivedAt = new Date().toISOString();
      const incomingAlerts = Array.isArray(payload.alerts) ? payload.alerts : [];
      const globalStatus = payload.status || 'unknown';

      // Transform and store each incoming alert
      const newEntries = incomingAlerts.map((a) => {
        const labels = a.labels || {};
        const annotations = a.annotations || {};
        return {
          status: a.status || globalStatus,
          alertname: labels.alertname || 'Unknown',
          severity: labels.severity || 'warning',
          summary: annotations.summary || '',
          description: annotations.description || '',
          action: annotations.action || '',
          instance: labels.instance || '',
          startsAt: a.startsAt || '',
          endsAt: a.endsAt || '',
          receivedAt: receivedAt,
        };
      });

      // Prepend newest alerts, cap at 100 entries in memory
      alerts = [...newEntries, ...alerts].slice(0, MAX_ALERTS);

      console.log(`[${receivedAt}] Webhook received: status=${globalStatus}, count=${incomingAlerts.length}, total_stored=${alerts.length}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', received: incomingAlerts.length }));
    });

    req.on('error', (err) => {
      console.error('Request error on /webhook:', err.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });

    return;
  }

  // 404 for any other route
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`DevMonitor alert receiver listening on http://0.0.0.0:${PORT}`);
});
