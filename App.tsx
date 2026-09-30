import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CompareScreen } from './src/app/CompareScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <CompareScreen />
    </SafeAreaProvider>
  );
}
