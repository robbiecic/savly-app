import type { FxQuote } from '../domain/calculator';
export const FX_STALE_AFTER_MS = 48 * 60 * 60 * 1000;

// Fetch/cache time never makes an old provider quote (or bundled default) fresh.
export function isRateStale(asOf: string | null, now = Date.now()): boolean {
  if (!asOf) return true;
  const timestamp = Date.parse(asOf);
  return !Number.isFinite(timestamp) || timestamp > now || now - timestamp > FX_STALE_AFTER_MS;
}
export function isFxStale(fx: FxQuote, now = Date.now()): boolean {
  if (fx.kind !== 'manual' && fx.from !== fx.to && fx.source === 'Frankfurter' && fx.asOf && /^\d{4}-\d{2}-\d{2}$/.test(fx.asOf)) {
    const dayStart = Date.parse(fx.asOf);
    // Frankfurter supplies a date, not the publication hour. Warn once the
    // rate is definitely older than 48 hours, even if issued late that day.
    return !Number.isFinite(dayStart) || dayStart > now || now - (dayStart + 24 * 60 * 60 * 1000) > FX_STALE_AFTER_MS;
  }
  return fx.kind !== 'manual' && fx.from !== fx.to && isRateStale(fx.asOf, now);
}

export function staleFxBadge(fx: FxQuote, now = Date.now()): string | null {
  if (!isFxStale(fx, now)) return null;
  if (fx.source === 'Built-in defaults') return 'FX rates are stale. This estimate used built-in default rates.';
  if (fx.kind === 'sample') return 'FX rates are stale. This estimate used a sample rate.';
  if (fx.source === 'Frankfurter') {
    const dayStart = fx.asOf ? Date.parse(fx.asOf) : NaN;
    return Number.isFinite(dayStart) && dayStart <= now
      ? 'Frankfurter daily reference rate is over 48 hours old. Check its source date in the details.'
      : 'Frankfurter daily reference date is unverified. Check its source date in the details.';
  }
  const sourceTime = fx.asOf ? Date.parse(fx.asOf) : NaN;
  return Number.isFinite(sourceTime) && sourceTime <= now
    ? 'API FX rate is over 48 hours old. Check its source timestamp in the details.'
    : 'API FX rate date is unverified. Check its source timestamp in the details.';
}
