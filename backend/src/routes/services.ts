import { Router } from 'express';
import { getServicesHandler } from '../controllers/servicesController.js';

export const servicesRouter = Router();
servicesRouter.get('/', getServicesHandler);
