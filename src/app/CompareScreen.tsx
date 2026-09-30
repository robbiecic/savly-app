import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Action, Card, Field, Select, ui } from '../components/controls';
import { useComparison } from '../features/comparison/useComparison';
import { availableCurrencies, fxLabel, savingsLabel, type DisplayedComparison } from '../features/comparison/model';
import { countryName, residenceOptions } from '../features/comparison/countries';
import { openShare, shareMessage } from '../features/comparison/sharing';
import { appShareLink } from '../config/sharing';
import { colors } from '../theme/colors';

function Result({ comparison }: { comparison: DisplayedComparison }) {
  const [details, setDetails] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(false);
  const r = comparison.result;
  const summary = savingsLabel(r);
  const favorable = r.savings?.outcome === 'save';
  const money = (value: string) => `${r.homeCurrency} ${value}`;
  const share = async () => {
    // Capture exactly the displayed snapshot before opening the native sheet.
    const message = shareMessage(comparison, appShareLink);
    setSharing(true); setShareError(false);
    const outcome = await openShare(message, (content) => Share.share(content));
    setShareError(outcome === 'failed'); setSharing(false);
  };
  return <Card>
    <Text accessibilityRole="header" style={ui.title}>Your comparison</Text>
    <Text style={styles.badge}>{comparison.sample ? 'Sample estimate' : 'Estimated cost'}{comparison.stale ? ' · Rates out of date' : ''}</Text>
    <View accessibilityLiveRegion="polite" style={{ gap: 16 }}>
      <View><Text style={ui.muted}>Without VAT refund</Text><Text style={styles.total}>{money(r.withoutRefund)}</Text></View>
      {r.refundHome !== null && r.withRefund !== null ? <>
        <View style={styles.row}><Text style={ui.text}>Estimated VAT refund</Text><Text style={ui.text}>{money(r.refundHome)}</Text></View>
        <View><Text style={ui.muted}>With VAT refund</Text><Text style={styles.total}>{money(r.withRefund)}</Text></View>
        <Text style={ui.muted}>Estimated refund, subject to eligibility{r.refund.kind === 'manual' ? ' · Manual amount' : ''}.</Text>
      </> : <Text style={ui.muted}>Refund estimate unavailable. Add a known refund under Edit assumptions, or compare the cost before a refund.</Text>}
      {!!summary && <View style={[styles.summary, favorable && { backgroundColor: '#E0F3E6' }]}>
        <Text style={[styles.summaryText, favorable && { color: '#176534' }]}>{summary}</Text>
        {r.savings?.outcome !== 'same' && <Text style={ui.text}>{r.savings?.percentage.replace('-', '')}% {favorable ? 'less' : 'more'} than at home</Text>}
      </View>}
      {!comparison.homePrice && <Text style={ui.muted}>Add a home price to compare potential savings.</Text>}
    </View>
    <Action label={details ? 'Hide rate details' : 'Rate details & assumptions'} secondary expanded={details} onPress={() => setDetails(!details)} />
    {details && <View style={{ gap: 10 }}>
      <Text selectable style={ui.text}>{fxLabel(r.fx)}</Text>
      {!!r.fx.asOf && <Text style={ui.muted}>{comparison.sample ? 'Sample source timestamp' : 'Source timestamp'}: {r.fx.asOf}</Text>}
      {!!r.fx.inverted && <Text style={ui.muted}>Calculated from {r.fx.originalPair} at {r.fx.originalRate}.</Text>}
      <Text style={ui.muted}>Card fee: {money(r.cardFee)} · Included VAT: {r.includedVat === null ? 'Unknown' : `${r.shoppingCurrency} ${r.includedVat}`}</Text>
      {r.refund.kind === 'sample' && r.refund.assumptions.map((text) => <Text key={text} style={ui.muted}>{text}</Text>)}
      {r.assumptions.map((text) => <Text key={text} style={ui.muted}>{text}</Text>)}
    </View>}
    <Action label={sharing ? 'Opening share sheet…' : favorable ? 'Share savings' : 'Share comparison'} disabled={sharing} onPress={() => { void share(); }} />
    {appShareLink.demo && <Text style={ui.muted}>Sharing includes a demo link. App download links are not available yet.</Text>}
    {shareError && <Text accessibilityRole="alert" style={ui.error}>Sharing couldn’t open. Please try again.</Text>}
  </Card>;
}

export function CompareScreen() {
  const state = useComparison();
  const [settings, setSettings] = useState<boolean | null>(null);
  const [assumptions, setAssumptions] = useState(false);
  const { form, view, reference } = state;
  const snapshot = reference?.snapshot;
  const shopping = snapshot?.countries.find((row) => row.country === form.country);
  const residences = useMemo(() => residenceOptions(state.locale), [state.locale]);
  const countries = snapshot?.countries.map((row) => ({ value: row.country, label: `${countryName(row.country, state.locale)} · ${row.currency}` })) ?? [];
  const currencies = snapshot ? availableCurrencies(snapshot).map((value) => ({ value, label: value })) : [];
  const error = (field: string) => !state.pending && view.status === 'invalid' && view.field === field ? view.message : undefined;
  const showSettings = (settings ?? !form.residence) || !!error('country') || !!error('homeCurrency');
  return <SafeAreaView style={styles.screen}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heading}><Text style={styles.brand}>Savly</Text><Text style={styles.badge}>SAMPLE PROTOTYPE</Text></View>
        <View style={{ gap: 8 }}><Text accessibilityRole="header" style={styles.headline}>A little clarity{ '\n' }before you buy.</Text><Text style={ui.muted}>Shop globally. Compare what you could pay at home.</Text></View>
        {!state.ready ? state.startupError ? <Card>
          <Text accessibilityRole="alert" style={ui.error}>Your settings couldn’t load. Please try again.</Text>
          <Action label="Retry loading settings" onPress={state.retryStartup} />
        </Card> : <ActivityIndicator accessibilityLabel="Loading your settings" color={colors.ink} /> : <>
          <Card>
            <Text accessibilityRole="header" style={ui.title}>Compare a price</Text>
            <Field label={`Shopping price (${shopping?.currency ?? 'local currency'})`} value={form.price} onChange={(v) => state.edit('price', v)} numeric prominent placeholder="0.00" error={error('price')} />
            <Text style={ui.muted}>Enter the full price, including any local purchase tax.</Text>
            <Action label={`${countryName(form.country || 'FR', state.locale)} → ${form.homeCurrency} · ${showSettings ? 'Hide' : 'Edit'} settings`} secondary expanded={showSettings} onPress={() => setSettings(!showSettings)} />
            {(showSettings) && <View style={{ gap: 16 }}>
              <Select label="Shopping country" value={form.country} options={countries} onChange={(v) => state.edit('country', v)} error={error('country')} />
              <Select label="Home currency" value={form.homeCurrency} options={currencies} onChange={(v) => state.edit('homeCurrency', v)} error={error('homeCurrency')} />
              <Select label="Country of residence" value={form.residence} options={residences} onChange={(v) => state.edit('residence', v)} />
              <Text style={ui.muted}>Residency is separate from currency. Refund eligibility is not verified.</Text>
            </View>}
            <Field label={`Home price (${form.homeCurrency}, optional)`} value={form.homePrice} onChange={(v) => state.edit('homePrice', v)} numeric placeholder="Price at home, including taxes" error={error('homePrice')} />
            <Field label="Item name (optional)" value={form.itemName} onChange={(v) => state.edit('itemName', v)} placeholder="What caught your eye?" />
            <Action label={assumptions ? 'Close assumptions' : 'Edit assumptions'} secondary expanded={assumptions} onPress={() => setAssumptions(!assumptions)} />
            {(assumptions || error('fxOverride') || error('refundOverride') || error('feePercent')) && <View style={{ gap: 16 }}>
              <Text style={ui.muted}>Leave FX and refund blank to use automatic values. Manual values apply only to this comparison.</Text>
              <Field label="Additional bank fee (%)" value={form.feePercent} onChange={(v) => state.edit('feePercent', v)} numeric error={error('feePercent') ?? error('bankFee')} />
              {shopping?.currency !== form.homeCurrency && <Field label={`Manual FX (${form.homeCurrency} per ${shopping?.currency ?? 'shopping unit'})`} value={form.fxOverride} onChange={(v) => state.edit('fxOverride', v)} numeric placeholder="Automatic rate" error={error('fxOverride')} />}
              <Field label={`Manual refund (${shopping?.currency ?? 'shopping currency'})`} value={form.refundOverride} onChange={(v) => state.edit('refundOverride', v)} numeric placeholder="Automatic estimate, if available" error={error('refundOverride')} />
              <Action label="Reset FX and refund to automatic" secondary onPress={state.reset} />
            </View>}
          </Card>
          {state.storageError && <Text accessibilityRole="alert" style={ui.error}>Settings couldn’t be saved on this device.</Text>}
          {(reference?.status === 'stale' || reference?.status === 'unavailable') && <Card>
            <Text style={ui.text}>{reference.label}</Text>
            <Action label={state.retrying ? 'Retrying…' : 'Retry rates'} disabled={state.retrying} secondary onPress={() => { void state.retry(); }} />
          </Card>}
          {state.pending ? <Text accessibilityLiveRegion="polite" style={ui.muted}>Updating estimate…</Text> : view.status === 'ready' ? <Result comparison={view.comparison} /> : <Card>
            <Text accessibilityRole={view.status === 'invalid' ? 'alert' : undefined} style={ui.text}>{view.message}</Text>
          </Card>}
        </>}
        <Text style={[ui.muted, { textAlign: 'center' }]}>Estimates to help you decide. Always check the final price and refund conditions.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 44, gap: 24, width: '100%', maxWidth: 620, alignSelf: 'center' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  brand: { fontSize: 32, fontWeight: '800', color: colors.ink },
  badge: { color: '#3F506B', fontSize: 12, fontWeight: '700', backgroundColor: '#E9EDF5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  headline: { fontSize: 34, fontWeight: '700', color: colors.ink, lineHeight: 41 },
  total: { color: colors.ink, fontSize: 32, fontWeight: '700', paddingTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  summary: { padding: 20, borderRadius: 16, backgroundColor: '#F0F2F7', gap: 8 },
  summaryText: { color: colors.ink, fontWeight: '700', fontSize: 24 },
});
