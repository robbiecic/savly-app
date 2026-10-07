import { D, positive } from './decimal';

export interface MinimumPurchase {
  readonly amount: number;
  readonly currency: string;
  readonly comparison: 'gt' | 'gte';
  readonly taxBasis: 'tax_inclusive' | 'tax_exclusive';
  readonly aggregation: 'single_invoice' | 'same_supplier' | 'same_store' | 'same_store_same_day' | 'same_retailer_three_days' | 'export_voucher' | 'no_minimum';
}
export interface TouristRefund {
  readonly status: 'available' | 'no_national_scheme' | 'regional_only';
  readonly minimumPurchase: MinimumPurchase | null;
  readonly notes: string;
  readonly sources: readonly { readonly title: string; readonly url: string }[];
  readonly reviewedOn: string;
  readonly reviewAfter: string;
  readonly regionalSchemes?: readonly { readonly regionCode: string; readonly minimumPurchase: MinimumPurchase; readonly notes: string }[];
}
export interface RefundAssessment {
  readonly status: 'potential' | 'excluded' | 'unknown';
  readonly reason: string;
}
export const groupingLabels: Record<MinimumPurchase['aggregation'], string> = {
  single_invoice: 'On a single invoice', same_supplier: 'From the same supplier', same_store: 'From the same store',
  same_store_same_day: 'From the same store on the same day', same_retailer_three_days: 'From the same retailer over at most three consecutive days',
  export_voucher: 'On an export voucher', no_minimum: 'No statutory minimum',
};
export function minimumLabel(minimum: MinimumPurchase): string {
  if (minimum.aggregation === 'no_minimum') return 'No statutory minimum purchase.';
  return `${minimum.comparison === 'gt' ? 'More than' : 'At least'} ${minimum.currency} ${new D(minimum.amount).toFixed()} ${minimum.taxBasis === 'tax_exclusive' ? 'excluding' : 'including'} VAT. ${groupingLabels[minimum.aggregation]}.`;
}
export function needsRefundReview(rule: TouristRefund, now: number): boolean {
  const today = new Date(now).toISOString().slice(0, 10);
  return today > rule.reviewAfter || today < rule.reviewedOn;
}
// Checks only what the reference contract models. No inference about residence or purchase region.
export function assessTouristRefund(country: { vatRate: number | null; touristRefund?: TouristRefund }, price: string, now: number): RefundAssessment {
  const p = positive(price, 'price');
  const rule = country.touristRefund;
  if (!rule) return { status: 'unknown', reason: 'Refund rules are unavailable. Comparison excludes any refund.' };
  if (needsRefundReview(rule, now)) return { status: 'unknown', reason: 'Refund rules need confirmation: their review date is overdue or unverified. Comparison excludes any refund.' };
  if (rule.status === 'no_national_scheme') return { status: 'excluded', reason: 'No national tourist VAT refund scheme. No automatic refund included.' };
  if (rule.status === 'regional_only') return { status: 'unknown', reason: 'Refunds are regional only. The purchase region is not confirmed, so no automatic refund is included.' };
  const min = rule.minimumPurchase;
  if (!min || country.vatRate === null) return { status: 'unknown', reason: 'The minimum purchase or VAT rate is unavailable. Comparison excludes any refund.' };
  // Compare gross against an exact equivalent gross threshold, avoiding division/rounding at net boundaries.
  const threshold = new D(min.amount).mul(min.taxBasis === 'tax_exclusive' ? new D(1).plus(country.vatRate) : 1);
  if (!(min.comparison === 'gt' ? p.gt(threshold) : p.gte(threshold))) {
    return { status: 'excluded', reason: `This price does not meet the minimum purchase. ${minimumLabel(min)} No automatic refund included; other qualifying purchases are not counted.` };
  }
  return { status: 'potential', reason: `Purchase value meets the minimum condition. ${minimumLabel(min)} Assumes this purchase meets the grouping conditions and is wholly taxed at the stated standard VAT rate. Residency, goods, paperwork and retailer conditions still apply. Assumes all included VAT is refundable, with no provider fee; actual refunds may be lower or unavailable.` };
}
