import type { Request, Response, NextFunction } from 'express';
import { createUser, getUsers } from '../services/usersService.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createUserHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { name, email } = req.body || {};

  if (typeof name !== 'string' || typeof email !== 'string') {
    res.status(400).json({ error: 'Name and email are required fields.' });
    return;
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();

  if (trimmedName.length < 1 || trimmedName.length > 100) {
    res.status(400).json({ error: 'Name must be between 1 and 100 characters.' });
    return;
  }

  if (trimmedEmail.length === 0 || trimmedEmail.length > 254 || !EMAIL_REGEX.test(trimmedEmail)) {
    res.status(400).json({ error: 'Invalid email format or length.' });
    return;
  }

  try {
    const user = await createUser(trimmedName, trimmedEmail);
    res.status(201).json(user);
  } catch (err: unknown) {
    // Unique violation code 23505 in PostgreSQL
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505') {
      res.status(409).json({ error: 'A user with this email already exists.' });
      return;
    }
    next(err);
  }
}

export async function getUsersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const limitParam = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
  const offsetParam = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : 0;

  const limit = Number.isNaN(limitParam) ? 50 : limitParam;
  const offset = Number.isNaN(offsetParam) ? 0 : offsetParam;

  try {
    const users = await getUsers(limit, offset);
    res.json(users);
  } catch (err) {
    next(err);
  }
}
