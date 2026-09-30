import { DataError } from './reference-data';

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

export const SAMPLE_RESPONSES = {
  '/v1/rates': { rates: [{ pair: 'EURUSD', rate: 1.1, pipSize: 0.0001, asOf: '2026-09-26T12:00:00Z', source: 'CityIndex' }] },
  '/v1/countries': { countries: [
    { country: 'FR', currency: 'EUR', vatRate: 0.2 },
    { country: 'US', currency: 'USD', vatRate: null },
  ] },
};

// Async fixture transport uses the backend wire shape, never claims live rates.
export function createMockTransport(
  respond: (path: ReferencePath) => unknown | Promise<unknown> = (path) => SAMPLE_RESPONSES[path],
): ReferenceTransport {
  return { async get(path) { return JSON.parse(JSON.stringify(await respond(path))); } };
}
