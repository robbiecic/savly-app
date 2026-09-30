import { D, decimal, fraction, InputError, money, positive } from './decimal';
import type { DataMode, RefundSelection } from './refunds';

export interface Currency {
  code: string;
  minorUnits: number;
}

// Already oriented by the data adapter: home units per shopping unit.
export interface FxQuote {
  rate: string;
  from: string;
  to: string;
  source: string;
  kind: 'sample' | 'reference' | 'manual';
  asOf: string | null;
  originalPair?: string;
  originalRate?: string;
  inverted?: boolean;
}

export interface CalculationInput {
  mode: DataMode;
  shoppingCurrency: Currency;
  homeCurrency: Currency;
  price: string;
  homePrice?: string;
  bankFee?: string; // Decimal fraction: "0.03" means 3%.
  vatRate: string | null;
  fx: FxQuote | null;
  refund: RefundSelection;
}

export interface Calculation {
  calculationVersion: 1;
  shoppingCurrency: string;
  homeCurrency: string;
  convertedCost: string;
  cardFee: string;
  includedVat: string | null; // Shopping currency; all cost totals are home currency.
  refundShopping: string | null;
  refundHome: string | null;
  withoutRefund: string;
  withRefund: string | null;
  savings: { amount: string; percentage: string; outcome: 'save' | 'more' | 'same' } | null;
  fx: FxQuote;
  refund: RefundSelection;
  bankFee: string;
  assumptions: readonly string[];
}

export type CalculationResult =
  | { status: 'ok'; value: Calculation }
  | { status: 'invalid'; field: string; message: string }
  | { status: 'unavailable'; field: 'fx'; message: string };

function validateCurrency(currency: Currency, field: string) {
  if (!/^[A-Z]{3}$/.test(currency.code) || !Number.isInteger(currency.minorUnits) ||
      currency.minorUnits < 0 || currency.minorUnits > 4) {
    throw new InputError(field, 'Valid currency metadata is required.');
  }
}

export function calculate(input: CalculationInput): CalculationResult {
  try {
    validateCurrency(input.shoppingCurrency, 'shoppingCurrency');
    validateCurrency(input.homeCurrency, 'homeCurrency');
    const p = positive(input.price, 'price');
    const h = input.homePrice === undefined ? null : positive(input.homePrice, 'homePrice');
    const f = fraction(input.bankFee ?? '0', 'bankFee');
    const v = input.vatRate === null ? null : fraction(input.vatRate, 'vatRate');
    const shopping = input.shoppingCurrency;
    const home = input.homeCurrency;
    const fx: FxQuote | null = shopping.code === home.code
      ? { rate: '1', from: shopping.code, to: home.code, source: 'Same currency', kind: 'reference', asOf: null }
      : input.fx;
    if (fx === null) return { status: 'unavailable', field: 'fx', message: 'Conversion unavailable.' };
    if (fx.from !== shopping.code || fx.to !== home.code || !fx.source.trim() ||
        (input.mode === 'real' && fx.kind === 'sample')) {
      return { status: 'unavailable', field: 'fx', message: 'FX direction or provenance is invalid.' };
    }
    // Reverse quotes retain the original rate so no rounded reciprocal enters money arithmetic.
    const r = fx.inverted && fx.kind !== 'manual'
      ? fx.originalPair === home.code + shopping.code && fx.originalRate
        ? new D(1).div(positive(fx.originalRate, 'fx'))
        : (() => { throw new InputError('fx', 'The original reverse quote is required.'); })()
      : positive(fx.rate, 'fx');
    const converted = p.mul(r);
    const fee = converted.mul(f);
    const before = converted.plus(fee);
    const vat = v === null ? null : p.mul(v).div(v.plus(1));
    let refund = input.refund;
    if (input.mode === 'real' && refund.kind === 'sample') {
      refund = { kind: 'unavailable', reason: 'Sample refund rules cannot be used with real data.' };
    }
    let amount = null;
    if (refund.kind === 'manual') amount = decimal(refund.amount, 'refund');
    if (refund.kind === 'sample') {
      const q = fraction(refund.rate, 'refund');
      const ruleVat = fraction(refund.vatRate, 'refund');
      if (v === null || !ruleVat.eq(v)) throw new InputError('refund', 'Refund rule VAT does not match the purchase VAT.');
      if (q.gt(v.div(v.plus(1)))) throw new InputError('refund', 'Refund rate exceeds included VAT.');
      amount = p.mul(q);
    }
    if (amount !== null && (amount.gt(p) || (vat !== null && amount.gt(vat.toDecimalPlaces(shopping.minorUnits))))) {
      throw new InputError('refund', vat === null ? 'Refund cannot exceed the purchase price.' : `Refund cannot exceed included VAT (${shopping.code} ${money(vat, shopping.minorUnits)}).`);
    }
    const refundHome = amount === null ? null : amount.mul(r);
    const after = refundHome === null ? null : before.minus(refundHome);
    const difference = h === null || after === null ? null : h.minus(after);
    const roundedDifference = difference?.toDecimalPlaces(home.minorUnits);
    const savings: Calculation['savings'] = difference === null || !roundedDifference || h === null ? null : {
      amount: money(difference, home.minorUnits),
      percentage: roundedDifference.isZero() ? '0.0' : money(difference.div(h).mul(100), 1),
      outcome: roundedDifference.isZero() ? 'same' : roundedDifference.gt(0) ? 'save' : 'more',
    };
    return { status: 'ok', value: {
      calculationVersion: 1, shoppingCurrency: shopping.code, homeCurrency: home.code,
      convertedCost: money(converted, home.minorUnits), cardFee: money(fee, home.minorUnits),
      includedVat: vat === null ? null : money(vat, shopping.minorUnits),
      refundShopping: amount === null ? null : money(amount, shopping.minorUnits),
      refundHome: refundHome === null ? null : money(refundHome, home.minorUnits),
      withoutRefund: money(before, home.minorUnits), withRefund: after === null ? null : money(after, home.minorUnits),
      savings, fx: { ...fx }, refund: refund.kind === 'sample' ? { ...refund, assumptions: [...refund.assumptions] } : { ...refund },
      bankFee: f.toString(), assumptions: [
        'Purchase and refund use the same FX rate; actual settlement may differ.',
        'Card fees apply to the full purchase and are not refunded.',
        'Customs duties, import taxes, and travel costs are excluded.',
      ],
    } };
  } catch (error) {
    if (!(error instanceof InputError)) throw error;
    return error.field === 'fx'
      ? { status: 'unavailable', field: 'fx', message: error.message }
      : { status: 'invalid', field: error.field, message: error.message };
  }
}
