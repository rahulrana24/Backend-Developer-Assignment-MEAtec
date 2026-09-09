import { sendPassportChangeEmail } from '../config/mailer';
import { logger } from '../config/logger';
import { PassportChangeEvent } from '../types/passportEvent';

export async function handlePassportChangeEvent(event: PassportChangeEvent): Promise<void> {
  await sendPassportChangeEmail(event);
}

/**
 * Parses a raw Kafka message value and hands it to handlePassportChangeEvent.
 * Never throws — a malformed or empty message must not crash the consumer loop
 * or block the partition. Kept free of kafkajs types so it's directly unit-testable.
 */
export async function processRawMessage(raw: string | undefined): Promise<void> {
  if (!raw) {
    logger.warn('Received empty Kafka message value, skipping');
    return;
  }

  let event: PassportChangeEvent;
  try {
    event = JSON.parse(raw) as PassportChangeEvent;
  } catch (err) {
    logger.error('Failed to parse passport change event — skipping message', {
      error: (err as Error).message,
    });
    return;
  }

  try {
    await handlePassportChangeEvent(event);
  } catch (err) {
    logger.error('Failed to handle passport change event — skipping message', {
      error: (err as Error).message,
      eventType: event?.eventType,
      passportId: event?.passportId,
    });
  }
}
