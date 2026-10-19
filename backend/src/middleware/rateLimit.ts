import type { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export function createRateLimiter(maxRequests: number = 60, windowMs: number = 60000) {
  const store = new Map<string, RateLimitRecord>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const record = store.get(ip);
    if (!record || now > record.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      return;
    }

    record.count += 1;
    next();
  };
}
