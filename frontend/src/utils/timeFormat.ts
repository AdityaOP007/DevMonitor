/**
 * Formats an ISO date string into a human-friendly relative time string.
 * Example: "just now", "45s ago", "3m ago", "2h ago", "5d ago"
 */
export function formatRelativeTime(isoString: string): string {
  const timestamp = Date.parse(isoString);
  if (Number.isNaN(timestamp)) return 'unknown';

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return 'just now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Formats an ISO date string into a full localized date and time string.
 */
export function formatFullDateTime(isoString: string | null): string {
  if (!isoString) return 'Not ended yet';
  const timestamp = Date.parse(isoString);
  if (Number.isNaN(timestamp)) return isoString;

  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
