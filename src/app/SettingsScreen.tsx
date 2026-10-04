import { useMemo } from 'react';
import { Text } from 'react-native';
import { Action, Card, Select, ui } from '../components/controls';
import { residenceOptions } from '../features/comparison/countries';

export function SettingsScreen({ country, currency, locale, onChange, onBack, storageError }: {
  country: string; currency: string; locale: string; onChange: (country: string) => void;
  onBack: () => void; storageError: boolean;
}) {
  const options = useMemo(() => residenceOptions(locale), [locale]);
  return <Card>
    <Text accessibilityRole="header" style={ui.title}>Settings</Text>
    <Select label="Home country" value={country} options={options} onChange={onChange} />
    <Text style={ui.muted}>Choose your country of residence. Its currency is used automatically for every new comparison.</Text>
    {!!currency && <Text style={ui.text}>Home currency: {currency}</Text>}
    {!!country && !currency && <Text accessibilityRole="alert" style={ui.error}>Currency data is unavailable for this home country. Choose a supported home country to calculate savings.</Text>}
    <Text style={ui.muted}>Changing home currency clears the entered home price and comparison overrides. Saved items keep their original estimates.</Text>
    {storageError && <Text accessibilityRole="alert" style={ui.error}>Settings couldn’t be saved on this device. Choose your country again to retry.</Text>}
    <Action label="Back to calculator" onPress={onBack} />
  </Card>;
}
