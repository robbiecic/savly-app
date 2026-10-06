import { ReferenceStore, type Storage } from './reference-store';
import { createHttpTransport, createMockTransport } from './transport';

export const DEVELOPMENT_API_URL = 'https://a2ckcxro8g.execute-api.us-east-1.amazonaws.com';

export function developmentApiUrl(development: boolean, _platform: string, override?: string): string | null {
  if (override?.trim()) return override.trim().replace(/\/+$/, '');
  return development ? DEVELOPMENT_API_URL : null;
}

// Resolve once per app session. A connected API store never switches to fixtures
// on refresh failure; its ordinary stale-cache and Retry behavior remains intact.
export async function selectReferenceStore(options: {
  baseUrl: string | null; storage: Storage; fetcher?: typeof fetch; getToken?: () => Promise<string>;
}): Promise<ReferenceStore> {
  if (options.baseUrl) {
    const api = new ReferenceStore({
      environment: `api:${options.baseUrl}`, mode: 'real', storage: options.storage,
      transport: createHttpTransport({ baseUrl: options.baseUrl, fetcher: options.fetcher, getToken: options.getToken, timeoutMs: 15000 }),
    });
    const state = await api.get();
    // Authenticated API failures remain visible and retryable.
    // Without usable API data, start from explicitly identified dated defaults.
    if (state.snapshot || options.getToken) return api;
  }
  return new ReferenceStore({
    environment: 'prototype', mode: 'sample', storage: options.storage, transport: createMockTransport(),
  });
}
