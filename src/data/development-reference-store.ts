import { ReferenceStore, type Storage } from './reference-store';
import { createHttpTransport, createMockTransport } from './transport';

export function developmentApiUrl(development: boolean, platform: string, override?: string): string | null {
  if (!development) return null;
  if (override?.trim()) return override.trim().replace(/\/$/, '');
  if (platform === 'android') return 'http://10.0.2.2:3000';
  if (platform === 'ios') return 'http://127.0.0.1:3000';
  return null;
}

// Resolve once per app session. A connected local store never switches to fixtures
// on refresh failure; its ordinary stale-cache and Retry behavior remains intact.
export async function selectReferenceStore(options: {
  baseUrl: string | null; storage: Storage; fetcher?: typeof fetch;
}): Promise<ReferenceStore> {
  if (options.baseUrl) {
    const local = new ReferenceStore({
      environment: `local:${options.baseUrl}`, mode: 'sample', storage: options.storage,
      transport: createHttpTransport({ baseUrl: options.baseUrl, fetcher: options.fetcher, timeoutMs: 2000 }),
    });
    const state = await local.get();
    // Local fxService defaults to mock CityIndex data. Keep sample provenance.
    // Invalid responses/auth/storage failures should be visible, not masked.
    if (state.snapshot || state.error !== 'network') return local;
  }
  return new ReferenceStore({
    environment: 'prototype', mode: 'sample', storage: options.storage, transport: createMockTransport(),
  });
}
