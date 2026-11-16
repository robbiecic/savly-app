import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { ReferenceStore } from './reference-store';
import { developmentApiUrl } from './development-reference-store';
import { createFrankfurterTransport } from './frankfurter-transport';
import { createHttpTransport } from './transport';
import { createCountryTransport } from './country-catalog';

import type { Session } from '../auth/cognito';

let selectedSession: Session | null | undefined;
let selectedBase: string | undefined;
let selected: Promise<ReferenceStore> | undefined;
export function getReferenceStore(session: Session | null, baseCurrency: string): Promise<ReferenceStore> {
  if (selectedSession !== session || selectedBase !== baseCurrency) {
    selected = undefined; selectedSession = session; selectedBase = baseCurrency;
  }
  return selected ??= Promise.resolve().then(() => {
    const baseUrl = session ? developmentApiUrl(
      __DEV__ || process.env.EXPO_PUBLIC_APP_ENV === 'development', Platform.OS, process.env.EXPO_PUBLIC_FX_API_URL,
    ) : null;
    const countrySource = baseUrl ? createHttpTransport({ baseUrl,
      getToken: async () => session && session.expiresAt > Date.now() ? session.accessToken : '', timeoutMs: 15_000,
    }) : undefined;
    const countries = createCountryTransport(countrySource);
    return new ReferenceStore({
      environment: `frankfurter:${baseUrl ?? 'guest'}:${baseCurrency}`, cacheRevision: 'global-countries-1',
      mode: 'real', storage: AsyncStorage,
      transport: createFrankfurterTransport({ baseCurrency, countries }),
    });
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
