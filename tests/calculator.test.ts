import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculate, type CalculationInput } from '../src/domain/calculator';
import { selectRefundRule, type RefundRule, type RefundContext } from '../src/domain/refunds';

const rule: RefundRule = {
  id: 'fr-demo', country: 'FR', currency: 'EUR', residenceCountries: ['US'],
  category: 'general-goods', minGrossPrice: '0', maxGrossPriceExclusive: null,
  vatRate: '0.20', netRefundRate: '0.125', assumptions: ['Sample provider fees included.'],
};
const context: RefundContext = { mode: 'sample', country: 'FR', currency: 'EUR', residenceCountry: 'US', price: '120' };
const input: CalculationInput = {
  mode: 'sample', shoppingCurrency: { code: 'EUR', minorUnits: 2 }, homeCurrency: { code: 'USD', minorUnits: 2 },
  price: '120', homePrice: '150', bankFee: '0.03', vatRate: '0.20',
  fx: { from: 'EUR', to: 'USD', rate: '1.10', kind: 'sample', source: 'Sample rate', asOf: null },
  refund: selectRefundRule([rule], context),
};
function result(changes: Partial<CalculationInput> = {}) {
  const result = calculate({ ...input, ...changes });
  if (result.status !== 'ok') assert.fail(result.message);
  return result.value;
}

test('AC1: decimal costs, VAT, fee, refund and savings', () => {
  const value = result();
  assert.equal(value.includedVat, '20.00');
  assert.equal(value.convertedCost, '132.00');
  assert.equal(value.cardFee, '3.96');
  assert.equal(value.refundHome, '16.50');
  assert.equal(value.withoutRefund, '135.96');
  assert.equal(value.withRefund, '119.46');
  assert.deepEqual(value.savings, { amount: '30.54', percentage: '20.4', outcome: 'save' });
});
test('AC2: explicit zero refund still supports comparison', () => {
  const value = result({ refund: selectRefundRule([{ ...rule, netRefundRate: '0' }], context) });
  assert.equal(value.withRefund, '135.96');
  assert.deepEqual(value.savings, { amount: '14.04', percentage: '9.4', outcome: 'save' });
});
test('AC3–4: unfavorable comparison and omitted home price', () => {
  assert.deepEqual(result({ homePrice: '100' }).savings, { amount: '-19.46', percentage: '-19.5', outcome: 'more' });
  assert.equal(result({ homePrice: undefined }).savings, null);
});
test('AC5: reject refund greater than included VAT with an explanatory error', () => {
  assert.deepEqual(calculate({ ...input, refund: { kind: 'manual', amount: '21' } }), {
    status: 'invalid', field: 'refund', message: 'Refund cannot exceed included VAT (EUR 20.00).',
  });
});
for (const value of ['', '0', '-1', 'NaN', 'Infinity', 'abc', '1e2', '0x10', '1,000', ' 12 ', '9999999999999999999']) {
  test(`AC6: reject invalid price and home price ${JSON.stringify(value)}`, () => {
    for (const field of ['price', 'homePrice'] as const) {
      const valueResult = calculate({ ...input, [field]: value });
      assert.equal(valueResult.status, 'invalid');
      assert.equal('field' in valueResult && valueResult.field, field);
    }
  });
}
test('AC6: invalid FX blocks conversion, fees and VAT must be fractions', () => {
  for (const rate of ['0', '-1', 'NaN', 'Infinity', '']) {
    assert.equal(calculate({ ...input, fx: { ...input.fx!, rate } }).status, 'unavailable');
  }
  for (const field of ['bankFee', 'vatRate'] as const) {
    for (const value of ['-0.01', '1.01', 'NaN']) assert.equal(calculate({ ...input, [field]: value }).status, 'invalid');
  }
  assert.equal(calculate({ ...input, refund: { kind: 'manual', amount: '-1' } }).status, 'invalid');
});
test('AC7 domain: retain FX direction, original quote, provenance and assumptions', () => {
  const fx = { ...input.fx!, source: 'CityIndex', kind: 'reference' as const, asOf: '2026-09-29T12:00:00Z', originalPair: 'USDEUR', originalRate: '0.8', inverted: true, rate: '1.25' };
  assert.deepEqual(result({ fx }).fx, fx);
  assert.notEqual(result().refund, input.refund);
  assert.equal(calculate({ ...input, fx: { ...fx, from: 'USD', to: 'EUR' } }).status, 'unavailable');
});
test('AC8: unknown refunds stay unavailable, zero VAT and zero refund work', () => {
  const unknown = result({ refund: { kind: 'unavailable', reason: 'Unknown eligibility' } });
  assert.equal(unknown.withoutRefund, '135.96');
  assert.equal(unknown.withRefund, null);
  assert.equal(unknown.refundHome, null);
  assert.equal(unknown.savings, null);
  const zero = result({ vatRate: '0', refund: { kind: 'manual', amount: '0' } });
  assert.equal(zero.includedVat, '0.00');
  assert.equal(zero.withRefund, zero.withoutRefund);
});
test('AC8: same currency uses 1 even when no FX quote exists', () => {
  const value = result({ homeCurrency: input.shoppingCurrency, fx: null });
  assert.equal(value.convertedCost, '120.00');
  assert.equal(value.fx.rate, '1');
});
test('Unknown VAT stays null; manual refund may not exceed gross price', () => {
  assert.equal(result({ vatRate: null, refund: { kind: 'manual', amount: '10' } }).includedVat, null);
  assert.equal(calculate({ ...input, vatRate: null, refund: { kind: 'manual', amount: '121' } }).status, 'invalid');
});
test('AC11: half-up monetary rounding, whole yen and no negative-zero savings', () => {
  const changes = { price: '1.005', bankFee: '0', refund: { kind: 'manual' as const, amount: '0' }, homeCurrency: input.shoppingCurrency, fx: null };
  assert.equal(result(changes).withRefund, '1.01');
  assert.equal(result({ ...changes, homeCurrency: { code: 'JPY', minorUnits: 0 }, fx: { ...input.fx!, to: 'JPY', rate: '100' } }).withRefund, '101');
  const equal = result({ ...changes, price: '1.004', homePrice: '1' });
  assert.deepEqual(equal.savings, { amount: '0.00', percentage: '0.0', outcome: 'same' });
});
test('Retain intermediate precision when converting a refund', () => {
  const value = result({ price: '0.10', bankFee: '0', fx: { ...input.fx!, rate: '100' } });
  assert.equal(value.refundShopping, '0.01');
  assert.equal(value.refundHome, '1.25');
  assert.equal(value.withRefund, '8.75');
});
test('AC12 numeric example: default fee is zero', () => {
  const value = result({ bankFee: undefined });
  assert.equal(value.withoutRefund, '132.00');
  assert.equal(value.withRefund, '115.50');
  assert.deepEqual(value.savings, { amount: '34.50', percentage: '23.0', outcome: 'save' });
});
test('Manual amount overrides fixture; refund bound uses rounded included VAT', () => {
  assert.equal(result({ refund: { kind: 'manual', amount: '20' } }).refundShopping, '20.00');
  assert.equal(calculate({ ...input, price: '1', refund: { kind: 'manual', amount: '0.17' } }).status, 'ok');
  assert.equal(calculate({ ...input, price: '1', refund: { kind: 'manual', amount: '0.18' } }).status, 'invalid');
});
test('Real mode never combines real FX with sample refund rules', () => {
  assert.equal(selectRefundRule([rule], { ...context, mode: 'real' }).kind, 'unavailable');
  assert.equal(calculate({ ...input, mode: 'real' }).status, 'unavailable');
  const value = result({ mode: 'real', fx: { ...input.fx!, kind: 'reference', source: 'CityIndex' } });
  assert.equal(value.withRefund, null);
  assert.equal(value.refund.kind, 'unavailable');
});
test('Refund selection matches explicit country, currency, residency and category', () => {
  assert.equal(selectRefundRule([rule], context).kind, 'sample');
  for (const change of [{ country: 'GB' }, { currency: 'USD' }, { residenceCountry: 'FR' }, { category: 'food' }]) {
    assert.equal(selectRefundRule([rule], { ...context, ...change }).kind, 'unavailable');
  }
});
test('Price bands are lower-inclusive and upper-exclusive', () => {
  const rules = [{ ...rule, minGrossPrice: '100', maxGrossPriceExclusive: '120' }, { ...rule, id: 'upper', minGrossPrice: '120' }];
  assert.equal(selectRefundRule(rules, { ...context, price: '99.99' }).kind, 'unavailable');
  const lower = selectRefundRule(rules, { ...context, price: '100' });
  assert.equal(lower.kind === 'sample' && lower.ruleId, 'fr-demo');
  const upper = selectRefundRule(rules, context);
  assert.equal(upper.kind === 'sample' && upper.ruleId, 'upper');
});
test('No match, overlapping rules, unknown rates and malformed rules are unavailable', () => {
  for (const rules of [[], [rule, { ...rule, id: 'duplicate' }], [{ ...rule, netRefundRate: null }], [{ ...rule, netRefundRate: '0.2' }], [{ ...rule, minGrossPrice: '200', maxGrossPriceExclusive: '100' }]]) {
    assert.equal(selectRefundRule(rules, context).kind, 'unavailable');
  }
});
test('Calculator revalidates sample refund bounds and VAT agreement', () => {
  assert.equal(calculate({ ...input, refund: { kind: 'sample', ruleId: 'bad', rate: '0.2', vatRate: '0.2', assumptions: [] } }).status, 'invalid');
  assert.equal(calculate({ ...input, vatRate: '0.1' }).status, 'invalid');
});
