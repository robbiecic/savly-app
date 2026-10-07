import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withHomeCurrency, automaticFx, compare, editForm, fxLabel, newForm, resetOverrides, type ComparisonForm } from '../src/features/comparison/model';
import { openShare, shareLink, shareMessage } from '../src/features/comparison/sharing';
import { ReferenceStore } from '../src/data/reference-store';
import { createMockTransport, SAMPLE_RESPONSES } from '../src/data/transport';
import { PreferenceStore, initialPreferences } from '../src/storage/preferences';
import type { Snapshot } from '../src/data/reference-data';
import { validateReferenceData } from '../src/data/reference-data';

const snapshot: Snapshot = { ...validateReferenceData(SAMPLE_RESPONSES['/v1/rates'], SAMPLE_RESPONSES['/v1/countries']), adapterVersion: 1, environment: 'test', mode: 'sample', id: 'sample-1', fetchedAt: 1000 };
const reference = { status: 'fresh' as const, snapshot, label: 'Sample rate' as const, error: null };
const form: ComparisonForm = { ...newForm(), price: '120', homePrice: '150', residence: 'US' };
function ready(changes: Partial<ComparisonForm> = {}, state = reference, locale = 'en-US') {
  const view = compare({ ...form, ...changes }, state, locale, Date.parse('2026-10-07T12:00:00Z'));
  if (view.status !== 'ready') assert.fail(view.message);
  return view.comparison;
}
test('AC12 complete automatic comparison from cached backend-shaped data', () => {
  const { result } = ready();
  assert.equal(result.withoutRefund, '132.00'); assert.equal(result.withRefund, '110.00');
  assert.equal(result.refundHome, '22.00'); assert.equal(result.savings?.amount, '40.00');
  assert.equal(result.bankFee, '0'); assert.equal(result.fx.kind, 'sample');
});
test('FX direction: direct, inverted, same currency and no triangulation', () => {
  const s = { ...snapshot, rates: [{ ...snapshot.rates[0], rate: 1.25 }] };
  assert.equal(automaticFx(s, 'EUR', 'USD')?.rate, '1.25');
  assert.equal(automaticFx(s, 'USD', 'EUR')?.rate, '0.8');
  assert.equal(automaticFx(s, 'EUR', 'EUR')?.rate, '1');
  assert.equal(automaticFx(snapshot, 'EUR', 'JPY'), null);
  assert.match(fxLabel(automaticFx(s, 'USD', 'EUR')!), /1 USD = 0.8 EUR · Sample rate/);
});
test('Reverse quotes remain calculable when reciprocals repeat beyond 18 decimal places', () => {
  const value = ready({ country: 'US', homeCurrency: 'EUR', price: '110', refundOverride: '0', homePrice: '' });
  assert.equal(value.result.convertedCost, '100.00');
  assert.equal(value.result.fx.originalRate, '1.1'); assert.equal(value.result.fx.inverted, true);
});
test('AC13 legacy fees ignored, overrides, automatic reset and context changes', () => {
  assert.equal(ready({ feePercent: '3' }).result.withRefund, '110.00');
  assert.equal(ready({ fxOverride: '2', refundOverride: '10' }).result.withRefund, '220.00');
  const overridden = { ...form, fxOverride: '2', refundOverride: '10' };
  for (const field of ['price', 'country', 'homeCurrency', 'residence'] as const) {
    const changed = editForm(overridden, field, 'changed');
    assert.equal(changed.fxOverride, ''); assert.equal(changed.refundOverride, '');
  }
  assert.equal(editForm(overridden, 'homePrice', '100').fxOverride, '2');
  assert.equal(compare(resetOverrides(overridden), reference).status, 'ready');
  assert.equal(ready(resetOverrides(overridden)).result.withRefund, '110.00');
});
test('AC14 loading, unavailable, missing pair, invalid, empty and unknown refund states', () => {
  assert.equal(compare(form, null).status, 'loading');
  assert.equal(compare(form, { status: 'unavailable', snapshot: null, label: 'Reference data unavailable', error: 'network' }).status, 'unavailable');
  assert.equal(compare({ ...form, price: '' }, reference).status, 'empty');
  assert.equal(compare({ ...form, price: '0' }, reference).status, 'invalid');
  assert.equal(compare({ ...form, homeCurrency: 'JPY' }, reference).status, 'invalid');
  assert.equal(ready({ residence: '' }).result.refund.kind, 'scheme');
  assert.equal(ready({ residence: 'FR' }).result.withRefund, '110.00');
});
test('AC15 locale normalizes decimal separator without inferring residency from currency', () => {
  assert.equal(ready({ price: '120,00', feePercent: '3,0' }, reference, 'fr-FR').result.withRefund, '110.00');
  assert.equal(compare({ ...form, price: '1,200' }, reference, 'en-US').status, 'invalid');
  assert.equal(initialPreferences().homeCurrency, '');
  assert.equal(initialPreferences().residence, '');
});
test('AC15 settings persist separately from item inputs and comparison overrides', async () => {
  let stored = '';
  const storage = { async getItem() { return stored || null; }, async setItem(_key: string, value: string) { stored = value; } };
  const store = new PreferenceStore(storage);
  await store.save({ country: 'JP', homeCurrency: 'USD', residence: 'US', feePercent: '3' });
  assert.deepEqual(await new PreferenceStore(storage).load(), { country: 'JP', homeCurrency: 'USD', residence: 'US', feePercent: '0' });
  assert.ok(!stored.includes('price')); stored = '{bad'; assert.equal(await store.load(), null);
});
test('AC16 removed countries block new estimates; history snapshots retain original values', () => {
  const old = ready();
  const next = { ...reference, snapshot: { ...snapshot, countries: snapshot.countries.filter((row) => row.country !== 'FR') } };
  assert.equal(compare(form, next).status, 'invalid'); assert.equal(old.result.withRefund, '110.00');
});
test('AC17–18 refresh recalculates active result, stale flags survive and edits/sharing make no requests', async () => {
  let now = 1000; let rate = 1.1; let offline = false; const calls: string[] = []; let raw: string | null = null;
  const store = new ReferenceStore({ mode: 'sample', environment: 'test', clock: { now: () => now, monotonic: () => now }, storage: {
    async getItem() { return raw; }, async setItem(_key, value) { raw = value; },
  }, transport: createMockTransport((path) => {
    calls.push(path); if (offline) throw new Error('offline');
    return path === '/v1/rates' ? { rates: [{ ...snapshot.rates[0], rate }] } : SAMPLE_RESPONSES[path];
  }) });
  const first = await store.get();
  const old = compare(form, first, 'en-US', Date.parse('2026-10-07T12:00:00Z')); assert.equal(old.status, 'ready');
  for (const price of ['120', '200']) { const view = compare({ ...form, price }, await store.get()); if (view.status === 'ready') shareMessage(view.comparison, shareLink()); }
  assert.equal(calls.length, 2);
  now += 14_400_000; offline = true;
  const stale = compare(form, await store.get(), 'en-US', Date.parse('2026-10-07T12:00:00Z')); assert.equal(stale.status === 'ready' && stale.comparison.stale, true);
  offline = false; rate = 2;
  const fresh = compare(form, await store.retry(), 'en-US', Date.parse('2026-10-07T12:00:00Z'));
  assert.equal(fresh.status === 'ready' && fresh.comparison.result.withRefund, '200.00');
  assert.equal(old.status === 'ready' && old.comparison.result.withRefund, '110.00');
});
test('SH1 and SH3: text matches displayed result and preserves qualifications', () => {
  const message = shareMessage(ready({ itemName: 'Travel bag' }), shareLink());
  for (const text of ['USD 40.00 (26.7%)', 'USD 132.00', 'USD 22.00', 'USD 110.00', 'Item: Travel bag', 'Sample estimate', 'Demo link only', 'https://example.com/app', 'Monthly subscription', 'Excludes customs/import taxes']) assert.ok(message.includes(text), text);
  assert.match(shareMessage(ready({ homePrice: '' }), shareLink()), /overseas shopping estimate/);
  assert.match(shareMessage(ready({ homePrice: '100' }), shareLink()), /USD 10.00 more/);
  assert.match(shareMessage(ready({ homePrice: '110.00' }), shareLink()), /Same estimated cost/);
  assert.match(shareMessage(ready({ residence: 'FR' }), shareLink()), /Assumes all included VAT/);
  const manual = shareMessage({ ...ready({ fxOverride: '1.2', refundOverride: '10' }), stale: true }, shareLink());
  assert.match(manual, /Manual rate/); assert.match(manual, /Manual refund/); assert.doesNotMatch(manual, /Rates out of date/);
});
test('SH4 share cancel and failure leave result unchanged; retries are possible', async () => {
  const value = ready(); const before = JSON.stringify(value); const message = shareMessage(value, shareLink());
  assert.equal(await openShare(message, async () => ({ action: 'dismissedAction' })), 'closed');
  assert.equal(await openShare(message, async () => { throw new DOMException('cancel', 'AbortError'); }), 'closed');
  assert.equal(await openShare(message, async () => { throw new Error('failed'); }), 'failed');
  assert.equal(await openShare(message, async () => ({})), 'closed'); assert.equal(JSON.stringify(value), before);
});
test('Share URL accepts only generic HTTPS app links without private parameters', () => {
  for (const url of ['http://example.com/app', 'https://example.com/app?price=120', 'https://secret@example.com/app', 'https://example.com/app#history', 'https://example.com/history/123']) assert.throws(() => shareLink(url));
  assert.equal(shareLink('https://example.org/app').demo, false);
});

test('Home currency follows reference country data and clears amounts when units change', () => {
  const old = { ...form, fxOverride: '2', refundOverride: '10' };
  const euro = withHomeCurrency(editForm(old, 'residence', 'FR'), snapshot);
  assert.equal(euro.homeCurrency, 'EUR');
  assert.equal(euro.homePrice, '');
  assert.equal(euro.fxOverride, '');
  assert.equal(euro.refundOverride, '');
  assert.equal(compare({ ...euro, refundOverride: '0' }, reference).status, 'ready');
  const result = ready({ ...euro, refundOverride: '0' }).result;
  assert.equal(result.withoutRefund, '120.00');
  assert.equal(result.homeCurrency, 'EUR');
  assert.equal(withHomeCurrency(old, snapshot), old);
  assert.equal(withHomeCurrency({ ...old, residence: '' }, snapshot).homeCurrency, '');
  assert.equal(withHomeCurrency({ ...old, residence: 'CA' }, snapshot).homeCurrency, '');
  assert.equal(withHomeCurrency(old, { ...snapshot, countries: snapshot.countries.filter(c => c.country !== 'US') }).homeCurrency, '');
  assert.equal(withHomeCurrency({ ...old, homeCurrency: 'GBP' }, snapshot).homeCurrency, 'USD');
});

test('Legacy fee preferences cannot charge new comparisons or appear in shares', () => {
  assert.equal(newForm({ ...form, feePercent: '3' }).feePercent, '0');
  for (const feePercent of ['3', 'invalid']) {
    const comparison = ready({ feePercent });
    assert.equal(comparison.result.cardFee, '0.00');
    assert.equal(comparison.result.savings?.amount, '40.00');
    assert.doesNotMatch(shareMessage(comparison, shareLink()), /bank fee/i);
  }
});
