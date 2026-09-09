import { PassportChangeEvent } from '../types/passportEvent';

export interface PassportChangeEmailContent {
  subject: string;
  html: string;
  text: string;
}

const EVENT_COLORS: Record<string, string> = {
  created: '#16a34a',
  updated: '#d97706',
  deleted: '#dc2626',
};

const EVENT_LABELS: Record<string, string> = {
  created: 'CREATED',
  updated: 'UPDATED',
  deleted: 'DELETED',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toUTCString();
}

function getBatteryIdentifier(event: PassportChangeEvent): string {
  return event.passport?.data?.generalInformation?.batteryIdentifier ?? event.passportId;
}

function buildSubject(event: PassportChangeEvent): string {
  const identifier = getBatteryIdentifier(event);
  switch (event.eventType) {
    case 'created':
      return `New Battery Passport Created — ${identifier}`;
    case 'updated': {
      const fieldCount = event.changeDescription?.changedFields.length ?? 0;
      return `Battery Passport Updated — ${identifier} (${fieldCount} field${fieldCount === 1 ? '' : 's'} changed)`;
    }
    case 'deleted':
      return `Battery Passport Deleted — ${identifier}`;
    default:
      return `Battery Passport Notification — ${identifier}`;
  }
}

function buildSummaryRows(event: PassportChangeEvent): Array<[string, string]> {
  const general = event.passport?.data?.generalInformation;
  return [
    ['Battery Identifier', formatValue(getBatteryIdentifier(event))],
    ['Passport ID', formatValue(event.passportId)],
    ['Manufacturer', formatValue(general?.manufacturerInformation?.manufacturerName)],
    ['Battery Model', formatValue(general?.batteryModel?.modelName)],
    ['Event Time', formatTimestamp(event.timestamp)],
    ['Actor', formatValue(event.actor?.userId)],
  ];
}

function buildGeneralInfoRows(event: PassportChangeEvent): Array<[string, string]> {
  const general = event.passport?.data?.generalInformation;
  return [
    ['Battery Category', formatValue(general?.batteryCategory)],
    ['Battery Status', formatValue(general?.batteryStatus)],
    ['Manufacturing Date', formatValue(general?.manufacturingDate)],
    ['Manufacturing Place', formatValue(general?.manufacturingPlace)],
    ['Warranty Period', formatValue(general?.warrantyPeriod)],
  ];
}

function htmlTable(rows: Array<[string, string]>): string {
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0;">${rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:40%;">${label}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;">${value}</td>
      </tr>`,
    )
    .join('')}</table>`;
}

function htmlChangesTable(event: PassportChangeEvent): string {
  const changes = event.changeDescription;
  if (!changes || changes.changedFields.length === 0) {
    return '<p style="color:#374151;font-size:14px;">This passport was updated; detailed change data was not available.</p>';
  }

  const rows = changes.changedFields
    .map((field) => {
      const change = changes.changes[field];
      return `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${field}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#b91c1c;">${formatValue(change?.before)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#15803d;">${formatValue(change?.after)}</td>
      </tr>`;
    })
    .join('');

  return `<table style="width:100%;border-collapse:collapse;margin:12px 0;">
    <tr>
      <th style="padding:6px 10px;text-align:left;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Field</th>
      <th style="padding:6px 10px;text-align:left;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Before</th>
      <th style="padding:6px 10px;text-align:left;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb;">After</th>
    </tr>
    ${rows}
  </table>`;
}

function buildHtml(event: PassportChangeEvent): string {
  const color = EVENT_COLORS[event.eventType] ?? '#374151';
  const label = EVENT_LABELS[event.eventType] ?? event.eventType.toUpperCase();
  const summaryRows = buildSummaryRows(event);

  let bodySection: string;
  if (event.eventType === 'created') {
    bodySection = `
      <p style="color:#374151;font-size:14px;">A new battery passport was created in the system.</p>
      ${htmlTable(buildGeneralInfoRows(event))}`;
  } else if (event.eventType === 'updated') {
    bodySection = `
      <p style="color:#374151;font-size:14px;">The following fields were changed:</p>
      ${htmlChangesTable(event)}`;
  } else {
    bodySection = `
      <p style="color:#374151;font-size:14px;">This battery passport has been removed from the system. Its last known state is shown below.</p>
      ${htmlTable(buildGeneralInfoRows(event))}`;
  }

  return `
<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="background-color:${color};color:#ffffff;padding:14px 20px;border-radius:8px 8px 0 0;">
    <span style="font-size:12px;font-weight:600;letter-spacing:0.05em;">BATTERY PASSPORT NOTIFICATION</span>
    <div style="font-size:20px;font-weight:700;margin-top:4px;">${label}</div>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:20px;">
    ${htmlTable(summaryRows)}
    ${bodySection}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
    <p style="color:#9ca3af;font-size:11px;">
      This is an automated notification from the Battery Passport Notification Service. Do not reply to this email.<br />
      Passport ID: ${event.passportId}
    </p>
  </div>
</div>`;
}

function buildText(event: PassportChangeEvent): string {
  const lines: string[] = [
    `Event: ${EVENT_LABELS[event.eventType] ?? event.eventType.toUpperCase()}`,
    ...buildSummaryRows(event).map(([label, value]) => `${label}: ${value}`),
    '',
  ];

  if (event.eventType === 'updated') {
    const changes = event.changeDescription;
    if (changes && changes.changedFields.length > 0) {
      lines.push('Changed Fields:');
      for (const field of changes.changedFields) {
        const change = changes.changes[field];
        lines.push(`- ${field}: ${formatValue(change?.before)} -> ${formatValue(change?.after)}`);
      }
    } else {
      lines.push('This passport was updated; detailed change data was not available.');
    }
  } else {
    lines.push(...buildGeneralInfoRows(event).map(([label, value]) => `${label}: ${value}`));
  }

  lines.push('', 'This is an automated notification from the Battery Passport Notification Service.');
  return lines.join('\n');
}

export function buildPassportChangeEmail(event: PassportChangeEvent): PassportChangeEmailContent {
  return {
    subject: buildSubject(event),
    html: buildHtml(event),
    text: buildText(event),
  };
}
