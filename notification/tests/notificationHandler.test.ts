import * as mailer from '../src/config/mailer';
import { handlePassportChangeEvent, processRawMessage } from '../src/services/notificationHandler';
import { buildCreatedEvent } from './helpers/fixtures';

describe('handlePassportChangeEvent', () => {
  it('sends an email for the given event', async () => {
    const sendSpy = jest.spyOn(mailer, 'sendPassportChangeEmail').mockResolvedValueOnce(undefined);
    const event = buildCreatedEvent();

    await handlePassportChangeEvent(event);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(event);
  });
});

describe('processRawMessage', () => {
  it('parses a valid message and calls the mailer exactly once', async () => {
    const sendSpy = jest.spyOn(mailer, 'sendPassportChangeEmail').mockResolvedValueOnce(undefined);
    const event = buildCreatedEvent();

    await processRawMessage(JSON.stringify(event));

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(event);
  });

  it('resolves without throwing on malformed JSON, and never calls the mailer', async () => {
    const sendSpy = jest.spyOn(mailer, 'sendPassportChangeEmail');

    await expect(processRawMessage('not valid json{{{')).resolves.toBeUndefined();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('resolves without throwing on an empty/undefined message value, and never calls the mailer', async () => {
    const sendSpy = jest.spyOn(mailer, 'sendPassportChangeEmail');

    await expect(processRawMessage(undefined)).resolves.toBeUndefined();
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
