import { useWideLayout } from '../components/responsive';
import { CompareIcon } from '../components/CompareIcon';
import { ItemPhoto } from '../components/ItemPhoto';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  const remove = async (id?: string) => {
    setBusy(true); setError('');
    try {
      if (id) await savedComparisons.remove(id); else await savedComparisons.clear();
      setItems(await savedComparisons.list()); setConfirmClear(false);
    } catch { setError('Couldn’t update saved comparisons. Please try again.'); }
    finally { setBusy(false); }
  };
  return <>
    <View style={styles.intro}>
      <Text accessibilityRole="header" style={styles.pageTitle}>Your saved items</Text>
      <Text style={styles.subtitle}>Keep your comparisons close for another look.</Text>
    </View>
    <Text style={styles.storageNote}>Stored on device only. These are historical estimates, not updated prices.</Text>
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
      {items.map(item => <View key={item.id} style={[styles.item, wide && styles.wideItem]}>
        <View style={styles.itemHeading}>
          {!!item.photoUri ? <ItemPhoto uri={item.photoUri} name={item.comparison.itemName} size={68} /> : <View style={styles.itemIcon}><CompareIcon name="bag" size={28} /></View>}
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={2}>{item.comparison.itemName}</Text>
            <Text style={styles.itemPrice}>{item.form.country} · {item.comparison.result.shoppingCurrency} {item.comparison.price}</Text>
          </View>
        </View>
        <View style={styles.itemActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={'Open ' + item.comparison.itemName} accessibilityState={{ disabled: busy }} disabled={busy}
            onPress={() => onOpen(item)} style={({ pressed }) => [styles.openButton, (pressed || busy) && styles.dimmed]}>
            <Text style={styles.openText}>Open comparison</Text><CompareIcon name="arrow" color="#FFFFFF" size={22} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={'Delete ' + item.comparison.itemName} accessibilityState={{ disabled: busy }} disabled={busy}
            onPress={() => { void remove(item.id); }} style={({ pressed }) => [styles.deleteButton, (pressed || busy) && styles.dimmed]}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        </View>
      </View>)}
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
  </>;
}

const styles = StyleSheet.create({
  intro: { gap: 8, marginTop: 12, marginBottom: 2 },
  pageTitle: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1.2, color: '#09184A' },
  subtitle: { fontSize: 17, lineHeight: 24, color: '#09184A', maxWidth: 350 },
  storageNote: { fontSize: 14, lineHeight: 20, color: '#596277' },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  item: { width: '100%', borderRadius: 22, backgroundColor: '#F2F3FA', padding: 18, gap: 14 },
  wideItem: { width: '48%' },
  itemHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  itemIcon: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  itemInfo: { flex: 1, minWidth: 0, gap: 3 },
  itemName: { fontSize: 20, lineHeight: 25, fontWeight: '800', color: '#09184A' },
  itemPrice: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: '#09184A' },
  itemActions: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  openButton: { flex: 1, minWidth: 0, minHeight: 54, borderRadius: 18, backgroundColor: '#0B2156', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  openText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  deleteButton: { minHeight: 54, borderRadius: 18, borderWidth: 1.5, borderColor: '#D9DEF5', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  deleteText: { color: '#09184A', fontSize: 15, fontWeight: '700' },
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
