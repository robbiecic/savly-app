import { useWideLayout } from './responsive';
import { RevealInputContext } from './KeyboardFormScrollView';
import { useContext, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const input = useRef<TextInput>(null);
  const reveal = useContext(RevealInputContext);
  return <View style={{ gap: 8 }}>
    <Text style={ui.label}>{label}</Text>
    <TextInput ref={input} onFocus={() => reveal?.(input.current)} onBlur={() => reveal?.(null)} accessibilityLabel={label} accessibilityHint={error} value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'}
      placeholder={placeholder} placeholderTextColor="#737A89" maxLength={numeric ? 40 : 100}
      style={[ui.input, prominent && { fontSize: 36, fontWeight: '600', paddingVertical: 20 }, !!error && { borderColor: '#A32828' }]} />
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </View>;
}
export interface Option { value: string; label: string; flag?: string }
function OptionLabel({ label, flag, selected = false }: { label: string; flag?: string; selected?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
    {!!flag && <Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ fontSize: 24 }}>{flag}</Text>}
    <Text style={[ui.text, { flexShrink: 1 }]}>{label}{selected ? ' ✓' : ''}</Text>
  </View>;
}
export function Select({ label, value, options, onChange, error, compact = false }: { label: string; value: string; options: Option[]; onChange: (value: string) => void; error?: string; compact?: boolean }) {
  const wide = useWideLayout();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectedOption = options.find((option) => option.value === value);
  const chosen = selectedOption?.label ?? (value || 'Choose country');
  return <View style={{ gap: 8 }}>
    <Text style={ui.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${chosen}`} accessibilityState={{ expanded: open }}
      style={[ui.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, compact && { borderRadius: 28, paddingVertical: 10, paddingHorizontal: 18 }]} onPress={() => { setSearch(''); setOpen(true); }}>
      <OptionLabel label={chosen} flag={selectedOption?.flag} /><Text style={ui.text}>⌄</Text>
    </Pressable>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    <RevealInputContext.Provider value={null}><Modal supportedOrientations={['portrait', 'landscape-left', 'landscape-right']} visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined} style={{ padding: wide ? 16 : 24, gap: 16, flex: 1, width: '100%', maxWidth: 1080, alignSelf: 'center' }}>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16, alignItems: wide ? 'center' : 'stretch' }}>
          <Text accessibilityRole="header" style={[ui.title, wide && { flex: 1 }]}>{label}</Text>
          <View style={wide && { flex: 2 }}><Field label={`Search ${label.toLowerCase()}`} value={search} onChange={setSearch} /></View>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {options.filter((option) => `${option.label} ${option.value}`.toLowerCase().includes(search.toLowerCase())).map((option) =>
              <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: option.value === value }}
                onPress={() => { onChange(option.value); setOpen(false); }} style={{ paddingVertical: 16, minHeight: 48, borderBottomWidth: 1, borderColor: colors.border }}>
                <OptionLabel label={option.label} flag={option.flag} selected={option.value === value} />
              </Pressable>)}
          </ScrollView>
          <Action label="Close selection" secondary onPress={() => setOpen(false)} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal></RevealInputContext.Provider>
  </View>;
}
