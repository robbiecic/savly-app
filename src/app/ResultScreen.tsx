import { RefundRulesScreen } from './RefundRulesScreen';
import { formatResultNumber, formatSummaryMoney, maskSavingsAmount } from '../features/comparison/number-display';
import { useAuth } from '../auth/AuthProvider';
import { useBilling } from '../billing/BillingProvider';
import { SavlyLogo } from '../components/SavlyLogo';
import { HomeSettingsButton } from '../components/HomeSettingsButton';
import { CloudHeaderBackground } from '../components/CloudHeaderBackground';
import { staleFxBadge } from '../data/fx-freshness';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { responsive, useWideLayout } from '../components/responsive';
import { ItemPhoto } from '../components/ItemPhoto';
import { pickPhoto } from '../features/photos/pick-photo';
import { KeyboardFormScrollView } from '../components/KeyboardFormScrollView';
import Svg, { Path } from 'react-native-svg';
import { D } from '../domain/decimal';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ResultAction } from '../components/ResultAction';
import { Action, Field, ui } from '../components/controls';
import { fxLabel, savingsLabel } from '../features/comparison/model';
import { openShare, shareMessage } from '../features/comparison/sharing';
import { appShareLink } from '../config/sharing';
import { colors } from '../theme/colors';
import { savedComparisons } from '../storage/mobile-saved-comparisons';
import type { SavedComparison } from '../storage/saved-comparisons';

export function ResultScreen({ entry, onBack, onSettings, fromSaved, homeCountry, locale }: { entry: SavedComparison; onBack: () => void; onSettings: () => void; fromSaved: boolean; homeCountry: string; locale: string }) {
  const { user, openSignUp } = useAuth();
  const billing = useBilling();
  const wide = useWideLayout();
  const [rules, setRules] = useState(false);
  const now = useCurrentTime();
  const comparison = entry.comparison;
  const [name, setName] = useState(comparison.itemName);
  const [photoUri, setPhotoUri] = useState(entry.photoUri);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const choosePhoto = async (source: 'camera' | 'library') => {
    setPhotoBusy(true); setPhotoError('');
    try {
      const uri = await pickPhoto(source);
      if (uri) setPhotoUri(uri);
    } catch (error) { setPhotoError(error instanceof Error && /Camera access|too large|No photo/.test(error.message) ? error.message : 'Couldn’t open this photo. Please try again or choose another image.'); }
    finally { setPhotoBusy(false); }
  };
  const [saved, setSaved] = useState(fromSaved);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const save = async () => {
    if (!name.trim()) { setSaveError('Enter an item name to save this comparison.'); return; }
    setSaving(true); setSaveError('');
    try {
      await savedComparisons.save({ ...entry, ...(photoUri ? { photoUri } : {}), form: { ...entry.form, itemName: name.trim() }, comparison: { ...comparison, itemName: name.trim() } });
      setSaved(true);
    } catch { setSaveError('Couldn’t save on this device. Please try again.'); }
    finally { setSaving(false); }
  };
  const [details, setDetails] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(false);
  const r = comparison.result;
  const rateBadge = staleFxBadge(r.fx, now) ?? (r.fx.source === 'Built-in defaults' ? 'Estimate · Default rates' : comparison.sample ? 'Sample estimate' : null);
  const number = (value: string) => formatResultNumber(value, locale);
  const summaryMoney = (value: string) => formatSummaryMoney(value, r.homeCurrency, locale);
  const favorable = r.savings?.outcome === 'save';
  const previewAmount = !(user && billing.active);
  const displaySummaryMoney = (value: string) => previewAmount ? maskSavingsAmount(summaryMoney(value)) : summaryMoney(value);
  const summary = savingsLabel(r, number, displaySummaryMoney);
  const money = (value: string) => `${r.homeCurrency} ${number(value)}`;
  const share = async () => {
    // Capture exactly the displayed snapshot before opening the native sheet.
    const message = shareMessage({ ...comparison, itemName: name.trim() }, appShareLink,
      previewAmount && r.savings && r.savings.outcome !== 'same' ? displaySummaryMoney(r.savings.amount.replace('-', '')) : undefined);
    setSharing(true); setShareError(false);
    const outcome = await openShare(message, (content) => Share.share(content));
    setShareError(outcome === 'failed'); setSharing(false);
  };
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <StatusBar style="light" />
    <CloudHeaderBackground />
    {rules && <RefundRulesScreen country={comparison.refundCountry ?? { country: entry.form.country, currency: r.shoppingCurrency, vatRate: null }} locale={locale} saved onClose={() => setRules(false)} />}
    <View style={[styles.brandHeader, wide && responsive.wideContent]}>
      <SavlyLogo light />
      <HomeSettingsButton country={homeCountry} locale={locale} onPress={onSettings} pill />
    </View>
    <View style={[styles.backRow, wide && responsive.wideContent]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to calculator" onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.5 }]}>
        <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false} aria-hidden>
          <Path d="m14 6-6 6 6 6" fill="none" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
    <KeyboardFormScrollView style={styles.scroll} contentContainerStyle={[styles.content, wide && responsive.wideContent, wide && styles.wideContent]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
    <Text accessibilityRole="header" style={styles.pageTitle}>Your savings</Text>
      {!!summary && <View style={[styles.summary, favorable && styles.summaryPositive]}>
        <Text style={[styles.summaryText, favorable && { color: '#073545' }]}>{summary}</Text>
        {previewAmount && r.savings && r.savings.outcome !== 'same' && <Action label="Get Premium" onPress={() => user ? billing.checkEntitlement() : openSignUp()} />}
        {(r.refund.kind === 'vat-unavailable' || (r.refund.kind === 'scheme' && r.refund.assessment.status !== 'potential')) && <Text style={ui.text}>Compared without a VAT refund.</Text>}
        {r.savings && r.savings.outcome !== 'same' && !previewAmount && <Text style={[styles.percentage, favorable && styles.positivePercentage]}>{number(r.savings.percentage.replace('-', ''))}% {favorable ? 'less' : 'more'} than at home</Text>}
      </View>}
    {!summary && <View style={styles.summary}>
      <Text style={styles.summaryText}>{r.priceDifference != null
        ? new D(r.priceDifference).isZero() ? 'Same price before VAT refund'
          : `${displaySummaryMoney(r.priceDifference.replace('-', ''))} ${new D(r.priceDifference).gt(0) ? 'less' : 'more'} before VAT refund`
        : comparison.homePrice ? 'Final savings unavailable' : 'Add a home price to see savings'}</Text>
      <Text style={ui.text}>{comparison.homePrice
        ? 'Final savings are unavailable because the VAT refund is unknown. Any price difference shown excludes a VAT refund.'
        : 'Go back to Calculate and enter the price at home to compare savings.'}</Text>
    </View>}

    {rateBadge && <Text style={styles.badge}>{rateBadge}</Text>}
    {comparison.refundAssessment && <Text style={ui.muted}>{comparison.refundAssessment.status === 'potential' ? 'Purchase minimum met. Refund assumes all included VAT is returned; eligibility and provider fees still need confirmation.' : comparison.refundAssessment.reason}</Text>}
    {r.refund.kind === 'manual' && <Text style={ui.muted}>Manual refund amount applied instead of the automatic scheme check. Eligibility is not verified.</Text>}
    {saved && !!name.trim() && <Text style={ui.title}>{name.trim()}</Text>}
    {!saved && <Field label="Name for saved comparison" value={name} onChange={setName} placeholder="e.g. Travel bag" outlined />}

    {!!photoUri && <ItemPhoto key={photoUri} uri={photoUri} name={name} />}
    {!saved && <View style={{ gap: 12 }}>
      <Text style={ui.label}>Item photo (optional)</Text>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'stretch' }}>
      <ResultAction icon="camera" label="Take photo" disabled={photoBusy || saving} onPress={() => { void choosePhoto('camera'); }} />
      <ResultAction icon="image" label="Add photo" disabled={photoBusy || saving} onPress={() => { void choosePhoto('library'); }} />
      </View>
      {!!photoUri && <Action label="Remove photo" secondary disabled={photoBusy || saving} onPress={() => { setPhotoUri(undefined); setPhotoError(''); }} />}
      {photoBusy && <Text style={ui.muted}>Preparing photo…</Text>}
      {!!photoError && <Text accessibilityRole="alert" style={ui.error}>{photoError}</Text>}
    </View>}

    {!!saveError && <Text accessibilityRole="alert" style={ui.error}>{saveError}</Text>}
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'stretch' }}>
      <ResultAction icon="heart" filled={saved} label={saved ? 'Saved' : saving ? 'Saving…' : 'Save'}
        accessibilityLabel={saved ? 'Saved on this device' : saving ? 'Saving…' : 'Save'}
        disabled={saved || saving || photoBusy} onPress={() => { void save(); }} />
      <ResultAction icon="share" label={sharing ? 'Sharing…' : 'Share'}
        accessibilityLabel={sharing ? 'Opening share sheet…' : favorable ? 'Share savings' : 'Share comparison'}
        disabled={sharing} onPress={() => { void share(); }} />
    </View>
    {shareError && <Text accessibilityRole="alert" style={ui.error}>Sharing couldn’t open. Please try again.</Text>}
    <Text style={ui.muted}>Saved comparisons stay on this device. No cloud backup.</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: details }} onPress={() => setDetails(!details)} style={({ pressed }) => [styles.detailsButton, pressed && { opacity: 0.7 }]}>
      <Text style={styles.detailsButtonText}>{details ? 'Hide details' : 'Expand details'}</Text>
      <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false} aria-hidden>
        <Path d={details ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} fill="none" stroke="#09184A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
    {details && <View style={[responsive.stack, styles.detailsPanel]}>
    <View style={{ gap: 16 }}>
      <View style={styles.row}><Text style={ui.text}>Shopping in</Text><Text style={ui.text}>{entry.form.country}</Text></View>
      <View style={styles.row}><Text style={ui.text}>Home Country</Text><Text style={ui.text}>{entry.form.residence}</Text></View>
      <View style={styles.row}><Text style={ui.text}>Date calculated</Text><Text style={ui.text}>{new Date(entry.savedAt).toLocaleDateString()}</Text></View>
      <View style={styles.row}><Text style={ui.text}>Shopping price</Text><Text style={ui.text}>{r.shoppingCurrency} {number(comparison.price)}</Text></View>
      <View style={styles.row}><Text style={ui.text}>Converted price</Text><Text style={ui.text}>{money(r.convertedCost)}</Text></View>
      {new D(r.cardFee).gt(0) && <View style={styles.row}><Text style={ui.text}>Card fee (saved estimate)</Text><Text style={ui.text}>{money(r.cardFee)}</Text></View>}
      <View><Text style={ui.muted}>Without VAT refund</Text><Text style={styles.total}>{money(r.withoutRefund)}</Text></View>
      {r.priceDifference != null && <View style={styles.row}><Text style={ui.text}>Price difference before refund</Text><Text style={ui.text}>{money(r.priceDifference)}</Text></View>}
      {!!r.refundBreakdown && <>
        <View style={styles.row}><Text style={ui.text}>VAT refund before fee (estimate)</Text><Text style={ui.text}>{money(r.refundBreakdown.grossHome)}</Text></View>
        <View style={styles.row}><Text style={ui.text}>Refund fee ({number(new D(r.refundBreakdown.feeRate).mul(100).toFixed())}% assumed)</Text><Text style={ui.text}>−{money(r.refundBreakdown.feeHome)}</Text></View>
      </>}
      {r.refundHome !== null && r.withRefund !== null ? <>
        <View style={styles.row}><Text style={ui.text}>{r.refundBreakdown ? 'Net VAT refund (estimate)' : 'Estimated VAT refund'}</Text><Text style={ui.text}>{money(r.refundHome)}</Text></View>
        <View><Text style={ui.muted}>With VAT refund</Text><Text style={styles.total}>{money(r.withRefund)}</Text></View>
        <Text style={ui.muted}>{r.refund.kind === 'vat-assumption' ? 'Assumes included VAT is refundable; any modeled fee is shown above. Eligibility is not verified' : 'Estimated refund, subject to eligibility'}{r.refund.kind === 'manual' ? ' · Manual amount' : ''}.</Text>
      </> : <Text style={ui.muted}>{r.refund.kind === 'vat-unavailable' ? 'VAT refund unavailable: no VAT rate supplied. The comparison uses the overseas price without a refund.' : 'Refund estimate unavailable. This comparison excludes a refund.'}</Text>}
      {!!comparison.homePrice && <View style={styles.row}><Text style={ui.text}>Home comparison price</Text><Text style={ui.text}>{money(comparison.homePrice)}</Text></View>}
      {!comparison.homePrice && <Text style={ui.muted}>Add a home price to compare potential savings.</Text>}
    </View>
    <View style={{ gap: 10 }}>
      <Text selectable style={ui.text}>{fxLabel(r.fx, number)}</Text>
      {!!r.fx.asOf && <Text style={ui.muted}>{r.fx.source === 'Built-in defaults' ? 'Default rate date' : comparison.sample ? 'Sample rate date' : 'FX rate date'}: {r.fx.asOf}</Text>}
      {!!r.fx.inverted && <Text style={ui.muted}>Calculated from {r.fx.originalPair} at {r.fx.originalRate ? number(r.fx.originalRate) : r.fx.originalRate}.</Text>}
      <Action label="VAT refund rules" secondary onPress={() => setRules(true)} />
      <Text style={ui.muted}>Included VAT: {r.includedVat === null ? 'Unknown' : `${r.shoppingCurrency} ${number(r.includedVat)}`}</Text>
      {r.refund.kind === 'sample' && r.refund.assumptions.map((text) => <Text key={text} style={ui.muted}>{text}</Text>)}
      {r.assumptions.map((text) => <Text key={text} style={ui.muted}>{text}</Text>)}
    </View>
    </View>}
  </KeyboardFormScrollView></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  brandHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, width: '100%', maxWidth: 1080, alignSelf: 'center' },
  backRow: { paddingHorizontal: 18, width: '100%', maxWidth: 1080, alignSelf: 'center' },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: '#3C90D1' },
  scroll: { flex: 1 },
  content: { marginTop: 16, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 44, gap: 18, width: '100%', maxWidth: 620, alignSelf: 'center', backgroundColor: '#FFFFFF', borderTopLeftRadius: 36, borderTopRightRadius: 36, minHeight: '100%' },
  wideContent: { marginTop: 8 },
  pageTitle: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1.2, color: '#09184A', marginBottom: 12 },
  badge: { color: '#3F506B', fontSize: 12, fontWeight: '700', backgroundColor: '#E9EDF5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, alignSelf: 'flex-start' },
  total: { color: colors.ink, fontSize: 32, fontWeight: '700', paddingTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  summary: { padding: 22, borderRadius: 22, backgroundColor: '#F0F2F7', gap: 10, minHeight: 116, justifyContent: 'center' },
  summaryPositive: { backgroundColor: '#DDF9ED' },
  summaryText: { color: colors.ink, fontWeight: '800', fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  percentage: { color: '#09184A', fontSize: 14, fontWeight: '700', alignSelf: 'flex-start' },
  positivePercentage: { backgroundColor: '#A5F3D1', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  infoStrip: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, backgroundColor: '#F0F1FA', paddingHorizontal: 16, paddingVertical: 12 },
  infoIcon: { fontSize: 22, color: '#09184A' },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#09184A' },
  detailsButton: { minHeight: 60, borderRadius: 20, backgroundColor: '#F0F1FA', paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  detailsButtonText: { color: '#09184A', fontSize: 17, fontWeight: '700' },
  detailsPanel: { backgroundColor: '#F7F8FC', borderRadius: 20, padding: 18 },
});
