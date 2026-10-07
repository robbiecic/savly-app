import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectReferenceStore } from '../src/data/development-reference-store';
import { GUEST_RESPONSES, SAMPLE_RESPONSES } from '../src/data/transport';
import { validateReferenceData } from '../src/data/reference-data';
import { compare, newForm, withHomeCurrency, automaticFx } from '../src/features/comparison/model';

function storage() {
  const values = new Map<string, string>();
  return { values, async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); } };
}

test('guest defaults support all 36 country combinations, retain provenance and survive restart', async () => {
  const disk = storage();
  const store = await selectReferenceStore({ baseUrl: null, storage: disk });
  const reference = await store.get();
  const snapshot = reference.snapshot!;
  assert.equal(snapshot.rates.length, 10);
  assert.equal(snapshot.countries.length, 6);
  for (const home of snapshot.countries) for (const shopping of snapshot.countries) {
    const form = withHomeCurrency({ ...newForm(), country: shopping.country, residence: home.country, price: '10000', homePrice: '20000' }, snapshot);
    const result = compare(form, reference, 'en-US', Date.parse('2026-10-07T12:00:00Z'));
    assert.equal(result.status, 'ready', `${home.country}/${shopping.country}`);
    if (result.status === 'ready') {
      assert.equal(result.comparison.stale, home.currency !== shopping.currency);
      assert.equal(result.comparison.result.fx.kind, home.currency === shopping.currency ? 'reference' : 'sample');
      assert.ok(result.comparison.refundCountry?.touristRefund);
    }
  }
  const direct = automaticFx(snapshot, 'GBP', 'AUD')!;
  assert.equal(direct.rate, '1.9');
  assert.equal(direct.asOf, null);
  assert.equal(direct.source, 'Owner-provided defaults');
  const reverse = automaticFx(snapshot, 'AUD', 'GBP')!;
  assert.equal(reverse.originalRate, '1.9');
  assert.equal(reverse.inverted, true);
  const gb = compare({ ...newForm(), country: 'GB', residence: 'US', homeCurrency: 'USD', price: '100', homePrice: '200' }, reference, 'en-US', Date.parse('2026-10-07T12:00:00Z'));
  assert.equal(gb.status, 'ready');
  if (gb.status === 'ready') {
    assert.equal(gb.comparison.result.withoutRefund, '132.00');
    assert.equal(gb.comparison.result.savings?.amount, '68.00');
  }
  const restarted = await selectReferenceStore({ baseUrl: null, storage: disk });
  assert.deepEqual((await restarted.get()).snapshot, snapshot);
});

test('owner defaults are rejected by the strict API validator', () => {
  assert.throws(() => validateReferenceData(GUEST_RESPONSES['/v1/rates'], GUEST_RESPONSES['/v1/countries']));
  assert.equal(validateReferenceData(SAMPLE_RESPONSES['/v1/rates'], SAMPLE_RESPONSES['/v1/countries']).rates.length, 4);
});

test('fresh old guest cache cannot hide newly bundled pairs', async () => {
  const disk = storage();
  disk.values.set('savly:reference:1:prototype:sample', JSON.stringify({
    ...validateReferenceData(SAMPLE_RESPONSES['/v1/rates'], SAMPLE_RESPONSES['/v1/countries']),
    adapterVersion: 1, environment: 'prototype', mode: 'sample', id: 'old', fetchedAt: Date.now(),
  }));
  const store = await selectReferenceStore({ baseUrl: null, storage: disk });
  assert.equal((await store.get()).snapshot?.rates.length, 10);
});
