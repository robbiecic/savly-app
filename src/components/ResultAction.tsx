import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/colors';

export function ResultAction({ label, accessibilityLabel = label, icon, filled = false, disabled = false, onPress }: {
  label: string; accessibilityLabel?: string; icon: 'heart' | 'share'; filled?: boolean; disabled?: boolean; onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}>
    <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false} aria-hidden>
      {icon === 'heart'
        ? <Path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"
            fill={filled ? colors.ink : 'none'} stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        : <Path d="M12 15V3m-4 4 4-4 4 4M5 12v8h14v-8"
            fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
    </Svg>
    <Text style={styles.label}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { flex: 1, minWidth: 0, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 10, paddingVertical: 14, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, backgroundColor: colors.surface },
  label: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  pressed: { backgroundColor: '#F0F2F7' },
  disabled: { opacity: 0.55 },
});
