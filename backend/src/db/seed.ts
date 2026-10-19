import { query, closePool } from './pool.js';
import { config } from '../config/env.js';

export async function runSeeds(): Promise<void> {
  // Check and seed services
  const existingServices = await query('SELECT COUNT(*) as count FROM services');
  const serviceCount = parseInt(existingServices.rows[0].count, 10);

  if (serviceCount === 0) {
    const services = [
      {
        name: 'Backend API',
        status: 'Healthy',
        url: `http://localhost:${config.port}/api/health`,
        role: 'Processes application requests and business logic',
      },
      {
        name: 'Database',
        status: 'Healthy',
        url: null,
        role: 'PostgreSQL storage for persistent data',
      },
      {
        name: 'Prometheus',
        status: 'Collecting',
        url: 'http://localhost:9090',
        role: 'Scrapes /metrics endpoint every 15 seconds',
      },
      {
        name: 'Grafana',
        status: 'Connected',
        url: 'http://localhost:3000',
        role: 'Visualizes historical metrics and time-series',
      },
    ];

    for (const s of services) {
      await query(
        'INSERT INTO services (name, status, url, role) VALUES ($1, $2, $3, $4)',
        [s.name, s.status, s.url, s.role]
      );
    }
    console.log(`[DB Seed] Inserted ${services.length} default services.`);
  }

  // Check and seed alert_config
  const existingConfig = await query('SELECT COUNT(*) as count FROM alert_config');
  const configCount = parseInt(existingConfig.rows[0].count, 10);

  if (configCount === 0) {
    await query(
      `INSERT INTO alert_config (id, cpu_threshold, memory_threshold, error_rate_threshold, response_time_threshold, duration_minutes)
       VALUES (1, $1, $2, $3, $4, $5)`,
      [80, 85, 5, 300, 5]
    );
    console.log('[DB Seed] Inserted default alert config.');
  }
}

// Allow direct CLI execution
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
