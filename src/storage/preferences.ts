import { DEFAULT_PREFERENCES, type Preferences } from '../features/comparison/model';
import type { Storage } from '../data/reference-store';

export class PreferenceStore {
  private writes = Promise.resolve();
  private readonly key = 'savly:preferences:1';
  constructor(private storage: Storage) {}
  async load(): Promise<Preferences | null> {
    try {
      const raw = await this.storage.getItem(this.key);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (p.version !== 1 || !/^[A-Z]{2}$/.test(p.country) || !(p.homeCurrency === '' || /^[A-Z]{3}$/.test(p.homeCurrency)) ||
          !(p.residence === '' || /^[A-Z]{2}$/.test(p.residence))) return null;
      return { country: p.country, homeCurrency: p.homeCurrency, residence: p.residence, feePercent: '0' };
    } catch { return null; }
  }
  save(preferences: Preferences): Promise<void> {
    // Serial writes stop an older preference save overwriting a later edit.
    const value = JSON.stringify({ version: 1, ...preferences, feePercent: '0' });
    this.writes = this.writes.catch(() => {}).then(() => this.storage.setItem(this.key, value));
    return this.writes;
  }
}
export function initialPreferences(): Preferences {
  return { ...DEFAULT_PREFERENCES, homeCurrency: '' };
}
