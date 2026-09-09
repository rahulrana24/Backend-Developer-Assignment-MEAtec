process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? 'http://auth-service.test';
process.env.AUTH_VERIFY_TIMEOUT_MS = process.env.AUTH_VERIFY_TIMEOUT_MS ?? '2000';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'error';

// Static credentials and no S3_ENDPOINT so the S3 client resolves credentials
// synchronously (no metadata-service network call). Every actual `.send()` call is
// intercepted by s3Mock below; getSignedUrl never calls `.send()` — it signs locally
// using these same static credentials, so presigned-URL tests don't need mocking.
process.env.S3_REGION = process.env.S3_REGION ?? 'us-east-1';
process.env.S3_BUCKET = process.env.S3_BUCKET ?? 'test-bucket';
process.env.S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID ?? 'test-access-key';
process.env.S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY ?? 'test-secret-key';
process.env.PRESIGNED_URL_EXPIRY_SECONDS = process.env.PRESIGNED_URL_EXPIRY_SECONDS ?? '900';
process.env.MAX_FILE_SIZE_MB = process.env.MAX_FILE_SIZE_MB ?? '10';

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import nock from 'nock';
import { s3Mock } from './helpers/s3Mock';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
  nock.cleanAll();
  s3Mock.reset();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
