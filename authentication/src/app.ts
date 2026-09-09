import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import authRoutes from './routes/authRoutes';
import { errorHandler } from './middleware/errorHandler';
import { sendError, sendSuccess } from './utils/apiResponse';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    sendSuccess(res, 200, 'Service is healthy', { status: 'ok' });
  });

  app.use('/api/auth', authRoutes);

  app.use((req: Request, res: Response) => {
    sendError(res, 404, `Route ${req.method} ${req.originalUrl} not found`);
  });

  app.use(errorHandler);

  return app;
}
