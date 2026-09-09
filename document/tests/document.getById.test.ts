import request from 'supertest';
import { createApp } from '../src/app';
import { mockAuthVerifySuccess } from './helpers/authMock';
import { expectErrorEnvelope, expectSuccessEnvelope } from './helpers/envelope';
import { createSampleDocument } from './helpers/fixtures';

const app = createApp();

describe('GET /api/documents/:docId', () => {
  it('returns a presigned download link for the owner', async () => {
    mockAuthVerifySuccess('user', { userId: 'user-1' });
    const document = await createSampleDocument('user-1');

    const res = await request(app).get(`/api/documents/${document._id}`).set('Authorization', 'Bearer user-token');

    expectSuccessEnvelope(res, 200);
    expect(res.body.message).toBe('Document download link generated successfully');
    expect(typeof res.body.data.downloadUrl).toBe('string');
    expect(res.body.data.downloadUrl.length).toBeGreaterThan(0);
    expect(res.body.data.document._id).toBe(document._id.toString());
    expect(res.body.data.expiresInSeconds).toBe(900);
  });

  it("allows an admin to fetch a link for someone else's document", async () => {
    mockAuthVerifySuccess('admin', { userId: 'admin-1' });
    const document = await createSampleDocument('user-1');

    const res = await request(app).get(`/api/documents/${document._id}`).set('Authorization', 'Bearer admin-token');

    expectSuccessEnvelope(res, 200);
  });

  it('rejects a non-owner, non-admin caller with 403', async () => {
    mockAuthVerifySuccess('user', { userId: 'user-2' });
    const document = await createSampleDocument('user-1');

    const res = await request(app).get(`/api/documents/${document._id}`).set('Authorization', 'Bearer user-token');

    expectErrorEnvelope(res, 403);
  });

  it('returns 404 for a document that does not exist', async () => {
    mockAuthVerifySuccess('admin');

    const res = await request(app)
      .get('/api/documents/66b1f0c9e1a2b3c4d5e6f7a8')
      .set('Authorization', 'Bearer admin-token');

    expectErrorEnvelope(res, 404);
  });

  it('rejects a malformed docId with 400', async () => {
    mockAuthVerifySuccess('admin');

    const res = await request(app).get('/api/documents/not-a-valid-id').set('Authorization', 'Bearer admin-token');

    expectErrorEnvelope(res, 400);
  });

  it('rejects a request with no token with 401', async () => {
    const document = await createSampleDocument('user-1');

    const res = await request(app).get(`/api/documents/${document._id}`);

    expectErrorEnvelope(res, 401);
  });
});
