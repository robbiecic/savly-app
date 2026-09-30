import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WelcomeScreen } from './src/app/WelcomeScreen';
import { CompareScreen } from './src/app/CompareScreen';

export default function App() {
  const [started, setStarted] = useState(false);
  return (
    <SafeAreaProvider>
      <StatusBar style={started ? "dark" : "light"} />
      {started ? <CompareScreen /> : <WelcomeScreen onGetStarted={() => setStarted(true)} />}
    </SafeAreaProvider>
  );
}
