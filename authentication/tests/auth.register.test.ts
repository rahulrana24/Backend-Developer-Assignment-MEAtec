import request from 'supertest';
import { createApp } from '../src/app';
import { User } from '../src/models/User';
import { expectErrorEnvelope, expectSuccessEnvelope } from './helpers/envelope';

const app = createApp();

describe('POST /api/auth/register', () => {
  const validBody = {
    email: 'dealer.admin@example.com',
    password: 'password123',
    role: 'admin',
  };

  it('creates a user and returns 201 in the standard envelope, without the password', async () => {
    const res = await request(app).post('/api/auth/register').send(validBody);

    expectSuccessEnvelope(res, 201);
    expect(res.body.message).toBe('User registered successfully');
    expect(res.body.data.user).toMatchObject({
      email: validBody.email,
      role: validBody.role,
    });
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('stores a bcrypt hash, not the plaintext password', async () => {
    await request(app).post('/api/auth/register').send(validBody);

    const stored = await User.findOne({ email: validBody.email });
    expect(stored).not.toBeNull();
    expect(stored?.passwordHash).not.toBe(validBody.password);
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('rejects a duplicate email with 409 in the standard error envelope', async () => {
    await request(app).post('/api/auth/register').send(validBody);
    const res = await request(app).post('/api/auth/register').send(validBody);

    expectErrorEnvelope(res, 409);
    expect(res.body.data).toBeNull();
  });

  it('rejects an invalid email with 400 and field-level error details in data', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, email: 'not-an-email' });

    expectErrorEnvelope(res, 400);
    expect(Array.isArray(res.body.data.errors)).toBe(true);
    expect(res.body.data.errors.some((e: { field: string }) => e.field === 'email')).toBe(true);
  });

  it('rejects a password shorter than 8 characters with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, password: 'short' });

    expectErrorEnvelope(res, 400);
  });

  it('rejects an unknown role with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, role: 'superuser' });

    expectErrorEnvelope(res, 400);
  });
});
