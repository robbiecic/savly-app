import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export function SavlyLogo({ light = false, large = false }: { light?: boolean; large?: boolean }) {
  const color = light ? '#FFFFFF' : colors.ink;
  return <View accessible accessibilityLabel="Savly" style={styles.brand}>
    <Text style={[styles.wordmark, large && styles.largeWordmark, { color }]}>Savly</Text>
    <Text accessible={false} style={[styles.plane, large && styles.largePlane, { color }]}>{'✈\uFE0E'}</Text>
  </View>;
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', flexShrink: 0 },
  wordmark: { fontSize: 30, lineHeight: 38, fontWeight: '800', fontStyle: 'italic', letterSpacing: -1.2 },
  plane: { fontSize: 22, marginLeft: 6, transform: [{ rotate: '-20deg' }] },
  largeWordmark: { fontSize: 48, lineHeight: 58, letterSpacing: -2 },
  largePlane: { fontSize: 34, marginLeft: 8 },
});
