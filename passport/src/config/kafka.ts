import fs from 'fs';
import { Kafka, logLevel, Producer } from 'kafkajs';
import { logger } from './logger';

const KAFKA_BROKER = process.env.KAFKA_BROKER;
const CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'passport-service';
const CA_PATH = process.env.KAFKA_SSL_CA_PATH ?? './certs/ca.pem';
const CERT_PATH = process.env.KAFKA_SSL_CERT_PATH ?? './certs/service.cert';
const KEY_PATH = process.env.KAFKA_SSL_KEY_PATH ?? './certs/service.key';

export const KAFKA_TOPIC_PASSPORT_CHANGE = 'passport.change.stream';

let producer: Producer | null = null;

/**
 * Connects the Kafka producer to Aiven over mTLS. If KAFKA_BROKER is unset, or the
 * connection attempt fails, this logs and returns without throwing — passport CRUD
 * must keep working even when Kafka is unreachable or not configured for local dev.
 */
export async function connectKafkaProducer(): Promise<void> {
  if (!KAFKA_BROKER) {
    logger.info('KAFKA_BROKER is not set — Kafka publishing is disabled');
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

    const kafkaProducer = kafka.producer();
    await kafkaProducer.connect();
    producer = kafkaProducer;
    logger.info('Connected to Kafka (Aiven)', { broker: KAFKA_BROKER });
  } catch (err) {
    logger.error('Failed to connect Kafka producer — passport events will not be published', {
      error: (err as Error).message,
    });
  }
}

export async function disconnectKafkaProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}

export function getKafkaProducer(): Producer | null {
  return producer;
}
