import { decimalSeparator } from './locale';
import { formatNumberInput } from './number-input';

// Keep the exact stored decimal digits, including currency trailing zeroes.
export function formatResultNumber(value: string, locale: string): string {
  const sign = value.startsWith('-') ? '-' : '';
  const magnitude = sign ? value.slice(1) : value;
  return sign + formatNumberInput(magnitude.replace('.', decimalSeparator(locale)), locale);
}
