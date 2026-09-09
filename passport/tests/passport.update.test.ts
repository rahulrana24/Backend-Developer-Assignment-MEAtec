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

describe('PUT /api/passports/:id', () => {
  it('lets an admin fully replace a passport and updates updatedBy', async () => {
    const id = await seedPassport();
    mockAuthVerifySuccess('admin', { userId: 'admin-2' });

    const body = samplePassportBody();
    body.data.generalInformation.batteryStatus = 'Refurbished';

    const res = await request(app).put(`/api/passports/${id}`).set('Authorization', 'Bearer admin-token').send(body);

    expectSuccessEnvelope(res, 200);
    expect(res.body.message).toBe('Passport updated successfully');
    expect(res.body.data.passport.data.generalInformation.batteryStatus).toBe('Refurbished');
    expect(res.body.data.passport.updatedBy).toBe('admin-2');
    expect(res.body.data.passport.createdBy).toBe('admin-1');
  });

  it('rejects a user-role caller with 403', async () => {
    const id = await seedPassport();
    mockAuthVerifySuccess('user');

    const res = await request(app)
      .put(`/api/passports/${id}`)
      .set('Authorization', 'Bearer user-token')
      .send(samplePassportBody());

    expectErrorEnvelope(res, 403);
  });

  it('returns 404 for a valid but non-existent id', async () => {
    mockAuthVerifySuccess('admin');
    const res = await request(app)
      .put('/api/passports/507f1f77bcf86cd799439011')
      .set('Authorization', 'Bearer admin-token')
      .send(samplePassportBody());

    expectErrorEnvelope(res, 404);
  });

  it('returns 400 for a malformed id', async () => {
    mockAuthVerifySuccess('admin');
    const res = await request(app)
      .put('/api/passports/not-a-valid-id')
      .set('Authorization', 'Bearer admin-token')
      .send(samplePassportBody());

    expectErrorEnvelope(res, 400);
  });

  it('returns 400 when the replacement body fails validation', async () => {
    const id = await seedPassport();
    mockAuthVerifySuccess('admin');

    const body = samplePassportBody();
    // @ts-expect-error intentionally omitting a required field for the validation test
    delete body.data.carbonFootprint.methodology;

    const res = await request(app).put(`/api/passports/${id}`).set('Authorization', 'Bearer admin-token').send(body);

    expectErrorEnvelope(res, 400);
  });
});
