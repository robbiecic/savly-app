import { Text } from 'react-native';
import { Action, Card, ui } from '../components/controls';
import { useBilling } from './BillingProvider';

export function PremiumCard() {
  const billing = useBilling();
  return <Card>
    <Text accessibilityRole="header" style={ui.title}>Savly Premium</Text>
    <Text style={ui.muted}>{billing.preview ? 'Browser prototype — purchases are unavailable here. Test billing in a Savly development build.' : 'RevenueCat Test Store — simulated purchases, no real charges.'}</Text>
    {!billing.preview && <>
      <Text style={ui.text}>{billing.active ? 'Premium test access is active.' : 'Get access to API countries and rates when signed in, with one of the configured Premium plans.'}</Text>
      {!billing.active && billing.packages.map(item => <Action key={item.identifier} disabled={billing.busy}
        label={item.packageType === 'MONTHLY' ? `Test monthly · ${item.product.priceString} / month`
          : item.packageType === 'ANNUAL' ? `Test annual · ${item.product.priceString} / year`
          : `Test lifetime · ${item.product.priceString} once`}
        onPress={() => billing.purchase(item)} />)}
      <Text style={ui.muted}>Monthly and annual access renew automatically until canceled. Lifetime is a one-time unlock. Buying lifetime does not cancel an existing subscription.</Text>
      <Action label={billing.busy ? 'Please wait…' : 'Restore purchases'} disabled={billing.busy} secondary onPress={billing.restore} />
      <Action label="Refresh purchase status" disabled={billing.busy} secondary onPress={billing.refresh} />
      <Text style={ui.muted}>Test billing help: manage or reset test purchases in the RevenueCat dashboard. App Store and Google Play subscription management will be available with real store billing.</Text>
      {!!billing.message && <Text accessibilityLiveRegion="polite" style={ui.text}>{billing.message}</Text>}
    </>}
  </Card>;
}
