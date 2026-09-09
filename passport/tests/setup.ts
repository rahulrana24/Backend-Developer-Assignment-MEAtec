process.env.AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? 'http://auth-service.test';
process.env.AUTH_VERIFY_TIMEOUT_MS = process.env.AUTH_VERIFY_TIMEOUT_MS ?? '2000';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'error';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import nock from 'nock';

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
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
