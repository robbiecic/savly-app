import { countryCurrencyCodes } from './country-catalog';
import { DataError, record } from './reference-data';
import type { ReferenceTransport } from './transport';

export const FRANKFURTER_URL = 'https://api.frankfurter.dev/v2/rates';
const supportedCurrencies = countryCurrencyCodes;
export function frankfurterBaseCurrency(preferred: string): string {
  return supportedCurrencies.includes(preferred) ? preferred : 'EUR';
}

// Frankfurter returns one row per base/quote pair, with a publication date rather
// than a quote timestamp. Keep the date and the base direction unchanged.
export function frankfurterRates(value: unknown, baseCurrency: string): { rates: unknown[] } {
  if (!Array.isArray(value)) throw new DataError('invalid-data', 'Frankfurter rates are malformed.');
  const rates = value.filter(value => {
    const row = record(value);
    return supportedCurrencies.includes(String(row.quote)) && row.quote !== baseCurrency;
  }).map(value => {
    const row = record(value);
    if (row.base !== baseCurrency || typeof row.quote !== 'string' || !/^[A-Z]{3}$/.test(row.quote) ||
        typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
        !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date ||
        typeof row.rate !== 'number' || !Number.isFinite(row.rate) || row.rate <= 0) {
      throw new DataError('invalid-data', 'Frankfurter rates are malformed.');
    }
    return { pair: baseCurrency + row.quote, rate: row.rate, pipSize: null, asOf: row.date, source: 'Frankfurter' };
  });
  if (!rates.length) {
    throw new DataError('invalid-data', 'Frankfurter did not return the requested rates.');
  }
  return { rates };
}

export function createFrankfurterTransport(options: {
  baseCurrency: string; countries: ReferenceTransport; fetcher?: typeof fetch; timeoutMs?: number;
}): ReferenceTransport {
  if (!supportedCurrencies.includes(options.baseCurrency)) throw new DataError('invalid-data', 'Unsupported home currency.');
  return {
    get: async path => {
      if (path === '/v1/countries') return options.countries.get(path);
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new DataError('network', 'Frankfurter request timed out.'));
        }, options.timeoutMs ?? 15_000);
      });
      try {
        const request = async () => {
          const quotes = supportedCurrencies.filter(currency => currency !== options.baseCurrency).join(',');
          const url = `${FRANKFURTER_URL}?base=${options.baseCurrency}&quotes=${quotes}`;
          const response = await (options.fetcher ?? fetch)(url, { method: 'GET', signal: controller.signal });
          if (!response.ok) throw new DataError('network', `Frankfurter request failed (${response.status}).`);
          return frankfurterRates(await response.json(), options.baseCurrency);
        };
        return await Promise.race([request(), deadline]);
      } catch (error) {
        if (error instanceof DataError) throw error;
        throw new DataError('network', 'Frankfurter rates could not be loaded.');
      } finally { clearTimeout(timeout); }
    },
  };
}
