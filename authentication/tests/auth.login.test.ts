import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app';
import { expectErrorEnvelope, expectSuccessEnvelope } from './helpers/envelope';

const app = createApp();

describe('POST /api/auth/login', () => {
  const credentials = {
    email: 'service.advisor@example.com',
    password: 'password123',
    role: 'user',
  };

  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(credentials);
  });

  it('logs in with correct credentials and returns a decodable JWT in the standard envelope', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    expectSuccessEnvelope(res, 200);
    expect(res.body.message).toBe('Login successful');
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user).toMatchObject({
      email: credentials.email,
      role: credentials.role,
    });

    const decoded = jwt.verify(res.body.data.token, process.env.JWT_SECRET as string) as {
      userId: string;
      email: string;
      role: string;
    };
    expect(decoded.email).toBe(credentials.email);
    expect(decoded.role).toBe(credentials.role);
    expect(decoded.userId).toBe(res.body.data.user.id);
  });

  it('rejects a wrong password with 401 in the standard error envelope', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'wrong-password' });

    expectErrorEnvelope(res, 401);
    expect(res.body.data).toBeNull();
  });

  it('rejects an unknown email with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: credentials.password });

    expectErrorEnvelope(res, 401);
  });

  it('rejects a malformed login body with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });

    expectErrorEnvelope(res, 400);
  });
});
