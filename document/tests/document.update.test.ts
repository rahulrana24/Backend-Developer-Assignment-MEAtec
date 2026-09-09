import request from 'supertest';
import { createApp } from '../src/app';
import { mockAuthVerifySuccess } from './helpers/authMock';
import { expectErrorEnvelope, expectSuccessEnvelope } from './helpers/envelope';
import { createSampleDocument } from './helpers/fixtures';

const app = createApp();

describe('PUT /api/documents/:docId', () => {
  it('updates originalName and description as the owner', async () => {
    mockAuthVerifySuccess('user', { userId: 'user-1' });
    const document = await createSampleDocument('user-1');

    const res = await request(app)
      .put(`/api/documents/${document._id}`)
      .set('Authorization', 'Bearer user-token')
      .send({ originalName: 'warranty-signed.pdf', description: 'Now signed' });

    expectSuccessEnvelope(res, 200);
    expect(res.body.data.document.originalName).toBe('warranty-signed.pdf');
    expect(res.body.data.document.description).toBe('Now signed');
    expect(res.body.data.document.updatedBy).toBe('user-1');
  });

  it('allows a partial update with only description', async () => {
    mockAuthVerifySuccess('user', { userId: 'user-1' });
    const document = await createSampleDocument('user-1');

    const res = await request(app)
      .put(`/api/documents/${document._id}`)
      .set('Authorization', 'Bearer user-token')
      .send({ description: 'Updated description only' });

    expectSuccessEnvelope(res, 200);
    expect(res.body.data.document.originalName).toBe('warranty.pdf');
    expect(res.body.data.document.description).toBe('Updated description only');
  });

  it("allows an admin to update someone else's document", async () => {
    mockAuthVerifySuccess('admin', { userId: 'admin-1' });
    const document = await createSampleDocument('user-1');

    const res = await request(app)
      .put(`/api/documents/${document._id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ description: 'Admin edit' });

    expectSuccessEnvelope(res, 200);
    expect(res.body.data.document.updatedBy).toBe('admin-1');
  });

  it('rejects a non-owner, non-admin caller with 403', async () => {
    mockAuthVerifySuccess('user', { userId: 'user-2' });
    const document = await createSampleDocument('user-1');

    const res = await request(app)
      .put(`/api/documents/${document._id}`)
      .set('Authorization', 'Bearer user-token')
      .send({ description: 'Hijack attempt' });

    expectErrorEnvelope(res, 403);
  });

  it('returns 404 for a document that does not exist', async () => {
    mockAuthVerifySuccess('admin');

    const res = await request(app)
      .put('/api/documents/66b1f0c9e1a2b3c4d5e6f7a8')
      .set('Authorization', 'Bearer admin-token')
      .send({ description: 'no-op' });

    expectErrorEnvelope(res, 404);
  });

  it('rejects an empty body with 400', async () => {
    mockAuthVerifySuccess('user', { userId: 'user-1' });
    const document = await createSampleDocument('user-1');

    const res = await request(app)
      .put(`/api/documents/${document._id}`)
      .set('Authorization', 'Bearer user-token')
      .send({});

    expectErrorEnvelope(res, 400);
  });

  it('rejects a malformed docId with 400', async () => {
    mockAuthVerifySuccess('user');

    const res = await request(app)
      .put('/api/documents/not-a-valid-id')
      .set('Authorization', 'Bearer user-token')
      .send({ description: 'x' });

    expectErrorEnvelope(res, 400);
  });
});
