import { Router } from 'express';
import { getServerHandler } from '../controllers/serverController.js';

export const serverRouter = Router();
serverRouter.get('/', getServerHandler);
