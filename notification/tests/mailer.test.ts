const sendMailMock = jest.fn();
const createTransportMock = jest.fn().mockReturnValue({ sendMail: sendMailMock });

jest.mock('nodemailer', () => ({
  createTransport: (options: unknown) => createTransportMock(options),
}));

import { sendPassportChangeEmail } from '../src/config/mailer';
import { buildCreatedEvent } from './helpers/fixtures';

describe('sendPassportChangeEmail', () => {
  beforeEach(() => {
    sendMailMock.mockReset();
    createTransportMock.mockClear();
  });

  it('calls sendMail with the configured recipient, and a subject/html/text derived from the event', async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: 'abc123' });
    const event = buildCreatedEvent();

    await sendPassportChangeEmail(event);

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0];
    expect(call.to).toBe('rahul.rana2000.rr@gmail.com');
    expect(call.subject).toContain('BP-2024-011');
    expect(typeof call.html).toBe('string');
    expect(call.html.length).toBeGreaterThan(0);
    expect(typeof call.text).toBe('string');
    expect(call.text.length).toBeGreaterThan(0);
  });

  it('resolves without throwing when sendMail rejects', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('SMTP connection refused'));
    const event = buildCreatedEvent();

    await expect(sendPassportChangeEmail(event)).resolves.toBeUndefined();
  });

  it('respects a NOTIFICATION_RECIPIENT_EMAIL override', async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: 'abc123' });
    const original = process.env.NOTIFICATION_RECIPIENT_EMAIL;
    process.env.NOTIFICATION_RECIPIENT_EMAIL = 'someone-else@example.com';

    try {
      await sendPassportChangeEmail(buildCreatedEvent());
      const call = sendMailMock.mock.calls[0][0];
      expect(call.to).toBe('someone-else@example.com');
    } finally {
      process.env.NOTIFICATION_RECIPIENT_EMAIL = original;
    }
  });
});
