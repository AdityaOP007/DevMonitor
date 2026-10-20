# DevMonitor 📊

A real-time monitoring and observability dashboard engineered as both an active developer tool and an interactive educational platform. DevMonitor teaches the core monitoring pipeline:
> **Application generates metrics** ➔ **Prometheus collects them** ➔ **Grafana visualizes them** ➔ **Alerts trigger when thresholds break**.

---

## Architecture Overview

DevMonitor is composed of eight containerized services managed via Docker Compose:

| Container Name | Service | Image | Role in Plain Language |
| :--- | :--- | :--- | :--- |
| `devmonitor-frontend` | Frontend | Built from `frontend/Dockerfile` (`nginx:1.27-alpine`) | Serves the React SPA static assets and proxies API requests (`/api/*`) dynamically to the backend. Blocks `/metrics` from public exposure. |
| `devmonitor-backend` | Backend | Built from `backend/Dockerfile` (`node:22-alpine`) | Express & TypeScript REST API serving system information, simulated traffic, and exposing Prometheus metrics at `/metrics`. Runs as non-root user `node`. |
| `devmonitor-postgres` | PostgreSQL | `postgres:16-alpine` | Relational database persisting application users, service catalog, incidents, and alert history. Isolated on internal network with named volume `postgres_data`. |
| `devmonitor-prometheus` | Prometheus | `prom/prometheus:v3.2.1` | Time-series metrics collection and storage engine. Scrapes targets every 15s. Evaluates 8 alert rules. Published strictly on loopback (`127.0.0.1:9090`) with named volume `prometheus_data`. |
| `devmonitor-node-exporter` | Node Exporter | `prom/node-exporter:v1.9.0` | Linux hardware and OS telemetry exporter (CPU, RAM, disk, network). Internal only (unpublished to host). |
| `devmonitor-grafana` | Grafana | `grafana/grafana-oss:11.5.2` | Observability visualization platform rendering pre-provisioned dashboards for Infrastructure, Application, and Database metrics. Published strictly on loopback (`127.0.0.1:3000`) with named volume `grafana_data`. |
| `devmonitor-alert-receiver` | Alert Receiver | Built from `alert-receiver/Dockerfile` (`node:22-alpine`) | Ephemeral in-memory webhook receiver capturing Alertmanager notification payloads. Serves a live alert stream and clearable dashboard. Published strictly on loopback (`127.0.0.1:8025`). Runs as non-root user `node`. |
| `devmonitor-alertmanager` | Alertmanager | `prom/alertmanager:v0.28.1` | Alert routing, grouping, silencing, and notification dispatcher. Evaluates route tree and dispatches alerts to webhook receiver, Slack, or email. Published strictly on loopback (`127.0.0.1:9093`) with named volume `alertmanager_data`. |

---

## Run with Docker

### Prerequisites
- [Docker Engine / Docker Desktop](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/) (v2.0+)

> [!NOTE]
> If a local dev container (such as `devmonitor-pg`) or a host `npm run dev` process is running on port `5432` or `5000`, stop it before starting Compose to prevent port collisions.

---

### Step 1: Configure Environment Variables

Copy the example environment configuration into `.env` at the project root:

```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Open `.env` and set secure credentials for PostgreSQL and Grafana:
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=devmonitor
ENABLE_TEST_ENDPOINTS=true
PROMETHEUS_RETENTION=15d

# Grafana Administration Credentials
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=your_secure_password_here

# Alertmanager Configuration (alertmanager.yml, alertmanager.slack.example.yml, alertmanager.email.example.yml)
ALERTMANAGER_CONFIG=alertmanager.yml
```

---

### Step 2: Build and Start Containers

Start all services in detached mode with one command:

```bash
docker compose up -d --build
```

Compose starts the database first, waits for its healthcheck (`pg_isready`) to pass, then starts the backend (which automatically applies migrations and seeds data before launching Express), the frontend Nginx container, Prometheus, Node Exporter, Grafana (which waits for Prometheus health), Alert Receiver, and Alertmanager.

---

### Step 3: Access the Application

- **Frontend Dashboard (Web UI):** [http://localhost:8080](http://localhost:8080)
- **Grafana Dashboard UI (Loopback only):** [http://127.0.0.1:3000](http://127.0.0.1:3000) *(Sign in with credentials from `.env`; default home is DevMonitor - Application)*
- **Prometheus Web UI (Loopback only):** [http://127.0.0.1:9090](http://127.0.0.1:9090) *(Inspect targets at Status > Targets)*
- **Prometheus Alert Rules UI (Loopback only):** [http://127.0.0.1:9090/alerts](http://127.0.0.1:9090/alerts) *(Inspect active firing and pending alert rules)*
- **Alertmanager Web UI (Loopback only):** [http://127.0.0.1:9093](http://127.0.0.1:9093) *(Inspect active alerts, silences, and routing status)*
- **Alert Receiver Dashboard (Loopback only):** [http://127.0.0.1:8025](http://127.0.0.1:8025) *(Inspect real-time alert notifications received from Alertmanager)*
- **Backend API (Loopback only):** [http://127.0.0.1:5000](http://127.0.0.1:5000)
- **Backend Metrics Endpoint:** [http://127.0.0.1:5000/metrics](http://127.0.0.1:5000/metrics)
- **API Health Check (via Frontend):** [http://localhost:8080/api/health](http://localhost:8080/api/health)

---

## Monitoring (Prometheus and Node Exporter)

### What Each Container Does in Plain Language

1. **Prometheus (`devmonitor-prometheus`)**:
   - Prometheus is a time-series database and monitoring server.
   - It operates on a **pull model**: at fixed intervals (configured to 15 seconds in `prometheus/prometheus.yml`), Prometheus makes HTTP GET requests ("scrapes") to each target service. **Nothing pushes metrics to Prometheus.**
   - It stores metrics as timestamped floating-point values indexed by metric names and key-value label pairs.
   - Its web UI is published at [http://127.0.0.1:9090](http://127.0.0.1:9090). To view active scrape jobs and target health, navigate to **Status > Targets**.
2. **Node Exporter (`devmonitor-node-exporter`)**:
   - Node Exporter is an agent designed to measure operating system and machine hardware metrics.
   - It reads kernel statistics and exposes them in Prometheus text format on internal port `9100`.
   - It is not exposed to the host machine directly; Prometheus reaches it over the internal Docker network at `http://node-exporter:9100/metrics`.

### Configuration and Operational Commands

* **Configuration Reload without Restarting:**
  Prometheus supports reloading its configuration file via the `SIGHUP` signal:
  ```bash
  docker compose kill -s SIGHUP prometheus
  ```
  *(Note: `--web.enable-lifecycle` is intentionally disabled for security to prevent remote unauthorized reload/shutdown requests).*
* **Retention and Persistent Storage:**
  - Metric retention is configured by `PROMETHEUS_RETENTION` (default: `15d`) passed to `--storage.tsdb.retention.time`.
  - TSDB data blocks are persisted in the `prometheus_data` named Docker volume mounted at `/prometheus`. Metrics survive container restarts and rebuilds.

---

## Dashboards (Grafana)

### What Grafana Does in Plain Language
Grafana is an open-source data visualization and analytics platform. While Prometheus collects and stores raw numeric metrics over time, Grafana connects to Prometheus and transforms those raw numbers into rich visual dashboards containing time-series graphs, color-coded health gauges, status indicators, and throughput distributions.

- **URL:** [http://127.0.0.1:3000](http://127.0.0.1:3000) (published strictly on the host loopback interface).
- **Credentials & Authentication:** Admin username and password are provided via environment variables (`GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD`) defined in `.env`.
  - `.env` is git-ignored and never committed to version control.
  - To change credentials, modify `.env` and restart Grafana (`docker compose up -d grafana`).
  - User self-registration and anonymous access are explicitly disabled (`GF_USERS_ALLOW_SIGN_UP=false`, `GF_AUTH_ANONYMOUS_ENABLED=false`).

---

### Pre-Provisioned Dashboards

Grafana starts automatically configured with a pre-wired `Prometheus` datasource and three dashboards grouped inside the **DevMonitor** folder:

#### 1. DevMonitor - Infrastructure (`/d/devmonitor-infrastructure`)
Visualizes OS and hardware performance metrics collected by Node Exporter:
- **Host Context Notice:** Explains that on Docker Desktop (Windows/macOS) these metrics reflect the Linux VM Docker runs in, while on a physical Linux server (or VPS) they reflect the physical host.
- **CPU Usage (%):** Processor utilization across all CPU cores (`100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval])) * 100)`). Turns red at $\ge 80\%$.
- **Memory Usage (%):** Percentage of system RAM currently occupied (`(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100`). Turns red at $\ge 85\%$.
- **Disk Usage (%):** Primary storage consumption (`(1 - node_filesystem_avail_bytes{mountpoint=~"^(/|/var/lib)$",fstype="ext4"} / node_filesystem_size_bytes{mountpoint=~"^(/|/var/lib)$",fstype="ext4"}) * 100`). Turns red at $\ge 85\%$.
- **Network In / Out (bytes/s):** Incoming and outgoing bandwidth rates across network interfaces (`node_network_receive_bytes_total` and `node_network_transmit_bytes_total`, excluding loopback/virtual bridges).
- **System Uptime:** Total time elapsed since system boot (`time() - node_boot_time_seconds`).

#### 2. DevMonitor - Application (`/d/devmonitor-application`) - Default Home
Visualizes Express backend API performance, latency, and failure states:
- **Backend Status:** Immediate reachability indicator (`up{job="backend"}`). Displays **UP** (green) normally and **DOWN** (red) if the backend container is halted.
- **Requests per Second:** Current global HTTP request throughput (`sum(rate(http_requests_total[$__rate_interval]))`).
- **Error Rate (%):** Percentage of requests resulting in 5xx server errors (`100 * (sum(rate(http_errors_total[$__rate_interval])) or vector(0)) / sum(rate(http_requests_total[$__rate_interval]))`). Displays "No traffic" when idle; turns red at $\ge 5\%$.
- **Average Response Time & p95:** Mean duration and 95th percentile latency from `http_request_duration_seconds`. Alert threshold line at $0.3\text{s}$ ($300\text{ms}$).
- **Throughput by Route:** Breakdown of requests per second grouped by route pattern (`/api/health`, `/api/users`, etc.).
- **Responses by Status Code:** Distribution of response codes (200, 304, 500, etc.).
- **Active Requests:** Current number of in-flight requests processed by Express (`http_active_requests`).
- **Service Health Overview:** Reachability status table across all registered services (`devmonitor_service_up`).
- **Failure Simulator State:** Active status of simulated failure modes (`devmonitor_simulation_active`).

#### 3. DevMonitor - Database (`/d/devmonitor-database`)
Visualizes PostgreSQL performance and database size:
- **Database Status:** PostgreSQL reachability gauge (`devmonitor_db_up`).
- **Connections:** Number of active database connections (`devmonitor_db_connections`).
- **Queries per Second:** Rate of application SQL queries executed (`rate(devmonitor_db_queries_total[$__rate_interval])`). Note: Internal health check queries are excluded, so idle rate is ~0.
- **Average Query Duration & p95:** Mean and 95th percentile query execution latency in seconds (`devmonitor_db_query_duration_seconds`).
- **Database Size:** On-disk size of the application database in bytes (`devmonitor_db_size_bytes`).

---

### Provisioning as Code

Dashboards and data sources are configured declaratively using Grafana's native file provisioning:
- **Datasource Definition:** `grafana/provisioning/datasources/prometheus.yml` automatically registers the Prometheus proxy pointing to internal service `http://prometheus:9090` with fixed UID `devmonitor-prometheus`.
- **Dashboard Provider:** `grafana/provisioning/dashboards/dashboards.yml` watches `/var/lib/grafana/dashboards` and loads dashboards into the `DevMonitor` folder every 30 seconds.
- **Zero Click Setup:** A fresh Grafana deployment or volume recreates all data sources and dashboards with no manual UI configuration.

### Workflow for Modifying Dashboards
To update a dashboard without losing changes:
1. Open Grafana at [http://127.0.0.1:3000](http://127.0.0.1:3000).
2. Edit panels in the UI, test layouts, or adjust query parameters.
3. Click **Dashboard Settings** (gear icon) ➔ **JSON Model** (or click **Save as...** / Export JSON).
4. Copy the updated JSON definition and overwrite the matching file in `grafana/dashboards/` (`devmonitor-infrastructure.json`, `devmonitor-application.json`, or `devmonitor-database.json`).
5. Commit the modified JSON file to Git. Grafana automatically synchronizes changes within 30 seconds.

---

### PromQL Reference Table

| Metric / Goal | PromQL Expression | Plain Language Explanation |
| :--- | :--- | :--- |
| **Request Rate** | `sum(rate(http_requests_total[$__rate_interval]))` | Total number of HTTP requests processed per second across all routes. |
| **Error Rate %** | `100 * (sum(rate(http_errors_total[$__rate_interval])) or vector(0)) / sum(rate(http_requests_total[$__rate_interval]))` | Percentage of total requests resulting in HTTP 5xx server errors (safe against missing series). |
| **Average Latency** | `sum(rate(http_request_duration_seconds_sum[$__rate_interval])) / sum(rate(http_request_duration_seconds_count[$__rate_interval]))` | Mean API response time in seconds. |
| **p95 Latency** | `histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[$__rate_interval])))` | 95% of incoming API requests complete within this duration (seconds). |
| **Active Requests** | `http_active_requests` | Number of currently active concurrent in-flight HTTP requests. |
| **CPU Usage %** | `100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval])) * 100)` | Total processor utilization percentage calculated by inverting idle CPU time. |
| **Memory Usage %** | `(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100` | Percentage of RAM occupied based on available vs total memory. |
| **Disk Used %** | `(1 - (node_filesystem_avail_bytes{mountpoint=~"^(/\|/var/lib)$",fstype="ext4"} / node_filesystem_size_bytes{mountpoint=~"^(/\|/var/lib)$",fstype="ext4"})) * 100` | Percentage of disk space consumed on primary storage volume. |
| **Network In** | `sum(rate(node_network_receive_bytes_total{device!~"lo\|veth.*\|docker.*\|br-.*"}[$__rate_interval]))` | Incoming network bandwidth in bytes/second excluding loopback/virtual interfaces. |
| **Network Out** | `sum(rate(node_network_transmit_bytes_total{device!~"lo\|veth.*\|docker.*\|br-.*"}[$__rate_interval]))` | Outgoing network bandwidth in bytes/second excluding loopback/virtual interfaces. |
| **Backend Up/Down** | `up{job="backend"}` | `1` when Express backend is actively reachable during scrapes; `0` when unreachable. |
| **DB Queries/sec** | `rate(devmonitor_db_queries_total[$__rate_interval])` | Application SQL query execution rate per second. |
| **DB Size** | `devmonitor_db_size_bytes` | Current PostgreSQL database disk footprint in bytes. |

---

## Operational Commands

### View Service Logs
Stream logs from all services or a specific container:
```bash
# View backend logs (including startup migrations & seeds)
docker compose logs -f backend

# View grafana visualization and provisioning logs
docker compose logs -f grafana

# View prometheus scrape and storage logs
docker compose logs -f prometheus

# View node-exporter hardware collector logs
docker compose logs -f node-exporter

# View frontend proxy access logs
docker compose logs -f frontend

# View database logs
docker compose logs -f postgres
```

### Inspect Container Health
Check container status and health states:
```bash
docker compose ps
```

### Stop Services
Stop containers without losing database, metric, or dashboard data:
```bash
docker compose down
```

### Full Reset (Deletes Database, Metrics, and Alertmanager Silences)
> [!CAUTION]
> Running this command permanently removes the PostgreSQL volume (`devmonitor_postgres_data`), Prometheus TSDB volume (`devmonitor_prometheus_data`), Grafana volume (`devmonitor_grafana_data`), and Alertmanager volume (`devmonitor_alertmanager_data`):
```bash
docker compose down -v
```

---

## Failure Simulation Demo ("Break Something")

DevMonitor includes built-in failure simulation scenarios to demonstrate observability reactions in real time:

### Scenario A: Simulate Backend Outage
1. **Stop the Backend Container:**
   ```bash
   docker stop devmonitor-backend
   ```
2. **Observe Downstream Monitoring Reaction:**
   - In Grafana ([http://127.0.0.1:3000](http://127.0.0.1:3000)), the **Backend Status** panel turns bright red (**DOWN**) within ~15–30 seconds.
   - In Prometheus ([http://127.0.0.1:9090/targets](http://127.0.0.1:9090/targets)), the `backend` target turns red (`DOWN`).
   - In the frontend ([http://localhost:8080/](http://localhost:8080/)), the SPA continues serving while `/api/health` returns `502 Bad Gateway`.
3. **Restore the Backend:**
   ```bash
   docker start devmonitor-backend
   ```
4. **Observe Recovery:**
   - The **Backend Status** panel in Grafana automatically turns green (**UP**).
   - In the DevMonitor Services page, backend status recovers to Healthy.

### Scenario B: Simulate High Error Rate
1. In the DevMonitor Web UI ([http://localhost:8080/](http://localhost:8080/)), navigate to the **Playground** or **Errors** page.
2. Click **Generate API Errors** (or send a POST to `http://localhost:8080/api/test/errors`).
3. Open the **DevMonitor - Application** dashboard in Grafana:
   - The **Error Rate (%)** panel jumps above the $5\%$ threshold and turns red.
   - The **Failure Simulator State** table displays `errors` mode as **ACTIVE**.
4. Restore normal operation by clicking **Restore Normal** (or sending a POST to `/api/test/restore`).

---

## Alerts (Alertmanager)

### How the Alerting Pipeline Works in Plain Language

DevMonitor implements an industry-standard four-stage monitoring and alerting pipeline:
1. **Application Generates Telemetry:** Express (`devmonitor-backend`), PostgreSQL (`devmonitor-postgres`), and Node Exporter (`devmonitor-node-exporter`) produce runtime performance metrics.
2. **Prometheus Evaluates Rules:** Every 15 seconds (`evaluation_interval: 15s`), Prometheus evaluates 8 declarative alerting rules defined in `prometheus/rules/devmonitor-alerts.yml`. If a threshold is continuously broken for its configured `for:` duration, Prometheus transitions the rule from `pending` (yellow) to `firing` (red).
3. **Alertmanager Groups & Routes:** Prometheus pushes firing alerts to Alertmanager (`http://alertmanager:9093`). Alertmanager groups related alerts by `[alertname, instance]` to avoid alert fatigue, suppresses redundant alerts using inhibition rules (for example, silencing warning-level `HighErrorRate` when `BackendDown` is already firing for that instance), and dispatches notifications after `group_wait` (10s).
4. **Receivers Deliver Notifications:** Alertmanager dispatches the structured alert payload to configured notification targets: a local webhook receiver (`devmonitor-alert-receiver`), Slack, or Email (SMTP). When the incident condition resolves in Prometheus, Alertmanager dispatches a green `resolved` notification after `group_interval` (1m).

---

### Alert Rules Reference Table

| Alert Name | Group | Severity | Plain-Language Condition | Duration (`for`) | What to Do (Runbook Action) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`HighCpuUsage`** | Infrastructure | `warning` | Host / VM total CPU utilization $\ge 80\%$ | 5 minutes | Inspect running processes with `docker top`. Check for runaway loops or heavy compute workloads. |
| **`HighMemoryUsage`** | Infrastructure | `warning` | Host / VM available RAM $\le 15\%$ (usage $\ge 85\%$) | 5 minutes | Check container memory consumption with `docker stats`. Check for memory leaks. |
| **`HighDiskUsage`** | Infrastructure | `warning` | Host / VM primary disk usage $\ge 85\%$ | 10 minutes | Inspect disk usage with `docker system df`. Prune unused images and containers with `docker system prune`. |
| **`BackendDown`** | Application | `critical` | Express backend container is unreachable (`up{job="backend"} == 0`) | 1 minute | Check if backend container is running with `docker compose ps`. Inspect backend logs with `docker compose logs backend`. |
| **`HighErrorRate`** | Application | `warning` | HTTP 5xx server error rate exceeds $10\%$ over a 2-minute rolling window | 2 minutes | Check backend logs for unhandled 500 exceptions. The Failure Simulator may be active — try `POST /api/test/restore`. |
| **`HighResponseTime`** | Application | `warning` | Average API request latency exceeds $300\text{ms}$ over a 2-minute rolling window | 3 minutes | Check database query latencies, slow endpoints, or simulated artificial delay. |
| **`DatabaseDown`** | Database & Targets | `critical` | PostgreSQL database probe failed (`devmonitor_db_up == 0`) | 1 minute | Check postgres container status with `docker compose ps` and database logs with `docker compose logs postgres`. |
| **`TargetDown`** | Database & Targets | `warning` | Any Prometheus scrape target is unreachable (`up == 0`) | 2 minutes | Check Prometheus target health at `http://127.0.0.1:9090/targets` to identify which scraper failed. |

---

### Component URLs

- **Alertmanager Web UI (Loopback only):** [http://127.0.0.1:9093](http://127.0.0.1:9093)
  - View active alert groups, manage silences, and view routing trees.
- **Alert Receiver Dashboard (Loopback only):** [http://127.0.0.1:8025](http://127.0.0.1:8025)
  - Dedicated developer UI showing live, color-coded alert notifications (Firing in red, Resolved in green), metadata, instance labels, and runbook actions. Includes a **Clear Alerts** button.
  - JSON API: `GET http://127.0.0.1:8025/alerts` (returns newest alerts first, capped at 100).
- **Prometheus Alert Rules UI (Loopback only):** [http://127.0.0.1:9090/alerts](http://127.0.0.1:9090/alerts)
  - Displays rule health, evaluation state (`inactive`, `pending`, `firing`), and active metric values.

---

### Operational Workflows

#### 1. Reload Alert Rules Without Restarting Containers
Prometheus dynamically reloads rules on receiving the `SIGHUP` signal:
```bash
docker compose kill -s SIGHUP prometheus
```
Confirm the reload by verifying `rule_files` under `http://127.0.0.1:9090/rules`.

#### 2. Run Promtool Rule Unit Tests
Prometheus alert rules are verified offline using `promtool test rules` against `prometheus/tests/alert-rules.test.yml`:
```bash
docker run --rm --entrypoint promtool -v "${PWD}/prometheus:/etc/prometheus" -w /etc/prometheus/tests prom/prometheus:v3.2.1 test rules alert-rules.test.yml
```
*(On Windows PowerShell, use `docker run --rm --entrypoint promtool -v "${PWD}/prometheus:/etc/prometheus" -w /etc/prometheus/tests prom/prometheus:v3.2.1 test rules alert-rules.test.yml`)*

**What this proves:** Unit tests simulate series data over time, verifying that each rule transitions to `pending` and `firing` at exact timestamps, resolves on recovery, and correctly interpolates dynamic labels (`{{ $labels.instance }}`) and annotations.

#### 3. Live Demo A: Simulate Backend Outage
1. **Stop the backend container:**
   ```bash
   docker stop devmonitor-backend
   ```
2. **Observe Downstream Pipeline Reaction:**
   - **Prometheus ([http://127.0.0.1:9090/alerts](http://127.0.0.1:9090/alerts)):** At ~15 seconds (`BackendDown` rule enters `pending`). At 60 seconds (`for: 1m`), the alert turns bright red (`firing`).
   - **Grafana ([http://127.0.0.1:3000](http://127.0.0.1:3000)):** The **Firing Alerts** stat panel turns red (`1`), and the **Active Alerts** table displays `BackendDown` with severity `critical`.
   - **Alert Receiver ([http://127.0.0.1:8025](http://127.0.0.1:8025)):** Within ~10-15 seconds of firing (`group_wait: 10s`), a red notification card appears with summary `BACKEND DOWN`, server `backend:5000`, duration `1 minute`, and the recommended runbook action.
3. **Restore the backend:**
   ```bash
   docker start devmonitor-backend
   ```
4. **Observe Recovery:**
   - Within ~60-75 seconds (`group_interval: 1m`), a green **RESOLVED** card arrives in the Alert Receiver dashboard.

#### 4. Live Demo B: Simulate High Error Rate
1. **Trigger simulated 500 errors:**
   ```bash
   curl -X POST http://localhost:8080/api/test/errors
   ```
   *(Or click "Generate API Errors" in the DevMonitor web UI).*
2. **Generate steady HTTP traffic:**
   ```bash
   # Send repeated requests to exercise the error rate
   for i in {1..30}; do curl -s http://localhost:8080/api/services > /dev/null; sleep 2; done
   ```
3. **Observe Pipeline Reaction:**
   - After 2 minutes of sustained $>10\%$ 5xx errors, Prometheus transitions `HighErrorRate` to `firing`.
   - The alert card arrives at [http://127.0.0.1:8025](http://127.0.0.1:8025).
4. **Restore Normal Operation:**
   ```bash
   curl -X POST http://localhost:8080/api/test/restore
   ```
   Send standard traffic; error rate drops to $0\%$, Prometheus clears the alert, and a green resolved notification is dispatched to the receiver.

#### 5. Configure Slack or Email Notifications Step by Step
DevMonitor includes ready-to-use configuration templates for Slack and Email:

1. **Create the Secrets File (Git-Ignored):**
   - For **Slack**: create `alertmanager/secrets/slack_webhook_url` containing your incoming webhook URL (e.g. `https://example.com/slack-webhook-placeholder`).
   - For **Email**: create `alertmanager/secrets/smtp_password` containing your SMTP application password.
   *(These files are strictly gitignored to prevent accidental credential leakage).*
2. **Switch Alertmanager Configuration in `.env`:**
   Open `.env` and set:
   ```env
   # For Slack:
   ALERTMANAGER_CONFIG=alertmanager.slack.example.yml
   
   # Or for Email:
   ALERTMANAGER_CONFIG=alertmanager.email.example.yml
   ```
   *(If using email, adjust `to:`, `from:`, and `smarthost:` in `alertmanager/alertmanager.email.example.yml`).*
3. **Apply the New Configuration:**
   ```bash
   docker compose up -d alertmanager
   ```
4. **Send a Test Alert:**
   Validate delivery without breaking any running service:
   ```bash
   # PowerShell:
   powershell -File scripts/send-test-alert.ps1
   
   # Bash:
   chmod +x scripts/send-test-alert.sh && ./scripts/send-test-alert.sh
   ```
   A synthetic firing alert followed by a resolved notification will be delivered directly through Alertmanager.

---

## Automated Verification Scripts

Comprehensive test suites validate configuration, proxying, metric isolation, failure simulation, database persistence, Prometheus scraping, Grafana dashboarding, and Alertmanager pipelines:

- **Alertmanager & Rules Pipeline Suite:**
  - PowerShell (Full): `powershell -ExecutionPolicy Bypass -File scripts/check-alerts.ps1`
  - PowerShell (Fast): `powershell -ExecutionPolicy Bypass -File scripts/check-alerts.ps1 -SkipSlow`
  - Bash (Full): `chmod +x scripts/check-alerts.sh && ./scripts/check-alerts.sh`
  - Bash (Fast): `./scripts/check-alerts.sh --skip-slow`
- **Grafana & Dashboards Suite:**
  - PowerShell: `powershell -ExecutionPolicy Bypass -File scripts/check-grafana.ps1`
  - Bash: `chmod +x scripts/check-grafana.sh && ./scripts/check-grafana.sh`
- **Prometheus & Node Exporter Suite:**
  - PowerShell: `powershell -ExecutionPolicy Bypass -File scripts/check-prometheus.ps1`
  - Bash: `chmod +x scripts/check-prometheus.sh && ./scripts/check-prometheus.sh`
- **Docker Architecture Suite:**
  - PowerShell: `powershell -ExecutionPolicy Bypass -File scripts/check-docker.ps1`
  - Bash: `chmod +x scripts/check-docker.sh && ./scripts/check-docker.sh`
- **Scrape Contract Verification:**
  - `cd backend && npm run check:metrics`

---

## Important Architectural Notes

1. **Host vs Virtual Machine Telemetry (Docker Desktop):**
   - On Windows and macOS using Docker Desktop, Node Exporter and the backend run inside a lightweight Linux virtual machine (WSL2 / Hyper-V). The CPU, RAM, disk, and network metrics reported reflect this **Linux VM environment**, not the Windows/macOS host directly.
   - On a native Linux VPS deployment, Node Exporter mounts `/` directly and reports genuine physical host metrics.
2. **Network Security & Port Isolation:**
   - **Grafana (3000):** Published strictly on loopback `127.0.0.1:3000`. Grafana must never be exposed publicly without HTTPS and authentication (the later VPS deployment stage adds that).
   - **Prometheus (9090):** Published strictly on loopback `127.0.0.1:9090`. Prometheus does not contain authentication mechanisms and must never be exposed publicly.
   - **Alertmanager (9093):** Published strictly on loopback `127.0.0.1:9093`. Alertmanager does not contain authentication mechanisms and must never be exposed publicly.
   - **Alert Receiver (8025):** Published strictly on loopback `127.0.0.1:8025`. Internal test receiver only.
   - **Node Exporter (9100):** Not published to the host at all (no `ports:` definition). It is accessible exclusively by Prometheus over the internal `devmonitor` Docker network.
   - **Frontend Proxy Isolation:** Public access to `/metrics` through Nginx on port `8080` is explicitly blocked (`return 404`). Neither Grafana, Prometheus, Alertmanager, nor the Alert Receiver is proxied by Nginx.
3. **Service Status Row Updates:**
   - On the frontend **Services** page (`/services`), **Prometheus** reports as **Collecting** (green), and **Grafana** reports as **Connected** (green) as the backend probes `http://grafana:3000/api/health`.
4. **Frontend Build-Time Configuration (`VITE_USE_MOCK`):**
   - Vite bakes client environment variables at bundle time. The frontend Dockerfile builds with `ARG VITE_USE_MOCK=false`. Changing this setting requires rebuilding the image (`docker compose build frontend`).
5. **Database Port Isolation (5432):**
   - PostgreSQL port `5432` is not published to the host by default. If host database access (e.g. via GUI tools or `psql`) is desired, copy `docker-compose.override.example.yml` to `docker-compose.override.yml` to bind port `5433` safely.
6. **Alerting Pipeline Architecture and Honest Disclosures:**
   - **CPU and Memory Alert Verification:** The `HighCpuUsage` and `HighMemoryUsage` rules are verified via `promtool` unit tests. The Failure Simulator's CPU load scenario runs on a single worker thread and cannot trigger a machine-wide $\ge 80\%$ CPU or $\ge 85\%$ RAM breach on modern multi-core development hosts.
   - **VM Telemetry on Docker Desktop:** Hardware telemetry reflects the Docker Desktop Linux VM (WSL2 / Hyper-V), not the physical host machine.
   - **Application Internal Alerts vs Alertmanager:** DevMonitor's web UI features an internal `/alerts` page backed by PostgreSQL tables and an in-app threshold evaluator. This is completely separate and independent from the Prometheus and Alertmanager infrastructure pipeline (the two systems do not share state).
   - **Slack and Email Verification:** Slack and Email templates are syntactically validated using `amtool check-config`, but external internet delivery was not live-fired during automated verification to prevent spamming real external webhooks/mailboxes.
   - **Ephemeral In-Memory Receiver:** The `devmonitor-alert-receiver` is an in-memory testing and demonstration sink storing the 100 most recent alerts in RAM. Alerts clear on container restart or via the `/clear` button.
   - **Loopback Isolation:** Neither Alertmanager (`9093`) nor the Alert Receiver (`8025`) provides authentication. Both are strictly bound to `127.0.0.1` and are never exposed publicly or proxied by Nginx.
