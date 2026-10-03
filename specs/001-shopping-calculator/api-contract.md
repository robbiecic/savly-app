# fxService integration and four-hour cache

Status: reference-data validation, HTTP/mock transports, persistent cache, and native storage/lifecycle adapters implemented. Calculator UI wiring and FX orientation are implemented; production authentication and device validation remain pending. The backend and canonical wire contracts live in the sibling `../../../fxService` repository:

- [Backend setup and local API](../../../fxService/README.md)
- [Canonical API contract](../../../fxService/specs/requirements/03-api-contract.md)
- [Country/VAT metadata and FX orientation](../../../fxService/specs/requirements/06-country-vat.md)

These are the source of truth for requests and responses. This document defines app behavior, not a second backend contract. The previously proposed `/v1/reference-data` endpoint does not exist in fxService.

## Current integration boundary

Fetch `GET /v1/rates` and `GET /v1/countries` together for one app refresh cycle. Rates contain `pair`, `rate`, `pipSize`, `asOf`, and `source`; countries contain `country`, `currency`, and nullable `vatRate`. The single-pair endpoint `GET /v1/rates/{pair}` exists but is unnecessary for normal cached calculator edits. Send no item inputs, residency, comparison prices, or computed savings to these endpoints. Every calculation runs on-device.

Production requests require `Authorization: Bearer <Cognito JWT>`. The backend’s local API uses `http://127.0.0.1:3000` without authentication and defaults to fixture data. Follow its README to run it; the loopback address is not a physical phone’s host address. Keep backend/provider secrets off the client. Authentication, optional history sync, and store entitlement verification remain separate concerns. Guest calculator access is a product requirement, but obtaining authorized production data without requiring a Savly account is unresolved; resolve it before production integration.

Use asynchronous mocks of the actual two response shapes for the initial prototype. Mark mock mode visibly even if backend fixtures contain a CityIndex source string. Never silently fall back from real data to samples.

## Mapping and validation

For a pair `EURUSD`, the rate means USD per EUR. The calculator needs home-currency units per shopping-currency unit: use the direct shopping+home pair, otherwise invert the reverse pair using decimal arithmetic. Same-currency conversion is 1. Do not triangulate. If neither direction is present, show conversion unavailable. Preserve the original pair, value, source, timestamp, and whether inversion occurred. Test direct and reverse orientation (e.g. EURUSD 1.25 gives USD per EUR 1.25 and EUR per USD 0.8).

CityIndex rates are stored MID bar closes, not live quotes or Mastercard settlement rates. Display source and each rate’s `asOf`; a newly fetched cache does not imply newly published market data. Keep the editable additional bank-fee assumption separate, defaulting to 0%.

Validate the response shapes, country/currency codes, unique countries and pairs, positive finite rates and pip sizes, valid source timestamps, and VAT values from 0 through 1 or null. Null VAT means unknown, not zero. Missing pairs are allowed by the backend. `pipSize` formats FX quotes; it is not currency minor-unit metadata. Use maintained client currency metadata for money rounding and localized country names; supported-country membership still comes from the API.

The backend supplies no schema version, dataset version, country data timestamp, currency minor units, refund eligibility, or net-refund rules. Generate an app snapshot identifier and adapter version locally; do not invent server provenance. Validate both responses before atomically publishing the combined app snapshot; if either fails, retain the previous complete snapshot. This is a client refresh grouping, not a server-guaranteed atomic dataset.

## Refund estimates

VAT metadata is not an assured refund. Current fxService responses cannot populate automatic net refunds. In the prototype only, use separately labeled illustrative local refund fixtures with residency/category/price-band assumptions; never add fictitious refund fields to backend responses. Match rules on-device, with lower-inclusive and upper-exclusive price bands. Zero or multiple matches mean unavailable. Validate net refund fraction `0 ≤ q ≤ v / (1 + v)` when VAT is known. An explicit zero refund is distinct from missing data.

Real backend mode shows “Refund estimate unavailable” until a validated manual amount is provided or a separately approved refund-data contract exists. Do not combine real FX with hidden sample refund rules. Preserve automatic and manual assumptions in saved results.

## Cache lifecycle

- Persist the complete validated snapshot and client `fetchedAt` on-device. Cache key includes API environment, app adapter version, and mock/real mode so mocked and production data never mix.
- TTL is exactly four hours (14,400 seconds) from successful fetch/validation. Each rate’s `asOf` describes source data age separately; show source age in details and never label mock data live.
- On first use with no cache, fetch each endpoint once. While cache age is less than four hours, use it without another data API call, including after app restart, input edits, or country changes. All recalculation and rule matching are local.
- At age greater than or equal to four hours, refresh on the next use or foreground resume. If the calculator stays active, refresh at expiry. Do not require background polling while the app is suspended.
- Coalesce concurrent consumers into one in-flight refresh cycle (one request per endpoint). Atomically replace the snapshot on success and recompute the open comparison locally. Prevent older responses from overwriting newer data.
- Cache reads and failed fetches never reset `fetchedAt`. Corrupt caches or clock rollback causing negative age require refresh. Use elapsed/monotonic time where available during a session.
- If refresh fails, retain the last valid snapshot and allow local estimates with a visible “Rates out of date” label and source timestamp. Do not call them latest. Offer Retry; automatic retries use backoff while active (1 minute, then 5, then 15 minutes maximum), coalesced across screens. With no valid snapshot, show unavailable and Retry.
- Build shopping-country options from the snapshot, not a hardcoded app list. A new supported country appears after refresh without an app release. If a previously selected country is removed, retain its label/history but mark it unsupported for new estimates and request a new selection.
- Historical saved results retain their original app-generated snapshot identifier, rates, timestamps, and totals. A cache refresh updates only the active calculation, not historical snapshots.

## Verification cases

Use a fake clock and per-endpoint request counters: first use makes two requests, 3:59:59 reuses the cache, and exactly 4:00:00 starts one shared refresh cycle with two requests. Verify restart persistence, no requests on price/country edits while fresh, partial refresh failure, malformed responses, null VAT, missing/reversed pairs, added/removed countries, offline first launch, expired offline cache, retry backoff, clock rollback, and recovery. Handle 401 as an authentication failure without repeatedly retrying the same invalid credentials; retain stale validated data with its label. Cover 500/network failures and prevent saved history from changing. Assert no item inputs or totals cross the data API boundary.

## Implementation verification

The data layer has 23 automated tests in `tests/reference-data.test.ts`, using fake time, storage, lifecycle scheduling, and HTTP responses. These verify country membership, exact four-hour expiry, restart cache reuse, shared refresh, offline states, validation, partial failures, immutable snapshots, retry backoff, clock rollback, and request boundaries. Native persistence and actual foreground/background behavior still require device testing. The calculator activates the shared store and subscribes to updates; stale data is exposed immediately when a refresh begins.

## Local development connection

Native development builds first use the local fxService API: iOS at `http://127.0.0.1:3000`, Android emulator at `http://10.0.2.2:3000`. `EXPO_PUBLIC_FX_API_URL` overrides the development address. Release builds and web previews continue with prototype fixtures by default; the override is ignored in release builds. Web overrides require the API to allow the preview's origin through CORS.

Resolve the source once per app session, allowing two seconds per endpoint. Reuse a validated local cache for four hours. With no local cache and a network/server failure, use clearly labeled prototype fixtures; reload after starting the API to select it. Invalid API data or authentication/storage errors remain visible. Once selected, the local store retains ordinary stale-cache/retry behavior and never substitutes fixtures on refresh failure. Local and prototype caches are isolated, and local caches include the URL in their key. Local data stays labeled sample because fxService defaults to mock CityIndex data and the contract does not identify mock versus real upstream mode.
