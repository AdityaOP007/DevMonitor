import { Router } from 'express';
import { getDashboardHandler } from '../controllers/dashboardController.js';

export const dashboardRouter = Router();
dashboardRouter.get('/', getDashboardHandler);
