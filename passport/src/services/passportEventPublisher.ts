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
 */
export async function publishPassportChangeEvent(event: PassportChangeEvent): Promise<void> {
  const producer = getKafkaProducer();
  if (!producer) {
    return;
  }

  try {
    await producer.send({
      topic: KAFKA_TOPIC_PASSPORT_CHANGE,
      messages: [{ key: event.passportId, value: JSON.stringify(event) }],
    });
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
