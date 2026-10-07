# Country refund thresholds and rules screen

This milestone replaces the unconditional full-VAT assumption for new comparisons. The canonical wire contract is fxService `specs/requirements/03-api-contract.md`; no new endpoints or server calculations are introduced.

## Calculation behavior

- Validate and retain optional `touristRefund` metadata from `/v1/countries`, including minimum amount/currency, comparison, tax basis, grouping, notes, sources, research dates and regional schemes. Additional fields are ignored. Missing metadata in old responses/caches is unknown, never a zero minimum. Malformed present metadata rejects the refresh, preserving the previous validated snapshot.
- Keep the four-hour cache lifetime. Research review dates do not extend when data is fetched. After `reviewAfter` (UTC date), or before `reviewedOn`, automatic refunds are unconfirmed until reviewed data arrives.
- A current `no_national_scheme` yields zero automatic refund. `regional_only` remains unknown because the current form has no explicit purchase-region input. Display regional exceptions without applying them nationally.
- For an available scheme, compare the entered gross purchase price using exact decimal arithmetic and the supplied `gt` or `gte` operator. For tax-exclusive minimums, compare gross against minimum × (1 + VAT), without rounding. Assume one purchase wholly taxed at the standard VAT rate; do not claim support for mixed-rate baskets.
- A price below the threshold yields zero automatic refund, with an explanation. Other invoices are not summed. Display the API's grouping conditions and notes.
- A passing value condition permits the existing full-included-VAT estimate P × v / (1 + v), as the gross potential refund, less an assumed 28% fee. This is an explicit potential-refund assumption, not verified personal eligibility or a provider quote. Residency, goods, paperwork, retailer participation and actual provider fees remain unverified. Do not infer eligibility from home currency or residence.
- Missing thresholds or VAT, missing rules, overdue rules, and unconfirmed regions leave the automatic refund unknown. Continue comparing the cost without a refund against the optional home price. A known zero is distinct from unknown.
- New comparisons use automatic refund assessment only. Users cannot override refund amounts or FX rates. Retain historical manual refund/FX metadata when displaying saved comparisons.
- Save the assessed country metadata, sources and reason with each submitted result. Result, sharing and saved comparisons retain their original totals. Historic results without this metadata remain readable; do not retrofit current rules onto them.

## Rules screen

A **VAT refund rules** button below **Calculate savings** on Calculate shows the selected shopping country's flag before its label and opens a scrollable screen for that country, even before a price is entered. The flag updates when the shopping country changes. On Your savings, the button is inside **Expand details**, alongside the VAT and rate assumptions, and opens the metadata captured with that result. It is hidden while details are collapsed. Back and Android hardware Back dismiss the screen without losing calculator fields, result item-name/photo drafts or saved status.

Show the country's flag beside its name in the rules screen title. Show scheme availability, strict/inclusive minimum with its currency and tax basis, grouping, notes, regional exceptions, source links, reviewed-on and review-after dates, and a warning when research needs confirmation. Clearly identify bundled defaults, API data, and retained comparison data. Old results and old caches with no refund metadata show an unavailable explanation. Source links accept HTTPS only and report opening failures. Refreshing reference data must not rewrite submitted or saved comparisons.

Bundled defaults use a dated response snapshot from the canonical backend dataset (`src/data/default-countries.json`, checked 2026-10-07), preserving original research dates. The six-country guest selector is retained. Guest FX includes all 10 pairs across its five currencies, including six undated owner-provided defaults; refund metadata and its review deadlines are unchanged. The pasted attachment ends partway through Spain's record; the complete canonical backend record supplies its missing provenance. This is a static response fixture, not a second rules engine.

## Acceptance examples

1. France EUR 100 fails; EUR 100.01 passes the value condition.
2. Australia AUD 299.99 fails; AUD 300 passes, subject to same-supplier conditions.
3. Portugal EUR 61.49 gross fails; EUR 61.50 passes at 23% VAT. Latvia EUR 42.35 passes at 21%. Japan JPY 5000 gross fails; JPY 5500 passes at 10%.
4. Spain's explicit zero is no statutory minimum. US has no national scheme. UK does not automatically apply Northern Ireland's exception.
5. Japan remains within its review window on 2026-10-31; from 2026-11-01 its refund needs confirmation, even after a successful API fetch.
6. France EUR 100, USD/EUR 1.1, home price USD 150: refund USD 0; cost USD 110; potential savings USD 40. France EUR 120 with the same rate/home price: gross refund USD 22, assumed fee USD 6.16, net refund USD 15.84, net cost USD 116.16, savings USD 33.84.
7. The rules screen preserves the draft and result when opened/closed. Saved/reopened results retain source metadata and thresholds. Missing metadata displays unavailable information, without silently assuming eligibility.
