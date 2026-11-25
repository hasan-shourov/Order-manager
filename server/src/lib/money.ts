export const DEFAULT_PRINT_HEADING = 'Sales Memo';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const PERCENT_PATTERN = /^\d+(\.\d{1,2})?$/;

export function parseMoneyToPoisha(input: string): number | null {
  const value = input.trim();
  if (!MONEY_PATTERN.test(value)) return null;
  const [wholePart, fractionPart = ''] = value.split('.');
  const whole = Number(wholePart);
  const fraction = Number((fractionPart + '00').slice(0, 2));
  if (!Number.isSafeInteger(whole)) return null;
  const poisha = whole * 100 + fraction;
  return Number.isSafeInteger(poisha) ? poisha : null;
}

export function parsePercentToHundredths(input: string): number | null {
  const value = input.trim();
  if (!PERCENT_PATTERN.test(value)) return null;
  const [wholePart, fractionPart = ''] = value.split('.');
  const whole = Number(wholePart);
  const fraction = Number((fractionPart + '00').slice(0, 2));
  if (!Number.isSafeInteger(whole)) return null;
  const hundredths = whole * 100 + fraction;
  if (hundredths < 0 || hundredths > 10000) return null;
  return hundredths;
}

export function isValidPercentValue(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const hundredths = Math.round(value * 100);
  return (
    hundredths >= 0 &&
    hundredths <= 10000 &&
    Math.abs(value * 100 - hundredths) < 1e-6
  );
}

export function isValidQuantity(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function isValidRate(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function percentageDiscountAmount(subtotal: number, percent: number): number {
  const hundredths = Math.round(percent * 100);
  return Math.round((subtotal * hundredths) / 10000);
}

export interface DiscountInput {
  type: 'none' | 'fixed' | 'percentage';
  value: number;
}

export interface DiscountResult {
  discountAmount: number;
}

export function calculateDiscount(subtotal: number, discount: DiscountInput): DiscountResult {
  if (discount.type === 'none') {
    return { discountAmount: 0 };
  }
  if (discount.type === 'fixed') {
    if (!Number.isSafeInteger(discount.value) || discount.value < 0) {
      throw new Error('Fixed discount must be a non-negative amount.');
    }
    if (discount.value > subtotal) {
      throw new Error('Fixed discount cannot exceed the subtotal.');
    }
    return { discountAmount: discount.value };
  }
  if (!isValidPercentValue(discount.value)) {
    throw new Error('Percentage must be between 0 and 100.');
  }
  return { discountAmount: percentageDiscountAmount(subtotal, discount.value) };
}

export function formatTaka(poisha: number): string {
  const sign = poisha < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(poisha));
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const fraction = String(abs % 100).padStart(2, '0');
  return `${sign}৳${whole}.${fraction}`;
}
