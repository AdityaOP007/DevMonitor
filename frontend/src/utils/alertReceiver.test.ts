import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReceiverPayload, summarize } from './alertReceiver.ts';

test('normalizeReceiverPayload: non-array input returns []', () => {
  assert.deepEqual(normalizeReceiverPayload(null), []);
  assert.deepEqual(normalizeReceiverPayload(undefined), []);
  assert.deepEqual(normalizeReceiverPayload('string'), []);
  assert.deepEqual(normalizeReceiverPayload(12345), []);
  assert.deepEqual(normalizeReceiverPayload({ alerts: [] }), []);
});

test('normalizeReceiverPayload: non-object elements are dropped', () => {
  const raw = [
    null,
    undefined,
    'alert string',
    42,
    [],
    {
      status: 'firing',
      alertname: 'ValidAlert',
      receivedAt: '2026-10-20T12:00:00Z',
    },
  ];
  const result = normalizeReceiverPayload(raw);
  assert.equal(result.length, 1);
  assert.equal(result[0].alertname, 'ValidAlert');
});

test('normalizeReceiverPayload: unknown status is dropped', () => {
  const raw = [
    { status: 'pending', alertname: 'PendingAlert', receivedAt: '2026-10-20T12:00:00Z' },
    { status: 'inactive', alertname: 'InactiveAlert', receivedAt: '2026-10-20T12:00:00Z' },
    { status: 'UNKNOWN', alertname: 'BadStatusAlert', receivedAt: '2026-10-20T12:00:00Z' },
    { status: 'firing', alertname: 'FiringAlert', receivedAt: '2026-10-20T12:00:00Z' },
    { status: 'resolved', alertname: 'ResolvedAlert', receivedAt: '2026-10-20T12:00:00Z' },
  ];
  const result = normalizeReceiverPayload(raw);
  assert.equal(result.length, 2);
  assert.equal(result[0].alertname, 'FiringAlert');
  assert.equal(result[1].alertname, 'ResolvedAlert');
});

test('normalizeReceiverPayload: "0001-01-01T00:00:00Z" endsAt becomes null', () => {
  const raw = [
    {
      status: 'firing',
      alertname: 'BackendDown',
      startsAt: '2026-10-20T12:00:00Z',
      endsAt: '0001-01-01T00:00:00Z',
      receivedAt: '2026-10-20T12:01:00Z',
    },
  ];
  const result = normalizeReceiverPayload(raw);
  assert.equal(result.length, 1);
  assert.equal(result[0].endsAt, null);
  assert.equal(result[0].startsAt, '2026-10-20T12:00:00Z');
});

test('normalizeReceiverPayload: invalid receivedAt drops the element', () => {
  const raw = [
    { status: 'firing', alertname: 'MissingReceivedAt' },
    { status: 'firing', alertname: 'InvalidReceivedAt', receivedAt: 'not-a-date' },
    { status: 'firing', alertname: 'ValidReceivedAt', receivedAt: '2026-10-20T12:00:00Z' },
  ];
  const result = normalizeReceiverPayload(raw);
  assert.equal(result.length, 1);
  assert.equal(result[0].alertname, 'ValidReceivedAt');
});

test('normalizeReceiverPayload: strings are trimmed and truncated', () => {
  const longName = 'A'.repeat(150);
  const longInstance = 'I'.repeat(250);
  const longSummary = 'S'.repeat(250);
  const longDesc = 'D'.repeat(600);
  const longAction = 'C'.repeat(600);

  const raw = [
    {
      status: 'firing',
      alertname: '   ' + longName + '   ',
      instance: '   ' + longInstance + '   ',
      summary: '   ' + longSummary + '   ',
      description: '   ' + longDesc + '   ',
      action: '   ' + longAction + '   ',
      receivedAt: '2026-10-20T12:00:00Z',
    },
  ];
  const result = normalizeReceiverPayload(raw);
  assert.equal(result.length, 1);
  assert.equal(result[0].alertname.length, 100);
  assert.equal(result[0].instance.length, 200);
  assert.equal(result[0].summary.length, 200);
  assert.equal(result[0].description.length, 500);
  assert.equal(result[0].action.length, 500);
});

test('normalizeReceiverPayload: severity falls back to "unknown"', () => {
  const raw = [
    { status: 'firing', alertname: 'A1', severity: 'critical', receivedAt: '2026-10-20T12:00:00Z' },
    { status: 'firing', alertname: 'A2', severity: 'warning', receivedAt: '2026-10-20T12:00:00Z' },
    { status: 'firing', alertname: 'A3', severity: 'info', receivedAt: '2026-10-20T12:00:00Z' },
    { status: 'firing', alertname: 'A4', severity: undefined, receivedAt: '2026-10-20T12:00:00Z' },
  ];
  const result = normalizeReceiverPayload(raw);
  assert.equal(result.find((a) => a.alertname === 'A1')?.severity, 'critical');
  assert.equal(result.find((a) => a.alertname === 'A2')?.severity, 'warning');
  assert.equal(result.find((a) => a.alertname === 'A3')?.severity, 'unknown');
  assert.equal(result.find((a) => a.alertname === 'A4')?.severity, 'unknown');
});

test('normalizeReceiverPayload: sorting newest first and cap of 100', () => {
  const raw = [];
  for (let i = 1; i <= 120; i++) {
    const min = String(i).padStart(3, '0');
    raw.push({
      status: 'firing',
      alertname: `Alert-${i}`,
      instance: `inst-${i}`,
      receivedAt: `2026-10-20T12:00:${min.slice(0, 2)}Z`,
    });
  }
  const result = normalizeReceiverPayload(raw);
  assert.equal(result.length, 100);
  // Newest timestamp must be first
  assert.equal(result[0].receivedAt >= result[99].receivedAt, true);
});

test('normalizeReceiverPayload: firing then later resolved for same alertname+instance gives firingNow 0', () => {
  const raw = [
    {
      status: 'firing',
      alertname: 'BackendDown',
      instance: 'backend:5000',
      receivedAt: '2026-10-20T12:00:00Z',
    },
    {
      status: 'resolved',
      alertname: 'BackendDown',
      instance: 'backend:5000',
      receivedAt: '2026-10-20T12:05:00Z',
    },
  ];
  const result = normalizeReceiverPayload(raw);
  assert.equal(result.length, 2);
  // Newest is the resolved one at 12:05:00Z
  assert.equal(result[0].status, 'resolved');
  assert.equal(result[0].active, false);
  assert.equal(result[1].status, 'firing');
  assert.equal(result[1].active, false);

  const stats = summarize(result);
  assert.equal(stats.firingNow, 0);
  assert.equal(stats.resolved, 1);
  assert.equal(stats.total, 2);
});

test('normalizeReceiverPayload: resolved then later firing again gives firingNow 1', () => {
  const raw = [
    {
      status: 'resolved',
      alertname: 'BackendDown',
      instance: 'backend:5000',
      receivedAt: '2026-10-20T12:00:00Z',
    },
    {
      status: 'firing',
      alertname: 'BackendDown',
      instance: 'backend:5000',
      receivedAt: '2026-10-20T12:05:00Z',
    },
  ];
  const result = normalizeReceiverPayload(raw);
  assert.equal(result.length, 2);
  assert.equal(result[0].status, 'firing');
  assert.equal(result[0].active, true);
  assert.equal(result[1].status, 'resolved');
  assert.equal(result[1].active, false);

  const stats = summarize(result);
  assert.equal(stats.firingNow, 1);
  assert.equal(stats.resolved, 1);
  assert.equal(stats.total, 2);
});

test('normalizeReceiverPayload: two different instances of same alertname are independent', () => {
  const raw = [
    {
      status: 'firing',
      alertname: 'HighCpuUsage',
      instance: 'server-1:9100',
      receivedAt: '2026-10-20T12:00:00Z',
    },
    {
      status: 'firing',
      alertname: 'HighCpuUsage',
      instance: 'server-2:9100',
      receivedAt: '2026-10-20T12:00:00Z',
    },
    {
      status: 'resolved',
      alertname: 'HighCpuUsage',
      instance: 'server-1:9100',
      receivedAt: '2026-10-20T12:05:00Z',
    },
  ];
  const result = normalizeReceiverPayload(raw);
  // server-1 is resolved (not active), server-2 is still firing (active)
  const s1 = result.filter((a) => a.instance === 'server-1:9100');
  const s2 = result.filter((a) => a.instance === 'server-2:9100');

  assert.equal(s1[0].active, false);
  assert.equal(s2[0].active, true);

  const stats = summarize(result);
  assert.equal(stats.firingNow, 1);
  assert.equal(stats.resolved, 1);
  assert.equal(stats.total, 3);
});

test('normalizeReceiverPayload: equal timestamps with firing and resolved: resolved wins', () => {
  const raw = [
    {
      status: 'firing',
      alertname: 'HighErrorRate',
      instance: 'backend:5000',
      receivedAt: '2026-10-20T12:00:00Z',
    },
    {
      status: 'resolved',
      alertname: 'HighErrorRate',
      instance: 'backend:5000',
      receivedAt: '2026-10-20T12:00:00Z',
    },
  ];
  const result = normalizeReceiverPayload(raw);
  assert.equal(result.some((a) => a.active), false);

  const stats = summarize(result);
  assert.equal(stats.firingNow, 0);
  assert.equal(stats.resolved, 1);
  assert.equal(stats.total, 2);
});

test('normalizeReceiverPayload: strings with <script> and <img onerror> are kept as plain text unchanged (only truncated)', () => {
  const xssSummary = '<script>alert(1)</script>';
  const xssAlertname = '<img src=x onerror=alert(1)>';
  const raw = [
    {
      status: 'firing',
      alertname: xssAlertname,
      instance: 'xss-instance',
      summary: xssSummary,
      receivedAt: '2026-10-20T12:00:00Z',
    },
  ];
  const result = normalizeReceiverPayload(raw);
  assert.equal(result.length, 1);
  // The raw strings must not be stripped or HTML escaped here (they remain plain text in the data layer)
  assert.equal(result[0].alertname, xssAlertname);
  assert.equal(result[0].summary, xssSummary);
});

test('summarize: counts are correct', () => {
  const alerts = [
    {
      status: 'firing' as const,
      alertname: 'A1',
      severity: 'critical' as const,
      summary: '',
      description: '',
      action: '',
      instance: 'inst1',
      startsAt: null,
      endsAt: null,
      receivedAt: '2026-10-20T12:00:00Z',
      active: true,
    },
    {
      status: 'firing' as const,
      alertname: 'A1',
      severity: 'critical' as const,
      summary: '',
      description: '',
      action: '',
      instance: 'inst1',
      startsAt: null,
      endsAt: null,
      receivedAt: '2026-10-20T11:50:00Z',
      active: false,
    },
    {
      status: 'resolved' as const,
      alertname: 'A2',
      severity: 'warning' as const,
      summary: '',
      description: '',
      action: '',
      instance: 'inst2',
      startsAt: null,
      endsAt: null,
      receivedAt: '2026-10-20T12:00:00Z',
      active: false,
    },
  ];
  const stats = summarize(alerts);
  assert.equal(stats.firingNow, 1);
  assert.equal(stats.resolved, 1);
  assert.equal(stats.total, 3);
});
