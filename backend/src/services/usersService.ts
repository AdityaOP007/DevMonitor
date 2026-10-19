import { query } from '../db/pool.js';
import type { UserItem } from '../types/index.js';

interface RawUserRow {
  id: number;
  name: string;
  email: string;
  created_at: Date;
}

export async function createUser(name: string, email: string): Promise<UserItem> {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();

  const res = await query<RawUserRow>(
    `INSERT INTO users (name, email, created_at)
     VALUES ($1, $2, NOW())
     RETURNING id, name, email, created_at`,
    [trimmedName, trimmedEmail]
  );

  const row = res.rows[0];
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function getUsers(limit: number = 50, offset: number = 0): Promise<UserItem[]> {
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safeOffset = Math.max(0, offset);

  const res = await query<RawUserRow>(
    `SELECT id, name, email, created_at
     FROM users
     ORDER BY created_at DESC, id DESC
     LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset]
  );

  return res.rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    email: row.email,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}
