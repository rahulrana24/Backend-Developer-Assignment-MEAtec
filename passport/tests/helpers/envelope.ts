import { Response } from 'supertest';

export function expectSuccessEnvelope(res: Response, statusCode: number): void {
  expect(res.status).toBe(statusCode);
  expect(res.body.success).toBe(true);
  expect(typeof res.body.message).toBe('string');
  expect(res.body.message.length).toBeGreaterThan(0);
}

export function expectErrorEnvelope(res: Response, statusCode: number): void {
  expect(res.status).toBe(statusCode);
  expect(res.body.success).toBe(false);
  expect(typeof res.body.message).toBe('string');
  expect(res.body.message.length).toBeGreaterThan(0);
}
