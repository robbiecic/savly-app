import { isFxStale } from '../data/fx-freshness';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { responsive, useWideLayout } from '../components/responsive';
import { ItemPhoto } from '../components/ItemPhoto';
import { pickPhoto } from '../features/photos/pick-photo';
import { KeyboardFormScrollView } from '../components/KeyboardFormScrollView';
import Svg, { Path } from 'react-native-svg';
import { D } from '../domain/decimal';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ResultAction } from '../components/ResultAction';
import { Action, Card, Field, ui } from '../components/controls';
import { fxLabel, savingsLabel } from '../features/comparison/model';
import { openShare, shareMessage } from '../features/comparison/sharing';
import { appShareLink } from '../config/sharing';
import { colors } from '../theme/colors';
import { savedComparisons } from '../storage/mobile-saved-comparisons';
import type { SavedComparison } from '../storage/saved-comparisons';

export function ResultScreen({ entry, onBack, fromSaved }: { entry: SavedComparison; onBack: () => void; fromSaved: boolean }) {
  const wide = useWideLayout();
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
  const summary = savingsLabel(r);
  const favorable = r.savings?.outcome === 'save';
  const money = (value: string) => `${r.homeCurrency} ${value}`;
  const share = async () => {
    // Capture exactly the displayed snapshot before opening the native sheet.
    const message = shareMessage({ ...comparison, itemName: name.trim() }, appShareLink);
    setSharing(true); setShareError(false);
    const outcome = await openShare(message, (content) => Share.share(content));
    setShareError(outcome === 'failed'); setSharing(false);
  };
  return <SafeAreaView style={styles.screen}>
    <View style={[styles.header, wide && responsive.wideContent]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to calculator" onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.5 }]}>
        <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false} aria-hidden>
          <Path d="m14 6-6 6 6 6" fill="none" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      <Text accessibilityRole="header" style={[ui.title, styles.headerTitle]}>Your savings</Text>
      <View style={styles.back} />
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
    <KeyboardFormScrollView contentContainerStyle={[styles.content, wide && responsive.wideContent]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
    <Card>
    {!!comparison.itemName && <Text style={ui.title}>{comparison.itemName}</Text>}
    <Text style={ui.muted}>{entry.form.country} → {entry.form.residence} · {new Date(entry.savedAt).toLocaleDateString()}</Text>
    <Text style={styles.badge}>{r.fx.source === 'Built-in defaults' ? 'Estimate · Default rates' : comparison.sample ? 'Sample estimate' : 'Estimated cost'}{isFxStale(r.fx, now) ? ' · Rates out of date' : ''}</Text>
    {isFxStale(r.fx, now) && <Text accessibilityRole="alert" style={{ backgroundColor: '#FFF2D6', color: '#714300', padding: 14, borderRadius: 12 }}>FX rate is stale (over 48 hours old or its date cannot be verified). This estimate may differ from current prices.</Text>}
      {!!summary && <View style={[styles.summary, favorable && { backgroundColor: '#E0F3E6' }]}>
        <Text style={[styles.summaryText, favorable && { color: '#176534' }]}>{summary}</Text>
        {r.savings?.outcome !== 'same' && <Text style={ui.text}>{r.savings?.percentage.replace('-', '')}% {favorable ? 'less' : 'more'} than at home</Text>}
      </View>}
    <View style={wide ? responsive.columns : responsive.stack}>
    <View style={[responsive.stack, wide && responsive.column]}>
    <View style={{ gap: 16 }}>
      <View style={styles.row}><Text style={ui.text}>Shopping price</Text><Text style={ui.text}>{r.shoppingCurrency} {comparison.price}</Text></View>
      <View style={styles.row}><Text style={ui.text}>Converted price</Text><Text style={ui.text}>{money(r.convertedCost)}</Text></View>
      {new D(r.cardFee).gt(0) && <View style={styles.row}><Text style={ui.text}>Card fee (saved estimate)</Text><Text style={ui.text}>{money(r.cardFee)}</Text></View>}
      <View><Text style={ui.muted}>Without VAT refund</Text><Text style={styles.total}>{money(r.withoutRefund)}</Text></View>
      {r.priceDifference != null && <View style={styles.row}><Text style={ui.text}>Price difference before refund</Text><Text style={ui.text}>{money(r.priceDifference)}</Text></View>}
      {!!r.refundBreakdown && <>
        <View style={styles.row}><Text style={ui.text}>VAT refund before fee (estimate)</Text><Text style={ui.text}>{money(r.refundBreakdown.grossHome)}</Text></View>
        <View style={styles.row}><Text style={ui.text}>Refund fee ({new D(r.refundBreakdown.feeRate).mul(100).toFixed()}% assumed)</Text><Text style={ui.text}>−{money(r.refundBreakdown.feeHome)}</Text></View>
      </>}
      {r.refundHome !== null && r.withRefund !== null ? <>
        <View style={styles.row}><Text style={ui.text}>{r.refundBreakdown ? 'Net VAT refund (estimate)' : 'Estimated VAT refund'}</Text><Text style={ui.text}>{money(r.refundHome)}</Text></View>
        <View><Text style={ui.muted}>With VAT refund</Text><Text style={styles.total}>{money(r.withRefund)}</Text></View>
        <Text style={ui.muted}>Estimated refund, subject to eligibility{r.refund.kind === 'manual' ? ' · Manual amount' : ''}.</Text>
      </> : <Text style={ui.muted}>Refund estimate unavailable. Add a known refund under Edit assumptions, or compare the cost before a refund.</Text>}
      {!!comparison.homePrice && <View style={styles.row}><Text style={ui.text}>Home comparison price</Text><Text style={ui.text}>{money(comparison.homePrice)}</Text></View>}
      {!comparison.homePrice && <Text style={ui.muted}>Add a home price to compare potential savings.</Text>}
    </View>
    <Action label={details ? 'Hide rate details' : 'Rate details & assumptions'} secondary expanded={details} onPress={() => setDetails(!details)} />
    {details && <View style={{ gap: 10 }}>
      <Text selectable style={ui.text}>{fxLabel(r.fx)}</Text>
      {!!r.fx.asOf && <Text style={ui.muted}>{r.fx.source === 'Built-in defaults' ? 'Default rate timestamp' : comparison.sample ? 'Sample source timestamp' : 'Source timestamp'}: {r.fx.asOf}</Text>}
      {!!r.fx.inverted && <Text style={ui.muted}>Calculated from {r.fx.originalPair} at {r.fx.originalRate}.</Text>}
      <Text style={ui.muted}>Included VAT: {r.includedVat === null ? 'Unknown' : `${r.shoppingCurrency} ${r.includedVat}`}</Text>
      {r.refund.kind === 'sample' && r.refund.assumptions.map((text) => <Text key={text} style={ui.muted}>{text}</Text>)}
      {r.assumptions.map((text) => <Text key={text} style={ui.muted}>{text}</Text>)}
    </View>}
    </View>
    <View style={[responsive.stack, wide && responsive.column]}>
    {!saved && <Field label="Name for saved comparison" value={name} onChange={setName} placeholder="e.g. Travel bag" />}

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
    <Text style={ui.muted}>Saved comparisons stay on this device. No cloud backup.</Text>
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'stretch' }}>
      <ResultAction icon="heart" filled={saved} label={saved ? 'Saved' : saving ? 'Saving…' : 'Save'}
        accessibilityLabel={saved ? 'Saved on this device' : saving ? 'Saving…' : 'Save'}
        disabled={saved || saving || photoBusy} onPress={() => { void save(); }} />
      <ResultAction icon="share" label={sharing ? 'Sharing…' : 'Share'}
        accessibilityLabel={sharing ? 'Opening share sheet…' : favorable ? 'Share savings' : 'Share comparison'}
        disabled={sharing} onPress={() => { void share(); }} />
    </View>
    {shareError && <Text accessibilityRole="alert" style={ui.error}>Sharing couldn’t open. Please try again.</Text>}
  </View></View></Card></KeyboardFormScrollView></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, width: '100%', maxWidth: 620, alignSelf: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20 },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 44, gap: 24, width: '100%', maxWidth: 620, alignSelf: 'center' },
  badge: { color: '#3F506B', fontSize: 12, fontWeight: '700', backgroundColor: '#E9EDF5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  total: { color: colors.ink, fontSize: 32, fontWeight: '700', paddingTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  summary: { padding: 20, borderRadius: 16, backgroundColor: '#F0F2F7', gap: 8 },
  summaryText: { color: colors.ink, fontWeight: '700', fontSize: 24 },
});
