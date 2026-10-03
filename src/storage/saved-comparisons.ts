import type { Storage } from '../data/reference-store';
import type { ComparisonForm, DisplayedComparison } from '../features/comparison/model';

export interface SavedComparison {
  id: string;
  savedAt: string;
  photoUri?: string;
  form: ComparisonForm;
  comparison: DisplayedComparison;
}
export interface PhotoStorage {
  persist(uri: string): Promise<string>;
  remove(uri: string): Promise<void>;
  clear(): Promise<void>;
}
export function validPhotoUri(uri: unknown): uri is string {
  return typeof uri === 'string' && (/^savly-photo:[a-zA-Z0-9-]+\.jpg$/.test(uri) ||
    (uri.length <= 400_000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(uri)));
}
const key = 'savly:saved:1';
function valid(entry: SavedComparison): boolean {
  const c = entry?.comparison;
  const r = c?.result;
  const amount = (v: unknown) => typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v);
  return typeof entry?.id === 'string' && typeof entry.savedAt === 'string' &&
    Number.isFinite(Date.parse(entry.savedAt)) && (entry.photoUri === undefined || validPhotoUri(entry.photoUri)) &&
    !!entry.form && ['country', 'residence', 'homeCurrency', 'price', 'homePrice', 'feePercent', 'itemName', 'fxOverride', 'refundOverride']
      .every(k => typeof entry.form[k as keyof ComparisonForm] === 'string') &&
    typeof c?.itemName === 'string' && !!c.itemName.trim() && amount(c.price) &&
    (c.homePrice === null || amount(c.homePrice)) && typeof c.sample === 'boolean' && typeof c.stale === 'boolean' &&
    typeof c.snapshotId === 'string' && Number.isFinite(c.fetchedAt) &&
    (r?.priceDifference === undefined || r.priceDifference === null || amount(r.priceDifference)) &&
    (r?.refundBreakdown === undefined || (!!r.refundBreakdown && amount(r.refundBreakdown.grossHome) &&
      amount(r.refundBreakdown.feeHome) && amount(r.refundBreakdown.feeRate) && Number(r.refundBreakdown.feeRate) <= 1)) &&
    r?.calculationVersion === 1 && /^[A-Z]{3}$/.test(r.homeCurrency) && /^[A-Z]{3}$/.test(r.shoppingCurrency) &&
    [r.convertedCost, r.cardFee, r.withoutRefund, r.bankFee].every(amount) &&
    [r.includedVat, r.refundShopping, r.refundHome, r.withRefund].every(v => v === null || amount(v)) &&
    (r.savings === null || (!!r.savings && amount(r.savings.amount) && amount(r.savings.percentage) && ['save', 'same', 'more'].includes(r.savings.outcome))) &&
    !!r.fx && amount(r.fx.rate) && typeof r.fx.from === 'string' && typeof r.fx.to === 'string' &&
    typeof r.fx.source === 'string' && ['sample', 'reference', 'manual'].includes(r.fx.kind) &&
    (r.fx.asOf === null || typeof r.fx.asOf === 'string') &&
    !!r.refund && ['sample', 'manual', 'unavailable'].includes(r.refund.kind) &&
    (r.refund.kind !== 'sample' || (Array.isArray(r.refund.assumptions) && r.refund.assumptions.every(v => typeof v === 'string'))) &&
    Array.isArray(r.assumptions) && r.assumptions.every(v => typeof v === 'string');
}
export class SavedComparisonStore {
  private writes: Promise<unknown> = Promise.resolve();
  constructor(private storage: Storage, private photos?: PhotoStorage) {}
  async list(): Promise<SavedComparison[]> {
    await this.writes.catch(() => {});
    return this.read();
  }
  private async read(): Promise<SavedComparison[]> {
    const raw = await this.storage.getItem(key);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.items) || !data.items.every(valid)) throw new Error('Saved comparisons could not be read.');
    return data.items;
  }
  private change(update: (items: SavedComparison[]) => SavedComparison[] | Promise<SavedComparison[]>, clear = false): Promise<void> {
    const next = this.writes.catch(() => {}).then(async () => {
      const items = clear ? [] : await this.read();
      const updated = await update(items);
      try {
        await this.storage.setItem(key, JSON.stringify({ version: 1, items: updated }));
      } catch (error) {
        for (const item of updated) if (item.photoUri && !items.some(old => old.photoUri === item.photoUri)) {
          await this.photos?.remove(item.photoUri).catch(() => {});
        }
        throw error;
      }
      // Delete only after the record write succeeds. A cleanup failure must not
      // turn a successful save/delete into a misleading failure message.
      if (clear) await this.photos?.clear().catch(() => {});
      else for (const item of items) if (item.photoUri && !updated.some(next => next.photoUri === item.photoUri)) {
        await this.photos?.remove(item.photoUri).catch(() => {});
      }
    });
    this.writes = next;
    return next;
  }
  save(entry: SavedComparison): Promise<void> {
    // Copy before queuing so later form edits cannot alter the saved snapshot.
    const copy = JSON.parse(JSON.stringify(entry)) as SavedComparison;
    if (!valid(copy)) return Promise.reject(new Error('Invalid comparison.'));
    return this.change(async items => {
      if (copy.photoUri && this.photos) copy.photoUri = await this.photos.persist(copy.photoUri);
      return [copy, ...items.filter(item => item.id !== copy.id)];
    });
  }
  remove(id: string): Promise<void> { return this.change(items => items.filter(item => item.id !== id)); }
  clear(): Promise<void> { return this.change(() => [], true); }
}
