import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compare, newForm } from '../src/features/comparison/model';
import { validateReferenceData } from '../src/data/reference-data';
import countries from '../src/data/default-countries.json';
import { shareLink, shareMessage } from '../src/features/comparison/sharing';
import { SavedComparisonStore } from '../src/storage/saved-comparisons';

// Owner-supplied quote in a synthetic API fixture (required source enum);
// sample mode ensures it is never presented as a retrieved/live CityIndex rate.
const now = Date.parse('2026-10-07T12:00:00Z');
const data = validateReferenceData({ rates: [{ pair: 'GBPAUD', rate: 1.9004,
  pipSize: .0001, source: 'CityIndex', asOf: '2026-10-01T12:00:00Z' }] }, countries);
const snapshot = { ...data, adapterVersion: 1 as const, mode: 'sample' as const,
  environment: 'test', id: 'uk-australia-example', fetchedAt: now };
const form = { ...newForm(), residence: 'GB', homeCurrency: 'GBP', country: 'AU', price: '350', homePrice: '200', itemName: 'Australia example' };
function example(changes = {}) {
  const view = compare({ ...form, ...changes }, { status: 'fresh', snapshot, label: 'Sample rate', error: null }, 'en-GB', now);
  if (view.status !== 'ready') assert.fail(view.message);
  return view.comparison;
}

test('UK/Australia: £200 vs tax-inclusive A$350 at 1 GBP = 1.9004 AUD, less 28% refund fee', () => {
  const c = example(); const r = c.result;
  assert.equal(r.fx.originalPair, 'GBPAUD');
  assert.equal(r.fx.originalRate, '1.9004');
  assert.equal(r.fx.inverted, true);
  assert.equal(r.fx.source, 'CityIndex');
  assert.equal(c.sample, true); assert.equal(c.stale, true);
  assert.equal(c.refundAssessment?.status, 'potential');
  assert.equal(r.convertedCost, '184.17');
  assert.equal(r.priceDifference, '15.83');
  assert.equal(r.includedVat, '31.82'); // 350 × .1 / 1.1, not 350 × .1.
  assert.deepEqual(r.refundBreakdown, { grossHome: '16.74', feeHome: '4.69', feeRate: '0.28' });
  assert.equal(r.refundShopping, '22.91');
  assert.equal(r.refundHome, '12.05');
  assert.equal(r.withRefund, '172.12');
  assert.deepEqual(r.savings, { amount: '27.88', percentage: '13.9', outcome: 'save' });
  const text = shareMessage(c, shareLink());
  for (const expected of ['GBP 27.88', 'GBP 16.74', '-GBP 4.69', '28% assumed', 'Sample estimate']) assert.ok(text.includes(expected), expected);
});
test('Manual gross refund incurs the fee once; refund bound is checked before the fee', () => {
  const r = example({ refundOverride: '30' }).result;
  assert.equal(r.refundShopping, '21.60');
  assert.deepEqual(r.refundBreakdown, { grossHome: '15.79', feeHome: '4.42', feeRate: '0.28' });
  assert.equal(r.savings?.amount, '27.19');
  const invalid = compare({ ...form, refundOverride: '35' }, { status: 'fresh', snapshot, label: 'Sample rate', error: null }, 'en-GB', now);
  assert.equal(invalid.status, 'invalid');
  assert.equal(example({ homePrice: '' }).result.savings, null);
  const zero = example({ refundOverride: '0' }).result;
  assert.equal(zero.refundBreakdown?.feeHome, '0.00');
  assert.equal(zero.savings?.amount, '15.83');
});
test('UK/Australia refund fee and quote survive saving and reopening without recalculation', async () => {
  let raw: string | null = null;
  const storage = { async getItem() { return raw; }, async setItem(_key: string, value: string) { raw = value; } };
  const comparison = example();
  await new SavedComparisonStore(storage).save({ id: 'australia', savedAt: new Date(now).toISOString(), form, comparison });
  assert.deepEqual((await new SavedComparisonStore(storage).list())[0].comparison, comparison);
});
