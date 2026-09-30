import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export const ui = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 22, gap: 18 },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink },
  text: { fontSize: 16, lineHeight: 24, color: colors.ink },
  muted: { fontSize: 14, lineHeight: 21, color: colors.muted },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, minHeight: 52, padding: 14, color: colors.ink, fontSize: 18, backgroundColor: colors.surface },
  error: { color: '#A32828', fontSize: 14, lineHeight: 21 },
  button: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
});
export function Card({ children }: { children: ReactNode }) { return <View style={ui.card}>{children}</View>; }
export function Action({ label, onPress, secondary = false, disabled = false, expanded }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; expanded?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, expanded }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [ui.button, secondary && { backgroundColor: '#EDEFF5' }, (pressed || disabled) && { opacity: 0.65 }]}>
    <Text style={[ui.buttonText, secondary && { color: colors.ink }]}>{label}</Text>
  </Pressable>;
}
export function Field({ label, value, onChange, error, numeric = false, prominent = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; error?: string; numeric?: boolean; prominent?: boolean; placeholder?: string }) {
  return <View style={{ gap: 8 }}>
    <Text style={ui.label}>{label}</Text>
    <TextInput accessibilityLabel={label} accessibilityHint={error} value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'}
      placeholder={placeholder} placeholderTextColor="#737A89" maxLength={numeric ? 40 : 100}
      style={[ui.input, prominent && { fontSize: 36, fontWeight: '600', paddingVertical: 20 }, !!error && { borderColor: '#A32828' }]} />
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </View>;
}
export interface Option { value: string; label: string }
export function Select({ label, value, options, onChange, error }: { label: string; value: string; options: Option[]; onChange: (value: string) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const chosen = options.find((option) => option.value === value)?.label ?? (value || 'Choose country');
  return <View style={{ gap: 8 }}>
    <Text style={ui.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${chosen}`} accessibilityState={{ expanded: open }}
      style={[ui.input, { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }]} onPress={() => { setSearch(''); setOpen(true); }}>
      <Text style={[ui.text, { flexShrink: 1 }]}>{chosen}</Text><Text style={ui.text}>⌄</Text>
    </Pressable>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: 24, gap: 16, flex: 1 }}>
          <Text accessibilityRole="header" style={ui.title}>{label}</Text>
          <Field label={`Search ${label.toLowerCase()}`} value={search} onChange={setSearch} />
          <ScrollView keyboardShouldPersistTaps="handled">
            {options.filter((option) => `${option.label} ${option.value}`.toLowerCase().includes(search.toLowerCase())).map((option) =>
              <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: option.value === value }}
                onPress={() => { onChange(option.value); setOpen(false); }} style={{ paddingVertical: 16, minHeight: 48, borderBottomWidth: 1, borderColor: colors.border }}>
                <Text style={ui.text}>{option.label}{option.value === value ? ' ✓' : ''}</Text>
              </Pressable>)}
          </ScrollView>
          <Action label="Close selection" secondary onPress={() => setOpen(false)} />
        </View>
      </SafeAreaView>
    </Modal>
  </View>;
}
