import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import type { TLSSocket } from 'node:tls';
import type { UrlCheckResult } from '../types/index.js';

interface CheckRecord {
  statusCode: number;
  durationMs: number;
  timestamp: number;
  isUp: boolean;
}

const urlHistory = new Map<string, CheckRecord[]>();
const urlFirstSeen = new Map<string, number>();

/**
 * Validates IP address against forbidden private and reserved ranges to prevent SSRF.
 */
function isPrivateOrReservedIp(ip: string): boolean {
  // IPv6 checks
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
    return true;
  }

  // IPv4 mapped IPv6 e.g. ::ffff:127.0.0.1
  const cleanIp = ip.startsWith('::ffff:') ? ip.replace('::ffff:', '') : ip;

  const parts = cleanIp.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // invalid / reserved
  }

  const [p0, p1] = parts;

  // 0.0.0.0/8
  if (p0 === 0) return true;
  // 127.0.0.0/8 (Loopback)
  if (p0 === 127) return true;
  // 10.0.0.0/8 (Private)
  if (p0 === 10) return true;
  // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
  if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (p0 === 192 && p1 === 168) return true;
  // 169.254.0.0/16 (Link-local / Cloud Metadata)
  if (p0 === 169 && p1 === 254) return true;

  return false;
}

export async function validateUrlSafety(urlStr: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https protocols are supported');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost') {
    throw new Error('Access to localhost is forbidden for security');
  }

  try {
    const lookup = await dns.lookup(hostname, { all: true });
    for (const entry of lookup) {
      if (isPrivateOrReservedIp(entry.address)) {
        throw new Error(`Target IP (${entry.address}) is in a reserved or private address range.`);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('reserved or private')) {
      throw err;
    }
    throw new Error(`DNS resolution failed for ${hostname}`);
  }

  return parsed;
}

export async function checkTargetUrl(targetUrl: string, maxRedirects: number = 3): Promise<UrlCheckResult> {
  const parsed = await validateUrlSafety(targetUrl);
  const isHttps = parsed.protocol === 'https:';

  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    const client = isHttps ? https : http;

    const req = client.request(
      parsed,
      {
        method: 'GET',
        headers: { 'User-Agent': 'DevMonitor-URL-Prober/1.0' },
        timeout: 5000,
      },
      async (res) => {
        const durationMs = Math.round(performance.now() - startTime);
        const statusCode = res.statusCode || 0;

        // Discard body stream immediately to avoid memory leaks
        res.resume();

        // Handle redirects safely with depth capping
        if (statusCode >= 300 && statusCode < 400 && res.headers.location && maxRedirects > 0) {
          try {
            const redirectUrl = new URL(res.headers.location, parsed).toString();
            const redirectResult = await checkTargetUrl(redirectUrl, maxRedirects - 1);
            return resolve(redirectResult);
          } catch (redErr) {
            return reject(redErr);
          }
        }

        // Verify SSL certificate validity if HTTPS
        let ssl: 'Valid' | 'Invalid' = 'Invalid';
        if (isHttps) {
          const socket = res.socket as TLSSocket;
          if (socket.authorized) {
            ssl = 'Valid';
          }
        }

        const isUp = statusCode >= 200 && statusCode < 500;

        // Record check in in-memory history
        const now = Date.now();
        if (!urlFirstSeen.has(targetUrl)) {
          urlFirstSeen.set(targetUrl, now);
        }

        const history = urlHistory.get(targetUrl) || [];
        history.push({ statusCode, durationMs, timestamp: now, isUp });
        if (history.length > 50) history.shift();
        urlHistory.set(targetUrl, history);

        // Compute availability %
        const upCount = history.filter((h) => h.isUp).length;
        const availability = Number(((upCount / history.length) * 100).toFixed(1));

        // Format uptime duration since first recorded check
        const firstSeen = urlFirstSeen.get(targetUrl) || now;
        const diffMinutes = Math.floor((now - firstSeen) / 60000);
        const uptime = diffMinutes < 60 ? `${diffMinutes} mins` : `${Math.floor(diffMinutes / 60)} hours`;

        resolve({
          url: targetUrl,
          status: isUp ? 'UP' : 'DOWN',
          availability,
          responseTime: durationMs,
          statusCode,
          ssl,
          uptime,
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({
        url: targetUrl,
        status: 'DOWN',
        availability: 0,
        responseTime: 5000,
        statusCode: 504,
        ssl: 'Invalid',
        uptime: '0 mins',
      });
    });

    req.on('error', (err) => {
      resolve({
        url: targetUrl,
        status: 'DOWN',
        availability: 0,
        responseTime: Math.round(performance.now() - startTime),
        statusCode: 502,
        ssl: 'Invalid',
        uptime: '0 mins',
      });
    });

    req.end();
  });
}
