import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app';
import { expectErrorEnvelope, expectSuccessEnvelope } from './helpers/envelope';

const app = createApp();

describe('POST /api/auth/verify', () => {
  const credentials = {
    email: 'fixed.ops.director@example.com',
    password: 'password123',
    role: 'admin',
  };

  async function getToken(): Promise<string> {
    await request(app).post('/api/auth/register').send(credentials);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    return res.body.data.token as string;
  }

  it('returns userId, email, and role in the standard envelope for a valid token', async () => {
    const token = await getToken();

    const res = await request(app).post('/api/auth/verify').set('Authorization', `Bearer ${token}`);

    expectSuccessEnvelope(res, 200);
    expect(res.body.message).toBe('Token verified successfully');
    expect(res.body.data).toMatchObject({
      email: credentials.email,
      role: credentials.role,
    });
    expect(typeof res.body.data.userId).toBe('string');
  });

  it('rejects a request with no Authorization header with 401 in the standard error envelope', async () => {
    const res = await request(app).post('/api/auth/verify');
    expectErrorEnvelope(res, 401);
    expect(res.body.data).toBeNull();
  });

  it('rejects a malformed Authorization header with 401', async () => {
    const res = await request(app).post('/api/auth/verify').set('Authorization', 'NotBearer abc');
    expectErrorEnvelope(res, 401);
  });

  it('rejects a garbage token with 401', async () => {
    const res = await request(app).post('/api/auth/verify').set('Authorization', 'Bearer garbage.token.value');
    expectErrorEnvelope(res, 401);
  });

  it('rejects an expired token with 401', async () => {
    const expiredToken = jwt.sign(
      { userId: '507f1f77bcf86cd799439011', email: credentials.email, role: credentials.role },
      process.env.JWT_SECRET as string,
      { expiresIn: -10 },
    );

    const res = await request(app).post('/api/auth/verify').set('Authorization', `Bearer ${expiredToken}`);
    expectErrorEnvelope(res, 401);
  });
});
