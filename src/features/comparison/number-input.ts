import { decimalSeparator } from './locale';

// Format strings rather than numbers so partial decimals and precision survive editing.
export function formatNumberInput(value: string, locale: string): string {
  const decimal = decimalSeparator(locale);
  const parts = value.split(decimal);
  if (parts.length > 2 || !/^\d*$/.test(parts[0]) || (parts[1] !== undefined && !/^\d*$/.test(parts[1]))) return value;
  const group = decimal === ',' ? '\u202f' : ',';
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return parts.join(decimal);
}

export function unformatNumberInput(value: string, locale: string): string {
  const group = decimalSeparator(locale) === ',' ? '\u202f' : ',';
  return value.split(group).join('');
}
