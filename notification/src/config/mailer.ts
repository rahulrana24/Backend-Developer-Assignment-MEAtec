import nodemailer, { Transporter } from 'nodemailer';
import { logger } from './logger';
import { buildPassportChangeEmail } from '../templates/passportChangeEmail';
import { PassportChangeEvent } from '../types/passportEvent';

function getEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

let transporter: Transporter | null = null;

/**
 * Lazily builds the SMTP transporter on first use rather than at module load —
 * keeps tests import-safe without needing real SMTP env vars, and makes
 * jest.mock('nodemailer') straightforward to assert against.
 */
function getTransporter(): Transporter {
  if (!transporter) {
    const host = getEnv('SMTP_HOST', 'smtp.gmail.com');
    const port = Number(getEnv('SMTP_PORT', '465'));
    const secure = getEnv('SMTP_SECURE', 'true') === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }
  return transporter;
}

export async function sendPassportChangeEmail(event: PassportChangeEvent): Promise<void> {
  const fromName = getEnv('SMTP_FROM_NAME', 'Battery Passport Notifications');
  const fromAddress = getEnv('SMTP_FROM_ADDRESS', process.env.SMTP_USER ?? 'no-reply@example.com');
  const recipient = getEnv('NOTIFICATION_RECIPIENT_EMAIL', 'rahul.rana2000.rr@gmail.com');
  const { subject, html, text } = buildPassportChangeEmail(event);

  try {
    await getTransporter().sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: recipient,
      subject,
      html,
      text,
    });
    logger.info('Notification email sent', {
      eventType: event.eventType,
      passportId: event.passportId,
      to: recipient,
    });
  } catch (err) {
    logger.error('Failed to send notification email — continuing without retry', {
      error: (err as Error).message,
      eventType: event.eventType,
      passportId: event.passportId,
    });
  }
}
