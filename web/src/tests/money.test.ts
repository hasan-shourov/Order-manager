import { describe, expect, it } from 'vitest';
import {
  formatRateInput,
  formatTaka,
  parseMoneyToPoisha,
  parsePercentToHundredths,
  parsePositiveQuantity,
  percentageDiscountAmount,
  percentageDiscountFromHundredths,
} from '../lib/money';

describe('web money helpers', () => {
  it('parses rates exactly into poisha', () => {
    expect(parseMoneyToPoisha('11.50')).toBe(1150);
    expect(parseMoneyToPoisha('8.00')).toBe(800);
    expect(parseMoneyToPoisha('0.05')).toBe(5);
    expect(parseMoneyToPoisha('1.234')).toBeNull();
    expect(parseMoneyToPoisha('-1')).toBeNull();
    expect(parseMoneyToPoisha('')).toBeNull();
  });

  it('accepts only positive whole quantities', () => {
    expect(parsePositiveQuantity('3')).toBe(3);
    expect(parsePositiveQuantity('0')).toBeNull();
    expect(parsePositiveQuantity('1.5')).toBeNull();
    expect(parsePositiveQuantity('abc')).toBeNull();
    expect(parsePositiveQuantity('')).toBeNull();
  });

  it('computes the required discount example', () => {
    const subtotal = 3 * 1150 + 2 * 800;
    expect(subtotal).toBe(5050);
    expect(percentageDiscountAmount(subtotal, 10)).toBe(505);
    expect(subtotal - 505).toBe(4545);
  });

  it('computes percentages from parsed hundredths and rounds once', () => {
    expect(percentageDiscountFromHundredths(5050, 1000)).toBe(505);
    expect(percentageDiscountFromHundredths(999, 1000)).toBe(100);
    expect(parsePercentToHundredths('12.5')).toBe(1250);
    expect(parsePercentToHundredths('100.5')).toBeNull();
  });

  it('formats taka and rate input values', () => {
    expect(formatTaka(4545)).toBe('৳45.45');
    expect(formatTaka(123456)).toBe('৳1,234.56');
    expect(formatRateInput(1150)).toBe('11.50');
    expect(formatRateInput(0)).toBe('0.00');
  });
});
