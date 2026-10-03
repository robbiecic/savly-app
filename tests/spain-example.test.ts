import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compare, newForm, SAMPLE_REFUND_RULES, automaticFx } from '../src/features/comparison/model';
import { calculate } from '../src/domain/calculator';
import { selectRefundRule } from '../src/domain/refunds';
import { shareMessage, shareLink } from '../src/features/comparison/sharing';
import type { Snapshot } from '../src/data/reference-data';
import { SavedComparisonStore } from '../src/storage/saved-comparisons';

const snapshot: Snapshot = {
  adapterVersion: 1, environment: 'test', mode: 'sample', id: 'spain-worked-example', fetchedAt: 1000,
  countries: [{ country: 'ES', currency: 'EUR', vatRate: 0.21 }, { country: 'US', currency: 'USD', vatRate: null }],
  rates: [{ pair: 'USDEUR', rate: 0.8887, pipSize: 0.0001, source: 'CityIndex', asOf: '2026-09-26T12:00:00Z' }],
};
const form = { ...newForm(), country: 'ES', residence: 'US', price: '450', homePrice: '500', itemName: 'Spain example' };
const context = { mode: 'sample' as const, country: 'ES', currency: 'EUR', residenceCountry: 'US', price: '450' };
function example() {
  const view = compare(form, { status: 'stale', snapshot, label: 'Rates out of date', error: 'network' });
  if (view.status !== 'ready') assert.fail(view.message);
  return view.comparison;
}
test('AC19 Spain: VAT-inclusive purchase, reverse stale FX, explicit 28% fee and final rounding', () => {
  const c = example(); const r = c.result;
  assert.equal(c.stale, true); assert.equal(c.sample, true);
  assert.equal(r.fx.originalPair, 'USDEUR'); assert.equal(r.fx.originalRate, '0.8887');
  assert.equal(r.fx.asOf, '2026-09-26T12:00:00Z');
  assert.equal(r.convertedCost, '506.36');
  assert.equal(r.priceDifference, '-6.36');
  assert.equal(r.includedVat, '78.10');
  assert.deepEqual(r.refundBreakdown, { grossHome: '87.88', feeHome: '24.61', feeRate: '0.28' });
  assert.equal(r.refundHome, '63.27');
  assert.equal(r.refundShopping, '56.23');
  assert.equal(r.withRefund, '443.08');
  assert.deepEqual(r.savings, { amount: '56.92', percentage: '11.4', outcome: 'save' });
  const message = shareMessage(c, shareLink());
  for (const label of ['USD 56.92', 'USD 87.88', '-USD 24.61', '28% assumed', 'Rates out of date', 'Sample estimate']) assert.ok(message.includes(label));
});
test('AC19 fee is applied once; manual net refunds replace the sample fee model', () => {
  const view = compare({ ...form, refundOverride: '50' }, { status: 'fresh', snapshot, label: 'Sample rate', error: null });
  if (view.status !== 'ready') assert.fail(view.message);
  assert.equal(view.comparison.result.refundShopping, '50.00');
  assert.equal(view.comparison.result.refundBreakdown, undefined);
  assert.equal(view.comparison.result.savings?.amount, '49.90');
});
test('Fee assumptions have bounds, require matching VAT, and never become live refund rules', () => {
  const rule = SAMPLE_REFUND_RULES.find(r => r.country === 'ES')!;
  for (const providerFeeRate of ['-0.01', '1.01', 'NaN']) {
    assert.equal(selectRefundRule([{ ...rule, providerFeeRate }], context).kind, 'unavailable');
  }
  assert.equal(selectRefundRule([{ ...rule, netRefundRate: '0.1' }], context).kind, 'unavailable');
  assert.equal(selectRefundRule([rule], { ...context, mode: 'real' }).kind, 'unavailable');
  assert.equal(selectRefundRule([rule], { ...context, residenceCountry: 'FR' }).kind, 'unavailable');
  const small = calculate({
    mode: 'sample', shoppingCurrency: { code: 'EUR', minorUnits: 2 }, homeCurrency: { code: 'USD', minorUnits: 2 },
    price: '1', vatRate: '0.21', fx: automaticFx(snapshot, 'EUR', 'USD'),
    refund: selectRefundRule([{ ...rule, providerFeeRate: '0' }], { ...context, price: '1' }),
  });
  assert.equal(small.status, 'ok'); // Full included VAT must not fail because its display rounds down.
  for (const fee of ['0', '1']) {
    const output = calculate({
      mode: 'sample', shoppingCurrency: { code: 'EUR', minorUnits: 2 }, homeCurrency: { code: 'USD', minorUnits: 2 },
      price: '450', homePrice: '500', vatRate: '0.21', fx: automaticFx(snapshot, 'EUR', 'USD'),
      refund: selectRefundRule([{ ...rule, providerFeeRate: fee }], context),
    });
    assert.equal(output.status, 'ok');
    if (output.status === 'ok') assert.equal(output.value.refundHome, fee === '0' ? '87.88' : '0.00');
  }
});
test('Saved Spain example retains the stale rate and fee breakdown across restart', async () => {
  let raw: string | null = null;
  const storage = { async getItem() { return raw; }, async setItem(_key: string, value: string) { raw = value; } };
  await new SavedComparisonStore(storage).save({ id: 'spain', savedAt: '2026-10-02T12:00:00Z', form, comparison: example() });
  const [saved] = await new SavedComparisonStore(storage).list();
  assert.deepEqual(saved.comparison, example());
});
