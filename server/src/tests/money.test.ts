import { describe, expect, it } from 'vitest';
import {
  calculateDiscount,
  formatTaka,
  parseMoneyToPoisha,
  parsePercentToHundredths,
  percentageDiscountAmount,
} from '../lib/money';

describe('parseMoneyToPoisha', () => {
  it('parses whole and decimal amounts exactly', () => {
    expect(parseMoneyToPoisha('11.50')).toBe(1150);
    expect(parseMoneyToPoisha('8')).toBe(800);
    expect(parseMoneyToPoisha('0.05')).toBe(5);
    expect(parseMoneyToPoisha('1234.5')).toBe(123450);
    expect(parseMoneyToPoisha(' 7.25 ')).toBe(725);
  });

  it('rejects negative, malformed, and over-precise input', () => {
    expect(parseMoneyToPoisha('-1')).toBeNull();
    expect(parseMoneyToPoisha('1.234')).toBeNull();
    expect(parseMoneyToPoisha('abc')).toBeNull();
    expect(parseMoneyToPoisha('')).toBeNull();
    expect(parseMoneyToPoisha('1.')).toBeNull();
    expect(parseMoneyToPoisha('.5')).toBeNull();
  });
});

describe('parsePercentToHundredths', () => {
  it('parses percentages with up to two decimals', () => {
    expect(parsePercentToHundredths('10')).toBe(1000);
    expect(parsePercentToHundredths('12.5')).toBe(1250);
    expect(parsePercentToHundredths('0')).toBe(0);
    expect(parsePercentToHundredths('100')).toBe(10000);
  });

  it('rejects out-of-range and malformed percentages', () => {
    expect(parsePercentToHundredths('100.01')).toBeNull();
    expect(parsePercentToHundredths('10.555')).toBeNull();
    expect(parsePercentToHundredths('-5')).toBeNull();
  });
});

describe('discounts', () => {
  it('matches the required 10% example', () => {
    const subtotal = 3 * 1150 + 2 * 800;
    expect(subtotal).toBe(5050);
    const discount = calculateDiscount(subtotal, { type: 'percentage', value: 10 });
    expect(discount.discountAmount).toBe(505);
    expect(subtotal - discount.discountAmount).toBe(4545);
  });

  it('rounds percentage discounts once to the nearest poisha', () => {
    expect(percentageDiscountAmount(999, 10)).toBe(100);
    expect(percentageDiscountAmount(999, 12.5)).toBe(125);
    expect(percentageDiscountAmount(1, 50)).toBe(1);
    expect(percentageDiscountAmount(0, 10)).toBe(0);
  });

  it('validates fixed discounts', () => {
    expect(calculateDiscount(1000, { type: 'fixed', value: 1000 }).discountAmount).toBe(1000);
    expect(calculateDiscount(1000, { type: 'fixed', value: 0 }).discountAmount).toBe(0);
    expect(() => calculateDiscount(1000, { type: 'fixed', value: 1001 })).toThrow(
      'cannot exceed the subtotal'
    );
    expect(() => calculateDiscount(1000, { type: 'fixed', value: -1 })).toThrow();
    expect(() => calculateDiscount(1000, { type: 'fixed', value: 10.5 })).toThrow();
  });

  it('rejects invalid percentage discounts', () => {
    expect(() => calculateDiscount(1000, { type: 'percentage', value: 100.01 })).toThrow();
    expect(() => calculateDiscount(1000, { type: 'percentage', value: -1 })).toThrow();
    expect(() =>
      calculateDiscount(1000, { type: 'percentage', value: 12.345 })
    ).toThrow();
    expect(calculateDiscount(1000, { type: 'percentage', value: 100 }).discountAmount).toBe(
      1000
    );
  });

  it('supports no discount', () => {
    expect(calculateDiscount(5050, { type: 'none', value: 0 }).discountAmount).toBe(0);
  });
});

describe('formatTaka', () => {
  it('formats poisha with the taka symbol and two decimals', () => {
    expect(formatTaka(4545)).toBe('৳45.45');
    expect(formatTaka(5)).toBe('৳0.05');
    expect(formatTaka(0)).toBe('৳0.00');
    expect(formatTaka(123456)).toBe('৳1,234.56');
    expect(formatTaka(-505)).toBe('-৳5.05');
  });
});
