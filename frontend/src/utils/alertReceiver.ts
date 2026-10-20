import type { ReceiverAlert, ReceiverSummary } from '../types';

/**
 * Type guard to check if an unknown value is a non-null record/object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Coerces an unknown value to a trimmed, truncated string.
 */
function sanitizeString(value: unknown, maxLength: number): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

/**
 * Validates and normalizes an ISO date string.
 * Returns null if the value is invalid or unparseable.
 */
function parseValidDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return null;

  return trimmed;
}

/**
 * Parses endsAt and converts Alertmanager's zero-sentinel ("0001-01-01...") to null.
 */
function parseEndsAt(value: unknown): string | null {
  const dateStr = parseValidDate(value);
  if (!dateStr) return null;

  const parsed = new Date(dateStr);
  // An endsAt whose year is 1 or earlier (e.g. 0001-01-01 sent by Alertmanager for firing alerts) becomes null
  if (parsed.getFullYear() <= 1) {
    return null;
  }

  return dateStr;
}

/**
 * Computes the `active` boolean for each alert in the list.
 * Grouping key: alertname + "|" + instance.
 * An entry is active ONLY if it is the MOST RECENT entry (by receivedAt) of its group
 * AND its status is "firing".
 * Tie on equal timestamps: "resolved" wins (firing is suppressed).
 */
export function computeActive(alerts: ReceiverAlert[]): void {
  // Map of groupKey -> list of alerts in this group
  const groups = new Map<string, ReceiverAlert[]>();

  for (const alert of alerts) {
    const key = `${alert.alertname}|${alert.instance}`;
    const list = groups.get(key);
    if (list) {
      list.push(alert);
    } else {
      groups.set(key, [alert]);
    }
  }

  // First reset all active flags to false
  for (const alert of alerts) {
    alert.active = false;
  }

  for (const groupAlerts of groups.values()) {
    if (groupAlerts.length === 0) continue;

    // Find the maximum receivedAt timestamp in the group
    let maxTime = -Infinity;
    for (const alert of groupAlerts) {
      const t = Date.parse(alert.receivedAt);
      if (t > maxTime) {
        maxTime = t;
      }
    }

    // Collect all entries in the group sharing the maximum timestamp
    const latestEntries = groupAlerts.filter((a) => Date.parse(a.receivedAt) === maxTime);

    // Tie-breaker rule: if any latest entry has status "resolved", resolved wins
    const hasResolved = latestEntries.some((a) => a.status === 'resolved');

    if (!hasResolved) {
      // Find the first firing entry in the latest entries (if any) and mark it active
      const latestFiring = latestEntries.find((a) => a.status === 'firing');
      if (latestFiring) {
        latestFiring.active = true;
      }
    }
  }
}

/**
 * Normalizes an untrusted raw payload from the alert receiver into strongly typed ReceiverAlert[].
 */
export function normalizeReceiverPayload(raw: unknown): ReceiverAlert[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const validAlerts: ReceiverAlert[] = [];

  for (const item of raw) {
    if (!isRecord(item)) continue;

    // Status must be exactly "firing" or "resolved"
    const rawStatus = item.status;
    if (rawStatus !== 'firing' && rawStatus !== 'resolved') {
      continue;
    }

    // receivedAt is required and must be a valid date
    const receivedAt = parseValidDate(item.receivedAt);
    if (!receivedAt) {
      continue;
    }

    // Severity mapping
    let severity: 'warning' | 'critical' | 'unknown' = 'unknown';
    if (item.severity === 'warning' || item.severity === 'critical') {
      severity = item.severity;
    }

    // StartsAt and EndsAt
    const startsAt = parseValidDate(item.startsAt);
    const endsAt = parseEndsAt(item.endsAt);

    // Coerced, trimmed, truncated strings
    const alertname = sanitizeString(item.alertname, 100);
    const instance = sanitizeString(item.instance, 200);
    const summary = sanitizeString(item.summary, 200);
    const description = sanitizeString(item.description, 500);
    const action = sanitizeString(item.action, 500);

    validAlerts.push({
      status: rawStatus,
      alertname,
      severity,
      summary,
      description,
      action,
      instance,
      startsAt,
      endsAt,
      receivedAt,
      active: false,
    });
  }

  // Sort newest receivedAt first (descending timestamp)
  validAlerts.sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));

  // Cap at 100 entries
  const capped = validAlerts.slice(0, 100);

  // Compute active status
  computeActive(capped);

  return capped;
}

/**
 * Computes summary statistics from a normalized alert list.
 */
export function summarize(alerts: ReceiverAlert[]): ReceiverSummary {
  let firingNow = 0;
  let resolved = 0;

  for (const alert of alerts) {
    if (alert.active) {
      firingNow++;
    }
    if (alert.status === 'resolved') {
      resolved++;
    }
  }

  return {
    firingNow,
    resolved,
    total: alerts.length,
  };
}
