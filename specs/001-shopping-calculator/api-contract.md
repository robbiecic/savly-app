# Reference data and four-hour cache

Frankfurter v2 is Savly's primary FX source for guests and signed-in users in development and release builds. The sibling `../../../fxService` repository still owns the canonical country/VAT wire contract; this app adds no backend endpoint:

- [Backend setup](../../../fxService/README.md)
- [Canonical API contract](../../../fxService/specs/requirements/03-api-contract.md)
- [Country and VAT metadata](../../../fxService/specs/requirements/06-country-vat.md)

## Country catalog

Both residence and shopping pickers show the same 249 country and territory codes from `country-names.en.json`. `country-currencies.json` maps them to current tender currencies using [Unicode CLDR supplemental currency data](https://unicode.org/reports/tr35/tr35-numbers.html), reviewed 2026-11-15. CLDR gives 248 entries a tender currency, spanning 152 distinct currencies; Antarctica has no tender currency. Keep Antarctica visible in both pickers but mark calculation unavailable. Some territories have multiple tender currencies; this catalog chooses the first current tender entry in CLDR. It is a single-currency product approximation, not a complete list of local payment options.

The built-in country metadata and signed-in Premium `/v1/countries` response supply VAT and tourist-refund data where known. Validate the backend response against its contract, then expand it to the picker catalog. Preserve known metadata; assign `vatRate: null` when none is supplied. Null means unknown, never zero or an assured refund. The backend's `unconfirmed` refund status means no verified operating threshold; show no automatic refund estimate. A backend currency disagreement with the current catalog is a validation error. The backend remains the owner of its own country/VAT contract and does not need to serve every picker entry.

## FX requests and calculations

Request `GET https://api.frankfurter.dev/v2/rates?base=<HOME_CURRENCY>&quotes=<OTHER_CURRENCIES>` on app load and when the selected home's currency changes. Before home selection, preload EUR. The `quotes` set contains the other currencies in the country catalog. Frankfurter's flat rows contain `date`, `base`, `quote`, and `rate`. Validate positive finite values, base direction, currencies, and source dates before publishing them. A missing quote leaves that pair unavailable; it must not invalidate other usable quotes. Do not fabricate a `pipSize`.

Frankfurter gives quote currency per one base currency. The calculator needs home currency per shopping currency, so invert the relevant home-base quote with decimal arithmetic. Same-currency conversion is one. Preserve the original pair, value, direction, source, date, and inversion in results, sharing, and saved snapshots. Do not triangulate missing pairs. Send no item names, prices, residency, refund inputs, or savings to Frankfurter; all calculations run on-device. The public API needs no key. [Frankfurter API documentation](https://frankfurter.dev/).

Frankfurter rates are daily references, not live card settlement rates. Display a generic FX rate label and the rate date; keep `Frankfurter` in internal provenance only. Fetch time does not make a published rate newer. Show an age warning only when the source date proves the rate is older than 48 hours; a date without a time is evaluated conservatively. Never substitute sample FX after a failed request.

## Cache and failure behavior

Persist a validated snapshot for each home currency and country-data source for exactly four hours (14,400 seconds) after successful fetch. Cache revision isolates this catalog from older trial/default snapshots. Reuse fresh data through restart and input edits. Every Calculate savings submission checks the snapshot containing FX and country VAT/tourist-refund metadata. If expired, wait for the `/v1/countries` refresh attempt (and the FX refresh) before creating the result, even during automatic retry backoff. The result uses the returned validated snapshot. At expiry, refresh while the app is active; foreground resume also checks. Share concurrent refreshes. On failure, keep the last validated snapshot, its original source date, and a retry message; without a valid snapshot show unavailable and Retry. Cache reads and failures do not reset the fetch time. Automatic retries use the existing 1, 5, and 15 minute backoff while active. Saved comparisons keep their original amounts and provenance.

Guests use bundled VAT/refund metadata. Signed-in Premium users can request the existing fxService `/v1/countries` with their Cognito access token; authentication and country fetch failures remain explicit. The app does not request fxService `/v1/rates` for new calculations. `EXPO_PUBLIC_FX_API_URL` configures the fxService country endpoint host, without `/v1`; it does not change Frankfurter's FX host. History sync and billing verification remain separate.

## Verification

Cover equal country picker membership, currency mapping, unknown VAT, rate direction, missing pairs, source dates, four-hour expiry, restart reuse, failed refresh, and financially meaningful calculations. Device checks should cover Android/iOS home-country changes, offline cached rates, Antarctica's unavailable state, and source-date display before store release. Do not claim those checks from browser or bundle tests.
