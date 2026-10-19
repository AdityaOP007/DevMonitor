import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { runSeeds } from './db/seed.js';
import { closePool, isDatabaseAlive, startBackgroundConnectionCheck } from './db/pool.js';

import { requestLogger } from './middleware/requestLogger.js';
import { metricsMiddleware } from './middleware/metricsMiddleware.js';
import { simulationMiddleware } from './middleware/simulationMiddleware.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

import { healthRouter } from './routes/health.js';
import { metricsRouter } from './routes/metrics.js';
import { serverRouter } from './routes/server.js';
import { dashboardRouter } from './routes/dashboard.js';
import { seriesRouter } from './routes/series.js';
import { errorsRouter } from './routes/errors.js';
import { servicesRouter } from './routes/services.js';
import { databaseRouter } from './routes/database.js';
import { alertsRouter } from './routes/alerts.js';
import { usersRouter } from './routes/users.js';
import { monitorRouter } from './routes/monitor.js';
import { testRouter } from './routes/test.js';

import { startSamplerJob, stopSamplerJob } from './jobs/sampler.js';
import { startHealthCheckJob, stopHealthCheckJob } from './jobs/healthCheckJob.js';
import { startAlertEvaluatorJob, stopAlertEvaluatorJob } from './jobs/alertEvaluator.js';

const app = express();

// 1. Dedicated Prometheus Scrape Target (mounted ahead of application middleware)
app.use('/metrics', metricsRouter);

// 2. Cross-Origin Resource Sharing for API routes
app.use(
  cors({
    origin: config.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. Body Parser with 10kb limit
app.use(express.json({ limit: '10kb' }));

// 4. Request Logger
app.use(requestLogger);

// 5. Prometheus Metrics Collection Middleware (instruments /api routes)
app.use(metricsMiddleware);

// 6. Simulation Control Middleware
app.use(simulationMiddleware);

// 7. API Routes
app.use('/api/health', healthRouter);
app.use('/api/server', serverRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/metrics', seriesRouter);
app.use('/api/errors', errorsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/database', databaseRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/users', usersRouter);
app.use('/api/monitor', monitorRouter);
app.use('/api/test', testRouter);

// 8. 404 & Central Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Bootstrap Server & DB Initialization
async function startServer(): Promise<void> {
  // Start background connection check probe
  startBackgroundConnectionCheck();

  // Attempt DB migrations and seeding; remain resilient if DB is briefly offline
  try {
    const dbAvailable = await isDatabaseAlive();
    if (dbAvailable) {
      await runMigrations();
      await runSeeds();
    } else {
      console.warn('[DB Warning] PostgreSQL is not reachable at startup. Operating in degraded mode.');
    }
  } catch (err) {
    console.warn('[DB Warning] Database init error, starting in degraded mode:', (err as Error).message);
  }

  // Start background jobs
  startSamplerJob();
  startHealthCheckJob();
  startAlertEvaluatorJob();

  // Listen explicitly on 0.0.0.0 for container networking
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[DevMonitor Backend] Running on http://0.0.0.0:${config.port}`);
    console.log(`[DevMonitor Backend] Metrics available at http://0.0.0.0:${config.port}/metrics`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Shutdown] Received ${signal}. Shutting down gracefully...`);
    stopSamplerJob();
    stopHealthCheckJob();
    stopAlertEvaluatorJob();

    server.close(async () => {
      try {
        await closePool();
        console.log('[Shutdown] Database pool closed.');
      } catch (err) {
        console.error('[Shutdown Error]', err);
      }
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[Shutdown] Forceful exit timed out.');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer();
