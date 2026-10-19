import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rawPool, closePool, withTransaction } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationTable(): Promise<void> {
  await rawPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function getMigrationStatus(): Promise<{ applied: string[]; pending: string[] }> {
  await ensureMigrationTable();

  const res = await rawPool.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename ASC'
  );
  const appliedSet = new Set(res.rows.map((r) => r.filename));

  const allFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = allFiles.filter((f) => appliedSet.has(f));
  const pending = allFiles.filter((f) => !appliedSet.has(f));

  return { applied, pending };
}

export async function runMigrations(): Promise<void> {
  await ensureMigrationTable();

  const { pending } = await getMigrationStatus();
  if (pending.length === 0) {
    console.log('[DB Migration] Schema is already up to date. No pending migrations.');
    return;
  }

  for (const filename of pending) {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`[DB Migration] Applying ${filename}...`);
    try {
      await withTransaction(async (client) => {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, applied_at) VALUES ($1, NOW())',
          [filename]
        );
      });
      console.log(`[DB Migration] Successfully applied ${filename}.`);
    } catch (err: unknown) {
      console.error(`[DB Migration Error] Failed applying ${filename}:`, err);
      throw err;
    }
  }
}

// CLI handler for npm run db:migrate and db:status
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  const isStatusCheck = process.argv.includes('--status');

  const action = isStatusCheck
    ? async () => {
        const { applied, pending } = await getMigrationStatus();
        console.log('=== Migration Status ===');
        console.log(`Applied (${applied.length}):`, applied.join(', ') || '(none)');
        console.log(`Pending (${pending.length}):`, pending.join(', ') || '(none)');
      }
    : runMigrations;

  action()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async () => {
      await closePool();
      process.exit(1);
    });
}
