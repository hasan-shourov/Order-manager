const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export function dhakaDayStartUtc(dateString: string): Date | null {
  const match = DATE_PATTERN.exec(dateString);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCalendarDate(year, month, day)) return null;
  const utcMidnight = Date.UTC(year, month - 1, day);
  return new Date(utcMidnight - DHAKA_OFFSET_MS);
}

export interface DhakaRange {
  fromDate: Date;
  toExclusive: Date;
}

export class DateRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DateRangeError';
  }
}

export function parseDhakaRange(from?: string, to?: string): DhakaRange | null {
  const hasFrom = Boolean(from && from.trim());
  const hasTo = Boolean(to && to.trim());
  if (!hasFrom && !hasTo) return null;
  if (!hasFrom || !hasTo) {
    throw new DateRangeError('Choose both a start date and an end date.');
  }
  const fromDate = dhakaDayStartUtc(from!.trim());
  const toStart = dhakaDayStartUtc(to!.trim());
  if (!fromDate || !toStart) {
    throw new DateRangeError('Enter valid dates in YYYY-MM-DD format.');
  }
  if (fromDate.getTime() > toStart.getTime()) {
    throw new DateRangeError('The start date must be on or before the end date.');
  }
  return { fromDate, toExclusive: new Date(toStart.getTime() + DAY_MS) };
}
