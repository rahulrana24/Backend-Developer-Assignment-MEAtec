import dotenv from 'dotenv';

dotenv.config();

import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { logger } from './config/logger';

const PORT = process.env.PORT ?? 4003;
const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/document-service';

async function main(): Promise<void> {
  await connectDB(MONGO_URI);
  logger.info('Connected to MongoDB');

  const app = createApp();
  const server = app.listen(PORT, () => {
    logger.info(`Document service listening on port ${PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received, shutting down`);
    server.close();
    await disconnectDB();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Failed to start document service', { message: err.message, stack: err.stack });
  process.exit(1);
});
