import { useState } from 'react';
import { Linking, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Country } from '../data/reference-data';
import { minimumLabel, needsRefundReview } from '../domain/tourist-refunds';
import { countryFlag, countryName } from '../features/comparison/countries';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { Action, Card, ui } from '../components/controls';
import { SavlyLogo } from '../components/SavlyLogo';
import { colors } from '../theme/colors';

export function RefundRulesScreen({ country, locale, onClose, saved = false, defaults = false }: {
  country: Country; locale: string; onClose: () => void; saved?: boolean; defaults?: boolean;
}) {
  const now = useCurrentTime();
  const [linkError, setLinkError] = useState(false);
  const rule = country.touristRefund;
  const openSource = async (url: string) => {
    setLinkError(false);
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Invalid source');
      await Linking.openURL(url);
    } catch { setLinkError(true); }
  };
  return <Modal animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 20, gap: 16, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        <SavlyLogo />
        <Action label="Back" onPress={onClose} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        <Text accessibilityRole="header" style={ui.title}>VAT refund rules · <Text accessible={false} aria-hidden>{countryFlag(country.country)} </Text>{countryName(country.country, locale)}</Text>
        <Text style={ui.muted}>{saved ? 'Rules retained with this comparison; they may have changed.' : defaults ? 'Bundled reference rules, reviewed on the dates below.' : 'Reference rules from the countries API.'}</Text>
        {!rule ? <Card><Text style={ui.text}>Refund rules are unavailable for this country. A VAT rate alone does not establish refund eligibility.</Text></Card> : <>
          <Card>
            <Text accessibilityRole="header" style={ui.title}>{rule.status === 'available' ? 'Tourist refund scheme available' : rule.status === 'regional_only' ? 'Regional schemes only' : 'No national tourist refund scheme'}</Text>
            {needsRefundReview(rule, now) && <Text accessibilityRole="alert" style={ui.error}>These rules need confirmation. Their review date is overdue or unverified.</Text>}
            <Text style={ui.text}>{rule.minimumPurchase ? minimumLabel(rule.minimumPurchase) : 'No country-wide minimum is provided. This does not mean a zero minimum.'}</Text>
            <Text style={ui.text}>{rule.notes}</Text>
          </Card>
          {rule.regionalSchemes?.map(region => <Card key={region.regionCode}>
            <Text accessibilityRole="header" style={ui.title}>{region.regionCode === 'GB-NIR' ? 'Northern Ireland (GB-NIR)' : region.regionCode}</Text>
            <Text style={ui.text}>{minimumLabel(region.minimumPurchase)}</Text>
            <Text style={ui.text}>{region.notes}</Text>
            <Text style={ui.muted}>Regional rules are not applied automatically because the purchase region has not been confirmed.</Text>
          </Card>)}
          <Card>
            <Text accessibilityRole="header" style={ui.title}>Before you buy</Text>
            <Text style={ui.text}>Meeting the purchase minimum does not guarantee eligibility or a refund of all VAT. Check residency, goods, retailer participation, export paperwork and provider fees.</Text>
            <Text style={ui.text}>The calculator checks only the entered purchase price. It does not combine other receipts. For tax-exclusive minimums, it assumes the whole purchase uses the stated standard VAT rate; mixed-rate or reduced-rate goods need confirmation.</Text>
          </Card>
          <Card>
            <Text accessibilityRole="header" style={ui.title}>Sources and review</Text>
            <Text style={ui.muted}>Sources checked: {rule.reviewedOn}{'\n'}Review after: {rule.reviewAfter}</Text>
            <Text style={ui.muted}>These research dates are separate from the four-hour data refresh.</Text>
            {rule.sources.map(source => <Action key={source.url} label={`Open source: ${source.title}`} secondary onPress={() => { void openSource(source.url); }} />)}
            {linkError && <Text accessibilityRole="alert" style={ui.error}>Couldn’t open this source. Please try again.</Text>}
          </Card>
        </>}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
