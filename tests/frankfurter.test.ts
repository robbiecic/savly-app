import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frankfurterBaseCurrency, frankfurterRates, createFrankfurterTransport } from '../src/data/frankfurter-transport';
import { ReferenceStore, CACHE_TTL_MS } from '../src/data/reference-store';
import { isFxStale } from '../src/data/fx-freshness';
import { countryCodes, countryCurrencyCodes, createCountryTransport, currencyForCountry, expandCountryData } from '../src/data/country-catalog';
import defaultCountries from '../src/data/default-countries.json';
import englishNames from '../src/features/comparison/country-names.en.json';
import { automaticFx, compare, newForm } from '../src/features/comparison/model';
import { validateReferenceData } from '../src/data/reference-data';

const day = '2026-11-14';
const quotes = { AUD: 1.5, EUR: 0.8, GBP: 0.7, JPY: 150 };
const rows = () => Object.entries(quotes).map(([quote, rate]) => ({ date: day, base: 'USD', quote, rate }));

test('Frankfurter base direction gives home currency per shopping currency', () => {
  assert.equal(frankfurterBaseCurrency('AED'), 'AED');
  const rates = frankfurterRates(rows(), 'USD');
  assert.deepEqual(rates.rates.find(row => (row as { pair: string }).pair === 'USDEUR'), {
    pair: 'USDEUR', rate: 0.8, pipSize: null, asOf: day, source: 'Frankfurter',
  });
  assert.throws(() => frankfurterRates([{ ...rows()[0], rate: 0 }], 'USD'));
  assert.throws(() => frankfurterRates([{ ...rows()[0], base: 'EUR' }], 'USD'));
  assert.equal(frankfurterRates(rows().slice(1), 'USD').rates.length, 3);
});

test('shopping and home pickers share the country catalog, with unknown VAT left unknown', () => {
  assert.deepEqual(countryCodes, Object.keys(englishNames).sort());
  assert.equal(countryCodes.length, 249);
  assert.equal(currencyForCountry('AE'), 'AED');
  assert.equal(currencyForCountry('AQ'), null);
  const countries = expandCountryData(defaultCountries).countries;
  assert.equal(countries.length, 248);
  assert.equal(countries.find(country => country.country === 'AE')?.vatRate, null);
  assert.equal(countries.find(country => country.country === 'FR')?.vatRate, 0.2);
});

test('UAE shopping converts with Frankfurter without inventing a VAT refund', () => {
  const data = validateReferenceData(frankfurterRates([{ date: day, base: 'USD', quote: 'AED', rate: 4 }], 'USD'), expandCountryData(defaultCountries));
  const snapshot = { ...data, adapterVersion: 1 as const, environment: 'frankfurter:guest:USD', mode: 'real' as const, id: 'aed-example', fetchedAt: Date.parse('2026-11-15T12:00:00Z') };
  const result = compare({ ...newForm(), country: 'AE', residence: 'US', homeCurrency: 'USD', price: '100', homePrice: '30' },
    { status: 'fresh', snapshot, label: 'Reference rate', error: null }, 'en-US', Date.parse('2026-11-15T12:00:00Z'));
  assert.equal(result.status, 'ready');
  if (result.status === 'ready') {
    assert.equal(result.comparison.result.withoutRefund, '25.00');
    assert.equal(result.comparison.result.refund.kind, 'vat-unavailable');
    assert.equal(result.comparison.result.withRefund, null);
    assert.equal(result.comparison.result.fx.originalPair, 'USDAED');
  }
});

test('Frankfurter rates persist for four hours and refresh at expiry', async () => {
  let now = Date.parse('2026-11-15T12:00:00Z');
  let calls = 0;
  let eurPerUsd = 0.8;
  const values = new Map<string, string>();
  const storage = { async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); } };
  const fetcher = async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get('base'), 'USD');
    assert.deepEqual(url.searchParams.get('quotes')?.split(',').sort(), countryCurrencyCodes.filter(code => code !== 'USD'));
    calls++;
    return { ok: true, json: async () => rows().map(row => row.quote === 'EUR' ? { ...row, rate: eurPerUsd } : row) } as Response;
  };
  const options = { environment: 'frankfurter:guest:USD', mode: 'real' as const, storage,
    clock: { now: () => now, monotonic: () => now },
    transport: createFrankfurterTransport({ baseCurrency: 'USD', countries: createCountryTransport(), fetcher: fetcher as typeof fetch }) };
  const store = new ReferenceStore(options);
  const first = await store.get();
  assert.equal(calls, 1);
  assert.equal(first.snapshot?.rates.length, 4);
  assert.equal(first.snapshot?.countries.length, 248);
  const fx = automaticFx(first.snapshot!, 'EUR', 'USD');
  assert.equal(fx?.rate, '1.25');
  assert.equal(fx?.originalPair, 'USDEUR');
  assert.equal(fx?.inverted, true);
  assert.equal(isFxStale(fx!, Date.parse('2026-11-17T00:00:00Z')), false);
  assert.equal(isFxStale(fx!, Date.parse('2026-11-17T00:00:00.001Z')), true);
  const result = compare({ ...newForm(), country: 'FR', residence: 'US', homeCurrency: 'USD', price: '120', homePrice: '150' }, first, 'en-US', now);
  assert.equal(result.status, 'ready');
  if (result.status === 'ready') assert.equal(result.comparison.result.withoutRefund, '150.00');
  now += CACHE_TTL_MS - 1;
  assert.equal((await new ReferenceStore(options).get()).snapshot?.id, first.snapshot?.id);
  assert.equal(calls, 1);
  now++; eurPerUsd = 0.75;
  const refreshed = await store.get();
  assert.equal(calls, 2);
  assert.match(automaticFx(refreshed.snapshot!, 'EUR', 'USD')?.rate ?? '', /^1\.3333/);
});
