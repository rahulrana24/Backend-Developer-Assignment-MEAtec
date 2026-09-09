import { DeliveryReport, LibrdKafkaError, Producer } from 'node-rdkafka';
import { logger } from './logger';

const KAFKA_BROKERS = process.env.KAFKA_BROKER;
const CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'passport-service';
const SASL_USERNAME = process.env.KAFKA_SASL_USERNAME;
const SASL_PASSWORD = process.env.KAFKA_SASL_PASSWORD;
const CA_PATH = process.env.KAFKA_SSL_CA_PATH ?? './certs/ca.pem';
const CONNECT_TIMEOUT_MS = Number(process.env.KAFKA_CONNECT_TIMEOUT_MS ?? 10000);
// node-rdkafka's plain Producer only surfaces 'delivery-report'/'event.error' when
// something drains its internal event queue — without polling on an interval, we'd
// never learn about a delivery failure, and the queue can eventually fill up (see
// node-rdkafka's README, "Producer" section). This is unrelated to CONNECT_TIMEOUT_MS.
const POLL_INTERVAL_MS = 1000;

export const KAFKA_TOPIC_PASSPORT_CHANGE = 'passport.change.stream';

let producer: Producer | null = null;

/**
 * Connects the Kafka producer to Aiven over SASL_SSL (SCRAM-SHA-256), authenticating
 * with a username/password instead of a client certificate — the CA is still needed
 * to verify the broker's TLS certificate, but there's no client cert/key anymore.
 * If KAFKA_BROKER or the SASL credentials are unset, or the connection attempt fails
 * or doesn't become ready within CONNECT_TIMEOUT_MS, this logs and returns without
 * throwing — passport CRUD must keep working even when Kafka/Aiven is unreachable or
 * not configured for local dev.
 */
export async function connectKafkaProducer(): Promise<void> {
  if (!KAFKA_BROKERS) {
    logger.info('KAFKA_BROKER is not set — Kafka publishing is disabled');
    return;
  }
  if (!SASL_USERNAME || !SASL_PASSWORD) {
    logger.info('KAFKA_SASL_USERNAME/KAFKA_SASL_PASSWORD are not set — Kafka publishing is disabled');
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const settle = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };

    // `new Producer(...)` and `.connect()` both throw synchronously on a bad
    // config value (e.g. a librdkafka build without SSL support) rather than via
    // an event, so this whole block is wrapped in try/catch, not just .connect().
    try {
      const kafkaProducer = new Producer({
        'client.id': CLIENT_ID,
        'bootstrap.servers': KAFKA_BROKERS,
        'security.protocol': 'sasl_ssl',
        'sasl.mechanism': 'SCRAM-SHA-256',
        'sasl.username': SASL_USERNAME,
        'sasl.password': SASL_PASSWORD,
        'ssl.ca.location': CA_PATH,
        dr_cb: true,
      });

      const connectTimeout = setTimeout(() => {
        logger.error('Kafka producer did not become ready in time — passport events will not be published', {
          timeoutMs: CONNECT_TIMEOUT_MS,
        });
        settle();
      }, CONNECT_TIMEOUT_MS);

      kafkaProducer.on('ready', () => {
        clearTimeout(connectTimeout);
        producer = kafkaProducer;
        logger.info('Connected to Kafka (Aiven, SASL_SSL)', { brokers: KAFKA_BROKERS });
        settle();
      });

      // Non-fatal producer errors (auth issues, broker hiccups) surface here — logged,
      // never thrown, since nothing awaits this event handler.
      kafkaProducer.on('event.error', (err: LibrdKafkaError) => {
        logger.error('Kafka producer error', { error: err.message });
      });

      // produce() only queues a message synchronously — a broker-level publish
      // failure is only known once its delivery report comes back, here.
      kafkaProducer.on('delivery-report', (err: LibrdKafkaError | null, report: DeliveryReport) => {
        if (err) {
          logger.error('Failed to deliver passport change event to Kafka', {
            error: err.message,
            topic: report.topic,
          });
        }
      });

      kafkaProducer.connect();
      kafkaProducer.setPollInterval(POLL_INTERVAL_MS);
    } catch (err) {
      logger.error('Failed to connect Kafka producer — passport events will not be published', {
        error: (err as Error).message,
      });
      settle();
    }
  });
}

export async function disconnectKafkaProducer(): Promise<void> {
  if (!producer) {
    return;
  }
  const producerToClose = producer;
  producer = null;
  await new Promise<void>((resolve) => {
    producerToClose.disconnect(() => resolve());
  });
}

export function getKafkaProducer(): Producer | null {
  return producer;
}
