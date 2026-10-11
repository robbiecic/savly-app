import { View } from 'react-native';
import { BillingProvider, useBilling } from './src/billing/BillingProvider';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WelcomeScreen } from './src/app/WelcomeScreen';
import { CompareScreen } from './src/app/CompareScreen';
import { SignInCheckout } from './src/billing/SignInCheckout';

export default function App() {
  return <SafeAreaProvider><AuthProvider><BillingProvider><AppContent /></BillingProvider></AuthProvider></SafeAreaProvider>;
}

function AppContent() {
  const { user, signOut } = useAuth();
  const billing = useBilling();
  const [started, setStarted] = useState(() => !!user);

  useEffect(() => { if (user) setStarted(true); }, [user]);
  return (
    <>
      <StatusBar style={started ? "dark" : "light"} />
      {user && billing.prompt && <SignInCheckout />}
      <View style={{ flex: 1, display: user && billing.prompt ? 'none' : 'flex' }}>
      {started ? <CompareScreen onSignOut={() => { void signOut().then(success => { if (success) setStarted(false); }); }} /> : <WelcomeScreen onGetStarted={() => setStarted(true)} />}
      </View>
    </>
  );
}
