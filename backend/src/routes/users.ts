import { Router } from 'express';
import { createUserHandler, getUsersHandler } from '../controllers/usersController.js';

export const usersRouter = Router();

usersRouter.post('/', createUserHandler);
usersRouter.get('/', getUsersHandler);
