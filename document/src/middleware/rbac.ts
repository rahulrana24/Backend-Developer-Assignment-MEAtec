import axios from 'axios';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger';
import { Role } from '../constants/roles';
import { AuthenticatedUser } from '../types/auth';
import { AppError } from '../utils/AppError';
import { authServiceClient } from '../utils/authServiceClient';

interface VerifyResponseBody {
  success: boolean;
  message: string;
  data: AuthenticatedUser | null;
}

function extractBearerHeader(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header;
}

export async function verifyAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = extractBearerHeader(req);
  if (!authHeader) {
    next(new AppError('Missing or malformed Authorization header', 401));
    return;
  }

  try {
    const response = await authServiceClient.post<VerifyResponseBody>('/api/auth/verify', undefined, {
      headers: { Authorization: authHeader },
    });
    req.user = response.data.data as AuthenticatedUser;
    next();
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response) {
        const body = err.response.data as Partial<VerifyResponseBody> | undefined;
        next(new AppError(body?.message ?? 'Invalid or expired token', 401));
        return;
      }

      logger.error('Auth service unreachable during token verification', {
        error: err.message,
        code: err.code,
      });
      next(new AppError('Unable to reach authentication service', 503));
      return;
    }
    next(err as Error);
  }
}

export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401));
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError('Insufficient permissions', 403));
      return;
    }
    next();
  };
}
