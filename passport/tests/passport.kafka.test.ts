import request from 'supertest';
import { createApp } from '../src/app';
import { Passport } from '../src/models/Passport';
import * as passportEventPublisher from '../src/services/passportEventPublisher';
import { mockAuthVerifySuccess } from './helpers/authMock';
import { samplePassportBody } from './helpers/fixtures';

const app = createApp();

describe('Kafka passport.change.stream publishing', () => {
  it('create/update/delete still succeed with no Kafka connection (KAFKA_BROKER unset in tests)', async () => {
    mockAuthVerifySuccess('admin');
    const createRes = await request(app)
      .post('/api/passports')
      .set('Authorization', 'Bearer admin-token')
      .send(samplePassportBody());
    expect(createRes.status).toBe(201);

    const id = createRes.body.data.passport._id as string;

    mockAuthVerifySuccess('admin');
    const updateRes = await request(app)
      .put(`/api/passports/${id}`)
      .set('Authorization', 'Bearer admin-token')
      .send(samplePassportBody());
    expect(updateRes.status).toBe(200);

    mockAuthVerifySuccess('admin');
    const deleteRes = await request(app).delete(`/api/passports/${id}`).set('Authorization', 'Bearer admin-token');
    expect(deleteRes.status).toBe(200);
  });

  it('publishes a "created" event with a null changeDescription', async () => {
    const publishSpy = jest.spyOn(passportEventPublisher, 'publishPassportChangeEvent');
    mockAuthVerifySuccess('admin', { userId: 'admin-9' });

    const res = await request(app)
      .post('/api/passports')
      .set('Authorization', 'Bearer admin-token')
      .send(samplePassportBody());

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'created',
        passportId: res.body.data.passport._id,
        actor: { userId: 'admin-9' },
        changeDescription: null,
      }),
    );
  });

  it('publishes an "updated" event whose changeDescription lists exactly the changed fields', async () => {
    const passport = await Passport.create({
      data: samplePassportBody().data,
      createdBy: 'admin-1',
      updatedBy: 'admin-1',
    });

    const publishSpy = jest.spyOn(passportEventPublisher, 'publishPassportChangeEvent');
    mockAuthVerifySuccess('admin', { userId: 'admin-2' });

    const body = samplePassportBody();
    body.data.generalInformation.batteryStatus = 'Refurbished';
    body.data.materialComposition.criticalRawMaterials = ['Lithium'];

    await request(app)
      .put(`/api/passports/${passport._id.toString()}`)
      .set('Authorization', 'Bearer admin-token')
      .send(body);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'updated',
        passportId: passport._id.toString(),
        actor: { userId: 'admin-2' },
        changeDescription: expect.objectContaining({
          changedFields: expect.arrayContaining([
            'generalInformation.batteryStatus',
            'materialComposition.criticalRawMaterials',
          ]),
          changes: expect.objectContaining({
            'generalInformation.batteryStatus': { before: 'Original', after: 'Refurbished' },
            'materialComposition.criticalRawMaterials': { before: ['Lithium', 'Iron'], after: ['Lithium'] },
          }),
        }),
      }),
    );
  });

  it('publishes a "deleted" event with a null changeDescription', async () => {
    const passport = await Passport.create({
      data: samplePassportBody().data,
      createdBy: 'admin-1',
      updatedBy: 'admin-1',
    });

    const publishSpy = jest.spyOn(passportEventPublisher, 'publishPassportChangeEvent');
    mockAuthVerifySuccess('admin');

    await request(app)
      .delete(`/api/passports/${passport._id.toString()}`)
      .set('Authorization', 'Bearer admin-token');

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'deleted',
        passportId: passport._id.toString(),
        changeDescription: null,
      }),
    );
  });
});
