import { describe, expect, it } from 'vitest';
import { DateRangeError, dhakaDayStartUtc, parseDhakaRange } from '../lib/dateRange';

describe('dhakaDayStartUtc', () => {
  it('converts a Dhaka calendar date to UTC midnight minus six hours', () => {
    expect(dhakaDayStartUtc('2026-11-23')?.toISOString()).toBe(
      '2026-11-22T18:00:00.000Z'
    );
  });

  it('rejects invalid calendar dates and formats', () => {
    expect(dhakaDayStartUtc('2026-02-30')).toBeNull();
    expect(dhakaDayStartUtc('2026-13-01')).toBeNull();
    expect(dhakaDayStartUtc('23-11-2026')).toBeNull();
  });
});

describe('parseDhakaRange', () => {
  it('returns null for All Time', () => {
    expect(parseDhakaRange()).toBeNull();
    expect(parseDhakaRange('', '')).toBeNull();
  });

  it('includes the full end date by using an exclusive next-day boundary', () => {
    const range = parseDhakaRange('2026-11-01', '2026-11-23');
    expect(range?.fromDate.toISOString()).toBe('2026-10-31T18:00:00.000Z');
    expect(range?.toExclusive.toISOString()).toBe('2026-11-23T18:00:00.000Z');
  });

  it('requires both dates when a custom range is used', () => {
    expect(() => parseDhakaRange('2026-11-01')).toThrow(DateRangeError);
    expect(() => parseDhakaRange(undefined, '2026-11-01')).toThrow(DateRangeError);
  });

  it('rejects an inverted range', () => {
    expect(() => parseDhakaRange('2026-11-23', '2026-11-01')).toThrow(
      'The start date must be on or before the end date.'
    );
  });

  it('allows the same start and end date', () => {
    const range = parseDhakaRange('2026-11-23', '2026-11-23');
    expect(range?.toExclusive.getTime() - range!.fromDate.getTime()).toBe(86400000);
  });
});
