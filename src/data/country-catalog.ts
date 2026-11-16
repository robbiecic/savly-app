import countryCurrencies from './country-currencies.json';
import defaultCountries from './default-countries.json';
import { DataError, validateReferenceData, type Country } from './reference-data';
import type { ReferenceTransport } from './transport';

// Current tender currencies from Unicode CLDR supplementalData, reviewed
// 2026-11-15. Antarctica has no tender currency in that source.
const currencies: Readonly<Record<string, string | null>> = countryCurrencies;
export const countryCodes = Object.keys(currencies);
export const countryCurrencyCodes = [...new Set(Object.values(currencies).filter((code): code is string => code !== null))].sort();

export function currencyForCountry(country: string): string | null | undefined {
  return currencies[country];
}

export function expandCountryData(response: unknown): { countries: Country[] } {
  const known = validateReferenceData({ rates: [] }, response).countries;
  const byCode = new Map(known.map(country => [country.country, country]));
  return { countries: countryCodes.flatMap(country => {
    const currency = currencies[country];
    if (!currency) return [];
    const source = byCode.get(country);
    // Source metadata is accepted only when its currency agrees with CLDR.
    if (source && source.currency !== currency) throw new DataError('invalid-data', 'Country currency metadata disagrees with the current country catalog.');
    return [{ country, currency, vatRate: source?.vatRate ?? null,
      ...(source?.touristRefund ? { touristRefund: source.touristRefund } : {}) }];
  }) };
}

export function createCountryTransport(source?: ReferenceTransport): ReferenceTransport {
  return {
    get: async path => {
      if (path !== '/v1/countries') throw new Error('Country transport only serves country metadata.');
      return expandCountryData(source ? await source.get(path) : defaultCountries);
    },
  };
}
