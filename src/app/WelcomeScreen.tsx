import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

export function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
  return <ImageBackground source={require('../../assets/welcome-travel.png')} resizeMode="cover" imageStyle={styles.backgroundImage} style={styles.screen}>
    <LinearGradient pointerEvents="none" colors={['rgba(3,9,18,0.18)', 'rgba(3,9,18,0)', 'rgba(3,9,18,0.68)', '#030912']}
      locations={[0, 0.36, 0.68, 1]} style={StyleSheet.absoluteFill} />
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <View accessibilityLabel="Savly" accessible style={styles.brand}>
          <Text style={styles.wordmark}>Savly</Text>
          <Text accessible={false} style={styles.plane}>{'✈\uFE0E'}</Text>
        </View>
        <View style={styles.bottom}>
          <Text accessibilityRole="header" style={styles.headline}>{'Shop the world.\nDiscover what\nyou could save.'}</Text>
          <Text style={styles.description}>Compare overseas prices, exchange rates and estimated VAT refunds — and see what you could save.</Text>
          <Pressable accessibilityRole="button" onPress={onGetStarted}
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
            <Text style={styles.primaryText}>Get started</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: true }} accessibilityHint="Sign in is not available yet" disabled style={styles.signIn}>
            <Text style={styles.signInText}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  </ImageBackground>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  backgroundImage: { width: '100%', height: '100%' },
  content: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 32, paddingBottom: 8, minHeight: 660 },
  brand: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  wordmark: { fontSize: 48, lineHeight: 58, color: '#FFFFFF', fontWeight: '800', fontStyle: 'italic', letterSpacing: -2 },
  plane: { fontSize: 34, color: '#FFFFFF', marginLeft: 8, transform: [{ rotate: '-20deg' }] },
  bottom: { paddingTop: 200, maxWidth: 440, width: '100%' },
  headline: { fontSize: 32, lineHeight: 37, fontWeight: '700', color: '#FFFFFF', marginBottom: 16, letterSpacing: -0.6 },
  description: { fontSize: 16, lineHeight: 23, color: '#FFFFFF', marginBottom: 24 },
  primary: { backgroundColor: '#FFFFFF', minHeight: 52, borderRadius: 30, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '700', color: '#081126' },
  signIn: { minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: 12 },
  signInText: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
});
