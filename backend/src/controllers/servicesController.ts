import type { Request, Response } from 'express';
import { query } from '../db/pool.js';
import type { ServiceItem, ServiceStatus } from '../types/index.js';

interface RawServiceRow {
  id: number;
  name: string;
  status: string;
  role: string | null;
}

/**
 * Maps database canonical status (UP/DOWN/UNKNOWN) to the frontend's ServiceStatus display values.
 */
export function mapCanonicalStatusToDisplay(name: string, canonicalStatus: string): ServiceStatus {
  if (canonicalStatus === 'UP') {
    if (name === 'Prometheus') return 'Collecting';
    if (name === 'Grafana') return 'Connected';
    return 'Healthy';
  }
  return 'Down';
}

export async function getServicesHandler(_req: Request, res: Response): Promise<void> {
  try {
    const result = await query<RawServiceRow>(
      'SELECT id, name, status, role FROM services ORDER BY id ASC'
    );

    const services: ServiceItem[] = result.rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      status: mapCanonicalStatusToDisplay(row.name, row.status),
      role: row.role || '',
    }));

    res.json(services);
  } catch (error) {
    // If DB is offline, return 503 per requirement
    res.status(503).json({ error: 'Database service is currently unavailable' });
  }
}
