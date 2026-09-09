import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../config/logger';
import { S3_BUCKET, s3Client } from '../config/s3';
import { AppError } from './AppError';

export const PRESIGNED_URL_EXPIRY_SECONDS = Number(process.env.PRESIGNED_URL_EXPIRY_SECONDS ?? 900);

/**
 * Every S3 call below is wrapped into the same 503 "storage service unreachable"
 * contract the passport service uses for its Auth Service dependency — the caller's
 * request fails cleanly instead of leaking an AWS SDK error shape.
 */
export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<void> {
  try {
    await s3Client.send(
      new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: contentType }),
    );
  } catch (err) {
    logger.error('S3 upload failed', { key, error: (err as Error).message });
    throw new AppError('Unable to reach storage service', 503);
  }
}

export async function deleteFromS3(key: string): Promise<void> {
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  } catch (err) {
    logger.error('S3 delete failed', { key, error: (err as Error).message });
    throw new AppError('Unable to reach storage service', 503);
  }
}

export async function getPresignedDownloadUrl(key: string): Promise<string> {
  try {
    return await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), {
      expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
    });
  } catch (err) {
    logger.error('Failed to generate presigned download URL', { key, error: (err as Error).message });
    throw new AppError('Unable to reach storage service', 503);
  }
}
