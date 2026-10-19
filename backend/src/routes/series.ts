import { Router } from 'express';
import {
  getOverviewHandler,
  getRequestSeriesHandler,
  getCpuSeriesHandler,
  getResponseTimeSeriesHandler,
} from '../controllers/seriesController.js';

export const seriesRouter = Router();
seriesRouter.get('/overview', getOverviewHandler);
seriesRouter.get('/requests-series', getRequestSeriesHandler);
seriesRouter.get('/cpu-series', getCpuSeriesHandler);
seriesRouter.get('/response-time-series', getResponseTimeSeriesHandler);
