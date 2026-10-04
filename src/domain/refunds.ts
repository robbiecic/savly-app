import { D, decimal, fraction, InputError, positive } from './decimal';

export type DataMode = 'sample' | 'real';

// Local illustrative fixture format, not a backend response contract.
export interface RefundRule {
  id: string;
  country: string;
  currency: string;
  residenceCountries: readonly string[];
  category: string;
  minGrossPrice: string;
  maxGrossPriceExclusive: string | null;
  vatRate: string;
  netRefundRate: string | null;
  providerFeeRate?: string; // Optional illustrative fee on included VAT, not purchase price.
  assumptions: readonly string[];
}

export type RefundSelection =
  | { kind: 'vat-assumption' } // Assume all included VAT refundable; not verified eligibility.
  | { kind: 'vat-unavailable' } // No VAT metadata; compare without a refund.
  | { kind: 'sample'; ruleId: string; rate: string; vatRate: string; providerFeeRate?: string; assumptions: readonly string[] }
  | { kind: 'manual'; amount: string }
  | { kind: 'unavailable'; reason: string };

export interface RefundContext {
  mode: DataMode;
  country: string;
  currency: string;
  residenceCountry: string;
  category?: string;
  price: string;
}

export function selectRefundRule(rules: readonly RefundRule[], context: RefundContext): RefundSelection {
  const price = positive(context.price, 'price');
  if (context.mode !== 'sample') {
    return { kind: 'unavailable', reason: 'Real refund data is not available.' };
  }
  const category = context.category ?? 'general-goods';
  try {
    const matches = rules.filter((rule) => {
      if (rule.country !== context.country || rule.currency !== context.currency ||
          rule.category !== category || !rule.residenceCountries.includes(context.residenceCountry)) return false;
      const min = decimal(rule.minGrossPrice, 'refundRule');
      const max = rule.maxGrossPriceExclusive === null ? null : decimal(rule.maxGrossPriceExclusive, 'refundRule');
      if (max !== null && max.lte(min)) throw new InputError('refundRule', 'Invalid price band.');
      return price.gte(min) && (max === null || price.lt(max));
    });
    if (matches.length !== 1) {
      return { kind: 'unavailable', reason: matches.length === 0 ? 'No matching refund rule.' : 'Multiple matching refund rules.' };
    }
    const rule = matches[0];
    const vat = fraction(rule.vatRate, 'refundRule');
    if (rule.providerFeeRate !== undefined) {
      if (rule.netRefundRate !== null) throw new InputError('refundRule', 'Choose a net rate or an explicit provider fee, not both.');
      const fee = fraction(rule.providerFeeRate, 'refundRule');
      return {
        kind: 'sample', ruleId: rule.id, vatRate: rule.vatRate, providerFeeRate: fee.toFixed(),
        rate: vat.div(vat.plus(1)).mul(new D(1).minus(fee)).toFixed(18),
        assumptions: [...rule.assumptions, 'Illustrative refund; eligibility is not verified.'],
      };
    }
    if (rule.netRefundRate === null) return { kind: 'unavailable', reason: 'Refund rate is unknown.' };
    const rate = fraction(rule.netRefundRate, 'refundRule');
    if (rate.gt(vat.div(vat.plus(1)))) throw new InputError('refundRule', 'Refund exceeds included VAT.');
    return {
      kind: 'sample', ruleId: rule.id, rate: rule.netRefundRate, vatRate: rule.vatRate,
      assumptions: [...rule.assumptions, `Category: ${category}`, 'Illustrative refund; eligibility is not verified.'],
    };
  } catch (error) {
    if (error instanceof InputError) return { kind: 'unavailable', reason: error.message };
    throw error;
  }
}
