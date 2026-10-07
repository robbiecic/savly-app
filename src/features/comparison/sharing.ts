import { isFxStale } from '../../data/fx-freshness';
import { D } from '../../domain/decimal';
import type { DisplayedComparison } from './model';
import { fxLabel } from './model';

export interface ShareLink { url: string; demo: boolean }
export function shareLink(url?: string): ShareLink {
  if (!url) return { url: 'https://example.com/app', demo: true };
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/app') {
    throw new Error('The share link must be an HTTPS /app address without credentials, query parameters, or fragments.');
  }
  return { url: parsed.toString(), demo: parsed.hostname === 'example.com' };
}
export function shareMessage(comparison: DisplayedComparison, link: ShareLink): string {
  const { result: r } = comparison;
  const money = (amount: string) => `${r.homeCurrency} ${amount}`;
  const savings = r.savings;
  const title = !savings ? "Here’s my overseas shopping estimate from Savly."
    : savings.outcome === 'save' ? `I could save ${money(savings.amount)} (${savings.percentage}%) with Savly!`
    : savings.outcome === 'same' ? 'Same estimated cost as at home.'
    : `This would cost ${money(savings.amount.replace('-', ''))} more than at home (${savings.percentage.replace('-', '')}%).`;
  return [title, '',
    ...(comparison.itemName ? [`Item: ${comparison.itemName.replace(/[\r\n]+/g, ' ')}`] : []),
    `Shopping price: ${r.shoppingCurrency} ${comparison.price}`,
    ...(comparison.homePrice ? [`Home price: ${money(comparison.homePrice)}`] : []),
    `Without VAT refund: ${money(r.withoutRefund)}`,
    ...(r.priceDifference != null ? [`Price difference before refund: ${money(r.priceDifference)}`] : []),
    ...(r.refundBreakdown ? [
      `VAT refund before fee (estimate): ${money(r.refundBreakdown.grossHome)}`,
      `Refund fee (${new D(r.refundBreakdown.feeRate).mul(100).toFixed()}% assumed): -${money(r.refundBreakdown.feeHome)}`,
    ] : []),
    ...(r.refundHome !== null && r.withRefund !== null
      ? [`Estimated VAT refund: ${money(r.refundHome)}`, `With VAT refund: ${money(r.withRefund)}`]
      : [r.refund.kind === 'vat-unavailable' ? 'VAT refund unavailable; comparison excludes any refund.' : 'Refund estimate unavailable']), '',
    r.fx.source === 'Built-in defaults' ? 'Estimate using built-in default rates' : comparison.sample ? 'Sample estimate' : r.fx.from === r.fx.to ? 'Estimated cost · No currency conversion' : r.fx.kind === 'manual' ? 'Estimated using a manual rate' : `Estimated using rates as of ${r.fx.asOf}`,
    ...(isFxStale(r.fx) ? ['Rates out of date · FX rate over 48 hours old or date unverified'] : []),
    fxLabel(r.fx),
    ...(r.refund.kind === 'manual' ? ['Manual refund amount'] : []),
    ...(new D(r.bankFee).gt(0) ? [`Additional bank fee: ${new D(r.bankFee).mul(100).toFixed()}%`] : []),
    ...(r.refund.kind === 'vat-assumption' ? ['Assumes all included VAT is refundable, with no provider fee.'] : []),
    ...(comparison.refundAssessment ? [comparison.refundAssessment.reason] : []),
    'Refund subject to eligibility. Excludes customs/import taxes.',
    ...(link.demo ? ['Demo link only; app open/download routing is not available.'] : []),
    `Open or download Savly: ${link.url}`,
    'Monthly subscription or lifetime purchase required to use Savly.',
  ].join('\n');
}
export async function openShare(message: string, send: (content: { message: string }) => Promise<unknown>): Promise<'closed' | 'failed'> {
  try { await send({ message }); return 'closed'; }
  catch (error) {
    // Web Share cancellation is a rejected AbortError; native iOS resolves dismissal.
    return error instanceof Error && error.name === 'AbortError' ? 'closed' : 'failed';
  }
}
