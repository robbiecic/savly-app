import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compare, newForm } from '../src/features/comparison/model';
import { validateReferenceData } from '../src/data/reference-data';
import { SAMPLE_RESPONSES } from '../src/data/transport';
import { shareMessage, shareLink } from '../src/features/comparison/sharing';

function result(changes = {}, vatRate: number | null = .2, mode: 'real' | 'sample' = 'real') {
  const data = validateReferenceData(SAMPLE_RESPONSES['/v1/rates'], { countries: [
    { ...SAMPLE_RESPONSES['/v1/countries'].countries.find(c => c.country === 'FR'), vatRate }, { country: 'AU', currency: 'AUD', vatRate: .1 },
  ] });
  const view = compare({ ...newForm(), residence: 'AU', price: '120', homePrice: '150', ...changes }, {
    status: 'fresh', label: 'Reference rate', error: null,
    snapshot: { ...data, adapterVersion: 1, mode, environment: 'api', id: 'test', fetchedAt: Date.now() },
  }, 'en-US', Date.parse('2026-10-07T12:00:00Z'));
  if (view.status !== 'ready') assert.fail(view.message);
  return view.comparison;
}
test('Qualifying purchase deducts 28% from full VAT, without asserting residency eligibility', () => {
  for (const mode of ['sample', 'real'] as const) {
    const c = result({}, .2, mode);
    assert.equal(c.result.refund.kind, 'scheme');
    assert.equal(c.result.includedVat, '20.00');
    assert.equal(c.result.refundHome, '15.84');
    assert.equal(c.result.withRefund, '116.16');
    assert.equal(c.result.savings?.amount, '33.84');
    assert.match(shareMessage(c, shareLink()), /Assumes all included VAT/);
  }
});
test('Null VAT preserves unavailable refund but compares converted price, including manual FX', () => {
  for (const [homePrice, outcome, amount] of [['150', 'save', '18.00'], ['120', 'more', '-12.00'], ['132', 'same', '0.00']]) {
    const c = result({ homePrice, refundOverride: '50' }, null);
    assert.equal(c.result.refund.kind, 'vat-unavailable');
    assert.equal(c.result.refundHome, null); assert.equal(c.result.withRefund, null);
    assert.deepEqual(c.result.savings?.outcome, outcome); assert.equal(c.result.savings?.amount, amount);
    assert.match(shareMessage(c, shareLink()), /comparison excludes any refund/);
  }
  assert.equal(result({ homePrice: '150', fxOverride: '2' }, null).result.savings?.amount, '-90.00');
  assert.equal(result({ homePrice: '' }, null).result.savings, null);
});
test('Zero VAT is distinct from missing VAT and manual refund overrides remain bounded', () => {
  assert.equal(result({}, 0).result.refundHome, '0.00');
  assert.equal(result({}, 0).result.savings?.amount, '18.00');
  assert.equal(result({ refundOverride: '10' }).result.refundHome, '7.92');
});
test('New estimates deduct the same 28% fee as the Spain example', () => {
  const r = result({ price: '450', homePrice: '500', fxOverride: '1.125239113311579835' }, .21).result;
  assert.deepEqual(r.refundBreakdown, { grossHome: '87.88', feeHome: '24.61', feeRate: '0.28' });
  assert.equal(r.refundShopping, '56.23');
});
