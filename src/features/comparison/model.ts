import { decimalSeparator } from './locale';
import { calculate, type Calculation, type FxQuote } from '../../domain/calculator';
import { D, InputError, decimal, positive } from '../../domain/decimal';
import { selectRefundRule, type RefundRule } from '../../domain/refunds';
import { selectedCountry, type Snapshot } from '../../data/reference-data';
import type { ReferenceState } from '../../data/reference-store';

export interface Preferences { country: string; homeCurrency: string; residence: string; feePercent: string }
export interface ComparisonForm extends Preferences {
  price: string; homePrice: string; itemName: string; fxOverride: string; refundOverride: string;
}
export const DEFAULT_PREFERENCES: Preferences = { country: 'FR', homeCurrency: 'USD', residence: '', feePercent: '0' };
export function newForm(preferences: Preferences = DEFAULT_PREFERENCES): ComparisonForm {
  return { ...preferences, price: '', homePrice: '', itemName: '', fxOverride: '', refundOverride: '' };
}
export function editForm(form: ComparisonForm, field: keyof ComparisonForm, value: string): ComparisonForm {
  const clear = ['country', 'homeCurrency', 'residence', 'price'].includes(field) && value !== form[field];
  return { ...form, ...(clear ? { fxOverride: '', refundOverride: '' } : {}), [field]: value };
}
export function resetOverrides(form: ComparisonForm): ComparisonForm {
  return { ...form, fxOverride: '', refundOverride: '' };
}
export function normalizeDecimal(value: string, locale: string): string {
  const separator = decimalSeparator(locale);
  const trimmed = value.trim();
  // Group separators are deliberately rejected, not guessed (1,234 is ambiguous).
  if (separator !== '.' && trimmed.includes('.')) return 'invalid';
  const normalized = separator === '.' ? trimmed : trimmed.replace(separator, '.');
  return normalized.startsWith('.') ? `0${normalized}` : normalized;
}
export function currencyInfo(code: string) {
  const supported = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : null;
  if (!/^[A-Z]{3}$/.test(code) || (supported && !supported.includes(code))) throw new InputError('homeCurrency', 'Currency metadata is unavailable.');
  return { code, minorUnits: new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2 };
}
export function availableCurrencies(snapshot: Snapshot): string[] {
  return [...new Set([...snapshot.countries.map((row) => row.currency), ...snapshot.rates.flatMap((row) => [row.pair.slice(0, 3), row.pair.slice(3)])])].sort();
}
export function automaticFx(snapshot: Snapshot, from: string, to: string): FxQuote | null {
  if (from === to) return { from, to, rate: '1', kind: 'reference', source: 'Same currency', asOf: null };
  const direct = snapshot.rates.find((row) => row.pair === from + to);
  const reverse = snapshot.rates.find((row) => row.pair === to + from);
  const row = direct ?? reverse;
  if (!row) return null;
  const inverted = !direct;
  return {
    from, to, rate: (inverted ? new D(1).div(row.rate) : new D(row.rate)).toFixed(),
    kind: snapshot.mode === 'sample' ? 'sample' : 'reference', source: row.source,
    asOf: row.asOf, originalPair: row.pair, originalRate: new D(row.rate).toFixed(), inverted,
  };
}
export const SAMPLE_REFUND_RULES: readonly RefundRule[] = [{
  id: 'fr-general-demo', country: 'FR', currency: 'EUR', residenceCountries: ['US'], category: 'general-goods',
  minGrossPrice: '0', maxGrossPriceExclusive: null, vatRate: '0.20', netRefundRate: '0.125',
  assumptions: ['Illustrative France/US scenario, not current tax guidance.', 'Modeled provider fees included.'],
}];
export interface DisplayedComparison {
  result: Calculation; itemName: string; price: string; homePrice: string | null;
  sample: boolean; stale: boolean; snapshotId: string; fetchedAt: number;
}
export type ComparisonView =
  | { status: 'empty' | 'loading' | 'unavailable'; message: string }
  | { status: 'invalid'; field: string; message: string }
  | { status: 'ready'; comparison: DisplayedComparison };

export function compare(form: ComparisonForm, reference: ReferenceState | null, locale = 'en-US'): ComparisonView {
  if (!reference) return { status: 'loading', message: 'Loading sample rates…' };
  const snapshot = reference.snapshot;
  if (!snapshot) return { status: 'unavailable', message: 'Rates are unavailable. Try again when you’re connected.' };
  const country = selectedCountry(snapshot, form.country);
  if (!country) return { status: 'invalid', field: 'country', message: 'This shopping country is no longer supported. Choose another country.' };
  if (!availableCurrencies(snapshot).includes(form.homeCurrency)) return { status: 'invalid', field: 'homeCurrency', message: 'Choose a supported home currency.' };
  if (!form.price.trim()) return { status: 'empty', message: 'Enter a shopping price to see your estimate.' };
  try {
    const price = normalizeDecimal(form.price, locale);
    positive(price, 'price');
    const shoppingCurrency = currencyInfo(country.currency);
    const homeCurrency = currencyInfo(form.homeCurrency);
    let fx = automaticFx(snapshot, country.currency, form.homeCurrency);
    if (form.fxOverride.trim() && country.currency !== form.homeCurrency) {
      fx = { from: country.currency, to: form.homeCurrency, rate: normalizeDecimal(form.fxOverride, locale), kind: 'manual', source: 'Manual rate', asOf: null };
    }
    const normalizedFee = normalizeDecimal(form.feePercent, locale);
    if (!/^\d{1,3}(?:\.\d{1,4})?$/.test(normalizedFee)) throw new InputError('feePercent', 'Enter a bank fee from 0 through 100%, with up to four decimal places.');
    const feePercent = decimal(normalizedFee, 'feePercent');
    if (feePercent.gt(100)) throw new InputError('feePercent', 'Enter a bank fee from 0 through 100%.');
    const homePrice = form.homePrice.trim() ? normalizeDecimal(form.homePrice, locale) : undefined;
    const calculation = calculate({
      mode: snapshot.mode, shoppingCurrency, homeCurrency, price, homePrice,
      bankFee: feePercent.div(100).toFixed(), vatRate: country.vatRate === null ? null : new D(country.vatRate).toFixed(), fx,
      refund: form.refundOverride.trim() ? { kind: 'manual', amount: normalizeDecimal(form.refundOverride, locale) }
        : selectRefundRule(SAMPLE_REFUND_RULES, { mode: snapshot.mode, country: country.country, currency: country.currency, residenceCountry: form.residence, price }),
    });
    if (calculation.status !== 'ok') return { ...calculation, status: 'invalid', field: calculation.field === 'refund' ? 'refundOverride' : calculation.field === 'fx' ? 'fxOverride' : calculation.field };
    return { status: 'ready', comparison: {
      result: calculation.value, itemName: form.itemName.trim(), price: new D(price).toFixed(shoppingCurrency.minorUnits),
      homePrice: homePrice ? new D(homePrice).toFixed(homeCurrency.minorUnits) : null,
      sample: snapshot.mode === 'sample', stale: reference.status === 'stale', snapshotId: snapshot.id, fetchedAt: snapshot.fetchedAt,
    } };
  } catch (error) {
    if (error instanceof InputError) return { status: 'invalid', field: error.field, message: error.message };
    throw error;
  }
}
export function fxLabel(fx: FxQuote): string {
  const displayed = new D(fx.rate).toSignificantDigits(8).toFixed();
  const label = fx.kind === 'manual' ? 'Manual rate' : fx.kind === 'sample' ? 'Sample rate' : fx.source;
  return `1 ${fx.from} = ${displayed} ${fx.to} · ${label}`;
}
export function savingsLabel(value: Calculation): string | null {
  const savings = value.savings;
  if (!savings) return null;
  if (savings.outcome === 'same') return 'Same estimated cost';
  const amount = `${value.homeCurrency} ${savings.amount.replace('-', '')}`;
  return savings.outcome === 'save' ? `You could save ${amount}` : `Costs ${amount} more`;
}
