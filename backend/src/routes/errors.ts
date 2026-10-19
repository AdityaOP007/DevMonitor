import { Router } from 'express';
import { getRecentErrorsHandler } from '../controllers/errorsController.js';

export const errorsRouter = Router();
errorsRouter.get('/recent', getRecentErrorsHandler);
