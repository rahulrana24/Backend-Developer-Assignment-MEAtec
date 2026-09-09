import { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/apiResponse';

// Express only recognizes error-handling middleware by its 4-argument arity,
// so `req` and `next` must stay in the signature even though they're unused.
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message, err.data);
    return;
  }

  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  sendError(res, 500, 'Internal server error');
}
