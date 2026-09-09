import request from 'supertest';
import { createApp } from '../src/app';
import { Passport } from '../src/models/Passport';
import { mockAuthVerifyNetworkError, mockAuthVerifySuccess } from './helpers/authMock';
import { expectErrorEnvelope, expectSuccessEnvelope } from './helpers/envelope';
import { samplePassportBody } from './helpers/fixtures';

const app = createApp();

async function seedPassport(): Promise<string> {
  const passport = await Passport.create({
    data: samplePassportBody().data,
    createdBy: 'admin-1',
    updatedBy: 'admin-1',
  });
  return passport._id.toString();
}

describe('GET /api/passports/:id', () => {
  it('lets an admin view a passport', async () => {
    const id = await seedPassport();
    mockAuthVerifySuccess('admin');

    const res = await request(app).get(`/api/passports/${id}`).set('Authorization', 'Bearer admin-token');

    expectSuccessEnvelope(res, 200);
    expect(res.body.message).toBe('Passport retrieved successfully');
    expect(res.body.data.passport._id).toBe(id);
  });

  it('lets a user view a passport', async () => {
    const id = await seedPassport();
    mockAuthVerifySuccess('user');

    const res = await request(app).get(`/api/passports/${id}`).set('Authorization', 'Bearer user-token');

    expectSuccessEnvelope(res, 200);
  });

  it('returns 404 for a valid but non-existent id', async () => {
    mockAuthVerifySuccess('admin');
    const res = await request(app)
      .get('/api/passports/507f1f77bcf86cd799439011')
      .set('Authorization', 'Bearer admin-token');

    expectErrorEnvelope(res, 404);
  });

  it('returns 400 for a malformed id without querying the database', async () => {
    mockAuthVerifySuccess('admin');
    const res = await request(app).get('/api/passports/not-a-valid-id').set('Authorization', 'Bearer admin-token');

    expectErrorEnvelope(res, 400);
  });

  it('returns 401 with no token', async () => {
    const id = await seedPassport();
    const res = await request(app).get(`/api/passports/${id}`);

    expectErrorEnvelope(res, 401);
  });

  it('returns 503 when the auth service is unreachable', async () => {
    const id = await seedPassport();
    mockAuthVerifyNetworkError();
    const res = await request(app).get(`/api/passports/${id}`).set('Authorization', 'Bearer admin-token');

    expectErrorEnvelope(res, 503);
  });
});
