import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEVELOPMENT_API_URL, developmentApiUrl, selectReferenceStore } from '../src/data/development-reference-store';
import { SAMPLE_RESPONSES, type ReferencePath } from '../src/data/transport';

function storage() {
  const values = new Map<string, string>();
  return { async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); } };
}
test('development uses the hosted API on every platform and supports configured release URLs', () => {
  assert.equal(developmentApiUrl(true, 'ios'), DEVELOPMENT_API_URL);
  assert.equal(developmentApiUrl(true, 'android'), DEVELOPMENT_API_URL);
  assert.equal(developmentApiUrl(true, 'android', `${DEVELOPMENT_API_URL}/`), DEVELOPMENT_API_URL);
  assert.equal(developmentApiUrl(false, 'ios', 'https://other.example'), 'https://other.example');
  assert.equal(developmentApiUrl(true, 'web'), DEVELOPMENT_API_URL);
});
test('hosted API loads both contracts once and retains reference provenance in an isolated cache', async () => {
  const disk = storage();
  const urls: string[] = [];
  const fetcher = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify(SAMPLE_RESPONSES[new URL(url).pathname as ReferencePath]));
  }) as typeof fetch;
  const options = { baseUrl: DEVELOPMENT_API_URL, storage: disk, fetcher };
  const store = await selectReferenceStore(options);
  assert.equal((await store.get()).snapshot?.environment, `api:${DEVELOPMENT_API_URL}`);
  assert.equal((await store.get()).snapshot?.mode, 'real');
  assert.equal(urls.length, 2);
  const restarted = await selectReferenceStore({ ...options, fetcher: (async () => { throw Error('offline'); }) as typeof fetch });
  assert.equal((await restarted.get()).snapshot?.environment, `api:${DEVELOPMENT_API_URL}`);
  assert.equal(urls.length, 2);
});
test('unreachable local server with no cache uses prototype; malformed API data also uses dated defaults', async () => {
  const options = { baseUrl: DEVELOPMENT_API_URL, storage: storage() };
  const offline = await selectReferenceStore({ ...options, fetcher: (async () => { throw Error('offline'); }) as typeof fetch });
  assert.equal((await offline.get()).snapshot?.environment, 'prototype');
  const malformed = await selectReferenceStore({ ...options, fetcher: (async () => new Response('{}')) as typeof fetch });
  assert.equal((await malformed.get()).snapshot?.environment, 'prototype');
});

test('authenticated API sends the session token and keeps failures retryable without sample substitution', async () => {
  const headers: unknown[] = [];
  const store = await selectReferenceStore({ baseUrl: DEVELOPMENT_API_URL, storage: storage(),
    getToken: async () => 'session-token', fetcher: (async (_url, init) => {
      headers.push(init?.headers);
      return new Response('{}', { status: 401 });
    }) as typeof fetch });
  assert.equal(store.state().error, 'authentication');
  assert.equal(store.state().snapshot, null);
  assert.deepEqual(headers, [{ Authorization: 'Bearer session-token' }, { Authorization: 'Bearer session-token' }]);
});
