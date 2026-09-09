import { ConsumerStream, LibrdKafkaError, Message, createReadStream } from 'node-rdkafka';
import { logger } from './logger';
import { processRawMessage } from '../services/notificationHandler';

const KAFKA_BROKERS = process.env.KAFKA_BROKER;
const CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'notification-service';
const SASL_USERNAME = process.env.KAFKA_SASL_USERNAME;
const SASL_PASSWORD = process.env.KAFKA_SASL_PASSWORD;
const CA_PATH = process.env.KAFKA_SSL_CA_PATH ?? './certs/ca.pem';
const FROM_BEGINNING = process.env.KAFKA_CONSUMER_FROM_BEGINNING === 'true';
const CONNECT_TIMEOUT_MS = Number(process.env.KAFKA_CONNECT_TIMEOUT_MS ?? 10000);

export const KAFKA_TOPIC_PASSPORT_CHANGE = 'passport.change.stream';
export const CONSUMER_GROUP_ID = 'notification-service-group';

let stream: ConsumerStream | null = null;

/**
 * Connects the Kafka consumer to Aiven over SASL_SSL (SCRAM-SHA-256) and starts
 * consuming passport.change.stream via node-rdkafka's stream API. Authenticates
 * with a username/password instead of a client certificate — the CA is still
 * needed to verify the broker's TLS certificate. If KAFKA_BROKER or the SASL
 * credentials are unset, or the connection attempt fails or doesn't become ready
 * within CONNECT_TIMEOUT_MS, this logs and returns without throwing — the service
 * must keep serving /health even when Kafka is unreachable or not configured for
 * local dev.
 */
export async function connectKafkaConsumer(): Promise<void> {
  if (!KAFKA_BROKERS) {
    logger.info('KAFKA_BROKER is not set — Kafka consumption is disabled');
    return;
  }
  if (!SASL_USERNAME || !SASL_PASSWORD) {
    logger.info('KAFKA_SASL_USERNAME/KAFKA_SASL_PASSWORD are not set — Kafka consumption is disabled');
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const settle = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };

    // createReadStream() constructs and connects the underlying consumer
    // synchronously — a bad config value (e.g. a librdkafka build without SSL
    // support) throws immediately, not via an event, so this whole block is
    // wrapped in try/catch rather than just the event wiring below it.
    try {
      const consumerStream = createReadStream(
        {
          'client.id': CLIENT_ID,
          'bootstrap.servers': KAFKA_BROKERS,
          'group.id': CONSUMER_GROUP_ID,
          'security.protocol': 'sasl_ssl',
          'sasl.mechanism': 'SCRAM-SHA-256',
          'sasl.username': SASL_USERNAME,
          'sasl.password': SASL_PASSWORD,
          'ssl.ca.location': CA_PATH,
        },
        {
          'auto.offset.reset': FROM_BEGINNING ? 'earliest' : 'latest',
        },
        { topics: [KAFKA_TOPIC_PASSPORT_CHANGE] },
      );

      const connectTimeout = setTimeout(() => {
        logger.error(
          'Kafka consumer did not become ready in time — passport change events will not be received',
          { timeoutMs: CONNECT_TIMEOUT_MS },
        );
        settle();
      }, CONNECT_TIMEOUT_MS);

      consumerStream.consumer.on('ready', () => {
        clearTimeout(connectTimeout);
        stream = consumerStream;
        logger.info('Connected to Kafka (Aiven, SASL_SSL) as consumer', {
          brokers: KAFKA_BROKERS,
          topic: KAFKA_TOPIC_PASSPORT_CHANGE,
          groupId: CONSUMER_GROUP_ID,
          fromBeginning: FROM_BEGINNING,
        });
        settle();
      });

      // Non-fatal consumer errors (auth issues, broker hiccups) surface here — logged,
      // never thrown, since nothing awaits this event handler.
      consumerStream.consumer.on('event.error', (err: LibrdKafkaError) => {
        logger.error('Kafka consumer error', { error: err.message });
      });

      consumerStream.on('error', (err: Error) => {
        logger.error('Kafka consumer stream error', { error: err.message });
        clearTimeout(connectTimeout);
        settle();
      });

      consumerStream.on('data', (message: Message) => {
        processRawMessage(message.value?.toString('utf-8')).catch((err: Error) => {
          // processRawMessage already catches its own errors — this is a last-resort
          // guard so a truly unexpected failure still can't crash the stream.
          logger.error('Unexpected error while processing Kafka message', { error: err.message });
        });
      });
    } catch (err) {
      logger.error('Failed to connect Kafka consumer — passport change events will not be received', {
        error: (err as Error).message,
      });
      settle();
    }
  });
}

export async function disconnectKafkaConsumer(): Promise<void> {
  if (!stream) {
    return;
  }
  const streamToClose = stream;
  stream = null;
  await new Promise<void>((resolve) => {
    streamToClose.close(() => resolve());
  });
}
