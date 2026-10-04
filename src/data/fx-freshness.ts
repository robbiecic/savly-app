import type { FxQuote } from '../domain/calculator';
export const FX_STALE_AFTER_MS = 48 * 60 * 60 * 1000;

// Fetch/cache time never makes an old provider quote (or bundled default) fresh.
export function isRateStale(asOf: string | null, now = Date.now()): boolean {
  if (!asOf) return true;
  const timestamp = Date.parse(asOf);
  return !Number.isFinite(timestamp) || timestamp > now || now - timestamp > FX_STALE_AFTER_MS;
}
export function isFxStale(fx: FxQuote, now = Date.now()): boolean {
  return fx.kind !== 'manual' && fx.from !== fx.to && isRateStale(fx.asOf, now);
}
