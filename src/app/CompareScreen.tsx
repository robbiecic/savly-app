import { RefundRulesScreen } from './RefundRulesScreen';
import { SavlyLogo } from '../components/SavlyLogo';
import { HomeSettingsButton } from '../components/HomeSettingsButton';
import { SettingsScreen } from './SettingsScreen';
import { responsive, useWideLayout } from '../components/responsive';
import { KeyboardFormScrollView } from '../components/KeyboardFormScrollView';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Action, Card, Field, Select, ui } from '../components/controls';
import { useComparison } from '../features/comparison/useComparison';
import { ResultScreen } from './ResultScreen';
import { SavedScreen } from './SavedScreen';
import type { SavedComparison } from '../storage/saved-comparisons';
import { countryFlag, countryName } from '../features/comparison/countries';
import { colors } from '../theme/colors';


export function CompareScreen({ onSignOut }: { onSignOut: () => void }) {
  const wide = useWideLayout();
  const [rules, setRules] = useState(false);
  const state = useComparison();
  const [page, setPage] = useState<'calculator' | 'result' | 'saved' | 'settings'>('calculator');
  const [entry, setEntry] = useState<SavedComparison | null>(null);
  const [resultOrigin, setResultOrigin] = useState<'calculator' | 'saved'>('calculator');
  const goBack = () => setPage('calculator');
  useEffect(() => {
    if (page === 'calculator') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => subscription.remove();
  }, [page, resultOrigin]);
  const [assumptions, setAssumptions] = useState(false);
  const { form, view, reference } = state;
  const snapshot = reference?.snapshot;
  const shopping = snapshot?.countries.find((row) => row.country === form.country);
  const countries = snapshot?.countries.map((row) => ({ value: row.country, label: `${countryName(row.country, state.locale)} · ${row.currency}`, flag: countryFlag(row.country) })) ?? [];
  const error = (field: string) => !state.pending && view.status === 'invalid' && view.field === field ? view.message : undefined;
  const calculate = () => {
    if (state.pending || view.status !== 'ready') return;
    Keyboard.dismiss();
    setEntry({ id: Date.now().toString(36) + Math.random().toString(36).slice(2), savedAt: new Date().toISOString(),
      form: { ...form }, comparison: JSON.parse(JSON.stringify(view.comparison)) });
    setResultOrigin('calculator'); setPage('result');
  };
  const openSettings = () => { Keyboard.dismiss(); setPage('settings'); };
  if (page === 'result' && entry) return <ResultScreen key={entry.id} entry={entry} fromSaved={resultOrigin === 'saved'} onBack={goBack} onSettings={openSettings} homeCountry={form.residence} locale={state.locale} />;
  return <SafeAreaView style={styles.screen}>
    {rules && shopping && <RefundRulesScreen country={shopping} locale={state.locale} defaults={snapshot?.environment === 'prototype'} onClose={() => setRules(false)} />}
    <View style={[styles.heading, styles.fixedHeader, wide && responsive.wideContent]}>
      <SavlyLogo />
      <HomeSettingsButton country={form.residence} locale={state.locale} disabled={!state.ready} onPress={openSettings} />
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
      <KeyboardFormScrollView contentContainerStyle={[styles.content, wide && responsive.wideContent]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
        {!state.ready ? state.startupError ? <Card>
          <Text accessibilityRole="alert" style={ui.error}>Your settings couldn’t load. Please try again.</Text>
          <Action label="Retry loading settings" onPress={state.retryStartup} />
        </Card> : <ActivityIndicator accessibilityLabel="Loading your settings" color={colors.ink} /> : <>
          {page === 'settings' ? <SettingsScreen country={form.residence} currency={form.homeCurrency} locale={state.locale}
            onChange={(country) => state.edit('residence', country)} onBack={goBack} onSignOut={onSignOut} storageError={state.storageError} /> : <>
          {snapshot && <View style={{ gap: 8 }}>
            <Text style={ui.muted}>{snapshot.environment === 'prototype' ? 'Using built-in default countries, VAT and FX rates.' : 'Countries, VAT and FX rates loaded from the API.'}</Text>

          </View>}
          <View style={styles.shoppingPicker}>
            <Select label="Shopping country" value={form.country} options={countries} onChange={(v) => state.edit('country', v)} error={error('country')} compact />
          </View>
          {shopping && <Action label="VAT refund rules" secondary onPress={() => { Keyboard.dismiss(); setRules(true); }} />}
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
            <View style={wide ? responsive.columns : responsive.stack}>
            <View style={[responsive.stack, wide && responsive.column]}>
            <Field label={`Shopping price (${shopping?.currency ?? 'local currency'})`} value={form.price} onChange={(v) => state.edit('price', v)} numeric locale={state.locale} placeholder="Price overseas, including taxes" error={error('price')} />
            {!form.residence && <Text style={ui.muted}>Set your home country in Settings to calculate savings.</Text>}
            </View>
            <View style={[responsive.stack, wide && responsive.column]}>
            <Field label={`Home price (${form.homeCurrency || 'home currency'})`} value={form.homePrice} onChange={(v) => state.edit('homePrice', v)} numeric locale={state.locale} placeholder="Price at home, including taxes" error={error('homePrice')} />
            <Action label={assumptions ? 'Close assumptions' : 'Edit assumptions'} secondary expanded={assumptions} onPress={() => setAssumptions(!assumptions)} />
            {(assumptions || error('fxOverride') || error('refundOverride')) && <View style={{ gap: 16 }}>
              <Text style={ui.muted}>Leave FX and refund blank to use automatic values. Manual values apply only to this comparison.</Text>
              {shopping?.currency !== form.homeCurrency && <Field label={`Manual FX (${form.homeCurrency || 'home currency'} per ${shopping?.currency ?? 'shopping unit'})`} value={form.fxOverride} onChange={(v) => state.edit('fxOverride', v)} numeric locale={state.locale} placeholder="Automatic rate" error={error('fxOverride')} />}
              {shopping?.vatRate != null && <Field label={`Manual refund (${shopping?.currency ?? 'shopping currency'})`} value={form.refundOverride} onChange={(v) => state.edit('refundOverride', v)} numeric locale={state.locale} placeholder="Automatic estimate, if available" error={error('refundOverride')} />}
              <Action label="Reset FX and refund to automatic" secondary onPress={state.reset} />
            </View>}
            </View></View>
            <Action label="Calculate savings" disabled={state.pending || view.status !== 'ready'} onPress={calculate} />
          </Card>
          {state.storageError && <Text accessibilityRole="alert" style={ui.error}>Settings couldn’t be saved on this device.</Text>}
          {(reference?.status === 'stale' || reference?.status === 'unavailable') && <Card>
            <Text style={ui.text}>{reference.status === 'unavailable' ? reference.label : 'Reference data could not be refreshed. Using the last saved data.'}</Text>
            <Action label={state.retrying ? 'Retrying…' : 'Retry rates'} disabled={state.retrying} secondary onPress={() => { void state.retry(); }} />
          </Card>}
          {state.pending ? <Text accessibilityLiveRegion="polite" style={ui.muted}>Updating estimate…</Text> : view.status === 'ready' ? null : <Card>
            <Text accessibilityRole={view.status === 'invalid' ? 'alert' : undefined} style={ui.text}>{view.message}</Text>
          </Card>}
          </>}
          </>}
        </>}
        <Text style={[ui.muted, { textAlign: 'center' }]}>Estimates to help you decide. Always check the final price and refund conditions.</Text>
      </KeyboardFormScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  fixedHeader: { paddingHorizontal: 20, paddingVertical: 8, width: '100%', maxWidth: 620, alignSelf: 'center' },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 44, gap: 24, width: '100%', maxWidth: 620, alignSelf: 'center' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  selectedTab: { borderBottomColor: colors.ink },
  tabText: { fontSize: 16, color: colors.muted },
  selectedTabText: { color: colors.ink, fontWeight: '700' },
  shoppingPicker: { alignSelf: 'center', width: '100%', maxWidth: 360 },
});
