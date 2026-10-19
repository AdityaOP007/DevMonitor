import { config } from '../config/env.js';
import { rawPool, closePool } from './pool.js';
import { runMigrations } from './migrate.js';
import { runSeeds } from './seed.js';

function validateResetSafety(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: db:reset is strictly forbidden when NODE_ENV is "production".');
  }

  let dbHost = 'unknown';
  try {
    const parsed = new URL(config.databaseUrl);
    dbHost = parsed.hostname.toLowerCase();
  } catch {
    // If connection string isn't a standard URL format, fallback checks
  }

  const allowedHosts = ['localhost', '127.0.0.1', 'postgres', 'db', 'backend'];
  if (!allowedHosts.includes(dbHost)) {
    throw new Error(
      `FATAL: db:reset refused on host "${dbHost}". Reset is only permitted on local or development containers (${allowedHosts.join(', ')}).`
    );
  }
}

export async function resetDatabase(): Promise<void> {
  validateResetSafety();

  console.log('[DB Reset] WARNING: Dropping public schema and resetting all database tables...');
  console.log(`[DB Reset] Target: ${config.databaseUrl}`);

  await rawPool.query('DROP SCHEMA public CASCADE;');
  await rawPool.query('CREATE SCHEMA public;');
  await rawPool.query('GRANT ALL ON SCHEMA public TO public;');

  console.log('[DB Reset] Public schema recreated. Applying migrations...');
  await runMigrations();

  console.log('[DB Reset] Migrations applied. Running initial seeds...');
  await runSeeds();

  console.log('[DB Reset] Database reset, migrated, and seeded successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('reset.ts')) {
  resetDatabase()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[DB Reset Error]', err);
      await closePool();
      process.exit(1);
    });
}
