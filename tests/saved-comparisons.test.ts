import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SavedComparisonStore, type SavedComparison } from '../src/storage/saved-comparisons';
import { compare, newForm } from '../src/features/comparison/model';
import { validateReferenceData, type Snapshot } from '../src/data/reference-data';
import { SAMPLE_RESPONSES } from '../src/data/transport';

function entry(id = 'one'): SavedComparison {
  const snapshot: Snapshot = { ...validateReferenceData(SAMPLE_RESPONSES['/v1/rates'], SAMPLE_RESPONSES['/v1/countries']),
    adapterVersion: 1, environment: 'test', mode: 'sample', id: 'reference-1', fetchedAt: 1000 };
  const form = { ...newForm(), residence: 'US', price: '120', homePrice: '150', itemName: 'Bag' };
  const view = compare(form, { status: 'fresh', snapshot, label: 'Sample rate', error: null });
  assert.equal(view.status, 'ready');
  if (view.status !== 'ready') throw new Error('Invalid fixture');
  return { id, savedAt: '2026-09-29T12:00:00Z', form, comparison: view.comparison };
}
function harness() {
  let raw: string | null = null;
  let fail = false;
  const storage = { async getItem() { return raw; }, async setItem(_key: string, value: string) {
    if (fail) throw new Error('Storage full'); raw = value;
  } };
  return { storage, store: new SavedComparisonStore(storage), corrupt: () => { raw = '{broken'; }, fail: (value: boolean) => { fail = value; } };
}
test('Saved snapshot survives reconstruction without mutation or duplicate saves', async () => {
  const h = harness(); const snapshot = entry();
  const writing = h.store.save(snapshot);
  snapshot.comparison.result.withRefund = '999.00';
  await writing;
  const loaded = await new SavedComparisonStore(h.storage).list();
  assert.equal(loaded[0].comparison.result.withRefund, '115.50');
  assert.equal(loaded[0].comparison.result.savings?.amount, '34.50');
  assert.equal(loaded[0].comparison.result.fx.source, 'CityIndex');
  await h.store.save(loaded[0]);
  assert.equal((await h.store.list()).length, 1);
});
test('Concurrent saves preserve both items; delete and clear persist', async () => {
  const h = harness();
  await Promise.all([h.store.save(entry('one')), h.store.save(entry('two'))]);
  assert.equal((await h.store.list()).length, 2);
  await h.store.remove('one');
  assert.deepEqual((await h.store.list()).map(item => item.id), ['two']);
  await h.store.clear();
  assert.deepEqual(await new SavedComparisonStore(h.storage).list(), []);
});
test('Failed writes are retryable and corrupt data is not silently overwritten', async () => {
  const h = harness();
  h.fail(true); await assert.rejects(h.store.save(entry()));
  h.fail(false); await h.store.save(entry());
  h.corrupt();
  await assert.rejects(h.store.list());
  await assert.rejects(h.store.save(entry('two')));
  await h.store.clear();
  assert.deepEqual(await h.store.list(), []);
});
test('Malformed stored snapshots are rejected before rendering', async () => {
  const data = entry(); (data.comparison.result as unknown as { fx: null }).fx = null;
  const store = new SavedComparisonStore({ async getItem() { return JSON.stringify({ version: 1, items: [data] }); }, async setItem() {} });
  await assert.rejects(store.list());
});

test('Optional photos survive restart and legacy records still load', async () => {
  const h = harness();
  await h.store.save({ ...entry(), photoUri: 'data:image/jpeg;base64,YWJj' });
  await h.store.save(entry('legacy'));
  const loaded = await new SavedComparisonStore(h.storage).list();
  assert.equal(loaded[0].photoUri, undefined);
  assert.equal(loaded[1].photoUri, 'data:image/jpeg;base64,YWJj');
  await assert.rejects(h.store.save({ ...entry(), photoUri: 'https://example.com/tracker.jpg' }));
  await assert.rejects(h.store.save({ ...entry(), photoUri: 'data:image/jpeg;base64,' + 'a'.repeat(400_000) }));
});

test('Photo files roll back on failed save and are deleted only after successful record deletion', async () => {
  const h = harness();
  const files = new Set<string>();
  let serial = 0;
  const photos = {
    async persist() { const uri = `savly-photo:${++serial}.jpg`; files.add(uri); return uri; },
    async remove(uri: string) { files.delete(uri); },
    async clear() { files.clear(); },
  };
  const store = new SavedComparisonStore(h.storage, photos);
  const item = { ...entry(), photoUri: 'data:image/jpeg;base64,YWJj' };
  h.fail(true); await assert.rejects(store.save(item)); assert.equal(files.size, 0);
  h.fail(false); await store.save(item); assert.equal(files.size, 1);
  const original = (await store.list())[0].photoUri!;
  h.fail(true); await assert.rejects(store.remove(item.id)); assert.ok(files.has(original));
  h.fail(false); await store.save(item); assert.equal(files.size, 1); assert.ok(!files.has(original));
  await store.remove(item.id); assert.equal(files.size, 0);
  await store.save(item); await store.clear(); assert.equal(files.size, 0);
});
