import { readFileSync } from 'node:fs';
import { validateReferenceData, type Snapshot } from '../../src/data/reference-data';
import { SAMPLE_RESPONSES } from '../../src/data/transport';
import { compare, newForm } from '../../src/features/comparison/model';
import type { SavedComparison } from '../../src/storage/saved-comparisons';

export function savedFixture(name: string, withPhoto = false): SavedComparison {
  const snapshot: Snapshot = {
    ...validateReferenceData(SAMPLE_RESPONSES['/v1/rates'], SAMPLE_RESPONSES['/v1/countries']),
    adapterVersion: 1, environment: 'test', mode: 'sample', id: 'saved-browser-fixture', fetchedAt: Date.now(),
  };
  const form = { ...newForm(), residence: 'US', price: '120', homePrice: '150', itemName: name };
  const view = compare(form, { status: 'fresh', snapshot, label: 'Sample rate', error: null });
  if (view.status !== 'ready') throw new Error('Saved browser fixture could not be calculated.');
  return {
    id: `saved-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    savedAt: '2026-11-15T12:00:00Z', form, comparison: view.comparison,
    ...(withPhoto ? { photoUri: `data:image/jpeg;base64,${readFileSync('tests/ui/fixture-photo.jpg').toString('base64')}` } : {}),
  };
}
