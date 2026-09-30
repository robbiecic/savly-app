import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countryName, residenceOptions } from '../src/features/comparison/countries';

test('Country selectors still work when Intl.DisplayNames is unavailable', () => {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, 'DisplayNames')!;
  try {
    Object.defineProperty(Intl, 'DisplayNames', { configurable: true, value: undefined });
    assert.equal(countryName('FR', 'en-US'), 'France');
    const options = residenceOptions('en-US');
    assert.equal(options.length, 249);
    assert.equal(options.find((option) => option.value === 'US')?.label, 'United States');
  } finally { Object.defineProperty(Intl, 'DisplayNames', descriptor); }
});

test('Unsupported locale tags fall back to English country names', () => {
  assert.equal(countryName('JP', 'not_a_locale'), 'Japan');
  assert.equal(residenceOptions('not_a_locale').find((option) => option.value === 'FR')?.label, 'France');
});

test('Supported engines retain localized country names and unknown-code fallback', () => {
  assert.equal(countryName('DE', 'fr-FR'), 'Allemagne');
  assert.equal(countryName('BAD', 'en-US'), 'BAD');
});
