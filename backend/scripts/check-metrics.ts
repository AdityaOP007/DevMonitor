/**
 * DevMonitor Metrics Scrape & Compliance Verification Script
 * Validates /metrics endpoint for Prometheus pull compliance.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

interface MetricSample {
  name: string;
  labels: Record<string, string>;
  value: number;
}

let allPassed = true;

function logPass(msg: string) {
  console.log(`[PASS] ${msg}`);
}

function logFail(msg: string, detail?: string) {
  allPassed = false;
  console.error(`[FAIL] ${msg}`);
  if (detail) console.error(`       ${detail}`);
}

async function fetchMetrics(): Promise<{ status: number; contentType: string; text: string }> {
  const res = await fetch(`${BASE_URL}/metrics`);
  return {
    status: res.status,
    contentType: res.headers.get('content-type') || '',
    text: await res.text(),
  };
}

function parseSampleLine(line: string): MetricSample | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const match = trimmed.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([^\s]+)(?:\s+\d+)?$/);
  if (!match) {
    throw new Error(`Invalid Prometheus metric line format: "${trimmed}"`);
  }

  const [, name, rawLabels, rawVal] = match;
  const labels: Record<string, string> = {};

  if (rawLabels !== undefined && rawLabels.trim().length > 0) {
    // Validate each label is name="value"
    const labelPairs = rawLabels.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
    for (const pair of labelPairs) {
      const pMatch = pair.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"([^"]*)"$/);
      if (!pMatch) {
        throw new Error(`Invalid label syntax (must be quoted): "${pair}" in line: "${trimmed}"`);
      }
      labels[pMatch[1]] = pMatch[2];
    }
  }

  const valNum = Number(rawVal);
  if (!Number.isFinite(valNum)) {
    throw new Error(`Sample value must be a finite number (got "${rawVal}") in line: "${trimmed}"`);
  }

  return { name, labels, value: valNum };
}

function parseAllSamples(body: string): MetricSample[] {
  const samples: MetricSample[] = [];
  const lines = body.split('\n');
  for (const line of lines) {
    const s = parseSampleLine(line);
    if (s) samples.push(s);
  }
  return samples;
}

async function runChecks() {
  console.log(`=== DevMonitor Prometheus Metrics Verification ===\nTarget: ${BASE_URL}\n`);

  // Check 1: Scrape status & Content-Type
  const initial = await fetchMetrics();
  if (initial.status === 200 && initial.contentType.startsWith('text/plain')) {
    logPass(`1. GET /metrics returns HTTP 200 with text/plain contentType (${initial.contentType})`);
  } else {
    logFail(`1. GET /metrics response failed`, `Status: ${initial.status}, Content-Type: ${initial.contentType}`);
  }

  // Check 2: Assert # TYPE lines for all required metrics
  const requiredTypes: Record<string, string> = {
    http_requests_total: 'counter',
    http_errors_total: 'counter',
    http_request_duration_seconds: 'histogram',
    http_active_requests: 'gauge',
    devmonitor_db_up: 'gauge',
    devmonitor_db_connections: 'gauge',
    devmonitor_db_queries_total: 'counter',
    devmonitor_db_query_duration_seconds: 'histogram',
    devmonitor_db_size_bytes: 'gauge',
    devmonitor_service_up: 'gauge',
    devmonitor_simulation_active: 'gauge',
  };

  const typeLines = new Map<string, string>();
  for (const line of initial.text.split('\n')) {
    const m = line.match(/^#\s+TYPE\s+([a-zA-Z0-9_]+)\s+([a-z]+)/);
    if (m) typeLines.set(m[1], m[2]);
  }

  let typeCheckOk = true;
  for (const [metric, expectedType] of Object.entries(requiredTypes)) {
    const actual = typeLines.get(metric);
    if (actual !== expectedType) {
      logFail(`2. Required metric type missing or incorrect: ${metric}`, `Expected ${expectedType}, found ${actual}`);
      typeCheckOk = false;
    }
  }

  // Also check at least one default process metric
  const hasProcessMetric = Array.from(typeLines.keys()).some(
    (k) => k.startsWith('process_') || k.startsWith('nodejs_')
  );
  if (!hasProcessMetric) {
    logFail('2. Default process metric missing from # TYPE definitions');
    typeCheckOk = false;
  }

  if (typeCheckOk) {
    logPass('2. All required metric types and default process metrics declared with valid # TYPE');
  }

  // Check 3: Hand-written line parser validation
  try {
    const samples = parseAllSamples(initial.text);
    logPass(`3. Hand-written parser validated ${samples.length} metric sample lines (all finite & quoted)`);
  } catch (err: unknown) {
    logFail(`3. Parsing metric sample lines failed: ${(err as Error).message}`);
  }

  // Check 4: Series count <= 500 (cardinality guard)
  const initialSamples = parseAllSamples(initial.text);
  if (initialSamples.length <= 500) {
    logPass(`4. Total time series count is bounded: ${initialSamples.length} <= 500`);
  } else {
    logFail(`4. Too many time series (potential explosion): ${initialSamples.length} > 500`);
  }

  // Check 5: Counter behavior
  const getHealthTotal = (samples: MetricSample[]) =>
    samples
      .filter((s) => s.name === 'http_requests_total' && s.labels.route === '/api/health')
      .reduce((acc, cur) => acc + cur.value, 0);

  const getTotalAll = (samples: MetricSample[]) =>
    samples.filter((s) => s.name === 'http_requests_total').reduce((acc, cur) => acc + cur.value, 0);

  const cBefore = getHealthTotal(initialSamples);
  const totalBefore = getTotalAll(initialSamples);

  // Scrape /metrics again - verify /metrics is not self-counted
  const scrapeAgain = await fetchMetrics();
  const totalAfterSelfScrape = getTotalAll(parseAllSamples(scrapeAgain.text));
  if (totalAfterSelfScrape === totalBefore) {
    logPass('5a. Scrape of /metrics itself did not increment http_requests_total');
  } else {
    logFail('5a. Scraping /metrics incremented http_requests_total (self-counting detected)');
  }

  // Invoke /api/health 3 times
  await fetch(`${BASE_URL}/api/health`);
  await fetch(`${BASE_URL}/api/health`);
  await fetch(`${BASE_URL}/api/health`);

  const scrapeAfterCalls = await fetchMetrics();
  const cAfter = getHealthTotal(parseAllSamples(scrapeAfterCalls.text));
  const healthDiff = cAfter - cBefore;

  if (healthDiff === 3) {
    logPass(`5b. Counter http_requests_total{route="/api/health"} increased by exactly 3 (+3)`);
  } else {
    logFail(`5b. Counter increment incorrect for /api/health`, `Expected +3, got +${healthDiff}`);
  }

  // Check 6: Duration histogram behavior
  const durSamples = parseAllSamples(scrapeAfterCalls.text);
  const hasInfBucket = durSamples.some(
    (s) => s.name === 'http_request_duration_seconds_bucket' && s.labels.le === '+Inf'
  );
  const durCount = durSamples
    .filter((s) => s.name === 'http_request_duration_seconds_count')
    .reduce((sum, s) => sum + s.value, 0);

  if (hasInfBucket && durCount > 0) {
    logPass(`6. Duration histogram includes le="+Inf" bucket and records non-zero observations`);
  } else {
    logFail(`6. Duration histogram verification failed (hasInf: ${hasInfBucket}, count: ${durCount})`);
  }

  // Check 7: Resilience during simulations
  // 7a. Test stop mode (down)
  await fetch(`${BASE_URL}/api/test/stop`, { method: 'POST' });
  const downScrape = await fetchMetrics();
  const downSamples = parseAllSamples(downScrape.text);
  const downGauge = downSamples.find(
    (s) => s.name === 'devmonitor_simulation_active' && s.labels.mode === 'down'
  );

  const downOk = downScrape.status === 200 && downGauge?.value === 1;
  await fetch(`${BASE_URL}/api/test/restore`, { method: 'POST' });
  const restoredScrape = await fetchMetrics();
  const restoredGauge = parseAllSamples(restoredScrape.text).find(
    (s) => s.name === 'devmonitor_simulation_active' && s.labels.mode === 'down'
  );

  if (downOk && restoredGauge?.value === 0) {
    logPass('7a. /metrics returns 200 during simulated down mode and tracks devmonitor_simulation_active{mode="down"}');
  } else {
    logFail('7a. Simulated down resilience check failed');
  }

  // 7b. Test slow mode
  await fetch(`${BASE_URL}/api/test/slow`, { method: 'POST' });
  const t0 = performance.now();
  const slowScrape = await fetchMetrics();
  const elapsedMs = performance.now() - t0;
  const slowSamples = parseAllSamples(slowScrape.text);
  const slowGauge = slowSamples.find(
    (s) => s.name === 'devmonitor_simulation_active' && s.labels.mode === 'slow'
  );

  const slowOk = slowScrape.status === 200 && slowGauge?.value === 1 && elapsedMs < 500;
  await fetch(`${BASE_URL}/api/test/restore`, { method: 'POST' });

  if (slowOk) {
    logPass(`7b. /metrics not delayed by slow mode (took ${Math.round(elapsedMs)}ms < 500ms) with active gauge = 1`);
  } else {
    logFail(`7b. Slow mode resilience check failed`, `Status: ${slowScrape.status}, Elapsed: ${elapsedMs}ms, Gauge: ${slowGauge?.value}`);
  }

  console.log(`\n=== Verification Summary ===`);
  if (allPassed) {
    console.log('ALL METRICS CHECKS PASSED [OK]\n');
    process.exit(0);
  } else {
    console.error('ONE OR MORE METRICS CHECKS FAILED [FAIL]\n');
    process.exit(1);
  }
}

runChecks().catch((err) => {
  console.error('Unhandled script error:', err);
  process.exit(1);
});
