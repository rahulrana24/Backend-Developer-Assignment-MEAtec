import multer from 'multer';

const MAX_FILE_SIZE_BYTES = Number(process.env.MAX_FILE_SIZE_MB ?? 10) * 1024 * 1024;

// Memory storage — the buffer is streamed straight to S3, never written to local disk.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});
