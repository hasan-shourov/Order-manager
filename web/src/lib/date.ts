const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Dhaka',
});

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'Asia/Dhaka',
});

export function formatDhakaDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_TIME_FORMATTER.format(date);
}

export function formatDhakaDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_FORMATTER.format(date);
}

export function formatDateOnly(dateString: string): string {
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const date = new Date(`${dateString}T00:00:00+06:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return DATE_FORMATTER.format(date);
}

export function todayInDhaka(): string {
  return new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function firstDayOfMonthInDhaka(): string {
  return `${todayInDhaka().slice(0, 7)}-01`;
}
