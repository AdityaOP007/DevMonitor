import { query, closePool } from './pool.js';
import { config } from '../config/env.js';

export async function runSeeds(): Promise<void> {
  const services = [
    {
      name: 'Backend API',
      status: 'UNKNOWN',
      url: config.backendHealthUrl,
      role: 'Serves the dashboard data and exposes metrics',
    },
    {
      name: 'Database',
      status: 'UNKNOWN',
      url: null,
      role: "Stores the application's own data",
    },
    {
      name: 'Frontend',
      status: 'UNKNOWN',
      url: config.frontendUrl,
      role: 'The React dashboard people open in the browser',
    },
    {
      name: 'Prometheus',
      status: 'UNKNOWN',
      url: config.prometheusUrl,
      role: 'Collects and stores metrics',
    },
    {
      name: 'Grafana',
      status: 'UNKNOWN',
      url: config.grafanaUrl,
      role: 'Draws graphs and dashboards',
    },
  ];

  for (const s of services) {
    // Idempotent: Never overwrite rows that exist or were edited by a user
    await query(
      `INSERT INTO services (name, status, url, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO NOTHING`,
      [s.name, s.status, s.url, s.role],
      { internal: true }
    );
  }
  console.log('[DB Seed] Seeded default services (idempotent ON CONFLICT DO NOTHING).');

  // Seed default alert_config row only if absent
  await query(
    `INSERT INTO alert_config (id, cpu_threshold, memory_threshold, error_rate_threshold, response_time_threshold, duration_minutes)
     VALUES (1, 80, 85, 5, 300, 5)
     ON CONFLICT (id) DO NOTHING`,
    [],
    { internal: true }
  );
  console.log('[DB Seed] Ensured default alert configuration row.');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  runSeeds()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[DB Seed Error]', err);
      await closePool();
      process.exit(1);
    });
}
