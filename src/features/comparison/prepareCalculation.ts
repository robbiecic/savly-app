import type { ReferenceStore } from '../../data/reference-store';
import { compare, resetOverrides, withHomeCurrency, type ComparisonForm, type ComparisonView } from './model';

// A submitted comparison must use the snapshot returned by this cache check.
// An expired snapshot gets a fetch attempt even during automatic retry backoff.
export async function prepareCalculation(store: ReferenceStore, form: ComparisonForm, locale: string, now: () => number = Date.now): Promise<{
  form: ComparisonForm; view: ComparisonView;
}> {
  const reference = await store.retry();
  const preparedForm = resetOverrides(withHomeCurrency(form, reference.snapshot));
  return { form: preparedForm, view: compare(preparedForm, reference, locale, now()) };
}
