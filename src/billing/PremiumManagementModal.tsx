import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SavlyLogo } from '../components/SavlyLogo';
import { CloudHeaderBackground } from '../components/CloudHeaderBackground';
import { CompareIcon } from '../components/CompareIcon';
import { useWideLayout } from '../components/responsive';
import { ui } from '../components/controls';
import { useBilling } from './BillingProvider';

function dateLabel(value: string, locale: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return date.toLocaleString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function PlanAction({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [secondary ? styles.secondaryAction : styles.primaryAction, (pressed || disabled) && styles.dimmed]}>
    <Text style={secondary ? styles.secondaryActionText : styles.primaryActionText}>{label}</Text>
    <CompareIcon name="arrow" size={secondary ? 22 : 28} color={secondary ? '#09184A' : '#FFFFFF'} />
  </Pressable>;
}

export function PremiumManagementModal({ email, locale, onClose }: { email?: string; locale: string; onClose: () => void }) {
  const billing = useBilling();
  const wide = useWideLayout();
  const { plan } = billing;
  const [opening, setOpening] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const [cancellationHelp, setCancellationHelp] = useState(false);
  const openingRef = useRef(false);
  // Refresh once when opened; provider also refreshes after returning from the store.
  const refresh = useRef(billing.refreshDetails);
  useEffect(() => { refresh.current(); }, []);
  const openManagement = async () => {
    if (!plan?.managementUrl || openingRef.current) return;
    openingRef.current = true; setOpening(true); setLinkError(false);
    try { await Linking.openURL(plan.managementUrl); }
    catch { setLinkError(true); }
    finally { openingRef.current = false; setOpening(false); }
  };
  return <Modal animationType="slide" presentationStyle="pageSheet" supportedOrientations={['portrait', 'landscape-left', 'landscape-right']} onRequestClose={onClose}>
    <SafeAreaProvider><SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="light" />
      <CloudHeaderBackground />
      <View style={styles.header}>
        <SavlyLogo light />
        <Pressable accessibilityRole="button" accessibilityLabel="Close plan details" onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.dimmed]}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, wide && styles.wideContent]}>
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={styles.pageTitle}>Manage Savly Premium</Text>
          {!!email && <Text style={styles.subtitle}>Signed in as {email}</Text>}
        </View>
        {plan ? <>
        <View style={styles.planPanel}>
          <Text accessibilityRole="header" style={styles.planTitle}>{billing.detailsLoading && plan.detailsUnavailable ? 'Loading your plan…' : `${plan.name}${plan.detailsUnavailable ? '' : ' plan'}`}</Text>
          <Text style={styles.status}>{plan.status}</Text>
          <Text style={styles.detail}>Purchased through {plan.storeName}</Text>
          {!!plan.purchasedAt && <Text style={styles.detail}>Purchased on {dateLabel(plan.purchasedAt, locale)}</Text>}
          {plan.expirationDate && <Text style={styles.detail}>{plan.dateLabel} {dateLabel(plan.expirationDate, locale)}</Text>}
          {plan.lifetime && <Text style={styles.detail}>Lifetime access has no renewal or recurring subscription to cancel.</Text>}
          {plan.testStore ? <Text style={styles.note}>Simulated test purchase · No real charges. Test subscriptions use accelerated renewal dates.</Text>
            : plan.sandbox && <Text style={styles.note}>Sandbox purchase · No real charges.</Text>}
          {plan.shared && <Text style={styles.note}>This plan is shared with you. The purchaser manages the subscription.</Text>}
          {plan.otherSubscriptions && <Text style={styles.detail}>You also have an active subscription. Buying Lifetime does not cancel it; manage that subscription separately to stop renewals.</Text>}
        </View>
          {plan.managementUrl && <>
            <Text style={styles.note}>Change or cancel your subscription in the store. The store confirms when changes take effect; opening it does not cancel your plan.</Text>
            <PlanAction label={plan.otherSubscriptions ? 'Manage other subscriptions' : 'Manage subscription'} disabled={opening || billing.busy} onPress={() => { void openManagement(); }} />
          </>}
          {plan.showCancellation && <PlanAction label={plan.otherSubscriptions ? 'Cancel other subscription' : 'Cancel subscription'} secondary disabled={opening || billing.busy}
            onPress={() => { if (plan.managementUrl) void openManagement(); else setCancellationHelp(true); }} />}
          {cancellationHelp && plan.showCancellation && !plan.managementUrl && <Text accessibilityRole="alert" style={styles.detail}>{plan.testStore
            ? 'This simulated subscription can’t be canceled from Savly. Manage test purchases in the RevenueCat dashboard, or wait for the test subscription to expire automatically. No real charges are made.'
            : `To cancel, open your subscription settings in ${plan.storeName} and select Savly. Your access remains until the verified end date; Savly checks for changes when you return.`}</Text>}
          {!plan.managementUrl && !plan.lifetime && !plan.shared && <Text style={styles.note}>{plan.testStore
            ? 'In-app cancellation is unavailable for this test purchase. Manage test purchases in the RevenueCat dashboard.'
            : 'A subscription-management link is unavailable. You can manage your subscription in the store where you purchased it.'}</Text>}
          {linkError && <Text accessibilityRole="alert" style={ui.error}>Couldn’t open subscription management. Try again or open your store’s subscription settings.</Text>}
          {plan.detailsUnavailable && !billing.detailsLoading && <Text style={styles.note}>We couldn’t load the plan’s product details. Your access status is shown above.</Text>}
        </> : <View style={styles.planPanel}><Text style={styles.detail}>{billing.busy ? 'Loading your subscription…' : 'No Savly Premium plan was found for this billing customer.'}</Text></View>}
        {!!billing.message && <Text accessibilityLiveRegion="polite" style={styles.note}>{billing.message}</Text>}
      </ScrollView>
    </SafeAreaView></SafeAreaProvider>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#3C90D1' },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 10, width: '100%', maxWidth: 1080, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  closeButton: { minHeight: 44, paddingHorizontal: 18, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#09184A', fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { marginTop: 54, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, gap: 16, width: '100%', maxWidth: 620, alignSelf: 'center', backgroundColor: '#FFFFFF', borderTopLeftRadius: 36, borderTopRightRadius: 36, minHeight: '100%' },
  wideContent: { marginTop: 24 },
  intro: { gap: 8, marginTop: 12, marginBottom: 6 },
  pageTitle: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1.2, color: '#09184A' },
  subtitle: { fontSize: 17, lineHeight: 24, color: '#09184A' },
  planPanel: { backgroundColor: '#F2F3FA', borderRadius: 22, padding: 20, gap: 12 },
  planTitle: { color: '#09184A', fontSize: 24, lineHeight: 30, fontWeight: '800' },
  status: { color: '#09184A', fontSize: 16, lineHeight: 23, fontWeight: '700' },
  detail: { color: '#09184A', fontSize: 16, lineHeight: 24 },
  note: { color: '#596277', fontSize: 14, lineHeight: 21 },
  primaryAction: { minHeight: 62, borderRadius: 22, backgroundColor: '#0B2156', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 16 },
  primaryActionText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', flexShrink: 1 },
  secondaryAction: { minHeight: 60, borderRadius: 20, backgroundColor: '#F0F1FA', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 22 },
  secondaryActionText: { color: '#09184A', fontSize: 17, fontWeight: '700', flexShrink: 1 },
  dimmed: { opacity: 0.65 },
});
