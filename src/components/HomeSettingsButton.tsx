import { Pressable, Text, View } from 'react-native';
import { HomeCountryBadge } from './HomeCountryBadge';
import { colors } from '../theme/colors';

export function HomeSettingsButton({ country, locale, onPress, disabled = false, expanded = false }: {
  country: string; locale: string; onPress: () => void; disabled?: boolean; expanded?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Settings" disabled={disabled}
    accessibilityState={{ disabled, expanded }} aria-expanded={expanded}
    accessibilityHint={expanded ? 'Return to calculator' : 'Change your home country and manage your account'} onPress={onPress}
    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minHeight: 48, opacity: pressed ? 0.65 : 1 })}>
    <HomeCountryBadge country={country} locale={locale} />
    <View style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, color: colors.ink }}>⚙</Text>
    </View>
  </Pressable>;
}
