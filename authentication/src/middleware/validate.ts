import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from '../utils/AppError';

export function validate(req: Request, _res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map((e) => ({
      field: e.type === 'field' ? e.path : undefined,
      message: e.msg as string,
    }));
    const message = details.map((d) => d.message).join('; ');
    next(new AppError(message, 400, { errors: details }));
    return;
  }
  next();
}
