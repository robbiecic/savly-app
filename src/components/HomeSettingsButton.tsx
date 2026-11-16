import { Pressable } from 'react-native';
import { HomeCountryBadge } from './HomeCountryBadge';

export function HomeSettingsButton({ country, locale, onPress, disabled = false, expanded = false }: {
  country: string; locale: string; onPress: () => void; disabled?: boolean; expanded?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Settings" disabled={disabled}
    accessibilityState={{ disabled, expanded }} aria-expanded={expanded}
    accessibilityHint={expanded ? 'Return to calculator' : 'Change your home country and manage your account'} onPress={onPress}
    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 48, minHeight: 48, opacity: pressed ? 0.65 : 1 })}>
    <HomeCountryBadge country={country} locale={locale} />
  </Pressable>;
}
