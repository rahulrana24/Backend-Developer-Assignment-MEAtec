import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import request from 'supertest';
import { createApp } from '../src/app';
import { DocumentModel } from '../src/models/Document';
import { mockAuthVerifySuccess } from './helpers/authMock';
import { expectErrorEnvelope, expectSuccessEnvelope } from './helpers/envelope';
import { createSampleDocument } from './helpers/fixtures';
import { s3Mock } from './helpers/s3Mock';

const app = createApp();

describe('DELETE /api/documents/:docId', () => {
  it('deletes a document as the owner', async () => {
    mockAuthVerifySuccess('user', { userId: 'user-1' });
    s3Mock.on(DeleteObjectCommand).resolves({});
    const document = await createSampleDocument('user-1');

    const res = await request(app).delete(`/api/documents/${document._id}`).set('Authorization', 'Bearer user-token');

    expectSuccessEnvelope(res, 200);
    expect(res.body.data).toBeNull();

    const stored = await DocumentModel.findById(document._id);
    expect(stored).toBeNull();
  });

  it("allows an admin to delete someone else's document", async () => {
    mockAuthVerifySuccess('admin');
    s3Mock.on(DeleteObjectCommand).resolves({});
    const document = await createSampleDocument('user-1');

    const res = await request(app)
      .delete(`/api/documents/${document._id}`)
      .set('Authorization', 'Bearer admin-token');

    expectSuccessEnvelope(res, 200);
  });

  it('rejects a non-owner, non-admin caller with 403 and keeps the record', async () => {
    mockAuthVerifySuccess('user', { userId: 'user-2' });
    const document = await createSampleDocument('user-1');

    const res = await request(app).delete(`/api/documents/${document._id}`).set('Authorization', 'Bearer user-token');

    expectErrorEnvelope(res, 403);
    const stored = await DocumentModel.findById(document._id);
    expect(stored).not.toBeNull();
  });

  it('returns 404 for a document that does not exist', async () => {
    mockAuthVerifySuccess('admin');

    const res = await request(app)
      .delete('/api/documents/66b1f0c9e1a2b3c4d5e6f7a8')
      .set('Authorization', 'Bearer admin-token');

    expectErrorEnvelope(res, 404);
  });

  it('rejects a malformed docId with 400', async () => {
    mockAuthVerifySuccess('admin');

    const res = await request(app).delete('/api/documents/not-a-valid-id').set('Authorization', 'Bearer admin-token');

    expectErrorEnvelope(res, 400);
  });

  it('returns 503 and keeps the record when the S3 delete fails', async () => {
    mockAuthVerifySuccess('user', { userId: 'user-1' });
    s3Mock.on(DeleteObjectCommand).rejects(new Error('network error'));
    const document = await createSampleDocument('user-1');

    const res = await request(app).delete(`/api/documents/${document._id}`).set('Authorization', 'Bearer user-token');

    expectErrorEnvelope(res, 503);
    const stored = await DocumentModel.findById(document._id);
    expect(stored).not.toBeNull();
  });

  it('rejects a request with no token with 401', async () => {
    const document = await createSampleDocument('user-1');

    const res = await request(app).delete(`/api/documents/${document._id}`);

    expectErrorEnvelope(res, 401);
  });
});
