import { decimalSeparator } from './locale';
import { formatNumberInput } from './number-input';

// Extract only the symbol so amounts retain their exact decimal precision and
// the summary always places the symbol before the number, in every locale.
export function formatSummaryMoney(value: string, currency: string, locale: string): string {
  let symbol = currency;
  try {
    symbol = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0).find(part => part.type === 'currency')?.value || currency;
  } catch { /* Older engines can still display an unambiguous currency code. */ }
  return `${symbol}${symbol === currency ? ' ' : ''}${formatResultNumber(value, locale)}`;
}

// Keep the exact stored decimal digits, including currency trailing zeroes.
export function formatResultNumber(value: string, locale: string): string {
  const sign = value.startsWith('-') ? '-' : '';
  const magnitude = sign ? value.slice(1) : value;
  return sign + formatNumberInput(magnitude.replace('.', decimalSeparator(locale)), locale);
}
