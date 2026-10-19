import type { Request, Response } from 'express';
import { query } from '../db/pool.js';
import type { ServiceItem, ServiceStatus } from '../types/index.js';

interface RawServiceRow {
  id: number;
  name: string;
  status: string;
  role: string | null;
}

export async function getServicesHandler(_req: Request, res: Response): Promise<void> {
  try {
    const result = await query<RawServiceRow>('SELECT id, name, status, role FROM services ORDER BY id ASC');

    const services: ServiceItem[] = result.rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      status: row.status as ServiceStatus,
      role: row.role || '',
    }));

    res.json(services);
  } catch (error) {
    // If DB is offline, return 503 per requirement
    res.status(503).json({ error: 'Database service is currently unavailable' });
  }
}
