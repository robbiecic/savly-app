import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { activateReferenceData, getReferenceStore } from '../../data/mobile-reference-store';
import type { ReferenceState } from '../../data/reference-store';
import { PreferenceStore, initialPreferences } from '../../storage/preferences';
import { withHomeCurrency, compare, editForm, newForm, resetOverrides, type ComparisonForm } from './model';

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
    let unsubscribe = () => {};
    let deactivate = () => {};
    const loadReference = async () => {
      const store = await getReferenceStore();
      if (mounted) {
        unsubscribe = store.subscribe((state) => { if (mounted) setReference(state); });
        deactivate = activateReferenceData(store);
      }
      return store.get();
    };
    void Promise.all([preferenceStore.load(), loadReference()]).then(([saved, state]) => {
      if (!mounted) return;
      const preferences = saved ?? initialPreferences();
      if (!saved && state.snapshot && !state.snapshot.countries.some((row) => row.country === preferences.country)) {
        preferences.country = state.snapshot.countries[0]?.country ?? '';
      }
      setForm(newForm(preferences));
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
    let current = true;
    void preferenceStore.save({ country: form.country, homeCurrency: form.homeCurrency, residence: form.residence, feePercent: '0' })
      .then(() => { if (current) setStorageError(false); }).catch(() => { if (current) setStorageError(true); });
    return () => { current = false; };
  }, [ready, form.country, form.homeCurrency, form.residence]);
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
    retry: async () => { setRetrying(true); try { setReference(await (await getReferenceStore()).retry()); } finally { setRetrying(false); } },
  };
}
