import { Pressable } from 'react-native';
import { HomeCountryBadge } from './HomeCountryBadge';
import { CompareIcon } from './CompareIcon';

export function HomeSettingsButton({ country, locale, onPress, disabled = false, expanded = false, pill = false }: {
  country: string; locale: string; onPress: () => void; disabled?: boolean; expanded?: boolean; pill?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Settings" disabled={disabled}
    accessibilityState={{ disabled, expanded }} aria-expanded={expanded}
    accessibilityHint={expanded ? 'Return to calculator' : 'Change your home country and manage your account'} onPress={onPress}
    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 48, minHeight: 48, gap: 6, paddingHorizontal: pill ? 12 : 0, borderRadius: pill ? 28 : 0, backgroundColor: pill ? '#FFFFFF' : 'transparent', opacity: pressed ? 0.65 : 1 })}>
    <HomeCountryBadge country={country} locale={locale} pill={pill} />
    {pill && <CompareIcon name="chevron" size={18} />}
  </Pressable>;
}
