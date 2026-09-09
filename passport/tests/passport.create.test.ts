import request from 'supertest';
import { createApp } from '../src/app';
import { Passport } from '../src/models/Passport';
import { mockAuthVerifyNetworkError, mockAuthVerifySuccess } from './helpers/authMock';
import { expectErrorEnvelope, expectSuccessEnvelope } from './helpers/envelope';
import { samplePassportBody } from './helpers/fixtures';

const app = createApp();

describe('POST /api/passports', () => {
  it('creates a passport as admin and returns 201 in the standard envelope', async () => {
    mockAuthVerifySuccess('admin', { userId: 'admin-1' });

    const res = await request(app)
      .post('/api/passports')
      .set('Authorization', 'Bearer admin-token')
      .send(samplePassportBody());

    expectSuccessEnvelope(res, 201);
    expect(res.body.message).toBe('Passport created successfully');
    expect(res.body.data.passport.data.generalInformation.batteryIdentifier).toBe('BP-2024-011');
    expect(res.body.data.passport.data.generalInformation.warrantyPeriod).toBe('8');
    expect(res.body.data.passport.createdBy).toBe('admin-1');
    expect(res.body.data.passport.updatedBy).toBe('admin-1');
  });

  it('persists an unmodeled extra field inside generalInformation instead of stripping it', async () => {
    mockAuthVerifySuccess('admin');

    const body = samplePassportBody();
    (body.data.generalInformation as Record<string, unknown>).notes = 'left front cell replaced';

    const res = await request(app).post('/api/passports').set('Authorization', 'Bearer admin-token').send(body);

    expectSuccessEnvelope(res, 201);
    const stored = await Passport.findById(res.body.data.passport._id);
    const storedGeneralInformation = stored?.toObject().data.generalInformation as unknown as Record<string, unknown>;
    expect(storedGeneralInformation.notes).toBe('left front cell replaced');
  });

  it('rejects a user-role caller with 403', async () => {
    mockAuthVerifySuccess('user');
    const res = await request(app)
      .post('/api/passports')
      .set('Authorization', 'Bearer user-token')
      .send(samplePassportBody());

    expectErrorEnvelope(res, 403);
  });

  it('rejects a request with no token with 401', async () => {
    const res = await request(app).post('/api/passports').send(samplePassportBody());
    expectErrorEnvelope(res, 401);
  });

  it('returns 503 when the auth service is unreachable', async () => {
    mockAuthVerifyNetworkError();
    const res = await request(app)
      .post('/api/passports')
      .set('Authorization', 'Bearer admin-token')
      .send(samplePassportBody());

    expectErrorEnvelope(res, 503);
  });

  it('rejects a missing batteryIdentifier with 400 and a field-level error', async () => {
    mockAuthVerifySuccess('admin');
    const body = samplePassportBody();
    // @ts-expect-error intentionally omitting a required field for the validation test
    delete body.data.generalInformation.batteryIdentifier;

    const res = await request(app).post('/api/passports').set('Authorization', 'Bearer admin-token').send(body);

    expectErrorEnvelope(res, 400);
    expect(
      res.body.data.errors.some((e: { field: string }) => e.field === 'data.generalInformation.batteryIdentifier'),
    ).toBe(true);
  });

  it('rejects a non-numeric batteryMass with 400', async () => {
    mockAuthVerifySuccess('admin');
    const body = samplePassportBody();
    (body.data.generalInformation as Record<string, unknown>).batteryMass = 'heavy';

    const res = await request(app).post('/api/passports').set('Authorization', 'Bearer admin-token').send(body);

    expectErrorEnvelope(res, 400);
  });

  it('rejects an empty criticalRawMaterials array with 400', async () => {
    mockAuthVerifySuccess('admin');
    const body = samplePassportBody();
    body.data.materialComposition.criticalRawMaterials = [];

    const res = await request(app).post('/api/passports').set('Authorization', 'Bearer admin-token').send(body);

    expectErrorEnvelope(res, 400);
  });

  it('rejects a numeric warrantyPeriod (must be a string) with 400', async () => {
    mockAuthVerifySuccess('admin');
    const body = samplePassportBody();
    (body.data.generalInformation as Record<string, unknown>).warrantyPeriod = 8;

    const res = await request(app).post('/api/passports').set('Authorization', 'Bearer admin-token').send(body);

    expectErrorEnvelope(res, 400);
  });
});
