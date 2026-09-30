import { decimalSeparator } from './locale';
import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { activateReferenceData, referenceStore } from '../../data/mobile-reference-store';
import type { ReferenceState } from '../../data/reference-store';
import { PreferenceStore, initialPreferences } from '../../storage/preferences';
import { D } from '../../domain/decimal';
import { withHomeCurrency, compare, editForm, newForm, normalizeDecimal, resetOverrides, type ComparisonForm } from './model';

const preferenceStore = new PreferenceStore(AsyncStorage);
export function useComparison() {
  const localeInfo = getLocales()[0];
  const locale = localeInfo?.languageTag ?? 'en-US';
  const [storedForm, setForm] = useState(newForm);
  const [reference, setReference] = useState<ReferenceState | null>(null);
  const form = useMemo(() => withHomeCurrency(storedForm, reference?.snapshot ?? null), [storedForm, reference?.snapshot]);
  useEffect(() => { if (form !== storedForm) setForm(form); }, [form, storedForm]);
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState(false);
  const [startupAttempt, setStartupAttempt] = useState(0);
  const [storageError, setStorageError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    let mounted = true;
    setStartupError(false);
    const unsubscribe = referenceStore.subscribe((state) => { if (mounted) setReference(state); });
    const deactivate = activateReferenceData();
    void Promise.all([preferenceStore.load(), referenceStore.get()]).then(([saved, state]) => {
      if (!mounted) return;
      const preferences = saved ?? initialPreferences();
      if (!saved && state.snapshot && !state.snapshot.countries.some((row) => row.country === preferences.country)) {
        preferences.country = state.snapshot.countries[0]?.country ?? '';
      }
      const separator = decimalSeparator(locale);
      setForm(newForm({ ...preferences, feePercent: preferences.feePercent.replace('.', separator) }));
      setReference(state); setReady(true);
    }).catch((error: unknown) => {
      if (!mounted) return;
      console.warn('Savly settings initialization failed:', error);
      setStartupError(true);
    });
    return () => { mounted = false; unsubscribe(); deactivate(); };
  }, [startupAttempt]);
  useEffect(() => {
    if (!ready) return;
    const normalized = normalizeDecimal(form.feePercent, locale);
    if (!/^\d{1,3}(?:\.\d{1,4})?$/.test(normalized) || new D(normalized).gt(100)) return;
    let current = true;
    void preferenceStore.save({ country: form.country, homeCurrency: form.homeCurrency, residence: form.residence, feePercent: normalized })
      .then(() => { if (current) setStorageError(false); }).catch(() => { if (current) setStorageError(true); });
    return () => { current = false; };
  }, [ready, form.country, form.homeCurrency, form.residence, form.feePercent, locale]);
  const [settledForm, setSettledForm] = useState(form);
  useEffect(() => {
    const timer = setTimeout(() => setSettledForm(form), 180);
    return () => clearTimeout(timer);
  }, [form]);
  const pending = settledForm !== form;
  const view = useMemo(() => compare(withHomeCurrency(settledForm, reference?.snapshot ?? null), ready ? reference : null, locale), [settledForm, reference, ready, locale]);
  return {
    form, reference, ready, view, pending, storageError, retrying, locale, startupError,
    retryStartup: () => setStartupAttempt((attempt) => attempt + 1),
    edit: (field: keyof ComparisonForm, value: string) => setForm(withHomeCurrency(editForm(form, field, value), reference?.snapshot ?? null)),
    reset: () => setForm(resetOverrides(form)),
    retry: async () => { setRetrying(true); try { setReference(await referenceStore.retry()); } finally { setRetrying(false); } },
  };
}
