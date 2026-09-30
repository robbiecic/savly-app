import type { DataMode } from '../domain/refunds';

export interface Rate {
  readonly pair: string;
  readonly rate: number;
  readonly pipSize: number;
  readonly asOf: string;
  readonly source: 'CityIndex';
}
export interface Country {
  readonly country: string;
  readonly currency: string;
  readonly vatRate: number | null;
}
export interface ReferenceData {
  readonly rates: readonly Rate[];
  readonly countries: readonly Country[];
}
export interface Snapshot extends ReferenceData {
  readonly adapterVersion: 1;
  readonly environment: string;
  readonly mode: DataMode;
  readonly id: string;
  readonly fetchedAt: number;
}

export class DataError extends Error {
  constructor(public readonly kind: 'invalid-data' | 'network' | 'authentication' | 'storage', message: string) {
    super(message);
  }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function invalid() { return new DataError('invalid-data', 'Reference data is malformed or unsupported.'); }
function code(value: unknown, length: number): string {
  if (typeof value !== 'string' || !new RegExp(`^[A-Z]{${length}}$`).test(value)) throw invalid();
  return value;
}
function positive(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw invalid();
  return value;
}
function unique<T>(rows: T[], key: (row: T) => string): readonly T[] {
  if (new Set(rows.map(key)).size !== rows.length) throw invalid();
  return Object.freeze(rows);
}

// Rebuild from allowed fields, then freeze: callers cannot change cached/history data.
export function validateReferenceData(ratesResponse: unknown, countriesResponse: unknown): ReferenceData {
  const rates = record(ratesResponse).rates;
  const countries = record(countriesResponse).countries;
  if (!Array.isArray(rates) || !Array.isArray(countries)) throw invalid();
  return Object.freeze({
    rates: unique(rates.map((value): Rate => {
      const row = record(value);
      const pair = code(row.pair, 6);
      if (pair.slice(0, 3) === pair.slice(3)) throw invalid();
      if (row.source !== 'CityIndex' || typeof row.asOf !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(row.asOf) ||
          !Number.isFinite(Date.parse(row.asOf)) ||
          new Date(row.asOf).toISOString() !== (row.asOf.includes('.') ? row.asOf : row.asOf.replace('Z', '.000Z'))) throw invalid();
      return Object.freeze({ pair, rate: positive(row.rate), pipSize: positive(row.pipSize), asOf: row.asOf, source: row.source });
    }), (row) => row.pair),
    countries: unique(countries.map((value): Country => {
      const row = record(value);
      if (row.vatRate !== null && (typeof row.vatRate !== 'number' || !Number.isFinite(row.vatRate) || row.vatRate < 0 || row.vatRate > 1)) throw invalid();
      return Object.freeze({ country: code(row.country, 2), currency: code(row.currency, 3), vatRate: row.vatRate as number | null });
    }), (row) => row.country),
  });
}

export function parseSnapshot(raw: string, environment: string, mode: DataMode): Snapshot {
  const value = record(JSON.parse(raw));
  if (value.adapterVersion !== 1 || value.environment !== environment || value.mode !== mode ||
      typeof value.id !== 'string' || !value.id || typeof value.fetchedAt !== 'number' ||
      !Number.isSafeInteger(value.fetchedAt) || value.fetchedAt < 0) throw invalid();
  return Object.freeze({ ...validateReferenceData(value, value), adapterVersion: 1, environment, mode, id: value.id, fetchedAt: value.fetchedAt });
}

// Membership comes only from the current snapshot, including after country removal.
export function selectedCountry(snapshot: Snapshot, code: string): Country | null {
  return snapshot.countries.find((country) => country.country === code) ?? null;
}
