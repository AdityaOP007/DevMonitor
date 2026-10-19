import type { Request, Response } from 'express';
import { getMetricsOverview } from '../services/metricsService.js';
import {
  getRequestSeries,
  getCpuSeries,
  getResponseTimeSeries,
  getCurrentThroughput,
} from '../jobs/sampler.js';

export function getOverviewHandler(_req: Request, res: Response): void {
  const throughput = getCurrentThroughput();
  const overview = getMetricsOverview(throughput);
  res.json(overview);
}

export function getRequestSeriesHandler(_req: Request, res: Response): void {
  res.json(getRequestSeries());
}

export function getCpuSeriesHandler(_req: Request, res: Response): void {
  res.json(getCpuSeries());
}

export function getResponseTimeSeriesHandler(_req: Request, res: Response): void {
  res.json(getResponseTimeSeries());
}
