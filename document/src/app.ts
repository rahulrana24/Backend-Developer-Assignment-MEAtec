import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import { mountSwagger } from './config/swagger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import documentRoutes from './routes/documentRoutes';
import { sendError, sendSuccess } from './utils/apiResponse';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  app.get('/health', (_req: Request, res: Response) => {
    sendSuccess(res, 200, 'Service is healthy', { status: 'ok' });
  });

  mountSwagger(app);

  app.use('/api/documents', documentRoutes);

  app.use((req: Request, res: Response) => {
    sendError(res, 404, `Route ${req.method} ${req.originalUrl} not found`);
  });

  app.use(errorHandler);

  return app;
}
