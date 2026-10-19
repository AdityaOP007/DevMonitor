import { Router } from 'express';
import { getPrometheusMetricsHandler } from '../controllers/metricsController.js';

export const metricsRouter = Router();
metricsRouter.get('/', getPrometheusMetricsHandler);
