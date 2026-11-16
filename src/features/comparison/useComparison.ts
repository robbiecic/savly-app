import { useBilling } from '../../billing/BillingProvider';
import { useAuth } from '../../auth/AuthProvider';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { activateReferenceData, getReferenceStore } from '../../data/mobile-reference-store';
import { frankfurterBaseCurrency } from '../../data/frankfurter-transport';
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
  const [referenceResult, setReference] = useState<{ base: string; session: typeof session; state: ReferenceState } | null>(null);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const baseCurrency = frankfurterBaseCurrency(storedForm.homeCurrency);
  const reference = referenceResult?.base === baseCurrency && referenceResult.session === session ? referenceResult.state : null;
  const form = useMemo(() => reference?.snapshot ? withHomeCurrency(storedForm, reference.snapshot) : storedForm, [storedForm, reference?.snapshot]);
  useEffect(() => { if (form !== storedForm && reference?.snapshot) setForm(current => withHomeCurrency(current, reference.snapshot)); }, [form, storedForm, reference?.snapshot]);
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState(false);
  const [startupAttempt, setStartupAttempt] = useState(0);
  const [storageError, setStorageError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    let mounted = true;
    setStartupError(false);
    setPreferencesReady(false);
    void preferenceStore.load().then(saved => {
      if (!mounted) return;
      setForm(newForm(saved ?? initialPreferences()));
      setPreferencesReady(true);
    }).catch((error: unknown) => {
      if (!mounted) return;
      console.warn('Savly settings initialization failed:', error);
      setStartupError(true);
    });
    return () => { mounted = false; };
  }, [startupAttempt]);
  useEffect(() => {
    if (!preferencesReady) return;
    let mounted = true;
    setReady(false);
    setReference(null);
    let unsubscribe = () => {};
    let deactivate = () => {};
    void getReferenceStore(session, baseCurrency).then(async store => {
      if (!mounted) return null;
      unsubscribe = store.subscribe((state) => { if (mounted) setReference({ base: baseCurrency, session, state }); });
      deactivate = activateReferenceData(store);
      return store.get();
    }).then(state => {
      if (!mounted || !state) return;
      if (!initialized.current && state.snapshot && !state.snapshot.countries.some(row => row.country === storedForm.country)) {
        setForm(current => ({ ...current, country: state.snapshot!.countries[0]?.country ?? '' }));
      }
      initialized.current = true;
      setReference({ base: baseCurrency, session, state }); setReady(true);
    }).catch((error: unknown) => {
      if (!mounted) return;
      console.warn('Savly settings initialization failed:', error);
      setStartupError(true);
    });
    return () => { mounted = false; unsubscribe(); deactivate(); };
  }, [preferencesReady, session, baseCurrency, startupAttempt]);
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
    retry: async () => { setRetrying(true); try { setReference({ base: baseCurrency, session, state: await (await getReferenceStore(session, baseCurrency)).retry() }); } finally { setRetrying(false); } },
  };
}
