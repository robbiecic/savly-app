import { Text, View } from 'react-native';
import { countryFlag, countryName } from '../features/comparison/countries';
import { colors } from '../theme/colors';

export function HomeCountryBadge({ country, locale, pill = false }: { country: string; locale: string; pill?: boolean }) {
  const name = country ? countryName(country, locale) : 'Not set';
  return <View accessible accessibilityLabel={`Home country: ${name}`}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, maxWidth: pill ? 210 : 170 }}>
    {!!country && <Text accessible={false} style={{ fontSize: 20 }}>{countryFlag(country)}</Text>}
    <View style={{ flexShrink: 1 }}>
      {!pill && <Text style={{ color: colors.muted, fontSize: 11 }}>Home</Text>}
      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: pill ? 14 : 13, fontWeight: '700' }}>{name}</Text>
    </View>
  </View>;
}
