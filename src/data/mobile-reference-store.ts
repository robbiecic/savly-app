import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import type { ReferenceStore } from './reference-store';
import { developmentApiUrl, selectReferenceStore } from './development-reference-store';

import type { Session } from '../auth/cognito';

let selectedSession: Session | null | undefined;
let selected: Promise<ReferenceStore> | undefined;
export function getReferenceStore(session: Session | null): Promise<ReferenceStore> {
  if (selectedSession !== session) { selected = undefined; selectedSession = session; }
  return selected ??= selectReferenceStore({
    baseUrl: session ? developmentApiUrl(
      __DEV__ || process.env.EXPO_PUBLIC_APP_ENV === 'development', Platform.OS, process.env.EXPO_PUBLIC_FX_API_URL,
    ) : null,
    getToken: session ? async () => session.expiresAt > Date.now() ? session.accessToken : '' : undefined,
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
