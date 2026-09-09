import { buildPassportChangeEmail } from '../src/templates/passportChangeEmail';
import { buildCreatedEvent, buildDeletedEvent, buildUpdatedEvent } from './helpers/fixtures';

describe('buildPassportChangeEmail', () => {
  it('builds a created-event email with the identifier in the subject and body', () => {
    const event = buildCreatedEvent();
    const { subject, html, text } = buildPassportChangeEmail(event);

    expect(subject).toContain('Created');
    expect(subject).toContain('BP-2024-011');
    expect(html).toContain('BP-2024-011');
    expect(html).toContain('Tesla Inc');
    expect(html).toContain(event.passportId);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('BP-2024-011');
  });

  it('builds an updated-event email whose subject mentions the changed field count', () => {
    const event = buildUpdatedEvent();
    const { subject, html, text } = buildPassportChangeEmail(event);

    expect(subject).toContain('Updated');
    expect(subject).toContain('2 fields changed');
    expect(html).toContain('generalInformation.batteryStatus');
    expect(html).toContain('Original');
    expect(html).toContain('Refurbished');
    expect(text).toContain('generalInformation.batteryStatus: Original -> Refurbished');
  });

  it('falls back gracefully when an updated event has no changeDescription', () => {
    const event = buildUpdatedEvent({ changeDescription: null });
    expect(() => buildPassportChangeEmail(event)).not.toThrow();

    const { html, text } = buildPassportChangeEmail(event);
    expect(html).toContain('detailed change data was not available');
    expect(text).toContain('detailed change data was not available');
  });

  it('builds a deleted-event email reflecting the deletion', () => {
    const event = buildDeletedEvent();
    const { subject, html } = buildPassportChangeEmail(event);

    expect(subject).toContain('Deleted');
    expect(html).toContain('removed from the system');
  });

  it('does not throw when generalInformation has unexpected extra fields', () => {
    const event = buildCreatedEvent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event.passport!.data!.generalInformation as any).notes = 'left front cell replaced';

    expect(() => buildPassportChangeEmail(event)).not.toThrow();
  });

  it('renders a nested-object before/after value as valid stringified content, not [object Object]', () => {
    const event = buildUpdatedEvent({
      changeDescription: {
        changedFields: ['generalInformation.manufacturerInformation'],
        changes: {
          'generalInformation.manufacturerInformation': {
            before: { manufacturerName: 'Tesla Inc' },
            after: { manufacturerName: 'Acme Batteries' },
          },
        },
      },
    });

    const { html } = buildPassportChangeEmail(event);
    expect(html).not.toContain('[object Object]');
    expect(html).toContain(JSON.stringify({ manufacturerName: 'Tesla Inc' }));
    expect(html).toContain(JSON.stringify({ manufacturerName: 'Acme Batteries' }));
  });

  it('falls back to the passportId in the subject when batteryIdentifier is missing', () => {
    const event = buildCreatedEvent({ passport: null });
    const { subject } = buildPassportChangeEmail(event);
    expect(subject).toContain(event.passportId);
  });
});
