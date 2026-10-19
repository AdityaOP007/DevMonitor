import { Router } from 'express';
import {
  getAlertsHandler,
  getAlertConfigHandler,
  saveAlertConfigHandler,
} from '../controllers/alertsController.js';

export const alertsRouter = Router();
alertsRouter.get('/', getAlertsHandler);
alertsRouter.get('/config', getAlertConfigHandler);
alertsRouter.post('/config', saveAlertConfigHandler);
