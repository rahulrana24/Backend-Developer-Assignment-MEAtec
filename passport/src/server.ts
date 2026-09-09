import dotenv from 'dotenv';

dotenv.config();

import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { connectKafkaProducer, disconnectKafkaProducer } from './config/kafka';
import { logger } from './config/logger';

const PORT = process.env.PORT ?? 4001;
const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/passport-service';

async function main(): Promise<void> {
  await connectDB(MONGO_URI);
  logger.info('Connected to MongoDB');

  // Best-effort: connectKafkaProducer logs and returns without throwing if
  // KAFKA_BROKER is unset or unreachable — passport CRUD must not depend on it.
  await connectKafkaProducer();

  const app = createApp();
  const server = app.listen(PORT, () => {
    logger.info(`Passport service listening on port ${PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received, shutting down`);
    server.close();
    await disconnectKafkaProducer();
    await disconnectDB();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Failed to start passport service', { message: err.message, stack: err.stack });
  process.exit(1);
});
