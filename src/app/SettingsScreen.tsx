import { PremiumManagementModal } from '../billing/PremiumManagementModal';
import { PremiumCard } from '../billing/PremiumCard';
import { useAuth } from '../auth/AuthProvider';
import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { useBilling } from '../billing/BillingProvider';
import { Action, Card, Select, ui } from '../components/controls';
import { residenceOptions } from '../features/comparison/countries';

export function SettingsScreen({ country, currency, locale, onChange, onBack, onSignOut, storageError }: {
  country: string; currency: string; locale: string; onChange: (country: string) => void;
  onBack: () => void; onSignOut: () => void; storageError: boolean;
}) {
  const { user, openSignIn, openSignUp } = useAuth();
  const billing = useBilling();
  const premiumActive = !!user && billing.active;
  const [managing, setManaging] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const options = useMemo(() => residenceOptions(locale), [locale]);
  if (purchasing && user && !premiumActive) return <>
    <PremiumCard />
    <Action label="Back to Settings" secondary onPress={() => setPurchasing(false)} />
  </>;
  return <Card>
    {user && (managing || (purchasing && premiumActive)) && <PremiumManagementModal email={user.email} locale={locale} onClose={() => { setManaging(false); setPurchasing(false); }} />}
    <Text accessibilityRole="header" style={ui.title}>Settings</Text>
    <Select label="Home country" value={country} options={options} onChange={onChange} />
    {!!country && !currency && <Text accessibilityRole="alert" style={ui.error}>Currency data is unavailable for this home country. Choose a supported home country to calculate savings.</Text>}
    {storageError && <Text accessibilityRole="alert" style={ui.error}>Your change is active, but settings couldn’t be saved for the next app launch.</Text>}
    <Text style={ui.label}>{premiumActive ? 'Savly Premium is active' : 'Default mode · Unlimited calculations'}</Text>
    <Action label={premiumActive ? 'Manage Savly Premium' : 'Get Savly Premium'} onPress={() => {
      if (premiumActive) setManaging(true);
      else if (user) setPurchasing(true);
      else openSignUp();
    }} />
    {!!billing.message && <Text accessibilityLiveRegion="polite" style={ui.text}>{billing.message}</Text>}
    {user ? <>
      <Text style={ui.label}>Account</Text>
      <Text style={ui.text}>{user ? `${user.email}` : 'Not signed in'}</Text>
      <Action label="Sign out" secondary onPress={onSignOut} />
    </> : <Action label="Sign in" secondary onPress={openSignIn} />}
    <Action label="Back to calculator" secondary onPress={onBack} />
  </Card>;
}
