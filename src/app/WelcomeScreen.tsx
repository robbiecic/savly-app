import { useAuth } from '../auth/AuthProvider';
import { SavlyLogo } from '../components/SavlyLogo';
import { useWideLayout } from '../components/responsive';
import { useWindowDimensions, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

export function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
  const { openSignIn } = useAuth();
  const wide = useWideLayout();
  const compact = useWindowDimensions().height < 500;
  return <ImageBackground source={require('../../assets/welcome-travel.png')} resizeMode="cover" imageStyle={styles.backgroundImage} style={styles.screen}>
    <LinearGradient pointerEvents="none" colors={['rgba(3,9,18,0.18)', 'rgba(3,9,18,0)', 'rgba(3,9,18,0.68)', '#030912']}
      locations={[0, 0.36, 0.68, 1]} style={StyleSheet.absoluteFill} />
    <SafeAreaView style={styles.screen}>
      <View style={{ paddingHorizontal: 28, paddingTop: compact ? 8 : 24, paddingBottom: 8 }}><SavlyLogo light large={!compact} /></View>
      <ScrollView contentContainerStyle={[styles.content, compact && { minHeight: 0, paddingTop: 16 }, wide && styles.wideContent]} bounces={false}>
        <View style={[styles.bottom, compact && { paddingTop: 24 }, wide && styles.wideBottom]}>
          <Text accessibilityRole="header" style={[styles.headline, wide && styles.wideHeadline]}>{'Shop the world.\nDiscover what\nyou could save.'}</Text>
          <Text style={styles.description}>Compare overseas prices, exchange rates and estimated VAT refunds — and see what you could save.</Text>
          <Pressable accessibilityRole="button" onPress={onGetStarted}
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
            <Text style={styles.primaryText}>Get started</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={openSignIn} style={styles.signIn}>
            <Text style={styles.signInText}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  </ImageBackground>;
}
const styles = StyleSheet.create({
  wideContent: { flexDirection: 'row', alignItems: 'center', minHeight: 0, paddingTop: 16, paddingBottom: 16, gap: 32, maxWidth: 1080, width: '100%', alignSelf: 'center' },
  wideBottom: { paddingTop: 0, flex: 1 },
  wideHeadline: { fontSize: 26, lineHeight: 30, marginBottom: 10 },
  screen: { flex: 1, backgroundColor: 'transparent' },
  backgroundImage: { width: '100%', height: '100%' },
  content: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 28, paddingTop: 32, paddingBottom: 8, minHeight: 560 },
  bottom: { paddingTop: 200, maxWidth: 440, width: '100%' },
  headline: { fontSize: 32, lineHeight: 37, fontWeight: '700', color: '#FFFFFF', marginBottom: 16, letterSpacing: -0.6 },
  description: { fontSize: 16, lineHeight: 23, color: '#FFFFFF', marginBottom: 24 },
  primary: { backgroundColor: '#FFFFFF', minHeight: 52, borderRadius: 30, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '700', color: '#081126' },
  signIn: { minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: 12 },
  signInText: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
});
