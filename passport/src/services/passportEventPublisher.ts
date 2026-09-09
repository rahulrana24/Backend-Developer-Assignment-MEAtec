import { KAFKA_TOPIC_PASSPORT_CHANGE, getKafkaProducer } from '../config/kafka';
import { logger } from '../config/logger';
import { diffObjects, FieldChange } from '../utils/diff';

export type PassportChangeType = 'created' | 'updated' | 'deleted';

export interface ChangeDescription {
  changedFields: string[];
  changes: Record<string, FieldChange>;
}

export interface PassportChangeEvent {
  eventType: PassportChangeType;
  passportId: string;
  actor: { userId: string };
  timestamp: string;
  passport: unknown;
  changeDescription: ChangeDescription | null;
}

/**
 * Publishes a passport lifecycle event to Kafka. Never throws — a Kafka/Aiven
 * outage must not fail the passport CRUD request that triggered this (the database
 * write already succeeded by the time this is called). Failures are logged instead.
 *
 * node-rdkafka's produce() is synchronous — it only queues the message locally and
 * can throw immediately (e.g. ERR__QUEUE_FULL), which the try/catch below covers.
 * Actual broker-level delivery failures arrive later via the 'delivery-report' event
 * (see src/config/kafka.ts), not through this function.
 */
export async function publishPassportChangeEvent(event: PassportChangeEvent): Promise<void> {
  const producer = getKafkaProducer();
  if (!producer) {
    return;
  }

  try {
    producer.produce(
      KAFKA_TOPIC_PASSPORT_CHANGE,
      null,
      Buffer.from(JSON.stringify(event)),
      event.passportId,
      Date.now(),
    );
  } catch (err) {
    logger.error('Failed to publish passport change event', {
      eventType: event.eventType,
      passportId: event.passportId,
      error: (err as Error).message,
    });
  }
}

export function buildChangeDescription(before: unknown, after: unknown): ChangeDescription {
  const changes = diffObjects(before, after);
  return { changedFields: Object.keys(changes), changes };
}
