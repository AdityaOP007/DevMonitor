import type { Request, Response } from 'express';
import { checkTargetUrl } from '../services/urlMonitorService.js';

export async function checkUrlHandler(req: Request, res: Response): Promise<void> {
  const url = req.body?.url;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Valid "url" string is required in request body' });
    return;
  }

  try {
    const result = await checkTargetUrl(url.trim());
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'URL check failed';
    res.status(400).json({ error: message });
  }
}
