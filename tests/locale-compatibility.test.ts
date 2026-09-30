import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeDecimal } from '../src/features/comparison/model';

test('Decimal input still works when NumberFormat.formatToParts is unavailable', () => {
  const descriptor = Object.getOwnPropertyDescriptor(Intl.NumberFormat.prototype, 'formatToParts')!;
  try {
    Object.defineProperty(Intl.NumberFormat.prototype, 'formatToParts', { configurable: true, value: undefined });
    assert.equal(normalizeDecimal('120.50', 'en-US'), '120.50');
    assert.equal(normalizeDecimal('120,50', 'fr-FR'), '120.50');
    assert.equal(normalizeDecimal('1.234,56', 'de-DE'), 'invalid');
  } finally { Object.defineProperty(Intl.NumberFormat.prototype, 'formatToParts', descriptor); }
});
