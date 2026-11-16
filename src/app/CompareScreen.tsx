import { useAuth } from '../auth/AuthProvider';
import { useBilling } from '../billing/BillingProvider';
import { RefundRulesScreen } from './RefundRulesScreen';
import { SavlyLogo } from '../components/SavlyLogo';
import { HomeSettingsButton } from '../components/HomeSettingsButton';
import { CloudHeaderBackground } from '../components/CloudHeaderBackground';
import { SettingsScreen } from './SettingsScreen';
import { responsive, useWideLayout } from '../components/responsive';
import { KeyboardFormScrollView } from '../components/KeyboardFormScrollView';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, BackHandler, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Action, Card, Field, Select, ui } from '../components/controls';
import { useComparison } from '../features/comparison/useComparison';
import { ResultScreen } from './ResultScreen';
import { SavedScreen } from './SavedScreen';
import type { SavedComparison } from '../storage/saved-comparisons';
import { countryFlag, countryName } from '../features/comparison/countries';
import { currencyForCountry } from '../data/country-catalog';
import { residenceOptions } from '../features/comparison/countries';
import { colors } from '../theme/colors';
import { isHorizontalTabSwipe, tabAfterSwipe } from './tab-swipe';
import { CompareIcon } from '../components/CompareIcon';


export function CompareScreen({ onSignOut }: { onSignOut: () => void }) {
  const billing = useBilling();
  const subject = useAuth().user?.sub;
  const wide = useWideLayout();
  const [rules, setRules] = useState(false);
  const state = useComparison();
  const [page, setPage] = useState<'calculator' | 'result' | 'saved' | 'settings'>('calculator');
  const swipeContext = useRef({ page, ready: state.ready, rules });
  swipeContext.current = { page, ready: state.ready, rules };
  const shouldSwipe = (_event: unknown, gesture: { dx: number; dy: number; numberActiveTouches: number }) => {
    const current = swipeContext.current;
    return current.ready && !current.rules && (current.page === 'calculator' || current.page === 'saved') &&
      gesture.numberActiveTouches <= 1 && isHorizontalTabSwipe(gesture.dx, gesture.dy, 18);
  };
  const swipeResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: shouldSwipe,
    onMoveShouldSetPanResponderCapture: shouldSwipe,
    onPanResponderRelease: (_event, gesture) => {
      const current = swipeContext.current;
      if (current.page !== 'calculator' && current.page !== 'saved') return;
      const next = tabAfterSwipe(current.page, gesture.dx, gesture.dy);
      if (next !== current.page) { Keyboard.dismiss(); setPage(next); }
    },
  })).current;
  const [entry, setEntry] = useState<SavedComparison | null>(null);
  const [resultOrigin, setResultOrigin] = useState<'calculator' | 'saved'>('calculator');
  const goBack = () => setPage('calculator');
  useEffect(() => {
    if (subject) { setPage('calculator'); setRules(false); }
  }, [subject]);
  useEffect(() => {
    if (page === 'calculator') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => subscription.remove();
  }, [page, resultOrigin]);
  const { form, view, reference } = state;
  const snapshot = reference?.snapshot;
  const shopping = snapshot?.countries.find((row) => row.country === form.country);
  const countries = residenceOptions(state.locale).map(option => ({ ...option,
    label: `${option.label} · ${currencyForCountry(option.value) ?? 'Currency unavailable'}` }));
  const error = (field: string) => !state.pending && view.status === 'invalid' && view.field === field ? view.message : undefined;
  const calculate = async () => {
    if (state.pending || state.preparing || view.status !== 'ready') return;
    Keyboard.dismiss();
    const prepared = await state.prepareCalculation();
    if (!prepared || prepared.view.status !== 'ready') return;
    setEntry({ id: Date.now().toString(36) + Math.random().toString(36).slice(2), savedAt: new Date().toISOString(),
      form: { ...prepared.form }, comparison: JSON.parse(JSON.stringify(prepared.view.comparison)) });
    setResultOrigin('calculator'); setPage('result');
  };
  const toggleSettings = () => { Keyboard.dismiss(); setPage(current => current === 'settings' ? 'calculator' : 'settings'); };
  if (page === 'result' && entry) return <ResultScreen key={entry.id} entry={entry} fromSaved={resultOrigin === 'saved'} onBack={goBack} onSettings={toggleSettings} homeCountry={form.residence} locale={state.locale} />;
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <StatusBar style="light" />
    <CloudHeaderBackground />
    {rules && shopping && <RefundRulesScreen country={shopping} locale={state.locale} defaults={snapshot?.environment === 'prototype' || snapshot?.environment.includes(':guest:')} onClose={() => setRules(false)} />}
    <View style={[styles.heading, styles.fixedHeader, wide && responsive.wideContent]}>
      <SavlyLogo light />
      <HomeSettingsButton country={form.residence} locale={state.locale} disabled={!state.ready} expanded={page === 'settings'} onPress={toggleSettings} pill />
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined} {...swipeResponder.panHandlers}>
      <KeyboardFormScrollView style={styles.scroll} contentContainerStyle={[styles.content, wide && responsive.wideContent, wide && styles.wideContent]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
        {!state.ready ? state.startupError ? <Card>
          <Text accessibilityRole="alert" style={ui.error}>Your settings couldn’t load. Please try again.</Text>
          <Action label="Retry loading settings" onPress={state.retryStartup} />
        </Card> : <ActivityIndicator accessibilityLabel="Loading your settings" color={colors.ink} /> : <>
          {page === 'settings' ? <SettingsScreen country={form.residence} currency={form.homeCurrency} locale={state.locale}
            onChange={(country) => state.edit('residence', country)} onBack={goBack} onSignOut={onSignOut} storageError={state.storageError} /> : <>
          <View accessibilityRole="tablist" style={styles.tabs}>
            {(['calculator', 'saved'] as const).map(tab => <Pressable key={tab} accessibilityRole="tab"
              accessibilityState={{ selected: page === tab }} aria-selected={page === tab} onPress={() => { Keyboard.dismiss(); setPage(tab); }}
              style={[styles.tab, page === tab && styles.selectedTab]}>
              <Text style={[styles.tabText, page === tab && styles.selectedTabText]}>{tab === 'calculator' ? 'Calculate' : 'Saved'}</Text>
            </Pressable>)}
          </View>
          {page === 'saved' ? <SavedScreen onOpen={(saved) => { setEntry(saved); setResultOrigin('saved'); setPage('result'); }} /> : <>
          {billing.preview && <Text style={ui.muted}>Browser prototype · billing is not enabled.</Text>}
          <View style={styles.intro}>
            <Text accessibilityRole="header" style={styles.pageTitle}>Compare a price</Text>
            {snapshot && <Text style={styles.subtitle}>{snapshot.environment.includes(':guest:') ? 'Start calculating your savings with FX rates and VAT refunds taken care for you.' : 'Start calculating your savings with FX rates and VAT refunds taken care for you.'}</Text>}
          </View>
          <Select label="Shopping country" value={form.country} options={countries} onChange={(v) => state.edit('country', v)} error={error('country')} tile />
          <View style={wide ? responsive.columns : responsive.stack}>
            <View style={[responsive.stack, wide && responsive.column]}>
            <Field label={`Shopping price (${shopping?.currency ?? 'local currency'})`} value={form.price} onChange={(v) => state.edit('price', v)} numeric locale={state.locale} placeholder="Price overseas, including taxes" error={error('price')} tileIcon="tag" />
            {!form.residence && <Text style={ui.muted}>Set your home country in Settings to calculate savings.</Text>}
            </View>
            <View style={[responsive.stack, wide && responsive.column]}>
            <Field label={`Home price (${form.homeCurrency || 'home currency'})`} value={form.homePrice} onChange={(v) => state.edit('homePrice', v)} numeric locale={state.locale} placeholder="Price at home, including taxes" error={error('homePrice')} tileIcon="home" />
            </View></View>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: state.pending || state.preparing || view.status !== 'ready' }} disabled={state.pending || state.preparing || view.status !== 'ready'} onPress={() => { void calculate(); }} style={({ pressed }) => [styles.calculateButton, (pressed || state.pending || state.preparing || view.status !== 'ready') && { opacity: 0.65 }]}>
              <Text style={styles.calculateText}>{state.preparing ? 'Updating reference data…' : 'Calculate savings'}</Text><CompareIcon name="arrow" color="#FFFFFF" size={28} />
            </Pressable>
            {shopping && <Pressable accessibilityRole="button" accessibilityLabel="VAT refund rules" onPress={() => { Keyboard.dismiss(); setRules(true); }} style={({ pressed }) => [styles.rulesButton, pressed && { opacity: 0.65 }]}>
              <Text style={styles.rulesText}>{countryFlag(shopping.country)}  VAT refund rules</Text><CompareIcon name="chevron" size={22} color="#09184A" />
            </Pressable>}
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
        <Text style={[ui.muted, styles.disclaimer]}>Estimates to help you decide. Always check the final price and refund conditions.</Text>
      </KeyboardFormScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  fixedHeader: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 10, width: '100%', maxWidth: 1080, alignSelf: 'center' },
  screen: { flex: 1, backgroundColor: '#3C90D1' },
  scroll: { flex: 1 },
  content: { marginTop: 54, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, gap: 16, width: '100%', maxWidth: 620, alignSelf: 'center', backgroundColor: '#FFFFFF', borderTopLeftRadius: 36, borderTopRightRadius: 36, minHeight: '100%' },
  wideContent: { marginTop: 24 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  tabs: { flexDirection: 'row', backgroundColor: '#F0F1FA', borderRadius: 28, padding: 3 },
  tab: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderRadius: 26 },
  selectedTab: { backgroundColor: '#091D52' },
  tabText: { fontSize: 16, color: '#09184A', fontWeight: '700' },
  selectedTabText: { color: '#FFFFFF' },
  intro: { gap: 8, marginTop: 12, marginBottom: 6 },
  pageTitle: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1.2, color: '#09184A' },
  subtitle: { fontSize: 17, lineHeight: 24, color: '#09184A', maxWidth: 350 },
  calculateButton: { minHeight: 62, borderRadius: 22, backgroundColor: '#0B2156', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 8, paddingHorizontal: 16 },
  calculateText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  rulesButton: { minHeight: 60, borderRadius: 20, backgroundColor: '#F0F1FA', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, marginTop: 4 },
  rulesText: { color: '#09184A', fontSize: 17, fontWeight: '700' },
  disclaimer: { textAlign: 'center', paddingTop: 8 },
});
