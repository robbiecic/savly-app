import { Pressable, Text, View } from 'react-native';
import { HomeCountryBadge } from './HomeCountryBadge';
import { colors } from '../theme/colors';

export function HomeSettingsButton({ country, locale, onPress, disabled = false }: {
  country: string; locale: string; onPress: () => void; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Settings" disabled={disabled}
    accessibilityHint="Change your home country" onPress={onPress}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minHeight: 48 }}>
    <HomeCountryBadge country={country} locale={locale} />
    <View style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, color: colors.ink }}>⚙</Text>
    </View>
  </Pressable>;
}
