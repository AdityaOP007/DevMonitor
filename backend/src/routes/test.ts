import { Router } from 'express';
import { testGuard } from '../middleware/testGuard.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import {
  testLoadHandler,
  testErrorsHandler,
  testSlowHandler,
  testCpuHandler,
  testStopHandler,
  testRestoreHandler,
} from '../controllers/testController.js';

export const testRouter = Router();

// Test guard: 404 unless ENABLE_TEST_ENDPOINTS=true
testRouter.use(testGuard);

// Rate-limit test actions to 120 per minute
testRouter.use(createRateLimiter(120, 60000));

testRouter.post('/load', testLoadHandler);
testRouter.post('/errors', testErrorsHandler);
testRouter.post('/slow', testSlowHandler);
testRouter.post('/cpu', testCpuHandler);
testRouter.post('/stop', testStopHandler);
testRouter.post('/restore', testRestoreHandler);
