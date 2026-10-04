import { Text, View } from 'react-native';
import { countryFlag, countryName } from '../features/comparison/countries';
import { colors } from '../theme/colors';

export function HomeCountryBadge({ country, locale }: { country: string; locale: string }) {
  const name = country ? countryName(country, locale) : 'Not set';
  return <View accessible accessibilityLabel={`Home country: ${name}`}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, maxWidth: 170 }}>
    {!!country && <Text accessible={false} style={{ fontSize: 20 }}>{countryFlag(country)}</Text>}
    <View style={{ flexShrink: 1 }}>
      <Text style={{ color: colors.muted, fontSize: 11 }}>Home</Text>
      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '600' }}>{name}</Text>
    </View>
  </View>;
}
