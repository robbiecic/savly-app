import type { DataMode } from '../domain/refunds';
import { DataError, parseSnapshot, validateReferenceData, type Snapshot } from './reference-data';
import type { ReferenceTransport } from './transport';

export const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const RETRIES = [60_000, 300_000, 900_000];
export interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export interface Clock { now(): number; monotonic(): number }
export interface Scheduler { schedule(callback: () => void, delayMs: number): () => void }
export interface ReferenceState {
  status: 'fresh' | 'stale' | 'unavailable';
  snapshot: Snapshot | null;
  label: 'Rates out of date' | 'Sample rate' | 'Reference rate' | 'Reference data unavailable';
  error: DataError['kind'] | null;
}
export interface StoreOptions {
  environment: string;
  cacheRevision?: string;
  mode: DataMode;
  transport: ReferenceTransport;
  storage: Storage;
  clock?: Clock;
  scheduler?: Scheduler;
}

// Share one store per environment/mode across all calculator consumers.
export class ReferenceStore {
  readonly key: string;
  private snapshot: Snapshot | null = null;
  private loaded: Promise<void> | null = null;
  private inFlight: Promise<ReferenceState> | null = null;
  private anchor: { age: number; mono: number; wall: number } | null = null;
  private clockInvalid = false;
  private failures = 0;
  private retryAt = 0;
  private error: DataError['kind'] | null = null;
  private active = false;
  private cancelTimer: (() => void) | null = null;
  private listeners = new Set<(state: ReferenceState) => void>();
  private clock: Clock;
  private scheduler: Scheduler;

  constructor(private readonly options: StoreOptions) {
    this.key = `savly:reference:1:${encodeURIComponent(options.environment)}:${options.mode}${options.cacheRevision ? ':' + options.cacheRevision : ''}`;
    this.clock = options.clock ?? { now: () => Date.now(), monotonic: () => performance.now() };
    this.scheduler = options.scheduler ?? { schedule(callback, delay) {
      const timer = setTimeout(callback, delay);
      return () => clearTimeout(timer);
    } };
  }

  private age(): number {
    if (!this.snapshot || !this.anchor) return Infinity;
    const now = this.clock.now();
    const mono = this.clock.monotonic();
    if (now < this.anchor.wall || mono < this.anchor.mono) this.clockInvalid = true;
    this.anchor.wall = now;
    if (this.clockInvalid) return Infinity;
    return Math.max(now - this.snapshot.fetchedAt, this.anchor.age + mono - this.anchor.mono);
  }

  state(): ReferenceState {
    const fresh = this.snapshot !== null && this.age() < CACHE_TTL_MS;
    return {
      status: fresh ? 'fresh' : this.snapshot ? 'stale' : 'unavailable', snapshot: this.snapshot,
      label: fresh ? this.options.mode === 'sample' ? 'Sample rate' : 'Reference rate' : this.snapshot ? 'Rates out of date' : 'Reference data unavailable',
      error: this.error,
    };
  }

  private async load(): Promise<void> {
    try {
      const raw = await this.options.storage.getItem(this.key);
      if (raw !== null) {
        this.snapshot = parseSnapshot(raw, this.options.environment, this.options.mode);
        const age = this.clock.now() - this.snapshot.fetchedAt;
        this.clockInvalid = age < 0;
        this.anchor = { age, mono: this.clock.monotonic(), wall: this.clock.now() };
      }
    } catch {
      // Malformed/incompatible cache or inaccessible storage requires a new fetch.
      this.snapshot = null;
    }
  }

  async get(): Promise<ReferenceState> { return this.use(false); }
  // Explicit user Retry (or newly supplied credentials) can bypass backoff.
  async retry(): Promise<ReferenceState> { return this.use(true); }

  private async use(force: boolean): Promise<ReferenceState> {
    await (this.loaded ??= this.load());
    if (this.inFlight) return this.inFlight;
    if (this.state().status === 'fresh' || (!force && this.clock.monotonic() < this.retryAt)) {
      this.schedule();
      return this.state();
    }
    this.inFlight = this.refresh();
    // Immediately expose expiry while the refresh is pending.
    if (this.snapshot) for (const listener of this.listeners) listener(this.state());
    try { return await this.inFlight; }
    finally {
      this.inFlight = null;
      this.schedule();
      const state = this.state();
      for (const listener of this.listeners) listener(state);
    }
  }

  private async refresh(): Promise<ReferenceState> {
    try {
      // Wait for BOTH calls even on failure: a subsequent refresh never overlaps
      // a leftover request from an earlier cycle.
      const results = await Promise.allSettled([
        this.options.transport.get('/v1/rates'), this.options.transport.get('/v1/countries'),
      ]);
      const auth = results.find((result) => result.status === 'rejected' && result.reason instanceof DataError && result.reason.kind === 'authentication');
      if (auth?.status === 'rejected') throw auth.reason;
      const [rates, countries] = results;
      if (rates.status === 'rejected') throw rates.reason;
      if (countries.status === 'rejected') throw countries.reason;
      const data = validateReferenceData(rates.value, countries.value, this.options.mode === 'sample');
      const fetchedAt = this.clock.now();
      const next: Snapshot = Object.freeze({
        ...data, adapterVersion: 1, environment: this.options.environment, mode: this.options.mode,
        fetchedAt, id: `${fetchedAt}-${Math.random().toString(36).slice(2)}`,
      });
      const mono = this.clock.monotonic();
      try { await this.options.storage.setItem(this.key, JSON.stringify(next)); }
      catch { throw new DataError('storage', 'Reference data could not be saved.'); }
      this.snapshot = next;
      this.anchor = { age: 0, mono, wall: fetchedAt };
      this.clockInvalid = false;
      this.failures = 0;
      this.retryAt = 0;
      this.error = null;
    } catch (error) {
      this.error = error instanceof DataError ? error.kind : 'network';
      this.retryAt = this.error === 'authentication' ? Infinity
        : this.clock.monotonic() + RETRIES[Math.min(this.failures++, RETRIES.length - 1)];
    }
    return this.state();
  }

  subscribe(listener: (state: ReferenceState) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  // Connect to AppState when the calculator mounts; no suspended background polling.
  setActive(active: boolean): void {
    this.active = active;
    this.cancelTimer?.();
    this.cancelTimer = null;
    if (active) void this.get();
  }

  private schedule(): void {
    this.cancelTimer?.();
    this.cancelTimer = null;
    if (!this.active || this.inFlight || this.retryAt === Infinity) return;
    const delay = this.age() < CACHE_TTL_MS ? CACHE_TTL_MS - this.age()
      : Math.max(0, this.retryAt - this.clock.monotonic());
    this.cancelTimer = this.scheduler.schedule(() => { void this.get(); }, delay);
  }
}
