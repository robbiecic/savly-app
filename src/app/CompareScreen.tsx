import { KeyboardFormScrollView } from '../components/KeyboardFormScrollView';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Action, Card, Field, Select, ui } from '../components/controls';
import { useComparison } from '../features/comparison/useComparison';
import { ResultScreen } from './ResultScreen';
import { SavedScreen } from './SavedScreen';
import type { SavedComparison } from '../storage/saved-comparisons';
import { countryFlag, countryName, residenceOptions } from '../features/comparison/countries';
import { colors } from '../theme/colors';


export function CompareScreen() {
  const state = useComparison();
  const [page, setPage] = useState<'calculator' | 'result' | 'saved'>('calculator');
  const [entry, setEntry] = useState<SavedComparison | null>(null);
  const [resultOrigin, setResultOrigin] = useState<'calculator' | 'saved'>('calculator');
  const goBack = () => setPage('calculator');
  useEffect(() => {
    if (page === 'calculator') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => subscription.remove();
  }, [page, resultOrigin]);
  const [settings, setSettings] = useState<boolean | null>(null);
  const [assumptions, setAssumptions] = useState(false);
  const { form, view, reference } = state;
  const snapshot = reference?.snapshot;
  const shopping = snapshot?.countries.find((row) => row.country === form.country);
  const residences = useMemo(() => residenceOptions(state.locale), [state.locale]);
  const countries = snapshot?.countries.map((row) => ({ value: row.country, label: `${countryName(row.country, state.locale)} · ${row.currency}`, flag: countryFlag(row.country) })) ?? [];
  const error = (field: string) => !state.pending && view.status === 'invalid' && view.field === field ? view.message : undefined;
  const showSettings = (settings ?? !form.residence) || !!error('homeCurrency');
  const calculate = () => {
    if (state.pending || view.status !== 'ready') return;
    Keyboard.dismiss();
    setEntry({ id: Date.now().toString(36) + Math.random().toString(36).slice(2), savedAt: new Date().toISOString(),
      form: { ...form }, comparison: JSON.parse(JSON.stringify(view.comparison)) });
    setResultOrigin('calculator'); setPage('result');
  };
  if (page === 'result' && entry) return <ResultScreen key={entry.id} entry={entry} fromSaved={resultOrigin === 'saved'} onBack={goBack} />;
  return <SafeAreaView style={styles.screen}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
      <KeyboardFormScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
        <View style={styles.heading}><Text style={styles.brand}>Savly</Text><Text style={styles.badge}>SAMPLE PROTOTYPE</Text></View>
        {!state.ready ? state.startupError ? <Card>
          <Text accessibilityRole="alert" style={ui.error}>Your settings couldn’t load. Please try again.</Text>
          <Action label="Retry loading settings" onPress={state.retryStartup} />
        </Card> : <ActivityIndicator accessibilityLabel="Loading your settings" color={colors.ink} /> : <>
          <View style={styles.shoppingPicker}>
            <Select label="Shopping country" value={form.country} options={countries} onChange={(v) => state.edit('country', v)} error={error('country')} compact />
          </View>
          <View accessibilityRole="tablist" style={styles.tabs}>
            {(['calculator', 'saved'] as const).map(tab => <Pressable key={tab} accessibilityRole="tab"
              accessibilityState={{ selected: page === tab }} aria-selected={page === tab} onPress={() => { Keyboard.dismiss(); setPage(tab); }}
              style={[styles.tab, page === tab && styles.selectedTab]}>
              <Text style={[styles.tabText, page === tab && styles.selectedTabText]}>{tab === 'calculator' ? 'Calculate' : 'Saved'}</Text>
            </Pressable>)}
          </View>
          {page === 'saved' ? <SavedScreen onOpen={(saved) => { setEntry(saved); setResultOrigin('saved'); setPage('result'); }} /> : <>
          <Card>
            <Text accessibilityRole="header" style={ui.title}>Compare a price</Text>
            <Field label={`Shopping price (${shopping?.currency ?? 'local currency'})`} value={form.price} onChange={(v) => state.edit('price', v)} numeric prominent placeholder="0.00" error={error('price')} />
            <Text style={ui.muted}>Enter the full price, including any local purchase tax.</Text>
            <Action label={`${form.homeCurrency || 'Home country'} · ${showSettings ? 'Hide' : 'Edit'} settings`} secondary expanded={showSettings} onPress={() => setSettings(!showSettings)} />
            {(showSettings) && <View style={{ gap: 16 }}>
              <Select label="Country of residence" value={form.residence} options={residences} onChange={(v) => state.edit('residence', v)} error={error('homeCurrency')} />
              <Text style={ui.muted}>Home currency follows your country of residence. Refund eligibility is not verified.</Text>
            </View>}
            <Field label={`Home price (${form.homeCurrency || 'home currency'})`} value={form.homePrice} onChange={(v) => state.edit('homePrice', v)} numeric placeholder="Price at home, including taxes" error={error('homePrice')} />
            <Field label="Item name (optional)" value={form.itemName} onChange={(v) => state.edit('itemName', v)} placeholder="What caught your eye?" />
            <Action label={assumptions ? 'Close assumptions' : 'Edit assumptions'} secondary expanded={assumptions} onPress={() => setAssumptions(!assumptions)} />
            {(assumptions || error('fxOverride') || error('refundOverride')) && <View style={{ gap: 16 }}>
              <Text style={ui.muted}>Leave FX and refund blank to use automatic values. Manual values apply only to this comparison.</Text>
              {shopping?.currency !== form.homeCurrency && <Field label={`Manual FX (${form.homeCurrency || 'home currency'} per ${shopping?.currency ?? 'shopping unit'})`} value={form.fxOverride} onChange={(v) => state.edit('fxOverride', v)} numeric placeholder="Automatic rate" error={error('fxOverride')} />}
              <Field label={`Manual refund (${shopping?.currency ?? 'shopping currency'})`} value={form.refundOverride} onChange={(v) => state.edit('refundOverride', v)} numeric placeholder="Automatic estimate, if available" error={error('refundOverride')} />
              <Action label="Reset FX and refund to automatic" secondary onPress={state.reset} />
            </View>}
            <Action label="Calculate savings" disabled={state.pending || view.status !== 'ready'} onPress={calculate} />
          </Card>
          {state.storageError && <Text accessibilityRole="alert" style={ui.error}>Settings couldn’t be saved on this device.</Text>}
          {(reference?.status === 'stale' || reference?.status === 'unavailable') && <Card>
            <Text style={ui.text}>{reference.label}</Text>
            <Action label={state.retrying ? 'Retrying…' : 'Retry rates'} disabled={state.retrying} secondary onPress={() => { void state.retry(); }} />
          </Card>}
          {state.pending ? <Text accessibilityLiveRegion="polite" style={ui.muted}>Updating estimate…</Text> : view.status === 'ready' ? null : <Card>
            <Text accessibilityRole={view.status === 'invalid' ? 'alert' : undefined} style={ui.text}>{view.message}</Text>
          </Card>}
          </>}
        </>}
        <Text style={[ui.muted, { textAlign: 'center' }]}>Estimates to help you decide. Always check the final price and refund conditions.</Text>
      </KeyboardFormScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 44, gap: 24, width: '100%', maxWidth: 620, alignSelf: 'center' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  brand: { fontSize: 32, fontWeight: '800', color: colors.ink },
  badge: { color: '#3F506B', fontSize: 12, fontWeight: '700', backgroundColor: '#E9EDF5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  selectedTab: { borderBottomColor: colors.ink },
  tabText: { fontSize: 16, color: colors.muted },
  selectedTabText: { color: colors.ink, fontWeight: '700' },
  shoppingPicker: { alignSelf: 'center', width: '100%', maxWidth: 360 },
});
