import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, closePool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    await query(sql);
    console.log('[DB Migration] Schema created/verified successfully.');
  } catch (error) {
    console.error('[DB Migration Error] Failed to run schema migration:', error);
    throw error;
  }
}

// Allow direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async () => {
      await closePool();
      process.exit(1);
    });
}
