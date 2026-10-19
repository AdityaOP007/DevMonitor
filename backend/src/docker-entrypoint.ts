import { runMigrations } from './db/migrate.js';
import { runSeeds } from './db/seed.js';

async function main(): Promise<void> {
  console.log('[Docker Entrypoint] Starting DevMonitor backend initialization...');

  try {
    console.log('[Docker Entrypoint] Executing pending database migrations...');
    await runMigrations();

    console.log('[Docker Entrypoint] Executing idempotent database seed...');
    await runSeeds();
  } catch (err: unknown) {
    console.error('[Docker Entrypoint Error] Startup migration/seed failed:', err);
    process.exit(1);
  }

  console.log('[Docker Entrypoint] Database ready. Launching application server...');
  await import('./server.js');
}

main().catch((err) => {
  console.error('[Docker Entrypoint Fatal]', err);
  process.exit(1);
});
