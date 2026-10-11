import { BillingProvider, useBilling } from './src/billing/BillingProvider';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { WelcomeScreen } from './src/app/WelcomeScreen';
import { CompareScreen } from './src/app/CompareScreen';
import { PremiumCard } from './src/billing/PremiumCard';
import { Action } from './src/components/controls';

export default function App() {
  return <SafeAreaProvider><AuthProvider><BillingProvider><AppContent /></BillingProvider></AuthProvider></SafeAreaProvider>;
}

function AppContent() {
  const { user, signOut } = useAuth();
  const billing = useBilling();
  const [started, setStarted] = useState(() => !!user);
  useEffect(() => {
    if (!user) setStarted(false);
    else if (billing.active || billing.preview) setStarted(true);
  }, [user, billing.active, billing.preview]);
  const needsPremium = !!user && !billing.preview && !billing.active;
  if (needsPremium) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar style="dark" />
      <PremiumCard />
      <Action label="Sign out" secondary onPress={() => { void signOut().then(success => { if (success) setStarted(false); }); }} />
    </SafeAreaView>;
  }
  return (
    <>
      <StatusBar style={started ? "dark" : "light"} />
      {started ? <CompareScreen onSignOut={() => { void signOut().then(success => { if (success) setStarted(false); }); }} /> : <WelcomeScreen onGetStarted={() => setStarted(true)} />}
    </>
  );
}
