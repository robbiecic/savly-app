import { useState } from 'react';
import { Image, Keyboard, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { photoSource } from '../storage/item-photos';
import { colors } from '../theme/colors';
import { ui } from './controls';

export function ItemPhoto({ uri, name }: { uri: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const label = name || 'item';
  const source = { uri: photoSource(uri) };
  if (failed) return <Text style={ui.muted}>Photo unavailable on this device.</Text>;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`View photo of ${label}`}
      accessibilityHint="Opens the full-screen photo" onPress={() => { Keyboard.dismiss(); setOpen(true); }}
      style={({ pressed }) => [styles.preview, pressed && { opacity: 0.75 }]}>
      <Image source={source} accessibilityLabel={`Photo of ${label}`} accessible
        resizeMode="cover" style={styles.thumbnail} onError={() => setFailed(true)} />
    </Pressable>
    <Modal visible={open} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={styles.viewer}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{label}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close photo" onPress={() => setOpen(false)}
            style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        <Image source={source} accessibilityLabel={`Full-screen photo of ${label}`} accessible
          resizeMode="contain" style={styles.fullImage} />
      </SafeAreaView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  preview: { width: 152, height: 152, borderRadius: 76, overflow: 'hidden', alignSelf: 'center', borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  thumbnail: { width: '100%', height: '100%' },
  viewer: { flex: 1, backgroundColor: '#080B12' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  title: { flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFFFFF', fontSize: 28 },
  fullImage: { flex: 1, width: '100%' },
});
