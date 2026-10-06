import assert from 'node:assert/strict';
import test from 'node:test';
import { formatNumberInput, unformatNumberInput } from '../src/features/comparison/number-input';
import { normalizeDecimal } from '../src/features/comparison/model';

test('amount formatting retains exact values, partial decimals, and trailing zeroes', () => {
  for (const [raw, displayed] of [
    ['', ''], ['123', '123'], ['1234', '1,234'], ['12345.67', '12,345.67'],
    ['1234.', '1,234.'], ['1234.00', '1,234.00'], ['.5', '.5'],
    ['123456789012345678.123456789012345678', '123,456,789,012,345,678.123456789012345678'],
  ]) {
    assert.equal(formatNumberInput(raw, 'en-US'), displayed);
    assert.equal(unformatNumberInput(displayed, 'en-US'), raw);
  }
});

test('grouped pasted amounts reach calculations without changing their decimal value', () => {
  assert.equal(normalizeDecimal(unformatNumberInput('12,345.67', 'en-US'), 'en-US'), '12345.67');
  const displayed = formatNumberInput('12345,67', 'fr-FR');
  assert.equal(displayed, '12\u202f345,67');
  assert.equal(normalizeDecimal(unformatNumberInput(displayed, 'fr-FR'), 'fr-FR'), '12345.67');
});

test('invalid input stays visible for existing validation', () => {
  for (const raw of ['12.3.4', '-1234', '1234abc']) assert.equal(formatNumberInput(raw, 'en-US'), raw);
});
