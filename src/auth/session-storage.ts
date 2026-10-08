import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { SessionStorage } from './session-store';

export const SECURE_STORAGE_BUILD_ERROR = 'This version of Savly needs an update to keep you signed in. Install the latest app build, then reopen Savly.';
export class SecureStorageBuildError extends Error {
  constructor() { super(SECURE_STORAGE_BUILD_ERROR); }
}

export function checkSessionStorage(): void {
  if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoSecureStore')) {
    throw new SecureStorageBuildError();
  }
}

async function secureStore() {
  // The package throws while importing on older native builds. Check first, and
  // load only on demand so a missing module cannot crash the JavaScript runtime.
  checkSessionStorage();
  const api = await import('expo-secure-store');
  return { api, options: { keychainAccessible: api.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY } };
}

const key = 'savly.auth.session.v1';
// Browser previews retain their existing memory-only authentication behavior.
export const sessionStorage: SessionStorage = Platform.OS === 'web' ? {
  read: async () => null, write: async () => {}, clear: async () => {},
} : {
  read: async () => { const { api, options } = await secureStore(); return api.getItemAsync(key, options); },
  write: async value => { const { api, options } = await secureStore(); await api.setItemAsync(key, value, options); },
  clear: async () => { const { api, options } = await secureStore(); await api.deleteItemAsync(key, options); },
};
