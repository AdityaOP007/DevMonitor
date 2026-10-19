import { Router } from 'express';
import { getHealthHandler } from '../controllers/healthController.js';

export const healthRouter = Router();
healthRouter.get('/', getHealthHandler);
