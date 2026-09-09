import dotenv from 'dotenv';

dotenv.config();

import { createApp } from './app';
import { connectKafkaConsumer, disconnectKafkaConsumer } from './config/kafka';
import { logger } from './config/logger';

const PORT = process.env.PORT ?? 4002;

async function main(): Promise<void> {
  // Best-effort: connectKafkaConsumer logs and returns without throwing if
  // KAFKA_BROKER is unset or unreachable — /health must keep working regardless.
  await connectKafkaConsumer();

  const app = createApp();
  const server = app.listen(PORT, () => {
    logger.info(`Notification service listening on port ${PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received, shutting down`);
    server.close();
    await disconnectKafkaConsumer();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Failed to start notification service', { message: err.message, stack: err.stack });
  process.exit(1);
});
