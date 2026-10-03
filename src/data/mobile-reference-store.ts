import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import type { ReferenceStore } from './reference-store';
import { developmentApiUrl, selectReferenceStore } from './development-reference-store';

let selected: Promise<ReferenceStore> | undefined;
export function getReferenceStore(): Promise<ReferenceStore> {
  return selected ??= selectReferenceStore({
    baseUrl: developmentApiUrl(__DEV__, Platform.OS, process.env.EXPO_PUBLIC_FX_API_URL),
    storage: AsyncStorage,
  });
}

export function activateReferenceData(referenceStore: ReferenceStore): () => void {
  referenceStore.setActive(AppState.currentState === 'active');
  const subscription = AppState.addEventListener('change', (state) => {
    referenceStore.setActive(state === 'active');
  });
  return () => {
    subscription.remove();
    referenceStore.setActive(false);
  };
}
