import { mockClient } from 'aws-sdk-client-mock';
import { s3Client } from '../../src/config/s3';

export const s3Mock = mockClient(s3Client);
