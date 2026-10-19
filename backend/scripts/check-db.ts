/**
 * DevMonitor Database & Persistence Verification Script
 * Validates migrations, constraints, seed idempotency, transactions, users API, and query honesty.
 */

import { rawPool, closePool, withTransaction } from '../src/db/pool.js';
import { runMigrations, getMigrationStatus } from '../src/db/migrate.js';
import { runSeeds } from '../src/db/seed.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
let allPassed = true;

function logPass(msg: string) {
  console.log(`[PASS] ${msg}`);
}

function logFail(msg: string, detail?: string) {
  allPassed = false;
  console.error(`[FAIL] ${msg}`);
  if (detail) console.error(`       ${detail}`);
}

async function runChecks() {
  console.log(`=== DevMonitor Database Compliance Verification ===\nTarget: ${BASE_URL}\n`);

  // Check 1: Connectivity & Migration idempotency
  try {
    const status1 = await getMigrationStatus();
    await runMigrations();
    const status2 = await getMigrationStatus();
    if (status1.applied.length === status2.applied.length && status2.pending.length === 0) {
      logPass(`1. Connectivity verified; db:migrate run twice is idempotent (${status2.applied.length} applied)`);
    } else {
      logFail('1. Migration idempotency failed');
    }
  } catch (err: unknown) {
    logFail('1. Migration check error:', (err as Error).message);
  }

  // Check 2: Tables, columns, and constraints
  try {
    // 2a. Reject status 'Healthy' in DB (DB only accepts UP/DOWN/UNKNOWN)
    let healthyRejected = false;
    try {
      await rawPool.query("INSERT INTO services (name, status) VALUES ('InvalidService', 'Healthy')");
    } catch {
      healthyRejected = true;
    }

    // 2b. Reject severity 'info' on incidents
    let infoRejected = false;
    try {
      await rawPool.query("INSERT INTO incidents (severity, title, message) VALUES ('info', 'T', 'M')");
    } catch {
      infoRejected = true;
    }

    // 2c. Reject duplicate service name
    let dupServiceRejected = false;
    try {
      await rawPool.query("INSERT INTO services (name, status) VALUES ('Backend API', 'UP')");
    } catch {
      dupServiceRejected = true;
    }

    // 2d. Reject duplicate user email
    const testEmail = `dup-${Date.now()}@test.com`;
    await rawPool.query("INSERT INTO users (name, email) VALUES ('User 1', $1)", [testEmail]);
    let dupUserRejected = false;
    try {
      await rawPool.query("INSERT INTO users (name, email) VALUES ('User 2', $1)", [testEmail]);
    } catch {
      dupUserRejected = true;
    } finally {
      await rawPool.query('DELETE FROM users WHERE email = $1', [testEmail]);
    }

    if (healthyRejected && infoRejected && dupServiceRejected && dupUserRejected) {
      logPass('2. CHECK and UNIQUE constraints enforced on services, incidents, and users');
    } else {
      logFail('2. Constraint verification failed', `Healthy: ${healthyRejected}, Info: ${infoRejected}, DupSvc: ${dupServiceRejected}, DupUser: ${dupUserRejected}`);
    }
  } catch (err: unknown) {
    logFail('2. Table constraint error:', (err as Error).message);
  }

  // Check 3: Seed idempotency & preservation of manual edits
  try {
    const sCountBefore = parseInt((await rawPool.query('SELECT COUNT(*) FROM services')).rows[0].count, 10);
    const cCountBefore = parseInt((await rawPool.query('SELECT COUNT(*) FROM alert_config')).rows[0].count, 10);

    // Manually edit a service URL
    const customUrl = 'http://custom-edited-domain.test';
    await rawPool.query("UPDATE services SET url = $1 WHERE name = 'Frontend'", [customUrl]);

    // Run seed twice
    await runSeeds();
    await runSeeds();

    const sCountAfter = parseInt((await rawPool.query('SELECT COUNT(*) FROM services')).rows[0].count, 10);
    const cCountAfter = parseInt((await rawPool.query('SELECT COUNT(*) FROM alert_config')).rows[0].count, 10);
    const frontendRow = (await rawPool.query("SELECT url FROM services WHERE name = 'Frontend'")).rows[0];

    const countMatches = sCountBefore === sCountAfter && cCountBefore === cCountAfter;
    const urlPreserved = frontendRow?.url === customUrl;

    // Restore Frontend default URL
    await rawPool.query("UPDATE services SET url = 'http://localhost:5173' WHERE name = 'Frontend'");

    if (countMatches && urlPreserved) {
      logPass('3. Seed idempotency confirmed: rows unchanged and manual edits preserved');
    } else {
      logFail('3. Seed idempotency check failed', `CountMatches: ${countMatches}, Preserved: ${urlPreserved}`);
    }
  } catch (err: unknown) {
    logFail('3. Seed check error:', (err as Error).message);
  }

  // Check 4: withTransaction rollback on failure
  try {
    const txEmail = `tx-fail-${Date.now()}@test.com`;
    let txThrew = false;
    try {
      await withTransaction(async (client) => {
        await client.query("INSERT INTO users (name, email) VALUES ('TxRollback', $1)", [txEmail]);
        throw new Error('Forced transaction failure');
      });
    } catch {
      txThrew = true;
    }

    const checkRes = await rawPool.query('SELECT COUNT(*) as count FROM users WHERE email = $1', [txEmail]);
    if (txThrew && parseInt(checkRes.rows[0].count, 10) === 0) {
      logPass('4. withTransaction helper successfully rolled back inserted row on error');
    } else {
      logFail('4. withTransaction rollback failed');
    }
  } catch (err: unknown) {
    logFail('4. Transaction rollback error:', (err as Error).message);
  }

  // Check 5: Partial unique index on active incidents
  const incidentTitle = `TEST_PARTIAL_IDX_${Date.now()}`;
  try {
    await rawPool.query(
      "INSERT INTO incidents (severity, title, message, active) VALUES ('warning', $1, 'Msg 1', true)",
      [incidentTitle]
    );

    let dupActiveFailed = false;
    try {
      await rawPool.query(
        "INSERT INTO incidents (severity, title, message, active) VALUES ('warning', $1, 'Msg 2', true)",
        [incidentTitle]
      );
    } catch {
      dupActiveFailed = true;
    }

    // Resolve first incident
    await rawPool.query('UPDATE incidents SET active = false, resolved_at = NOW() WHERE title = $1', [incidentTitle]);

    // Now inserting active incident with same title must succeed
    let newActiveSucceeded = false;
    try {
      await rawPool.query(
        "INSERT INTO incidents (severity, title, message, active) VALUES ('warning', $1, 'Msg 3', true)",
        [incidentTitle]
      );
      newActiveSucceeded = true;
    } catch {
      newActiveSucceeded = false;
    }

    await rawPool.query('DELETE FROM incidents WHERE title = $1', [incidentTitle]);

    if (dupActiveFailed && newActiveSucceeded) {
      logPass('5. Partial unique index prevents duplicate active incidents and allows new upon resolution');
    } else {
      logFail('5. Partial unique index check failed');
    }
  } catch (err: unknown) {
    await rawPool.query('DELETE FROM incidents WHERE title = $1', [incidentTitle]);
    logFail('5. Incident index check error:', (err as Error).message);
  }

  // Check 6: Through running API (POST/GET /api/users, GET /api/services)
  const apiEmail = `api-user-${Date.now()}@test.com`;
  try {
    // 6a. Create user
    const createRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'API Tester', email: apiEmail }),
    });
    const createdUser = await createRes.json();
    const createOk = createRes.status === 201 && createdUser.email === apiEmail && Boolean(createdUser.id);

    // 6b. Duplicate user
    const dupRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'API Tester Dup', email: apiEmail }),
    });
    const dupOk = dupRes.status === 409;

    // 6c. Invalid input
    const badRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', email: 'not-an-email' }),
    });
    const badOk = badRes.status === 400;

    // 6d. GET /api/users
    const listRes = await fetch(`${BASE_URL}/api/users?limit=10`);
    const userList: { email: string }[] = await listRes.json();
    const listOk = listRes.status === 200 && userList.some((u) => u.email === apiEmail);

    // Clean up
    await rawPool.query('DELETE FROM users WHERE email = $1', [apiEmail]);

    // 6e. GET /api/services status vocabulary
    const svcRes = await fetch(`${BASE_URL}/api/services`);
    const svcs: { status: string }[] = await svcRes.json();
    const validDisplayStatuses = new Set(['Healthy', 'Collecting', 'Connected', 'Down']);
    const svcVocabularyOk = svcRes.status === 200 && svcs.every((s) => validDisplayStatuses.has(s.status));

    if (createOk && dupOk && badOk && listOk && svcVocabularyOk) {
      logPass('6. Users API (201/409/400/list) and Services API frontend vocabulary verified');
    } else {
      logFail('6. API behavior check failed', `Create: ${createOk}, Dup: ${dupOk}, Bad: ${badOk}, List: ${listOk}, SvcVocab: ${svcVocabularyOk}`);
    }
  } catch (err: unknown) {
    await rawPool.query('DELETE FROM users WHERE email = $1', [apiEmail]);
    logFail('6. Users API check error:', (err as Error).message);
  }

  // Check 7: Internal-query honesty
  try {
    const parseDbQueries = async () => {
      const res = await fetch(`${BASE_URL}/metrics`);
      const text = await res.text();
      const match = text.match(/^devmonitor_db_queries_total\s+([^\s]+)/m);
      return match ? Number(match[1]) : 0;
    };

    const qBefore = await parseDbQueries();
    await fetch(`${BASE_URL}/metrics`);
    await fetch(`${BASE_URL}/metrics`);
    const qAfter = await parseDbQueries();

    if (qBefore === qAfter) {
      logPass(`7. Internal-query honesty verified: devmonitor_db_queries_total stayed at ${qBefore} across scrapes`);
    } else {
      logFail(`7. Internal queries counted in metrics (went from ${qBefore} to ${qAfter})`);
    }
  } catch (err: unknown) {
    logFail('7. Query honesty check error:', (err as Error).message);
  }

  await closePool();

  console.log(`\n=== Verification Summary ===`);
  if (allPassed) {
    console.log('ALL DATABASE CHECKS PASSED [OK]\n');
    process.exit(0);
  } else {
    console.error('ONE OR MORE DATABASE CHECKS FAILED [FAIL]\n');
    process.exit(1);
  }
}

runChecks().catch((err) => {
  console.error('Unhandled check-db script error:', err);
  process.exit(1);
});
