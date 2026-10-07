import { useAuth } from '../auth/AuthProvider';
import { useMemo } from 'react';
import { Text } from 'react-native';
import { Action, Card, Select, ui } from '../components/controls';
import { residenceOptions } from '../features/comparison/countries';

export function SettingsScreen({ country, currency, locale, onChange, onBack, onSignOut, storageError }: {
  country: string; currency: string; locale: string; onChange: (country: string) => void;
  onBack: () => void; onSignOut: () => void; storageError: boolean;
}) {
  const { user, openSignIn } = useAuth();
  const options = useMemo(() => residenceOptions(locale), [locale]);
  return <Card>
    <Text accessibilityRole="header" style={ui.title}>Settings</Text>
    <Select label="Home country" value={country} options={options} onChange={onChange} />
    <Text style={ui.muted}>Choose your country of residence. Its currency is used automatically for every new comparison.</Text>
    {!!currency && <Text style={ui.text}>Home currency: {currency}</Text>}
    {!!country && !currency && <Text accessibilityRole="alert" style={ui.error}>Currency data is unavailable for this home country. Choose a supported home country to calculate savings.</Text>}
    <Text style={ui.muted}>Changing home currency clears the entered home price and comparison overrides. Saved items keep their original estimates.</Text>
    {storageError && <Text accessibilityRole="alert" style={ui.error}>Your change is active, but settings couldn’t be saved for the next app launch.</Text>}
    <Text style={ui.label}>Account</Text>
    <Text style={ui.text}>{user ? `Signed in${user.email ? ` as ${user.email}` : ''}` : 'Not signed in'}</Text>
    <Text style={ui.muted}>Saved comparisons stay on this device. Cloud history sync is not available yet.</Text>
    {user ? <Action label="Sign out" secondary onPress={onSignOut} />
      : <Action label="Sign in" secondary onPress={openSignIn} />}
    <Action label="Back to calculator" onPress={onBack} />
  </Card>;
}
