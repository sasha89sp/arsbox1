import { CalendarEvent } from '../types';

function formatIcsDateTime(date: string, time: string): string {
  const d = date.replace(/-/g, '');
  const t = (time || '09:00').replace(/:/g, '') + '00';
  return `${d}T${t}`;
}

export function exportEventsToIcs(events: CalendarEvent[], calName = 'Свод Календарь'): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Svod Workspace//Calendar//RU',
    `X-WR-CALNAME:${calName}`,
  ];

  for (const ev of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id}@svod.local`);
    lines.push(`SUMMARY:${ev.title.replace(/\n/g, ' ')}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${ev.date.replace(/-/g, '')}`);
      lines.push(`DTEND;VALUE=DATE:${ev.date.replace(/-/g, '')}`);
    } else {
      lines.push(`DTSTART:${formatIcsDateTime(ev.date, ev.startTime)}`);
      lines.push(`DTEND:${formatIcsDateTime(ev.date, ev.endTime)}`);
    }
    if (ev.location) lines.push(`LOCATION:${ev.location}`);
    if (ev.description) lines.push(`DESCRIPTION:${ev.description.replace(/\n/g, '\\n')}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function parseIcsEvents(icsText: string, defaultCalendarId: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const blocks = icsText.split(/BEGIN:VEVENT/i).slice(1);
  for (const block of blocks) {
    const endIdx = block.search(/END:VEVENT/i);
    const body = endIdx >= 0 ? block.slice(0, endIdx) : block;
    const getField = (name: string): string => {
      const m = body.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, 'im'));
      return m ? m[1].trim() : '';
    };
    const summary = getField('SUMMARY') || 'Событие из .ics';
    const dtStart = getField('DTSTART');
    const dtEnd = getField('DTEND');
    const location = getField('LOCATION');
    const description = getField('DESCRIPTION').replace(/\\n/g, '\n');

    const dateMatch = dtStart.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!dateMatch) continue;
    const date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    const startTimeMatch = dtStart.match(/T(\d{2})(\d{2})/);
    const endTimeMatch = dtEnd.match(/T(\d{2})(\d{2})/);
    const allDay = !startTimeMatch;

    events.push({
      id: `ev-ics-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      calendarId: defaultCalendarId,
      title: summary,
      date,
      startTime: startTimeMatch ? `${startTimeMatch[1]}:${startTimeMatch[2]}` : '09:00',
      endTime: endTimeMatch ? `${endTimeMatch[1]}:${endTimeMatch[2]}` : '10:00',
      allDay,
      location: location || undefined,
      description: description || undefined,
      reminderMinutes: 15,
    });
  }
  return events;
}
