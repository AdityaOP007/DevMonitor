import { Router } from 'express';
import { getDatabaseStatsHandler } from '../controllers/databaseController.js';

export const databaseRouter = Router();
databaseRouter.get('/stats', getDatabaseStatsHandler);
