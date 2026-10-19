# DevMonitor Backend Service

Real-time monitoring backend, metrics pipeline collector, and educational observability engine for **DevMonitor**.

## Architecture & Data Paths

The backend provides two distinct data paths:
1. **Application Data Path:** React -> REST API (`/api/*`) -> Express -> PostgreSQL.
2. **Monitoring Data Path:** Backend instruments incoming requests using `prom-client` and exposes `/metrics`. Prometheus scrapes `/metrics` periodically (every 15s) in later phases.

---

## Prerequisites & Local PostgreSQL Setup

To run a local PostgreSQL instance for development without manual installation:

```bash
docker run --name devmonitor-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=devmonitor -p 5432:5432 -d postgres:16-alpine
```

*(Note: Production containerization with Docker Compose, Prometheus, Grafana, Node Exporter, and Alertmanager will be introduced in subsequent phases.)*

---

## Installation & Setup

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Configuration:**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

   | Variable | Default | Description |
   |---|---|---|
   | `PORT` | `5000` | HTTP port for Express server and Prometheus scrape target |
   | `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/devmonitor` | PostgreSQL connection string |
   | `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin for CORS |
   | `ENABLE_TEST_ENDPOINTS` | `true` | Enables failure simulation & traffic generation routes |
   | `SAMPLE_INTERVAL_SECONDS` | `15` | Time-series sampling resolution |
   | `HEALTH_CHECK_INTERVAL_SECONDS` | `30` | Periodic service reachability polling interval |
   | `TEST_MAX_REQUESTS` | `1000` | Upper limit for test load generator |

3. **Run Database Migrations & Seeds:**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
   *(Migrations and seeds are also checked and executed automatically on server boot if PostgreSQL is available.)*

4. **Start Development Server:**
   ```bash
   npm run dev
   ```

5. **Production Build & Execution:**
   ```bash
   npm run build
   npm start
   ```

---

## API Reference & Example Curls

### Core Observability Endpoints

- **Prometheus Metrics Scrape Target:**
  ```bash
  curl http://localhost:5000/metrics
  ```
  *Exposes standard process metrics alongside `http_requests_total`, `http_errors_total`, `http_request_duration_seconds`, and `http_active_requests`.*

- **Health Status:**
  ```bash
  curl http://localhost:5000/api/health
  # {"status":"healthy","service":"devmonitor-api","uptime":42}
  ```

- **Server Resources:**
  ```bash
  curl http://localhost:5000/api/server
  # {"cpu":18,"memory":64,"disk":42,"uptime":142500}
  ```

- **Dashboard Headline Statistics:**
  ```bash
  curl http://localhost:5000/api/dashboard
  # {"requests":140,"errors":0,"responseTime":12,"uptime":100}
  ```

### Dashboard Time-Series & Logs

- **Metrics Overview:**
  ```bash
  curl http://localhost:5000/api/metrics/overview
  # {"requests":140,"errors":0,"errorRate":0,"responseTime":12,"throughput":2}
  ```

- **Requests per Minute Series:**
  ```bash
  curl http://localhost:5000/api/metrics/requests-series
  # [{"time":"19:00","requests":120},{"time":"19:02","requests":140}]
  ```

- **CPU Usage Series:**
  ```bash
  curl http://localhost:5000/api/metrics/cpu-series
  # [{"time":"19:00","cpu":14},{"time":"19:02","cpu":18}]
  ```

- **Response Time Series:**
  ```bash
  curl http://localhost:5000/api/metrics/response-time-series
  # [{"time":"19:00","responseTime":10},{"time":"19:02","responseTime":12}]
  ```

- **Recent 5xx Errors:**
  ```bash
  curl http://localhost:5000/api/errors/recent
  ```

- **Monitored Services:**
  ```bash
  curl http://localhost:5000/api/services
  ```

- **Database Performance:**
  ```bash
  curl http://localhost:5000/api/database/stats
  # {"connections":1,"queries":24,"queryDuration":2,"databaseSize":"8432 kB"}
  ```

### Alerts & Threshold Rules

- **Incident History:**
  ```bash
  curl http://localhost:5000/api/alerts
  ```

- **Get Alert Configuration:**
  ```bash
  curl http://localhost:5000/api/alerts/config
  ```

- **Update Alert Configuration:**
  ```bash
  curl -X POST http://localhost:5000/api/alerts/config \
    -H "Content-Type: application/json" \
    -d '{"cpuThreshold":80,"memoryThreshold":85,"errorRateThreshold":5,"responseTimeThreshold":300,"durationMinutes":5}'
  ```

### External URL Probing (Level 1 Blackbox Check)

- **Probe Public Web Address (SSRF Protected):**
  ```bash
  curl -X POST http://localhost:5000/api/monitor/check-url \
    -H "Content-Type: application/json" \
    -d '{"url":"https://example.com"}'
  ```

### Playground & Failure Simulator Endpoints

- **Generate Inbound Traffic:**
  ```bash
  curl -X POST http://localhost:5000/api/test/load -H "Content-Type: application/json" -d '{"count":50}'
  ```

- **Simulate Error Spike (turns error rate red):**
  ```bash
  curl -X POST http://localhost:5000/api/test/errors
  ```

- **Simulate Latency Delay:**
  ```bash
  curl -X POST http://localhost:5000/api/test/slow
  ```

- **Simulate CPU Workload:**
  ```bash
  curl -X POST http://localhost:5000/api/test/cpu
  ```

- **Simulate Backend Down:**
  ```bash
  curl -X POST http://localhost:5000/api/test/stop
  ```

- **Restore System to Normal:**
  ```bash
  curl -X POST http://localhost:5000/api/test/restore
  ```

---

## Running Smoke Tests

Run the automated test suite against the running server:

```bash
# Bash:
bash scripts/smoke.sh

# PowerShell:
pwsh scripts/smoke.ps1
```
