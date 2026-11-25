const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const PERCENT_PATTERN = /^\d+(\.\d{1,2})?$/;
const QUANTITY_PATTERN = /^\d+$/;

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

export function parsePositiveQuantity(input: string): number | null {
  const value = input.trim();
  if (!QUANTITY_PATTERN.test(value)) return null;
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return null;
  return quantity;
}

export function percentageDiscountAmount(subtotal: number, percent: number): number {
  const hundredths = Math.round(percent * 100);
  return Math.round((subtotal * hundredths) / 10000);
}

export function percentageDiscountFromHundredths(
  subtotal: number,
  hundredths: number
): number {
  return Math.round((subtotal * hundredths) / 10000);
}

export function formatTaka(poisha: number): string {
  const sign = poisha < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(poisha));
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const fraction = String(abs % 100).padStart(2, '0');
  return `${sign}৳${whole}.${fraction}`;
}

export function formatRateInput(poisha: number): string {
  const abs = Math.abs(Math.trunc(poisha));
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${poisha < 0 ? '-' : ''}${whole}.${fraction}`;
}

export function formatPercentValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return (Math.round(value * 100) / 100).toString();
}
