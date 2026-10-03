import { StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useWideLayout() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Width-based so opening a keyboard cannot switch a portrait form to columns.
  return (width - insets.left - insets.right) / Math.max(1, fontScale) >= 680;
}
export const responsive = StyleSheet.create({
  wideContent: { maxWidth: 1080 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  stack: { gap: 18 },
  column: { flex: 1, minWidth: 0 },
});
