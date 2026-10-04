import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FX_STALE_AFTER_MS, isRateStale, isFxStale } from '../src/data/fx-freshness';
import { compare, newForm } from '../src/features/comparison/model';
import { validateReferenceData } from '../src/data/reference-data';
import { SAMPLE_RESPONSES } from '../src/data/transport';

const now = Date.parse('2026-10-03T12:00:00Z');
test('Rate age is stale only beyond 48 hours, with undated/future timestamps unverified', () => {
  for (const age of [0, FX_STALE_AFTER_MS - 1, FX_STALE_AFTER_MS, FX_STALE_AFTER_MS + 1]) {
    assert.equal(isRateStale(new Date(now - age).toISOString(), now), age > FX_STALE_AFTER_MS);
  }
  assert.equal(isRateStale(null, now), true);
  assert.equal(isRateStale('invalid', now), true);
  assert.equal(isRateStale(new Date(now + 1).toISOString(), now), true);
});
test('Selected FX age is independent of cache age for API, defaults, direct and reversed quotes', () => {
  const form = { ...newForm(), residence: 'US', price: '120', homePrice: '150' };
  for (const environment of ['prototype', 'local:http://localhost:3000']) {
    for (const cacheStatus of ['fresh', 'stale'] as const) {
      for (const age of [2 * 60 * 60 * 1000, FX_STALE_AFTER_MS + 1]) {
        const data = validateReferenceData({ rates: [{ ...SAMPLE_RESPONSES['/v1/rates'].rates[0], asOf: new Date(now - age).toISOString() }] }, SAMPLE_RESPONSES['/v1/countries']);
        const snapshot = { ...data, adapterVersion: 1 as const, environment, mode: 'sample' as const, id: 'test', fetchedAt: now };
        const reference = { status: cacheStatus, snapshot, label: 'Sample rate' as const, error: null };
        for (const changes of [{}, { country: 'US', homeCurrency: 'EUR' }]) {
          const view = compare({ ...form, ...changes }, reference, 'en-US', now);
          assert.equal(view.status, 'ready');
          if (view.status === 'ready') assert.equal(view.comparison.stale, age > FX_STALE_AFTER_MS);
        }
        const manual = compare({ ...form, fxOverride: '1.1' }, reference, 'en-US', now);
        assert.equal(manual.status === 'ready' && manual.comparison.stale, false);
      }
    }
  }
});
test('Same-currency comparisons do not use stale FX', () => {
  assert.equal(isFxStale({ from: 'USD', to: 'USD', rate: '1', kind: 'reference', source: 'Same currency', asOf: null }, now), false);
});
