import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Action, ui } from '../components/controls';
import { useBilling } from './BillingProvider';
import { PremiumCard } from './PremiumCard';
import { colors } from '../theme/colors';

export function SignInCheckout() {
  const billing = useBilling();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={{ padding: 24, gap: 20, width: '100%', maxWidth: 620, alignSelf: 'center' }}>
      <Text accessibilityRole="header" style={ui.title}>{billing.prompt === 'checking' ? 'Checking Premium access…' : billing.prompt === 'error' ? 'Couldn’t check Premium access' : 'Choose your Savly Premium plan'}</Text>
      {billing.prompt !== 'checking' && <>
        {billing.prompt === 'plans' && <Text style={ui.text}>Choose Monthly, Annual, or Lifetime access.</Text>}
        <PremiumCard allowPurchase={billing.prompt === 'plans'} />
        {billing.prompt === 'error' && !billing.preview && <Action label="Retry entitlement check" disabled={billing.busy} onPress={billing.checkEntitlement} />}
      </>}
      {billing.prompt === 'error' && <Action label="Continue with default rates" secondary onPress={billing.dismissPrompt} />}
    </ScrollView>
  </SafeAreaView>;
}
