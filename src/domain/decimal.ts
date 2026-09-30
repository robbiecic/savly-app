import Decimal from 'decimal.js';

// Isolated configuration: other libraries cannot change calculator precision.
export const D = Decimal.clone({ precision: 80, rounding: Decimal.ROUND_HALF_UP });
export type DecimalValue = Decimal;

export class InputError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
  }
}

// Domain inputs are normalized decimal strings, never binary floating-point money.
// Bound input size to keep calculations responsive and within working precision.
export function decimal(value: string, field: string): Decimal {
  if (typeof value !== 'string' || !/^\d{1,18}(?:\.\d{1,18})?$/.test(value)) {
    throw new InputError(field, 'Enter a non-negative decimal with at most 18 digits before and after the decimal point.');
  }
  return new D(value);
}

export function positive(value: string, field: string): Decimal {
  const result = decimal(value, field);
  if (result.lte(0)) throw new InputError(field, 'Enter a value greater than zero.');
  return result;
}

export function fraction(value: string, field: string): Decimal {
  const result = decimal(value, field);
  if (result.gt(1)) throw new InputError(field, 'Enter a fraction from 0 through 1.');
  return result;
}

export function money(value: Decimal, minorUnits: number): string {
  const rounded = value.toDecimalPlaces(minorUnits);
  return rounded.isZero() ? new D(0).toFixed(minorUnits) : rounded.toFixed(minorUnits);
}
