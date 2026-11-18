import { PremiumManagementModal } from '../billing/PremiumManagementModal';
import { PremiumCard } from '../billing/PremiumCard';
import { useAuth } from '../auth/AuthProvider';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useBilling } from '../billing/BillingProvider';
import { Select, ui } from '../components/controls';
import { CompareIcon } from '../components/CompareIcon';
import { residenceOptions } from '../features/comparison/countries';

function SettingsRow({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    <Text style={styles.rowText}>{label}</Text><CompareIcon name="arrow" size={22} />
  </Pressable>;
}

function PrimaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
    <Text style={styles.primaryText}>{label}</Text><CompareIcon name="arrow" color="#FFFFFF" size={28} />
  </Pressable>;
}

export function SettingsScreen({ country, currency, locale, onChange, onBack, onSignOut, storageError }: {
  country: string; currency: string; locale: string; onChange: (country: string) => void;
  onBack: () => void; onSignOut: () => void; storageError: boolean;
}) {
  const { user, openSignIn, openSignUp } = useAuth();
  const billing = useBilling();
  const premiumActive = !!user && billing.active;
  const [managing, setManaging] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const options = useMemo(() => residenceOptions(locale), [locale]);
  if (purchasing && user && !premiumActive) return <>
    <PremiumCard />
    <SettingsRow label="Back to Settings" onPress={() => setPurchasing(false)} />
  </>;
  return <>
    {user && (managing || (purchasing && premiumActive)) && <PremiumManagementModal email={user.email} locale={locale} onClose={() => { setManaging(false); setPurchasing(false); }} />}
    <View style={styles.intro}>
      <Text accessibilityRole="header" style={styles.pageTitle}>Settings</Text>
      <Text style={styles.subtitle}>Set your home country and manage your Savly access.</Text>
    </View>
    <Select label="Home country" value={country} options={options} onChange={onChange} tile tileIcon="home" />
    {!!country && !!currency && <Text style={styles.note}>Your home currency is {currency}.</Text>}
    {!!country && !currency && <Text accessibilityRole="alert" style={ui.error}>Currency data is unavailable for this home country. Choose a supported home country to calculate savings.</Text>}
    {storageError && <Text accessibilityRole="alert" style={ui.error}>Your change is active, but settings couldn’t be saved for the next app launch.</Text>}
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Savly Premium</Text>
      <Text style={styles.note}>{premiumActive ? 'Savly Premium is active' : 'Default mode · Unlimited calculations'}</Text>
      {premiumActive
        ? <SettingsRow label="Manage Savly Premium" onPress={() => setManaging(true)} />
        : <PrimaryAction label="Get Savly Premium" onPress={() => user ? setPurchasing(true) : openSignUp()} />}
      {!!billing.message && <Text accessibilityLiveRegion="polite" style={styles.note}>{billing.message}</Text>}
    </View>
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Account</Text>
      {user && <Text style={styles.note}>{user.email}</Text>}
      <SettingsRow label={user ? 'Sign out' : 'Sign in'} onPress={user ? onSignOut : openSignIn} />
    </View>
    {premiumActive
      ? <PrimaryAction label="Back to calculator" onPress={onBack} />
      : <SettingsRow label="Back to calculator" onPress={onBack} />}
  </>;
}

const styles = StyleSheet.create({
  intro: { gap: 8, marginTop: 12, marginBottom: 6 },
  pageTitle: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1.2, color: '#09184A' },
  subtitle: { fontSize: 17, lineHeight: 24, color: '#09184A', maxWidth: 350 },
  section: { gap: 12, marginTop: 8 },
  sectionTitle: { color: '#09184A', fontSize: 20, lineHeight: 26, fontWeight: '800' },
  note: { color: '#596277', fontSize: 14, lineHeight: 20 },
  primaryButton: { minHeight: 62, borderRadius: 22, backgroundColor: '#0B2156', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 16 },
  primaryText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', flexShrink: 1 },
  row: { minHeight: 60, borderRadius: 20, backgroundColor: '#F0F1FA', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 22 },
  rowText: { color: '#09184A', fontSize: 17, fontWeight: '700', flexShrink: 1 },
  pressed: { opacity: 0.65 },
});
