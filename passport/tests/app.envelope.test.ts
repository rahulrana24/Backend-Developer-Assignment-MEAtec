import request from 'supertest';
import { createApp } from '../src/app';
import { expectErrorEnvelope, expectSuccessEnvelope } from './helpers/envelope';

const app = createApp();

describe('cross-cutting response envelope', () => {
  it('GET /health returns the standard success envelope', async () => {
    const res = await request(app).get('/health');

    expectSuccessEnvelope(res, 200);
    expect(res.body.data).toEqual({ status: 'ok' });
  });

  it('an unknown route returns the standard error envelope with 404', async () => {
    const res = await request(app).get('/api/passports/does-not-exist/nested');

    expectErrorEnvelope(res, 404);
    expect(res.body.data).toBeNull();
  });

  it('GET /api-docs serves the Swagger UI', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
  });
});
