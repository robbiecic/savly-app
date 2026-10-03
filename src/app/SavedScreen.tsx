import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Action, Card, ui } from '../components/controls';
import { savedComparisons } from '../storage/mobile-saved-comparisons';
import type { SavedComparison } from '../storage/saved-comparisons';

export function SavedScreen({ onOpen }: { onOpen: (entry: SavedComparison) => void }) {
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
      <Text accessibilityRole="header" style={ui.title}>Saved comparisons</Text>
      <Text style={ui.muted}>Stored on this device only. These are historical estimates, not updated prices.</Text>
      {!!error && <><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Action label="Retry saved comparisons" disabled={busy} onPress={() => { void load(); }} /></>}
      {busy && <Text style={ui.muted}>Loading…</Text>}
      {!busy && !error && !items.length && <Text style={ui.text}>No saved comparisons yet.</Text>}
      {items.map(item => <Card key={item.id}>
        <Text style={ui.title}>{item.comparison.itemName}</Text>
        <Text style={ui.text}>{item.form.country} · {item.comparison.result.shoppingCurrency} {item.comparison.price}</Text>
        <Text style={ui.muted}>{new Date(item.savedAt).toLocaleDateString()} · {item.comparison.sample ? 'Sample estimate' : 'Historical estimate'}</Text>
        <Action label={'Open ' + item.comparison.itemName} disabled={busy} onPress={() => onOpen(item)} />
        <Action label={'Delete ' + item.comparison.itemName} secondary disabled={busy} onPress={() => { void remove(item.id); }} />
      </Card>)}
      {(items.length > 0 || !!error) && <Action label="Clear saved comparisons" secondary disabled={busy} onPress={() => setConfirmClear(true)} />}
      {confirmClear && <Card>
        <Text style={ui.text}>Delete all saved comparisons from this device? This cannot be undone.</Text>
        <Action label="Delete all saved comparisons" disabled={busy} onPress={() => { void remove(); }} />
        <Action label="Cancel" secondary onPress={() => setConfirmClear(false)} />
      </Card>}
  </>;
}
