import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatSummaryMoney, maskSavingsAmount } from '../src/features/comparison/number-display';
import { shareLink, shareMessage } from '../src/features/comparison/sharing';
import { compare, newForm } from '../src/features/comparison/model';
import { createMockTransport, SAMPLE_RESPONSES } from '../src/data/transport';
import { ReferenceStore } from '../src/data/reference-store';

test('trial preview preserves only the first amount digit and money punctuation', () => {
  assert.equal(maskSavingsAmount(formatSummaryMoney('33.84', 'USD', 'en-US')), '$3X.XX');
  assert.equal(maskSavingsAmount(formatSummaryMoney('16.16', 'USD', 'en-US')), '$1X.XX');
  assert.equal(maskSavingsAmount(formatSummaryMoney('1234.50', 'EUR', 'de-DE')), '€1\u202fXXX,XX');
  assert.equal(maskSavingsAmount(formatSummaryMoney('5.00', 'GBP', 'en-GB')), '£5.XX');
});

test('trial share masks an extra cost and omits the full comparison breakdown', async () => {
  const store = new ReferenceStore({ mode: 'sample', environment: 'test', transport: createMockTransport(path => SAMPLE_RESPONSES[path]),
    storage: { async getItem() { return null; }, async setItem() {} } });
  const snapshot = await store.get();
  const result = compare({ ...newForm(), residence: 'US', price: '120', homePrice: '100' }, snapshot, 'en-US');
  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') return;
  const message = shareMessage(result.comparison, shareLink(), '$1X.XX');
  assert.match(message, /cost \$1X\.XX more/);
  for (const exact of ['16.16', '16.2%', '116.16', '100.00']) assert.ok(!message.includes(exact), exact);
});

test('trial share omits the full savings result and its calculation breakdown', async () => {
  const store = new ReferenceStore({ mode: 'sample', environment: 'test', transport: createMockTransport(path => SAMPLE_RESPONSES[path]),
    storage: { async getItem() { return null; }, async setItem() {} } });
  const snapshot = await store.get();
  const result = compare({ ...newForm(), residence: 'US', price: '120', homePrice: '150' }, snapshot, 'en-US');
  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') return;
  const message = shareMessage(result.comparison, shareLink(), '$3X.XX');
  assert.match(message, /I could save \$3X\.XX/);
  assert.match(message, /Sample estimate/);
  for (const exact of ['33.84', '22.6%', '116.16', '15.84', '150.00']) assert.ok(!message.includes(exact), exact);
});
