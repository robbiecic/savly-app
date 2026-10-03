import assert from 'node:assert/strict';
import { test } from 'node:test';
import { developmentApiUrl, selectReferenceStore } from '../src/data/development-reference-store';
import { SAMPLE_RESPONSES, type ReferencePath } from '../src/data/transport';

function storage() {
  const values = new Map<string, string>();
  return { async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); } };
}
test('development addresses account for emulator networking and never enable production HTTP', () => {
  assert.equal(developmentApiUrl(true, 'ios'), 'http://127.0.0.1:3000');
  assert.equal(developmentApiUrl(true, 'android'), 'http://10.0.2.2:3000');
  assert.equal(developmentApiUrl(true, 'android', 'http://127.0.0.1:3000/'), 'http://127.0.0.1:3000');
  assert.equal(developmentApiUrl(false, 'ios', 'http://localhost:3000'), null);
  assert.equal(developmentApiUrl(true, 'web'), null);
});
test('local API loads both contracts once and retains sample provenance in an isolated cache', async () => {
  const disk = storage();
  const urls: string[] = [];
  const fetcher = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify(SAMPLE_RESPONSES[new URL(url).pathname as ReferencePath]));
  }) as typeof fetch;
  const options = { baseUrl: 'http://127.0.0.1:3000', storage: disk, fetcher };
  const store = await selectReferenceStore(options);
  assert.equal((await store.get()).snapshot?.environment, 'local:http://127.0.0.1:3000');
  assert.equal((await store.get()).snapshot?.mode, 'sample');
  assert.equal(urls.length, 2);
  const restarted = await selectReferenceStore({ ...options, fetcher: (async () => { throw Error('offline'); }) as typeof fetch });
  assert.equal((await restarted.get()).snapshot?.environment, 'local:http://127.0.0.1:3000');
  assert.equal(urls.length, 2);
});
test('unreachable local server with no cache uses prototype; malformed API data stays unavailable', async () => {
  const options = { baseUrl: 'http://127.0.0.1:3000', storage: storage() };
  const offline = await selectReferenceStore({ ...options, fetcher: (async () => { throw Error('offline'); }) as typeof fetch });
  assert.equal((await offline.get()).snapshot?.environment, 'prototype');
  const malformed = await selectReferenceStore({ ...options, fetcher: (async () => new Response('{}')) as typeof fetch });
  assert.equal((await malformed.get()).status, 'unavailable');
});
