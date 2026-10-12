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

export function staleFxBadge(fx: FxQuote, now = Date.now()): string | null {
  if (!isFxStale(fx, now)) return null;
  if (fx.source === 'Built-in defaults') return 'FX rates are stale. This estimate used built-in default rates.';
  if (fx.kind === 'sample') return 'FX rates are stale. This estimate used a sample rate.';
  const sourceTime = fx.asOf ? Date.parse(fx.asOf) : NaN;
  return Number.isFinite(sourceTime) && sourceTime <= now
    ? 'API FX rate is over 48 hours old. Check its source timestamp in the details.'
    : 'API FX rate date is unverified. Check its source timestamp in the details.';
}
