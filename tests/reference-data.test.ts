import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CACHE_TTL_MS, ReferenceStore, type Scheduler, type Storage } from '../src/data/reference-store';
import { DataError, selectedCountry, validateReferenceData } from '../src/data/reference-data';
import { createHttpTransport, createMockTransport, SAMPLE_RESPONSES, type ReferencePath } from '../src/data/transport';

class FakeTime implements Scheduler {
  wall = Date.parse('2026-09-29T12:00:00Z');
  mono = 0;
  jobs = new Set<{ at: number; callback: () => void }>();
  now = () => this.wall;
  monotonic = () => this.mono;
  schedule(callback: () => void, delayMs: number) {
    const job = { at: this.mono + delayMs, callback };
    this.jobs.add(job);
    return () => { this.jobs.delete(job); };
  }
  advance(ms: number) {
    this.wall += ms; this.mono += ms;
    for (const job of [...this.jobs]) if (job.at <= this.mono) { this.jobs.delete(job); job.callback(); }
  }
}
class MemoryStorage implements Storage {
  values = new Map<string, string>();
  writes = 0;
  failWrite = false;
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) {
    if (this.failWrite) throw new Error('Disk unavailable');
    this.writes++; this.values.set(key, value);
  }
}
function setup(storage = new MemoryStorage(), clock = new FakeTime()) {
  const calls: ReferencePath[] = [];
  const responses = JSON.parse(JSON.stringify(SAMPLE_RESPONSES)) as typeof SAMPLE_RESPONSES;
  let failure: Error | null = null;
  let badPath: ReferencePath | null = null;
  const transport = createMockTransport(async (path) => {
    calls.push(path);
    if (failure && (!badPath || badPath === path)) throw failure;
    return responses[path];
  });
  const options = { environment: 'test', mode: 'sample' as const, storage, clock, scheduler: clock, transport };
  return { store: new ReferenceStore(options), options, clock, storage, calls, responses,
    fail(error: Error | null, path: ReferencePath | null = null) { failure = error; badPath = path; },
  };
}

test('First load calls exactly two endpoints; price/country edits reuse one snapshot until 3:59:59', async () => {
  const h = setup();
  const first = await h.store.get();
  assert.equal(first.status, 'fresh');
  assert.equal(first.label, 'Sample rate');
  assert.deepEqual(h.calls, ['/v1/rates', '/v1/countries']);
  for (const code of ['FR', 'US', 'FR']) {
    const state = await h.store.get();
    assert.equal(state.snapshot, first.snapshot);
    assert.equal(selectedCountry(state.snapshot!, code)?.country, code);
  }
  h.clock.advance(CACHE_TTL_MS - 1000);
  assert.equal((await h.store.get()).snapshot, first.snapshot);
  assert.equal(h.calls.length, 2);
  assert.equal(h.storage.writes, 1);
});
test('At exactly four hours simultaneous consumers share one refresh cycle', async () => {
  const h = setup();
  await Promise.all(Array.from({ length: 10 }, () => h.store.get()));
  assert.equal(h.calls.length, 2);
  h.clock.advance(CACHE_TTL_MS);
  const results = await Promise.all(Array.from({ length: 10 }, () => h.store.get()));
  assert.equal(h.calls.length, 4);
  assert.ok(results.every((result) => result.snapshot === results[0].snapshot));
  assert.equal(h.storage.writes, 2);
});
test('A new store restores the persisted snapshot without resetting fetchedAt or making requests', async () => {
  const h = setup();
  const first = await h.store.get();
  h.clock.advance(CACHE_TTL_MS - 1);
  const restarted = new ReferenceStore(h.options);
  assert.deepEqual((await restarted.get()).snapshot, first.snapshot);
  assert.equal(h.calls.length, 2);
  h.clock.advance(1);
  assert.equal((await restarted.get()).status, 'fresh');
  assert.equal(h.calls.length, 4);
});
test('Offline first launch is unavailable; recovery via Retry works', async () => {
  const h = setup(); h.fail(new Error('offline'));
  assert.equal((await h.store.get()).status, 'unavailable');
  await h.store.get(); assert.equal(h.calls.length, 2);
  h.fail(null);
  assert.equal((await h.store.retry()).status, 'fresh');
  assert.equal(h.calls.length, 4);
});
test('Expired offline data retains timestamps and labels; refresh does not alter saved snapshot', async () => {
  const h = setup(); const first = await h.store.get();
  const saved = JSON.stringify(first.snapshot);
  h.clock.advance(CACHE_TTL_MS); h.fail(new Error('offline'));
  const stale = await h.store.get();
  assert.equal(stale.status, 'stale'); assert.equal(stale.label, 'Rates out of date');
  assert.equal(stale.snapshot, first.snapshot); assert.equal(h.storage.writes, 1);
  h.fail(null); h.responses['/v1/rates'].rates[0].rate = 1.25;
  const recovered = await h.store.retry();
  assert.equal(recovered.status, 'fresh'); assert.notEqual(recovered.snapshot?.id, first.snapshot?.id);
  assert.equal(JSON.stringify(first.snapshot), saved);
  assert.ok(Object.isFrozen(first.snapshot?.rates[0]));
});
test('A country appears or disappears only after refresh; null VAT is preserved', async () => {
  const h = setup(); const first = (await h.store.get()).snapshot!;
  assert.equal(selectedCountry(first, 'US')?.vatRate, null);
  h.responses['/v1/countries'].countries = [{ country: 'CA', currency: 'CAD', vatRate: 0.1 }];
  assert.equal(selectedCountry((await h.store.get()).snapshot!, 'CA'), null);
  h.clock.advance(CACHE_TTL_MS);
  const next = (await h.store.get()).snapshot!;
  assert.equal(selectedCountry(next, 'CA')?.currency, 'CAD');
  assert.equal(selectedCountry(next, 'FR'), null);
  assert.equal(selectedCountry(first, 'FR')?.country, 'FR');
});
test('Partial failure never publishes or persists half a snapshot', async () => {
  const h = setup(); const before = await h.store.get();
  h.clock.advance(CACHE_TTL_MS); h.responses['/v1/rates'].rates[0].rate = 2;
  h.fail(new Error('countries failed'), '/v1/countries');
  assert.equal((await h.store.get()).snapshot, before.snapshot);
  assert.equal(h.storage.writes, 1);
});
test('Malformed refreshed payload cannot replace valid cache', async () => {
  const h = setup(); const before = await h.store.get();
  h.clock.advance(CACHE_TTL_MS); h.responses['/v1/rates'].rates[0].rate = -1;
  const state = await h.store.get();
  assert.equal(state.error, 'invalid-data'); assert.equal(state.snapshot, before.snapshot);
});
test('Corrupt or incompatible persistent cache is discarded and fetched', async () => {
  for (const raw of ['broken JSON', '{}', JSON.stringify({ adapterVersion: 999 })]) {
    const h = setup(); h.storage.values.set(h.store.key, raw);
    assert.equal((await h.store.get()).status, 'fresh'); assert.equal(h.calls.length, 2);
  }
});
test('Environment and mode separate persisted caches', async () => {
  const h = setup(); await h.store.get();
  const real = new ReferenceStore({ ...h.options, mode: 'real' });
  const another = new ReferenceStore({ ...h.options, environment: 'another' });
  assert.notEqual(real.key, h.store.key); assert.notEqual(another.key, h.store.key);
  await real.get(); await another.get(); assert.equal(h.calls.length, 6);
});
test('Clock rollback requires refresh even within TTL; monotonic time also expires frozen wall time', async () => {
  const h = setup(); await h.store.get();
  h.clock.wall -= 1000; await h.store.get(); assert.equal(h.calls.length, 4);
  h.clock.mono += CACHE_TTL_MS; await h.store.get(); assert.equal(h.calls.length, 6);
});
test('Future persisted timestamp is stale on restart and requires refresh', async () => {
  const h = setup(); await h.store.get(); h.clock.wall -= 1000;
  await new ReferenceStore(h.options).get(); assert.equal(h.calls.length, 4);
});
test('Automatic retries back off 1 minute, 5 minutes, then at most 15 minutes', async () => {
  const h = setup(); h.fail(new Error('offline')); await h.store.get();
  for (const delay of [60_000, 300_000, 900_000, 900_000]) {
    const before = h.calls.length;
    h.clock.advance(delay - 1); await h.store.get(); assert.equal(h.calls.length, before);
    h.clock.advance(1); await h.store.get(); assert.equal(h.calls.length, before + 2);
  }
});
test('401 stops automatic retries until explicit Retry with new credentials', async () => {
  const h = setup(); await h.store.get(); h.clock.advance(CACHE_TTL_MS);
  h.fail(new DataError('authentication', 'expired'));
  assert.equal((await h.store.get()).error, 'authentication');
  h.clock.advance(CACHE_TTL_MS * 10); await h.store.get(); assert.equal(h.calls.length, 4);
  h.fail(null); assert.equal((await h.store.retry()).status, 'fresh');
});
test('Active timer refreshes at expiry, pauses while suspended, resumes on foreground', async () => {
  const h = setup(); h.store.setActive(true); await h.store.get();
  assert.equal(h.clock.jobs.size, 1);
  h.clock.advance(CACHE_TTL_MS);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.calls.length, 4);
  h.store.setActive(false); assert.equal(h.clock.jobs.size, 0);
  h.clock.advance(CACHE_TTL_MS); assert.equal(h.calls.length, 4);
  h.store.setActive(true); await h.store.get(); assert.equal(h.calls.length, 6);
  h.store.setActive(false);
});
test('Subscribers receive recovery snapshots, and unsubscribe stops notifications', async () => {
  const h = setup(); const states: string[] = [];
  const unsubscribe = h.store.subscribe((state) => { if (states.at(-1) !== state.status) states.push(state.status); });
  await h.store.get(); h.clock.advance(CACHE_TTL_MS); h.fail(new Error('offline')); await h.store.get();
  h.fail(null); await h.store.retry(); assert.deepEqual(states, ['fresh', 'stale', 'fresh']);
  unsubscribe(); h.clock.advance(CACHE_TTL_MS); await h.store.get(); assert.equal(states.length, 3);
});
test('Storage write failure preserves the previous persisted snapshot and fetch timestamp', async () => {
  const h = setup(); const before = await h.store.get();
  h.clock.advance(CACHE_TTL_MS); h.storage.failWrite = true;
  const state = await h.store.get(); assert.equal(state.error, 'storage'); assert.equal(state.snapshot, before.snapshot);
});
test('Pending partial requests finish before another refresh may start', async () => {
  let complete!: (value: unknown) => void;
  const calls: string[] = [];
  const h = setup();
  const store = new ReferenceStore({ ...h.options, transport: { async get(path) {
    calls.push(path);
    if (path === '/v1/rates') throw new Error('offline');
    return new Promise((resolve) => { complete = resolve; });
  } } });
  const first = store.get();
  await new Promise((resolve) => setImmediate(resolve));
  const second = store.retry();
  complete(SAMPLE_RESPONSES['/v1/countries']);
  await Promise.all([first, second]); assert.equal(calls.length, 2);
});
test('Validator rejects duplicate codes/pairs, invalid numeric data and timestamps', () => {
  const rate = SAMPLE_RESPONSES['/v1/rates'].rates[0];
  const country = SAMPLE_RESPONSES['/v1/countries'].countries[0];
  for (const bad of [ { ...rate, rate: Infinity }, { ...rate, rate: '1.1' }, { ...rate, pipSize: 0 }, { ...rate, source: 'Mastercard' }, { ...rate, asOf: '2026-02-30T12:00:00Z' }, { ...rate, pair: 'EUR' } ]) {
    assert.throws(() => validateReferenceData({ rates: [bad] }, { countries: [country] }), DataError);
  }
  for (const bad of [{ ...country, vatRate: 1.1 }, { ...country, country: 'fr' }, { ...country, currency: 'EU' }]) {
    assert.throws(() => validateReferenceData({ rates: [rate] }, { countries: [bad] }), DataError);
  }
  assert.throws(() => validateReferenceData({ rates: [rate, rate] }, { countries: [country] }), DataError);
  assert.throws(() => validateReferenceData({ rates: [rate] }, { countries: [country, country] }), DataError);
  assert.deepEqual(validateReferenceData({ rates: [] }, { countries: [] }), { rates: [], countries: [] });
});
test('HTTP adapter only sends GET paths and authentication, no item inputs', async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const http = createHttpTransport({ baseUrl: 'https://example.test/', getToken: async () => 'test-token', fetcher: async (url, init) => {
    requests.push({ url: String(url), init }); return new Response(JSON.stringify(SAMPLE_RESPONSES['/v1/rates']));
  } });
  await http.get('/v1/rates');
  assert.equal(requests[0].url, 'https://example.test/v1/rates');
  assert.equal(requests[0].init?.method, 'GET'); assert.equal(requests[0].init?.body, undefined);
  assert.deepEqual(requests[0].init?.headers, { Authorization: 'Bearer test-token' });
});
test('HTTP failures and timeout produce structured failures without sample fallback', async () => {
  for (const status of [401, 500]) {
    const http = createHttpTransport({ baseUrl: 'https://example.test', fetcher: async () => new Response('{}', { status }) });
    await assert.rejects(http.get('/v1/rates'), (error: unknown) => error instanceof DataError && error.kind === (status === 401 ? 'authentication' : 'network'));
  }
  const http = createHttpTransport({ baseUrl: 'https://example.test', timeoutMs: 5, fetcher: async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  }) });
  await assert.rejects(http.get('/v1/rates'), DataError);
});

test('Active retry timer runs without input edits, and stops on authentication failure', async () => {
  const h = setup(); h.fail(new Error('offline')); h.store.setActive(true); await h.store.get();
  assert.equal(h.clock.jobs.size, 1);
  h.clock.advance(60_000);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.calls.length, 4);
  h.fail(new DataError('authentication', 'expired')); h.clock.advance(300_000);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.calls.length, 6); assert.equal(h.clock.jobs.size, 0);
  h.store.setActive(false);
});
test('A stalled token provider times out without making an unauthenticated request', async () => {
  let calls = 0;
  const transport = createHttpTransport({ baseUrl: 'https://example.test', timeoutMs: 5,
    getToken: () => new Promise(() => {}), fetcher: async () => { calls++; return new Response('{}'); },
  });
  await assert.rejects(transport.get('/v1/rates'), DataError);
  assert.equal(calls, 0);
});
