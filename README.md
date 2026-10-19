# DevMonitor 📊

A real-time monitoring and observability dashboard engineered as both an active developer tool and an interactive educational platform. DevMonitor teaches the core monitoring pipeline:
> **Application generates metrics** ➔ **Prometheus collects them** ➔ **Grafana visualizes them** ➔ **Alerts trigger when thresholds break**.

---

## Architecture Overview

DevMonitor is composed of five containerized services managed via Docker Compose:

| Container Name | Service | Image | Role in Plain Language |
| :--- | :--- | :--- | :--- |
| `devmonitor-frontend` | Frontend | Built from `frontend/Dockerfile` (`nginx:1.27-alpine`) | Serves the React SPA static assets and proxies API requests (`/api/*`) dynamically to the backend. Blocks `/metrics` from public exposure. |
| `devmonitor-backend` | Backend | Built from `backend/Dockerfile` (`node:22-alpine`) | Express & TypeScript REST API serving system information, simulated traffic, and exposing Prometheus metrics at `/metrics`. Runs as non-root user `node`. |
| `devmonitor-postgres` | PostgreSQL | `postgres:16-alpine` | Relational database persisting application users, service catalog, incidents, and alert history. Isolated on internal network with named volume `postgres_data`. |
| `devmonitor-prometheus` | Prometheus | `prom/prometheus:v3.2.1` | Time-series metrics collection and storage engine. Scrapes targets every 15s. Published strictly on loopback (`127.0.0.1:9090`) with named volume `prometheus_data`. |
| `devmonitor-node-exporter` | Node Exporter | `prom/node-exporter:v1.9.0` | Linux hardware and OS telemetry exporter (CPU, RAM, disk, network). Internal only (unpublished to host). |

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

Open `.env` and set a secure password for PostgreSQL and Prometheus retention:
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=devmonitor
ENABLE_TEST_ENDPOINTS=true
PROMETHEUS_RETENTION=15d
```

---

### Step 2: Build and Start Containers

Start all services in detached mode with one command:

```bash
docker compose up -d --build
```

Compose starts the database first, waits for its healthcheck (`pg_isready`) to pass, then starts the backend (which automatically applies migrations and seeds data before launching Express), the frontend Nginx container, Prometheus, and Node Exporter.

---

### Step 3: Access the Application

- **Frontend Dashboard (Web UI):** [http://localhost:8080](http://localhost:8080)
- **Prometheus Web UI (Loopback only):** [http://127.0.0.1:9090](http://127.0.0.1:9090) *(Inspect targets at Status > Targets)*
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

### Example PromQL Queries

You can execute queries in the Prometheus expression browser at [http://127.0.0.1:9090/graph](http://127.0.0.1:9090/graph):

| Metric / Goal | PromQL Expression | Plain Language Explanation |
| :--- | :--- | :--- |
| **Request Rate** | `sum(rate(http_requests_total[2m]))` | Total number of HTTP requests processed per second across all application routes. |
| **Error Percentage** | `(sum(rate(http_errors_total[2m])) / sum(rate(http_requests_total[2m]))) * 100` | Percentage of total requests resulting in HTTP 5xx server errors. |
| **p95 Latency** | `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[2m])) by (le))` | 95% of incoming API requests complete within this duration (in seconds). |
| **CPU Usage %** | `100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)` | Total processor utilization percentage calculated by inverting idle CPU time. |
| **Memory Usage %** | `(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100` | Current RAM consumption percentage based on available versus total memory. |
| **Disk Used %** | `(1 - (node_filesystem_avail_bytes{mountpoint="/host"} / node_filesystem_size_bytes{mountpoint="/host"})) * 100` | Percentage of disk space consumed on the primary root storage volume. |
| **Network In** | `sum(rate(node_network_receive_bytes_total[2m]))` | Incoming network bandwidth throughput in bytes per second. |
| **Network Out** | `sum(rate(node_network_transmit_bytes_total[2m]))` | Outgoing network bandwidth throughput in bytes per second. |
| **Backend Up/Down** | `up{job="backend"}` | `1` when the Express backend is actively reachable during scrapes; `0` when unreachable. |

---

## Operational Commands

### View Service Logs
Stream logs from all services or a specific container:
```bash
# View backend logs (including startup migrations & seeds)
docker compose logs -f backend

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
Stop containers without losing database or metric data:
```bash
docker compose down
```

### Full Reset (Deletes Database and Metrics)
> [!CAUTION]
> Running this command permanently removes both the PostgreSQL volume (`devmonitor_postgres_data`) and the Prometheus TSDB volume (`devmonitor_prometheus_data`):
```bash
docker compose down -v
```

---

## Failure Simulation Demo

DevMonitor includes a built-in failure simulation scenario to demonstrate service resilience and dynamic Nginx proxy recovery.

1. **Simulate Backend Outage:**
   ```bash
   docker stop devmonitor-backend
   ```
2. **Observe Downstream Monitoring Reaction:**
   - In Prometheus ([http://127.0.0.1:9090/targets](http://127.0.0.1:9090/targets)), the `backend` target turns red (`DOWN`) with connection refused.
   - Querying `up{job="backend"}` returns `0`.
   - In the frontend ([http://localhost:8080/](http://localhost:8080/)), the SPA continues serving (200 OK) while `/api/health` returns `502 Bad Gateway`.
3. **Restore Backend Service:**
   ```bash
   docker start devmonitor-backend
   ```
4. **Observe Automatic Recovery:**
   - Within 15 seconds, the next scrape recovers `up{job="backend"}` to `1` in Prometheus.
   - The frontend API proxy seamlessly resumes returning `200 OK`.

---

## Automated Verification Scripts

Comprehensive test suites are included to validate configuration, proxying, metric isolation, failure simulation, database persistence, and Prometheus scraping:

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
   - **Prometheus (9090):** Published strictly on `127.0.0.1:9090`. Prometheus does not contain authentication mechanisms and must never be exposed publicly.
   - **Node Exporter (9100):** Not published to the host at all (no `ports:` definition). It is accessible exclusively by Prometheus over the internal `devmonitor` Docker network.
   - **Frontend Proxy (/metrics):** Public access to `/metrics` through Nginx on port `8080` is explicitly blocked (`return 404`).
   - **Grafana Integration (Next Phase):** In upcoming stages, Grafana will query Prometheus securely inside the network at `http://prometheus:9090`.
3. **Service Status Row Updates:**
   - On the frontend **Services** page (`/services`), **Prometheus** now reports as **Collecting** (green) as the backend probes `http://prometheus:9090/-/healthy`.
   - **Grafana** continues to appear as **Down** until its container is provisioned in the next stage.
4. **Frontend Build-Time Configuration (`VITE_USE_MOCK`):**
   - Vite bakes client environment variables at bundle time. The frontend Dockerfile builds with `ARG VITE_USE_MOCK=false`. Changing this setting requires rebuilding the image (`docker compose build frontend`).
5. **Database Port Isolation (5432):**
   - PostgreSQL port `5432` is not published to the host by default. If host database access (e.g. via GUI tools or `psql`) is desired, copy `docker-compose.override.example.yml` to `docker-compose.override.yml` to bind port `5433` safely.
