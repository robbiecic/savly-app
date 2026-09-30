import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { ReferenceStore } from './reference-store';
import { createMockTransport } from './transport';

// One shared instance, intentionally sample-only until production access is agreed.
export const referenceStore = new ReferenceStore({
  environment: 'prototype', mode: 'sample', storage: AsyncStorage, transport: createMockTransport(),
});

// Start from the future calculator's root effect; return its cleanup function.
export function activateReferenceData(): () => void {
  referenceStore.setActive(AppState.currentState === 'active');
  const subscription = AppState.addEventListener('change', (state) => {
    referenceStore.setActive(state === 'active');
  });
  return () => {
    subscription.remove();
    referenceStore.setActive(false);
  };
}
