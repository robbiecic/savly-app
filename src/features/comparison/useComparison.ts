import { useBilling } from '../../billing/BillingProvider';
import { useAuth } from '../../auth/AuthProvider';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { activateReferenceData, getReferenceStore } from '../../data/mobile-reference-store';
import type { ReferenceState } from '../../data/reference-store';
import { PreferenceStore, initialPreferences } from '../../storage/preferences';
import { withHomeCurrency, compare, editForm, newForm, resetOverrides, type ComparisonForm } from './model';

const preferenceStore = new PreferenceStore(AsyncStorage);
export function useComparison() {
  const { session: accountSession } = useAuth();
  const { active: premium } = useBilling();
  // Free use must never activate the authenticated API store, even after sign-in.
  const session = premium ? accountSession : null;
  const initialized = useRef(false);
  const now = useCurrentTime();
  const localeInfo = getLocales()[0];
  const locale = localeInfo?.languageTag ?? 'en-US';
  const [storedForm, setForm] = useState(newForm);
  const [referenceState, setReference] = useState<ReferenceState | null>(null);
  const reference = premium || referenceState?.snapshot?.environment === 'prototype' ? referenceState : null;
  const form = useMemo(() => withHomeCurrency(storedForm, reference?.snapshot ?? null), [storedForm, reference?.snapshot]);
  useEffect(() => { if (form !== storedForm) setForm(current => withHomeCurrency(current, reference?.snapshot ?? null)); }, [form, storedForm, reference?.snapshot]);
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState(false);
  const [startupAttempt, setStartupAttempt] = useState(0);
  const [storageError, setStorageError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    let mounted = true;
    setStartupError(false);
    setReady(false);
    setReference(null);
    let unsubscribe = () => {};
    let deactivate = () => {};
    const loadReference = async () => {
      const store = await getReferenceStore(session);
      if (!mounted) return null;
      if (mounted) {
        unsubscribe = store.subscribe((state) => { if (mounted) setReference(state); });
        deactivate = activateReferenceData(store);
      }
      return store.get();
    };
    void Promise.all([preferenceStore.load(), loadReference()]).then(([saved, state]) => {
      if (!mounted || !state) return;
      const preferences = saved ?? initialPreferences();
      if (!saved && state.snapshot && !state.snapshot.countries.some((row) => row.country === preferences.country)) {
        preferences.country = state.snapshot.countries[0]?.country ?? '';
      }
      if (!initialized.current) setForm(newForm(preferences));
      initialized.current = true;
      setReference(state); setReady(true);
    }).catch((error: unknown) => {
      if (!mounted) return;
      console.warn('Savly settings initialization failed:', error);
      setStartupError(true);
    });
    return () => { mounted = false; unsubscribe(); deactivate(); };
  }, [startupAttempt, session]);
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
  // New calculations always use reference data; manual support remains for legacy snapshots.
  const view = useMemo(() => compare(resetOverrides(withHomeCurrency(settledForm, reference?.snapshot ?? null)), ready ? reference : null, locale, now), [settledForm, reference, ready, locale, now]);
  return {
    form, reference, ready, view, pending, now, storageError, retrying, locale, startupError,
    retryStartup: () => setStartupAttempt((attempt) => attempt + 1),
    edit: (field: Exclude<keyof ComparisonForm, 'fxOverride' | 'refundOverride' | 'feePercent'>, value: string) => setForm(current => withHomeCurrency(editForm(current, field, value), reference?.snapshot ?? null)),
    retry: async () => { setRetrying(true); try { setReference(await (await getReferenceStore(session)).retry()); } finally { setRetrying(false); } },
  };
}
