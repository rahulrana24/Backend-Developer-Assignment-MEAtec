import fs from 'fs';
import { Consumer, Kafka, logLevel } from 'kafkajs';
import { logger } from './logger';
import { processRawMessage } from '../services/notificationHandler';

const KAFKA_BROKER = process.env.KAFKA_BROKER;
const CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'notification-service';
const CA_PATH = process.env.KAFKA_SSL_CA_PATH ?? './certs/ca.pem';
const CERT_PATH = process.env.KAFKA_SSL_CERT_PATH ?? './certs/service.cert';
const KEY_PATH = process.env.KAFKA_SSL_KEY_PATH ?? './certs/service.key';
const FROM_BEGINNING = process.env.KAFKA_CONSUMER_FROM_BEGINNING === 'true';

export const KAFKA_TOPIC_PASSPORT_CHANGE = 'passport.change.stream';
export const CONSUMER_GROUP_ID = 'notification-service-group';

let consumer: Consumer | null = null;

/**
 * Connects the Kafka consumer to Aiven over mTLS and starts consuming
 * passport.change.stream. If KAFKA_BROKER is unset, or the connection attempt
 * fails, this logs and returns without throwing — the service must keep serving
 * /health even when Kafka is unreachable or not configured for local dev.
 */
export async function connectKafkaConsumer(): Promise<void> {
  if (!KAFKA_BROKER) {
    logger.info('KAFKA_BROKER is not set — Kafka consumption is disabled');
    return;
  }

  try {
    const kafka = new Kafka({
      clientId: CLIENT_ID,
      brokers: [KAFKA_BROKER],
      ssl: {
        ca: [fs.readFileSync(CA_PATH, 'utf-8')],
        cert: fs.readFileSync(CERT_PATH, 'utf-8'),
        key: fs.readFileSync(KEY_PATH, 'utf-8'),
      },
      logLevel: logLevel.ERROR,
    });

    const kafkaConsumer = kafka.consumer({ groupId: CONSUMER_GROUP_ID });
    await kafkaConsumer.connect();
    await kafkaConsumer.subscribe({ topic: KAFKA_TOPIC_PASSPORT_CHANGE, fromBeginning: FROM_BEGINNING });

    await kafkaConsumer.run({
      eachMessage: async ({ message }) => {
        try {
          await processRawMessage(message.value?.toString('utf-8'));
        } catch (err) {
          // processRawMessage already catches its own errors — this is a last-resort
          // guard so a truly unexpected failure still can't crash the consumer loop.
          logger.error('Unexpected error while processing Kafka message', {
            error: (err as Error).message,
          });
        }
      },
    });

    consumer = kafkaConsumer;
    logger.info('Connected to Kafka (Aiven) as consumer', {
      broker: KAFKA_BROKER,
      topic: KAFKA_TOPIC_PASSPORT_CHANGE,
      groupId: CONSUMER_GROUP_ID,
      fromBeginning: FROM_BEGINNING,
    });
  } catch (err) {
    logger.error('Failed to connect Kafka consumer — passport change events will not be received', {
      error: (err as Error).message,
    });
  }
}

export async function disconnectKafkaConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
}
