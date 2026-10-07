import assert from 'node:assert/strict';
import { test } from 'node:test';
import defaults from '../src/data/default-countries.json';
import { validateReferenceData, parseSnapshot, DataError } from '../src/data/reference-data';
import { assessTouristRefund } from '../src/domain/tourist-refunds';
import { compare, newForm } from '../src/features/comparison/model';
import { SAMPLE_RESPONSES } from '../src/data/transport';
import { SavedComparisonStore } from '../src/storage/saved-comparisons';
import { shareMessage, shareLink } from '../src/features/comparison/sharing';
const now = Date.parse('2026-10-07T12:00:00Z');
const data = validateReferenceData(SAMPLE_RESPONSES['/v1/rates'], defaults);
const country = (code: string) => data.countries.find(c => c.country === code)!;
const snapshot = { ...data, adapterVersion: 1 as const, environment: 'api', mode: 'real' as const, id: 'refund-test', fetchedAt: now };
function comparison(code: string, price: string, at = now, override = '') {
  const view = compare({ ...newForm(), country: code, residence: 'US', homeCurrency: code === 'GB' ? 'EUR' : 'USD', price, homePrice: '500', refundOverride: override },
    { snapshot, status: 'fresh', label: 'Reference rate', error: null }, 'en-US', at);
  if (view.status !== 'ready') assert.fail(view.message);
  return view.comparison;
}
test('Exact gross/net boundaries: France, Australia, Portugal, Latvia, Japan and no-minimum Spain', () => {
  for (const [code, below, pass] of [['FR', '100', '100.01'], ['AU', '299.99', '300'], ['PT', '61.49', '61.50'], ['LV', '42.34', '42.35'], ['JP', '5499', '5500'], ['ES', null, '0.01']] as const) {
    if (below) assert.equal(assessTouristRefund(country(code), below, now).status, 'excluded', code);
    assert.equal(assessTouristRefund(country(code), pass, now).status, 'potential', code);
  }
  assert.equal(assessTouristRefund(country('JP'), '5000', now).status, 'excluded');
});
test('No scheme, unconfirmed region, absent rules and overdue rules remain distinct', () => {
  assert.equal(assessTouristRefund(country('US'), '100', now).status, 'excluded');
  assert.equal(assessTouristRefund(country('GB'), '1000', now).status, 'unknown');
  assert.equal(assessTouristRefund({ vatRate: .2 }, '1000', now).status, 'unknown');
  assert.equal(assessTouristRefund(country('JP'), '5500', Date.parse('2026-10-31T23:59:59Z')).status, 'potential');
  assert.equal(assessTouristRefund(country('JP'), '5500', Date.parse('2026-11-01T00:00:00Z')).status, 'unknown');
});
test('Savings exclude blocked refunds and unknown refunds; manual amounts remain explicit', () => {
  const below = comparison('FR', '100');
  assert.equal(below.result.refundHome, '0.00');
  assert.equal(below.result.withRefund, '110.00');
  assert.equal(below.result.savings?.amount, '390.00');
  const above = comparison('FR', '100.01');
  assert.equal(above.result.refundShopping, '16.67');
  assert.equal(comparison('FR', '120.01').result.refundShopping, '20.00');
  assert.equal(comparison('JP', '5501').result.refundShopping, '500');
  assert.equal(comparison('US', '100', now, '50').result.refundHome, '0.00');
  const expired = comparison('FR', '120', Date.parse('2027-01-07'));
  assert.equal(expired.result.refundHome, null);
  assert.equal(expired.result.savings?.amount, '368.00');
  assert.equal(comparison('US', '100').result.refundHome, '0.00');
  assert.equal(comparison('GB', '100').result.refundHome, null);
  const manual = comparison('FR', '100', now, '10');
  assert.equal(manual.result.refund.kind, 'manual');
  assert.equal(manual.refundAssessment?.status, 'excluded');
  assert.match(shareMessage(below, shareLink()), /does not meet the minimum/);
  assert.match(shareMessage(expired, shareLink()), /need confirmation/);
});
test('Validate, deeply freeze and persist all 24 country records and regional/source details', () => {
  assert.equal(data.countries.length, 24);
  const roundtrip = parseSnapshot(JSON.stringify(snapshot), 'api', 'real');
  assert.deepEqual(roundtrip.countries, data.countries);
  assert.equal(roundtrip.countries.find(c => c.country === 'GB')?.touristRefund?.regionalSchemes?.[0].regionCode, 'GB-NIR');
  assert.ok(Object.isFrozen(country('FR').touristRefund?.minimumPurchase));
  assert.ok(Object.isFrozen(country('FR').touristRefund?.sources[0]));
  assert.equal(validateReferenceData({ rates: [] }, { countries: [{ country: 'FR', currency: 'EUR', vatRate: .2 }] }).countries[0].touristRefund, undefined);
});
test('Reject malformed thresholds, currency mismatches, enums, dates and unsafe source links', () => {
  for (const change of [
    { minimumPurchase: { ...country('FR').touristRefund!.minimumPurchase, amount: -1 } },
    { minimumPurchase: { ...country('FR').touristRefund!.minimumPurchase, currency: 'USD' } },
    { minimumPurchase: { ...country('FR').touristRefund!.minimumPurchase, comparison: 'maybe' } },
    { minimumPurchase: null }, { status: 'unknown' }, { reviewedOn: '2026-02-30' },
    { reviewAfter: '2020-01-01' }, { sources: [{ title: 'Bad', url: 'javascript:alert(1)' }] },
    { sources: [{ title: 'Bad', url: 'not-a-url' }] },
  ]) assert.throws(() => validateReferenceData({ rates: [] }, { countries: [{ ...country('FR'), touristRefund: { ...country('FR').touristRefund, ...change } }] }), DataError);
});
test('Saved results preserve the assessed threshold and provenance through reopening', async () => {
  let raw: string | null = null;
  const storage = { async getItem() { return raw; }, async setItem(_key: string, value: string) { raw = value; } };
  const store = new SavedComparisonStore(storage);
  const c = { ...comparison('FR', '100'), itemName: 'Bag' };
  await store.save({ id: 'item', savedAt: new Date(now).toISOString(), form: { ...newForm(), itemName: 'Bag' }, comparison: c });
  const reopened = (await new SavedComparisonStore(storage).list())[0].comparison;
  assert.deepEqual(reopened, c);
  comparison('FR', '120');
  assert.equal(reopened.result.refundHome, '0.00');
  assert.equal(reopened.refundCountry?.touristRefund?.minimumPurchase?.comparison, 'gt');
});

test('Four-hour cache retains refund metadata and rejects a malformed partial refresh atomically', async () => {
  const { ReferenceStore, CACHE_TTL_MS } = await import('../src/data/reference-store');
  let time = now, calls = 0, malformed = false, raw: string | null = null;
  const storage = { async getItem() { return raw; }, async setItem(_key: string, value: string) { raw = value; } };
  const options = { mode: 'real' as const, environment: 'thresholds', storage,
    clock: { now: () => time, monotonic: () => time },
    transport: { async get(path: '/v1/rates' | '/v1/countries') {
      calls++;
      if (path === '/v1/rates') return SAMPLE_RESPONSES[path];
      return malformed ? { countries: [{ ...country('FR'), touristRefund: { ...country('FR').touristRefund, minimumPurchase: { amount: 0 } } }] } : defaults;
    } },
  };
  const first = await new ReferenceStore(options).get();
  const restarted = new ReferenceStore(options);
  time += CACHE_TTL_MS - 1;
  assert.deepEqual((await restarted.get()).snapshot?.countries, first.snapshot?.countries);
  assert.equal(calls, 2);
  time++; malformed = true;
  const failed = await restarted.get();
  assert.equal(calls, 4);
  assert.equal(failed.error, 'invalid-data');
  assert.equal(failed.status, 'stale');
  assert.deepEqual(failed.snapshot, first.snapshot);
});
