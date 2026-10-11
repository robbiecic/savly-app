import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Action, Card, ui } from '../components/controls';
import { colors } from '../theme/colors';
import { useBilling } from './BillingProvider';

function dateLabel(value: string, locale: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return date.toLocaleString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function PremiumManagementModal({ email, locale, onClose }: { email?: string; locale: string; onClose: () => void }) {
  const billing = useBilling();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 20, width: '100%', maxWidth: 620, alignSelf: 'center' }}>
        <Action label="Close plan details" secondary onPress={onClose} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, width: '100%', maxWidth: 620, alignSelf: 'center' }}>
        <Text accessibilityRole="header" style={ui.title}>Manage Savly Premium</Text>
        {!!email && <Text style={ui.text}>Signed in as {email}</Text>}
        {plan ? <Card>
          <Text accessibilityRole="header" style={ui.title}>{billing.detailsLoading && plan.detailsUnavailable ? 'Loading your plan…' : `${plan.name}${plan.detailsUnavailable ? '' : ' plan'}`}</Text>
          <Text style={ui.text}>{plan.status}</Text>
          <Text style={ui.muted}>Purchased through {plan.storeName}</Text>
          {!!plan.purchasedAt && <Text style={ui.text}>Purchased on {dateLabel(plan.purchasedAt, locale)}</Text>}
          {plan.expirationDate && <Text style={ui.text}>{plan.dateLabel} {dateLabel(plan.expirationDate, locale)}</Text>}
          {plan.lifetime && <Text style={ui.text}>Lifetime access has no renewal or recurring subscription to cancel.</Text>}
          {plan.testStore ? <Text style={ui.muted}>Simulated test purchase · No real charges. Test subscriptions use accelerated renewal dates.</Text>
            : plan.sandbox && <Text style={ui.muted}>Sandbox purchase · No real charges.</Text>}
          {plan.shared && <Text style={ui.muted}>This plan is shared with you. The purchaser manages the subscription.</Text>}
          {plan.otherSubscriptions && <Text style={ui.text}>You also have an active subscription. Buying Lifetime does not cancel it; manage that subscription separately to stop renewals.</Text>}
          {plan.managementUrl && <>
            <Text style={ui.muted}>Change or cancel your subscription in the store. The store confirms when changes take effect; opening it does not cancel your plan.</Text>
            <Action label={plan.otherSubscriptions ? 'Manage other subscriptions' : 'Manage subscription'} disabled={opening || billing.busy} onPress={() => { void openManagement(); }} />
          </>}
          {plan.showCancellation && <Action label={plan.otherSubscriptions ? 'Cancel other subscription' : 'Cancel subscription'} secondary disabled={opening || billing.busy}
            onPress={() => { if (plan.managementUrl) void openManagement(); else setCancellationHelp(true); }} />}
          {cancellationHelp && plan.showCancellation && !plan.managementUrl && <Text accessibilityRole="alert" style={ui.text}>{plan.testStore
            ? 'This simulated subscription can’t be canceled from Savly. Manage test purchases in the RevenueCat dashboard, or wait for the test subscription to expire automatically. No real charges are made.'
            : `To cancel, open your subscription settings in ${plan.storeName} and select Savly. Your access remains until the verified end date; Savly checks for changes when you return.`}</Text>}
          {!plan.managementUrl && !plan.lifetime && !plan.shared && <Text style={ui.muted}>{plan.testStore
            ? 'In-app cancellation is unavailable for this test purchase. Manage test purchases in the RevenueCat dashboard.'
            : 'A subscription-management link is unavailable. You can manage your subscription in the store where you purchased it.'}</Text>}
          {linkError && <Text accessibilityRole="alert" style={ui.error}>Couldn’t open subscription management. Try again or open your store’s subscription settings.</Text>}
          {plan.detailsUnavailable && !billing.detailsLoading && <Text style={ui.muted}>We couldn’t load the plan’s product details. Your access status is shown above.</Text>}
        </Card> : <Text style={ui.text}>{billing.busy ? 'Loading your subscription…' : 'No Savly Premium plan was found for this billing customer.'}</Text>}
        {!!billing.message && <Text accessibilityLiveRegion="polite" style={ui.text}>{billing.message}</Text>}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
