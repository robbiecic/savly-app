import { useWideLayout } from '../components/responsive';
import { CompareIcon } from '../components/CompareIcon';
import { ItemPhoto } from '../components/ItemPhoto';
import { completesSavedDeleteSwipe } from './saved-swipe';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ui } from '../components/controls';
import { savedComparisons } from '../storage/mobile-saved-comparisons';
import type { SavedComparison } from '../storage/saved-comparisons';

export function SavedScreen({ onOpen }: { onOpen: (entry: SavedComparison) => void }) {
  const wide = useWideLayout();
  const [items, setItems] = useState<SavedComparison[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const load = async () => {
    setBusy(true); setError('');
    try { setItems(await savedComparisons.list()); }
    catch { setError('Saved comparisons couldn’t load. Retry, or clear saved data to start again.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);
  const remove = async (id?: string): Promise<boolean> => {
    setBusy(true); setError('');
    try {
      if (id) await savedComparisons.remove(id); else await savedComparisons.clear();
      setItems(await savedComparisons.list()); setConfirmClear(false);
      return true;
    } catch { setError('Couldn’t update saved comparisons. Please try again.'); return false; }
    finally { setBusy(false); }
  };
  return <>
    <View style={styles.intro}>
      <Text accessibilityRole="header" style={styles.pageTitle}>Your saved items</Text>
      <Text style={styles.subtitle}>Keep your comparisons close for another look.</Text>
    </View>
    {!!error && <View style={styles.notice}>
      <Text accessibilityRole="alert" style={ui.error}>{error}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => { void load(); }} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>Retry saved comparisons</Text>
      </Pressable>
    </View>}
    {busy && <Text style={styles.storageNote}>Loading…</Text>}
    {!busy && !error && !items.length && <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><CompareIcon name="bag" size={32} /></View>
      <Text style={styles.emptyTitle}>No saved comparisons yet.</Text>
      <Text style={styles.storageNote}>Save a comparison to find it here later.</Text>
    </View>}
    <View style={styles.list}>
      {items.map(item => <SavedItem key={item.id} item={item} wide={wide} busy={busy} onOpen={() => onOpen(item)} onDelete={() => remove(item.id)} />)}
    </View>
    {(items.length > 0 || !!error) && <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy}
      onPress={() => setConfirmClear(true)} style={({ pressed }) => [styles.clearButton, (pressed || busy) && styles.dimmed]}>
      <Text style={styles.clearText}>Clear saved comparisons</Text><CompareIcon name="chevron" size={20} />
    </Pressable>}
    {confirmClear && <View style={styles.notice}>
      <Text style={styles.confirmText}>Delete all saved comparisons from this device? This cannot be undone.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Delete all saved comparisons" accessibilityState={{ disabled: busy }} disabled={busy}
        onPress={() => { void remove(); }} style={({ pressed }) => [styles.openButton, (pressed || busy) && styles.dimmed]}>
        <Text style={styles.openText}>Delete all saved comparisons</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setConfirmClear(false)} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>Cancel</Text>
      </Pressable>
    </View>}
    <Text style={styles.storageNote}>Stored on device only. These are historical estimates, not updated prices.</Text>
  </>;
}

function SavedItem({ item, wide, busy, onOpen, onDelete }: {
  item: SavedComparison; wide: boolean; busy: boolean; onOpen: () => void; onDelete: () => Promise<boolean>;
}) {
  const [width, setWidth] = useState(0);
  const drag = useRef(new Animated.Value(0)).current;
  const reset = () => Animated.spring(drag, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 4 }).start();
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => !busy && width > 0 && gesture.numberActiveTouches <= 1 &&
      gesture.dx > 18 && gesture.dx > Math.abs(gesture.dy) * 1.3,
    onPanResponderMove: (_event, gesture) => drag.setValue(Math.max(0, Math.min(width, gesture.dx))),
    onPanResponderRelease: (_event, gesture) => {
      // PanResponder begins after the first 18 px, so include that movement.
      if (!completesSavedDeleteSwipe(gesture.dx + 18, width)) { reset(); return; }
      Animated.timing(drag, { toValue: width, duration: 130, useNativeDriver: true }).start(({ finished }) => {
        if (!finished) { reset(); return; }
        void onDelete().then(deleted => { if (!deleted) reset(); });
      });
    },
    onPanResponderTerminate: reset,
    onPanResponderTerminationRequest: () => false,
  }), [busy, width, drag, onDelete]);
  const binScale = drag.interpolate({ inputRange: [0, Math.max(width, 1)], outputRange: [0.65, 1.5], extrapolate: 'clamp' });
  return <View testID={`saved-item-${item.id}`} onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.itemFrame, wide && styles.wideItem]}>
    <View pointerEvents="none" style={styles.deleteReveal}>
      <Animated.View style={{ transform: [{ scale: binScale }] }}>
        <Svg width={34} height={34} viewBox="0 0 24 24" accessible={false}>
          <Path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" fill="none" stroke="#C82E38" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </View>
    <Animated.View testID={`saved-card-${item.id}`} {...responder.panHandlers} style={{ width: '100%', transform: [{ translateX: drag }] }}>
      <Pressable accessibilityRole="button" accessibilityLabel={'Open ' + item.comparison.itemName}
        accessibilityHint="Swipe right all the way to delete this item" accessibilityState={{ disabled: busy }} disabled={busy}
        accessibilityActions={[{ name: 'delete', label: 'Delete ' + item.comparison.itemName }]}
        onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'delete') void onDelete(); }}
        onPress={onOpen} style={({ pressed }) => [styles.item, (pressed || busy) && styles.dimmed]}>
        <View style={styles.itemHeading}>
          {!!item.photoUri ? <ItemPhoto uri={item.photoUri} name={item.comparison.itemName} size={68} interactive={false} /> : <View style={styles.itemIcon}><CompareIcon name="bag" size={28} /></View>}
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={2}>{item.comparison.itemName}</Text>
            <Text style={styles.itemPrice}>{item.form.country} · {item.comparison.result.shoppingCurrency} {item.comparison.price}</Text>
          </View>
          <CompareIcon name="arrow" size={22} />
        </View>
      </Pressable>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  intro: { gap: 8, marginTop: 12, marginBottom: 2 },
  pageTitle: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1.2, color: '#09184A' },
  subtitle: { fontSize: 17, lineHeight: 24, color: '#09184A', maxWidth: 350 },
  storageNote: { fontSize: 14, lineHeight: 20, color: '#596277' },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  itemFrame: { width: '100%', overflow: 'hidden', borderRadius: 22 },
  deleteReveal: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#FCE8E9', justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 28 },
  item: { width: '100%', borderRadius: 22, backgroundColor: '#F2F3FA', padding: 18, gap: 14 },
  wideItem: { width: '48%' },
  itemHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  itemIcon: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  itemInfo: { flex: 1, minWidth: 0, gap: 3 },
  itemName: { fontSize: 20, lineHeight: 25, fontWeight: '800', color: '#09184A' },
  itemPrice: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: '#09184A' },
  openButton: { flex: 1, minWidth: 0, minHeight: 54, borderRadius: 18, backgroundColor: '#0B2156', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  openText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  clearButton: { minHeight: 58, borderRadius: 20, backgroundColor: '#F0F1FA', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20 },
  clearText: { flex: 1, color: '#09184A', fontSize: 16, fontWeight: '700' },
  emptyState: { borderRadius: 22, backgroundColor: '#F2F3FA', padding: 24, alignItems: 'center', gap: 10 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  emptyTitle: { color: '#09184A', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  notice: { borderRadius: 20, backgroundColor: '#F2F3FA', padding: 18, gap: 12 },
  secondaryButton: { minHeight: 50, borderRadius: 16, borderWidth: 1.5, borderColor: '#D9DEF5', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  secondaryText: { color: '#09184A', fontSize: 15, fontWeight: '700' },
  confirmText: { color: '#09184A', fontSize: 15, lineHeight: 22 },
  dimmed: { opacity: 0.65 },
});
