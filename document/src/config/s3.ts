import { S3Client } from '@aws-sdk/client-s3';

const REGION = process.env.S3_REGION ?? 'us-east-1';
// Set for S3-compatible storage (e.g. MinIO). Leave unset to talk to real AWS S3.
const ENDPOINT = process.env.S3_ENDPOINT;
// MinIO (and most S3-compatible stores) need path-style requests instead of the
// virtual-hosted-style AWS S3 uses by default.
const FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE === 'true';

export const S3_BUCKET = process.env.S3_BUCKET ?? 'battery-passport-documents';

export const s3Client = new S3Client({
  region: REGION,
  ...(ENDPOINT ? { endpoint: ENDPOINT, forcePathStyle: FORCE_PATH_STYLE } : {}),
  ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});
