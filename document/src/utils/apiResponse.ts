import { Response } from 'express';

export interface ApiResponseBody<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
}

export function sendSuccess<T>(res: Response, statusCode: number, message: string, data: T | null = null): void {
  const body: ApiResponseBody<T> = { success: true, message, data };
  res.status(statusCode).json(body);
}

export function sendError(res: Response, statusCode: number, message: string, data: unknown = null): void {
  const body: ApiResponseBody = { success: false, message, data };
  res.status(statusCode).json(body);
}
