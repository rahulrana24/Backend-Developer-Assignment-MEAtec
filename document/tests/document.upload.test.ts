import { PutObjectCommand } from '@aws-sdk/client-s3';
import request from 'supertest';
import { createApp } from '../src/app';
import { DocumentModel } from '../src/models/Document';
import { mockAuthVerifyNetworkError, mockAuthVerifySuccess } from './helpers/authMock';
import { expectErrorEnvelope, expectSuccessEnvelope } from './helpers/envelope';
import { s3Mock } from './helpers/s3Mock';

const app = createApp();

describe('POST /api/documents/upload', () => {
  it('uploads a document as user and returns 201 in the standard envelope', async () => {
    mockAuthVerifySuccess('user', { userId: 'user-1' });
    s3Mock.on(PutObjectCommand).resolves({});

    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', 'Bearer user-token')
      .field('description', 'Signed warranty certificate')
      .attach('file', Buffer.from('hello world'), 'warranty.pdf');

    expectSuccessEnvelope(res, 201);
    expect(res.body.message).toBe('Document uploaded successfully');
    expect(res.body.data.document.originalName).toBe('warranty.pdf');
    expect(res.body.data.document.description).toBe('Signed warranty certificate');
    expect(res.body.data.document.uploadedBy).toBe('user-1');
    expect(res.body.data.document.updatedBy).toBe('user-1');
    expect(res.body.data.document.sizeBytes).toBe(Buffer.byteLength('hello world'));

    const stored = await DocumentModel.findById(res.body.data.document._id);
    expect(stored).not.toBeNull();
  });

  it('allows admin to upload too', async () => {
    mockAuthVerifySuccess('admin');
    s3Mock.on(PutObjectCommand).resolves({});

    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', 'Bearer admin-token')
      .attach('file', Buffer.from('hello'), 'note.txt');

    expectSuccessEnvelope(res, 201);
  });

  it('rejects a request with no file with 400', async () => {
    mockAuthVerifySuccess('user');

    const res = await request(app).post('/api/documents/upload').set('Authorization', 'Bearer user-token');

    expectErrorEnvelope(res, 400);
  });

  it('rejects a request with no token with 401', async () => {
    const res = await request(app).post('/api/documents/upload').attach('file', Buffer.from('hello'), 'a.txt');

    expectErrorEnvelope(res, 401);
  });

  it('returns 503 when the auth service is unreachable', async () => {
    mockAuthVerifyNetworkError();

    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', 'Bearer user-token')
      .attach('file', Buffer.from('hello'), 'a.txt');

    expectErrorEnvelope(res, 503);
  });

  it('returns 503 when the S3 upload fails', async () => {
    mockAuthVerifySuccess('user');
    s3Mock.on(PutObjectCommand).rejects(new Error('network error'));

    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', 'Bearer user-token')
      .attach('file', Buffer.from('hello'), 'a.txt');

    expectErrorEnvelope(res, 503);
  });
});
