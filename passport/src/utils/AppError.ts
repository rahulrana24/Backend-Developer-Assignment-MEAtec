export class AppError extends Error {
  public readonly statusCode: number;
  public readonly data: unknown;
  public readonly isOperational = true;

  constructor(message: string, statusCode: number, data: unknown = null) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
