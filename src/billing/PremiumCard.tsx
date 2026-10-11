import { planLabel } from './access';
import { Text } from 'react-native';
import { Action, Card, ui } from '../components/controls';
import { useBilling } from './BillingProvider';

export function PremiumCard({ allowPurchase = true }: { allowPurchase?: boolean }) {
  const billing = useBilling();
  const canShowPlans = allowPurchase && !billing.preview && !billing.active;
  return <Card>
    <Text accessibilityRole="header" style={ui.title}>Get Savly Premium</Text>
    <Text style={ui.muted}>{billing.preview ? 'Browser prototype — purchases are unavailable here. Test billing in a Savly development build.' : 'RevenueCat Test Store — simulated purchases, no real charges.'}</Text>
    {!billing.preview && <>
      <Text style={ui.text}>{billing.active ? 'Premium test access is active.' : 'Get access to API countries and rates when signed in, with one of the configured Premium plans.'}</Text>
      {canShowPlans && billing.packages.map(item => <Action key={item.identifier} disabled={billing.busy}
        label={planLabel(item.product)}
        onPress={() => billing.purchase(item)} />)}
      {canShowPlans && !billing.busy && billing.packages.length === 0 && <Action label="Retry loading offers" onPress={billing.checkEntitlement} />}
      <Text style={ui.muted}>Monthly and annual access renew automatically until canceled. Lifetime is a one-time unlock. Buying lifetime does not cancel an existing subscription.</Text>
      {!!billing.message && <Text accessibilityLiveRegion="polite" style={ui.text}>{billing.message}</Text>}
    </>}
  </Card>;
}
