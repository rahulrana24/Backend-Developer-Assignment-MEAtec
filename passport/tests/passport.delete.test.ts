import request from 'supertest';
import { createApp } from '../src/app';
import { Passport } from '../src/models/Passport';
import { mockAuthVerifySuccess } from './helpers/authMock';
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

describe('DELETE /api/passports/:id', () => {
  it('lets an admin delete a passport, returning 200 with null data', async () => {
    const id = await seedPassport();
    mockAuthVerifySuccess('admin');

    const res = await request(app).delete(`/api/passports/${id}`).set('Authorization', 'Bearer admin-token');

    expectSuccessEnvelope(res, 200);
    expect(res.body.message).toBe('Passport deleted successfully');
    expect(res.body.data).toBeNull();

    const stored = await Passport.findById(id);
    expect(stored).toBeNull();
  });

  it('rejects a user-role caller with 403', async () => {
    const id = await seedPassport();
    mockAuthVerifySuccess('user');

    const res = await request(app).delete(`/api/passports/${id}`).set('Authorization', 'Bearer user-token');

    expectErrorEnvelope(res, 403);
  });

  it('returns 404 for a valid but non-existent id', async () => {
    mockAuthVerifySuccess('admin');
    const res = await request(app)
      .delete('/api/passports/507f1f77bcf86cd799439011')
      .set('Authorization', 'Bearer admin-token');

    expectErrorEnvelope(res, 404);
  });

  it('returns 400 for a malformed id', async () => {
    mockAuthVerifySuccess('admin');
    const res = await request(app).delete('/api/passports/not-a-valid-id').set('Authorization', 'Bearer admin-token');

    expectErrorEnvelope(res, 400);
  });
});
