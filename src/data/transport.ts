import defaultCountries from './default-countries.json';
import { DataError, validateReferenceData } from './reference-data';

export type ReferencePath = '/v1/rates' | '/v1/countries';
export interface ReferenceTransport {
  get(path: ReferencePath): Promise<unknown>;
}

// This interface cannot carry item inputs, residency, or computed totals.
export function createHttpTransport(options: {
  baseUrl: string;
  getToken?: () => Promise<string>;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): ReferenceTransport {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  return {
    async get(path) {
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new DataError('network', 'Reference data request timed out.'));
        }, options.timeoutMs ?? 15_000);
      });
      const request = async () => {
        const token = options.getToken ? await options.getToken() : null;
        if (controller.signal.aborted) throw new DataError('network', 'Reference data request timed out.');
        if (options.getToken && !token) throw new DataError('authentication', 'An API access token is required.');
        const response = await (options.fetcher ?? fetch)(`${baseUrl}${path}`, {
          method: 'GET', headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal,
        });
        if (response.status === 401) throw new DataError('authentication', 'API authentication is required.');
        if (!response.ok) throw new DataError('network', `Reference data request failed (${response.status}).`);
        return await response.json();
      };
      try {
        return await Promise.race([request(), deadline]);
      } catch (error) {
        if (error instanceof DataError) throw error;
        throw new DataError('network', 'Reference data could not be loaded.');
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

// Dated response snapshot from fxService, not an independently maintained rules engine.
const bundledCountries = validateReferenceData({ rates: [] }, defaultCountries).countries;
export const SAMPLE_RESPONSES = {
  '/v1/rates': { rates: [
    { pair: 'EURUSD', rate: 1.1, pipSize: 0.0001, asOf: '2026-09-26T12:00:00Z', source: 'CityIndex' },
    { pair: 'USDJPY', rate: 150, pipSize: 0.01, asOf: '2026-09-26T12:00:00Z', source: 'CityIndex' },
    { pair: 'AUDUSD', rate: 0.65, pipSize: 0.0001, asOf: '2026-09-26T12:00:00Z', source: 'CityIndex' },
    { pair: 'EURGBP', rate: 0.85, pipSize: 0.0001, asOf: '2026-09-26T12:00:00Z', source: 'CityIndex' },
  ] },
  '/v1/countries': { countries: ['FR', 'ES', 'US', 'JP', 'GB', 'AU'].map(code => bundledCountries.find(country => country.country === code)!) },
};

// Async fixture transport uses the backend wire shape, never claims live rates.
export function createMockTransport(
  respond: (path: ReferencePath) => unknown | Promise<unknown> = (path) => SAMPLE_RESPONSES[path],
): ReferenceTransport {
  return { async get(path) { return JSON.parse(JSON.stringify(await respond(path))); } };
}

// Owner supplied these static rates on 2026-10-07 without a quote timestamp.
// Keep them undated and distinct from CityIndex API responses.
export const GUEST_RESPONSES = {
  ...SAMPLE_RESPONSES,
  '/v1/rates': { rates: [
    ...SAMPLE_RESPONSES['/v1/rates'].rates,
    ...[
      { pair: 'GBPUSD', rate: 1.32, pipSize: 0.0001 },
      { pair: 'GBPJPY', rate: 208.8, pipSize: 0.01 },
      { pair: 'GBPAUD', rate: 1.90, pipSize: 0.0001 },
      { pair: 'EURJPY', rate: 176.9, pipSize: 0.01 },
      { pair: 'EURAUD', rate: 1.61, pipSize: 0.0001 },
      { pair: 'AUDJPY', rate: 110.0, pipSize: 0.01 },
    ].map(rate => ({ ...rate, source: 'Owner-provided defaults' as const, asOf: null })),
  ] },
};

export function createGuestTransport(): ReferenceTransport {
  return createMockTransport(path => GUEST_RESPONSES[path]);
}
