import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WelcomeScreen } from './src/app/WelcomeScreen';
import { CompareScreen } from './src/app/CompareScreen';

export default function App() {
  return <SafeAreaProvider><AuthProvider><AppContent /></AuthProvider></SafeAreaProvider>;
}

function AppContent() {
  const { user, signOut } = useAuth();
  const [started, setStarted] = useState(() => !!user);
  useEffect(() => { if (user) setStarted(true); }, [user]);
  return (
    <>
      <StatusBar style={started ? "dark" : "light"} />
      {started ? <CompareScreen onSignOut={() => { void signOut().then(success => { if (success) setStarted(false); }); }} /> : <WelcomeScreen onGetStarted={() => setStarted(true)} />}
    </>
  );
}
