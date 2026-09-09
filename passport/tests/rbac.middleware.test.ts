import request from 'supertest';
import { createApp } from '../src/app';
import {
  mockAuthVerifyNetworkError,
  mockAuthVerifySuccess,
  mockAuthVerifyTimeout,
  mockAuthVerifyUnauthorized,
} from './helpers/authMock';
import { expectErrorEnvelope, expectSuccessEnvelope } from './helpers/envelope';

const app = createApp();
const VALID_ID = '507f1f77bcf86cd799439011';

describe('verifyAuth middleware (HTTP delegation to Auth Service)', () => {
  it('rejects a request with no Authorization header with 401, without calling the auth service', async () => {
    const res = await request(app).get(`/api/passports/${VALID_ID}`);
    expectErrorEnvelope(res, 401);
  });

  it('rejects a malformed Authorization header with 401, without calling the auth service', async () => {
    const res = await request(app).get(`/api/passports/${VALID_ID}`).set('Authorization', 'NotBearer abc');
    expectErrorEnvelope(res, 401);
  });

  it('lets an admin-role token through to the route handler', async () => {
    mockAuthVerifySuccess('admin');
    const res = await request(app).get(`/api/passports/${VALID_ID}`).set('Authorization', 'Bearer admin-token');

    // reaches the controller (proven by a 404 "not found" rather than a 401/403)
    expectErrorEnvelope(res, 404);
  });

  it('lets a user-role token through to the route handler', async () => {
    mockAuthVerifySuccess('user');
    const res = await request(app).get(`/api/passports/${VALID_ID}`).set('Authorization', 'Bearer user-token');

    expectErrorEnvelope(res, 404);
  });

  it('propagates the auth service 401 as this service 401 with its message', async () => {
    mockAuthVerifyUnauthorized('Invalid or expired token');
    const res = await request(app).get(`/api/passports/${VALID_ID}`).set('Authorization', 'Bearer bad-token');

    expectErrorEnvelope(res, 401);
    expect(res.body.message).toBe('Invalid or expired token');
  });

  it('returns 503 when the auth service is unreachable (network error)', async () => {
    mockAuthVerifyNetworkError();
    const res = await request(app).get(`/api/passports/${VALID_ID}`).set('Authorization', 'Bearer some-token');

    expectErrorEnvelope(res, 503);
    expect(res.body.message).toBe('Unable to reach authentication service');
  });

  it('returns 503 when the auth service call times out', async () => {
    mockAuthVerifyTimeout();
    const res = await request(app).get(`/api/passports/${VALID_ID}`).set('Authorization', 'Bearer some-token');

    expectErrorEnvelope(res, 503);
    expect(res.body.message).toBe('Unable to reach authentication service');
  }, 10000);
});

describe('authorize middleware (role check)', () => {
  it('rejects a non-admin caller from an admin-only route with 403, before body validation runs', async () => {
    mockAuthVerifySuccess('user');
    const res = await request(app).post('/api/passports').set('Authorization', 'Bearer user-token').send({});

    expectErrorEnvelope(res, 403);
  });

  it('lets an admin caller reach an admin-only route', async () => {
    mockAuthVerifySuccess('admin');
    const res = await request(app).post('/api/passports').set('Authorization', 'Bearer admin-token').send({
      data: {
        generalInformation: {
          batteryIdentifier: 'BP-TEST-1',
          batteryModel: { id: 'M1', modelName: 'Model 1' },
          batteryMass: 100,
          batteryCategory: 'EV',
          batteryStatus: 'Original',
          manufacturingDate: '2024-01-15',
          manufacturingPlace: 'Plant',
          warrantyPeriod: '8',
          manufacturerInformation: { manufacturerName: 'Acme', manufacturerIdentifier: 'ACME-1' },
        },
        materialComposition: {
          batteryChemistry: 'LiFePO4',
          criticalRawMaterials: ['Lithium'],
          hazardousSubstances: [],
        },
        carbonFootprint: { totalCarbonFootprint: 10, measurementUnit: 'kg CO2e', methodology: 'LCA' },
      },
    });

    expectSuccessEnvelope(res, 201);
  });
});
