import { Router } from 'express';
import { checkUrlHandler } from '../controllers/monitorController.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

export const monitorRouter = Router();

// Rate limit URL monitoring to 10 checks per minute per IP to prevent probe abuse
const urlCheckLimiter = createRateLimiter(10, 60000);

monitorRouter.post('/check-url', urlCheckLimiter, checkUrlHandler);
