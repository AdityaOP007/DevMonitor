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
   | `DB_POOL_MAX` | `10` | Maximum connections in PostgreSQL pool |
   | `DB_IDLE_TIMEOUT_MS` | `30000` | Milliseconds before idle connection is closed |
   | `DB_CONNECTION_TIMEOUT_MS` | `5000` | Milliseconds to wait before connection attempt times out |
   | `BACKEND_HEALTH_URL` | `http://localhost:5000/api/health` | URL used to health-check Backend API |
   | `FRONTEND_URL` | `http://localhost:5173` | URL used to health-check Frontend dashboard |
   | `PROMETHEUS_URL` | `http://localhost:9090/-/healthy` | URL used to health-check Prometheus |
   | `GRAFANA_URL` | `http://localhost:3000/api/health` | URL used to health-check Grafana |

3. **Run Database Migrations & Seeds:**
   ```bash
   npm run db:status    # List applied and pending migrations
   npm run db:migrate   # Apply all pending migrations transactionally
   npm run db:seed      # Seed initial services and alert configuration
   npm run db:reset     # Recreate public schema, migrate, and seed (dev only)
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

### Application Input & Users API

- **Create User Account (generates DB write & traffic metrics):**
  ```bash
  curl -X POST http://localhost:5000/api/users \
    -H "Content-Type: application/json" \
    -d '{"name":"Alice Smith","email":"alice@example.com"}'
  # {"id":"1","name":"Alice Smith","email":"alice@example.com","createdAt":"2026-10-19T15:00:00.000Z"}
  ```

- **List Registered Users:**
  ```bash
  curl "http://localhost:5000/api/users?limit=10&offset=0"
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

## Database

DevMonitor uses PostgreSQL for application data, service health tracking, incident history, and threshold configurations.

### Schema Reference

#### `users`
Stores user accounts created through standard application traffic.
- `id` (SERIAL PRIMARY KEY): Unique numeric identifier for the user.
- `name` (TEXT NOT NULL): User's full display name (1–100 characters).
- `email` (TEXT NOT NULL UNIQUE): User's email address (unique, max 254 chars).
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW()): Timestamp when the user account was registered.

#### `services`
Stores the registry of monitored architecture components.
- `id` (SERIAL PRIMARY KEY): Unique numeric identifier for the service.
- `name` (TEXT NOT NULL UNIQUE): Name of the service (e.g., "Backend API", "Prometheus").
- `status` (TEXT NOT NULL DEFAULT 'UNKNOWN'): Canonical status (`UP`, `DOWN`, `UNKNOWN`).
- `url` (TEXT NULL): Network health probe endpoint, or NULL for local DB checks.
- `role` (TEXT NULL): Functional description of what the service does.
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW()): Timestamp when the service was registered.
- `last_checked_at` (TIMESTAMPTZ NULL): Timestamp of the most recent health check execution.

#### `incidents`
Records alert incidents created when metrics exceed configured thresholds.
- `id` (SERIAL PRIMARY KEY): Unique numeric identifier for the incident.
- `severity` (TEXT NOT NULL CHECK in 'warning', 'critical'): Impact severity level.
- `title` (TEXT NOT NULL): Concise summary of the violation (e.g., "HIGH CPU USAGE").
- `message` (TEXT NOT NULL): Detailed alert narrative with metric numbers and recommendations.
- `active` (BOOLEAN NOT NULL DEFAULT TRUE): True if the incident is currently ongoing.
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW()): Timestamp when the violation started.
- `resolved_at` (TIMESTAMPTZ NULL): Timestamp when metrics returned to normal thresholds.
*(Indexes: `(active, created_at DESC)` for fast timeline queries, and partial unique index `(title) WHERE active = true` preventing duplicate active alerts).*

#### `alert_config`
Single-row configuration table (`id = 1`) defining metric evaluation thresholds.
- `id` (INT PRIMARY KEY DEFAULT 1 CHECK (id = 1)): Enforces a single configuration record.
- `cpu_threshold` (NUMERIC NOT NULL CHECK 0..100): CPU usage trigger percentage.
- `memory_threshold` (NUMERIC NOT NULL CHECK 0..100): Memory usage trigger percentage.
- `error_rate_threshold` (NUMERIC NOT NULL CHECK 0..100): 5xx error rate trigger percentage.
- `response_time_threshold` (NUMERIC NOT NULL CHECK > 0): Average response latency trigger in ms.
- `duration_minutes` (INT NOT NULL CHECK >= 1): Duration threshold must be sustained to fire.

#### `schema_migrations`
Tracks versioned migrations applied to the database.
- `filename` (TEXT PRIMARY KEY): Migration file name (e.g., `001_initial.sql`).
- `applied_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW()): Exact time migration transaction committed.

---

### Starting Local PostgreSQL (Documentation Only)

To spin up a local PostgreSQL container for local development:

```bash
docker run --name devmonitor-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=devmonitor \
  -p 5432:5432 \
  -d postgres:16-alpine
```

### Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/devmonitor` | PostgreSQL connection string |
| `DB_POOL_MAX` | `10` | Maximum connection pool size |
| `DB_IDLE_TIMEOUT_MS` | `30000` | Pool client idle eviction timeout in milliseconds |
| `DB_CONNECTION_TIMEOUT_MS` | `5000` | Pool connection acquisition timeout in milliseconds |
| `BACKEND_HEALTH_URL` | `http://localhost:5000/api/health` | Health check endpoint for Backend API |
| `FRONTEND_URL` | `http://localhost:5173` | Health check endpoint for Frontend |
| `PROMETHEUS_URL` | `http://localhost:9090/-/healthy` | Health check endpoint for Prometheus |
| `GRAFANA_URL` | `http://localhost:3000/api/health` | Health check endpoint for Grafana |

### Migration Workflow

DevMonitor utilizes a hand-written, versioned migration runner located in `backend/src/db/migrate.ts`:
1. SQL files reside in `backend/src/db/migrations/` prefixed with a 3-digit order number: `001_initial.sql`, `002_schema_v2.sql`, `003_feature.sql`.
2. Each migration runs inside its own database transaction (`withTransaction`). If an error occurs, the transaction rolls back cleanly, reports the offending file, and terminates.
3. **Immutability Rule:** Never edit an applied migration file. All schema updates must be committed as new sequential migration files.
4. Check migration status anytime via `npm run db:status`. Run pending migrations with `npm run db:migrate`.

### Resetting the Database (`db:reset`)

The `npm run db:reset` command drops the public schema, recreates it, runs all migrations, and applies seed data.
- **Safety Guards:** `db:reset` strictly refuses to execute if `NODE_ENV === 'production'` or if the hostname in `DATABASE_URL` is not `localhost`, `127.0.0.1`, or an isolated container name (`postgres`, `db`, `backend`).

### Status Vocabulary Mapping

To satisfy both Prometheus/docs standards and frontend presentation requirements:
- The **Database** stores canonical statuses: `UP`, `DOWN`, or `UNKNOWN`.
- The **Frontend Controller** (`GET /api/services`) maps canonical values to the UI presentation strings:

| Service Name | Canonical DB Status | Frontend Display String |
|---|---|---|
| Prometheus | `UP` | `Collecting` |
| Grafana | `UP` | `Connected` |
| Other Services (Backend, Database, Frontend) | `UP` | `Healthy` |
| Any Service | `DOWN` or `UNKNOWN` | `Down` |

---

## Prometheus Scraping

DevMonitor exposes an unauthenticated, zero-overhead Prometheus pull target compliant with Prometheus exposition format standards.

- **Scrape Target:** `backend:5000` (inside Docker Compose networking) or `localhost:5000` (local development)
- **Path:** `/metrics`
- **Recommended Scrape Interval:** `15s`
- **Isolation Guarantee:** `/metrics` is mounted ahead of application middleware; it is immune to slow/error/stop simulation modes, rate limiters, or database latency timeouts (max 2s probe timeout with safe fallback). Scraping `/metrics` does not increment application traffic counters or latency histograms.

### Custom Metrics Reference

| Metric Name | Type | Labels | Plain Language Meaning |
|---|---|---|---|
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Total HTTP requests handled by the server (excluding `/metrics`). |
| `http_errors_total` | Counter | `method`, `route`, `status_code` | Total HTTP 5xx server errors produced by the application. |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | HTTP request execution duration in seconds (buckets: 5ms to 5s). |
| `http_active_requests` | Gauge | (none) | Number of HTTP requests currently in flight being processed. |
| `devmonitor_db_up` | Gauge | (none) | PostgreSQL database connectivity status (1 = reachable, 0 = unreachable). |
| `devmonitor_db_connections` | Gauge | (none) | Current active client connections to the PostgreSQL database. |
| `devmonitor_db_queries_total` | Counter | (none) | Total SQL queries executed through the application pool wrapper. |
| `devmonitor_db_query_duration_seconds` | Histogram | (none) | Duration of queries executed through the pool wrapper (buckets: 1ms to 1s). |
| `devmonitor_db_size_bytes` | Gauge | (none) | Current PostgreSQL database disk usage size in bytes (`pg_database_size`). |
| `devmonitor_service_up` | Gauge | `service` | Health check probe status for monitored services (1 = operational, 0 = down). |
| `devmonitor_simulation_active` | Gauge | `mode` | Active state of failure simulator modes (`errors`, `slow`, `cpu`, `down`). |

*(Note: Standard Node.js process and memory metrics such as `process_cpu_user_seconds_total` and `process_resident_memory_bytes` are also exposed via `client.collectDefaultMetrics`.)*

### Example Prometheus Scrape Configuration (Documentation Only)

```yaml
scrape_configs:
  - job_name: "backend"
    scrape_interval: 15s
    static_configs:
      - targets: ["backend:5000"]
```

### Dashboard PromQL Queries

The planned Grafana dashboards use these fundamental queries:

1. **Request Rate (req/s):**
   ```promql
   sum(rate(http_requests_total[2m]))
   ```
   *Measures the per-second rate of incoming HTTP requests across all endpoints averaged over a 2-minute window.*

2. **Error Percentage (%):**
   ```promql
   (sum(rate(http_errors_total[2m])) / sum(rate(http_requests_total[2m]))) * 100
   ```
   *Measures the ratio of 5xx server error responses to total HTTP traffic as a percentage over 2 minutes.*

3. **95th Percentile Response Time (Latency):**
   ```promql
   histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[2m])) by (le))
   ```
   *Estimates the maximum latency in seconds experienced by the fastest 95% of requests.*

---

## Running Smoke Tests

Run the automated test suite against the running server:

```bash
# Metrics scrape & format compliance check:
npm run check:metrics

# Bash smoke test:
bash scripts/smoke.sh

# PowerShell smoke test:
powershell -ExecutionPolicy Bypass -File scripts/smoke.ps1
```

