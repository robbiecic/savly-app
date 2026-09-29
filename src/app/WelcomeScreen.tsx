import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';

export function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={styles.brand}>Savly</Text>
          <Text style={styles.tagline}>Shop globally. Keep more of it.</Text>
          <Text style={styles.description}>
            Estimate what you’ll pay and compare potential savings.
          </Text>
        </View>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            A little clarity before you buy.
          </Text>
          <Text style={styles.description}>
            Your shopping companion is taking shape. Price comparisons are coming soon.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 32, maxWidth: 600, width: '100%', alignSelf: 'center' },
  intro: { gap: 16 },
  brand: { color: colors.ink, fontSize: 44, fontWeight: '800' },
  tagline: { color: colors.ink, fontSize: 26, fontWeight: '600' },
  description: { color: colors.muted, fontSize: 17, lineHeight: 26 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 24, gap: 12 },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: '600' },
});
