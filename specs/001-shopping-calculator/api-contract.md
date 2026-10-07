# fxService integration and four-hour cache

Status: reference-data validation, HTTP/mock transports, persistent cache, and native storage/lifecycle adapters implemented. Calculator UI wiring and FX orientation are implemented; hosted development authentication is connected; device validation remains pending. The backend and canonical wire contracts live in the sibling `../../../fxService` repository:

- [Backend setup and local API](../../../fxService/README.md)
- [Canonical API contract](../../../fxService/specs/requirements/03-api-contract.md)
- [Country/VAT metadata and FX orientation](../../../fxService/specs/requirements/06-country-vat.md)

These are the source of truth for requests and responses. This document defines app behavior, not a second backend contract. The previously proposed `/v1/reference-data` endpoint does not exist in fxService.

## Current integration boundary

Fetch `GET /v1/rates` and `GET /v1/countries` together for one app refresh cycle. Rates contain `pair`, `rate`, `pipSize`, `asOf`, and `source`; countries contain `country`, `currency`, nullable `vatRate`, and optional `touristRefund` metadata. The single-pair endpoint `GET /v1/rates/{pair}` exists but is unnecessary for normal cached calculator edits. Send no item inputs, residency, comparison prices, or computed savings to these endpoints. Every calculation runs on-device.

Production requests require `Authorization: Bearer <Cognito JWT>`. The backend’s local API uses `http://127.0.0.1:3000` without authentication and defaults to fixture data. Follow its README to run it; the loopback address is not a physical phone’s host address. Keep backend/provider secrets off the client. Authentication, optional history sync, and store entitlement verification remain separate concerns. Guest calculator access is a product requirement, but obtaining authorized production data without requiring a Savly account is unresolved; resolve it before production integration.

Use asynchronous mocks of the actual two response shapes for the initial prototype. Mark mock mode visibly even if backend fixtures contain a CityIndex source string. Never silently fall back from real data to samples.

## Mapping and validation

For a pair `EURUSD`, the rate means USD per EUR. The calculator needs home-currency units per shopping-currency unit: use the direct shopping+home pair, otherwise invert the reverse pair using decimal arithmetic. Same-currency conversion is 1. Do not triangulate. If neither direction is present, show conversion unavailable. Preserve the original pair, value, source, timestamp, and whether inversion occurred. Test direct and reverse orientation (e.g. EURUSD 1.25 gives USD per EUR 1.25 and EUR per USD 0.8).

CityIndex rates are stored MID bar closes, not live quotes or Mastercard settlement rates. Display source and each rate’s `asOf`; a newly fetched cache does not imply newly published market data. New calculations exclude additional bank/card fees.

Validate the response shapes, country/currency codes, unique countries and pairs, positive finite rates and pip sizes, valid source timestamps, and VAT values from 0 through 1 or null. Null VAT means unknown, not zero. Missing pairs are allowed by the backend. `pipSize` formats FX quotes; it is not currency minor-unit metadata. Use maintained client currency metadata for money rounding and localized country names; supported-country membership still comes from the API.

The backend supplies no schema version, dataset version, country data timestamp, currency minor units, personal refund eligibility, or net-refund amounts. Generate an app snapshot identifier and adapter version locally; do not invent server provenance. Validate both responses before atomically publishing the combined app snapshot; if either fails, retain the previous complete snapshot. This is a client refresh grouping, not a server-guaranteed atomic dataset.

## Refund estimates

Consume optional `touristRefund` metadata from `/v1/countries` under the canonical backend contract. Preserve nested thresholds, grouping, regional exceptions, source links and research dates through validation/cache/save. Follow [country refund thresholds and rules screen](tourist-refunds.md) for automatic selection, fallback, manual overrides, and acceptance examples. Threshold availability is not personal eligibility or a net refund rate.

## Cache lifecycle

- Persist the complete validated snapshot and client `fetchedAt` on-device. Cache key includes API environment, app adapter version, and mock/real mode so mocked and production data never mix.
- TTL is exactly four hours (14,400 seconds) from successful fetch/validation. Each rate’s `asOf` describes source data age separately; show source age in details and never label mock data live.
- On first use with no cache, fetch each endpoint once. While cache age is less than four hours, use it without another data API call, including after app restart, input edits, or country changes. All recalculation and rule matching are local.
- At age greater than or equal to four hours, refresh on the next use or foreground resume. If the calculator stays active, refresh at expiry. Do not require background polling while the app is suspended.
- Coalesce concurrent consumers into one in-flight refresh cycle (one request per endpoint). Atomically replace the snapshot on success and recompute the open comparison locally. Prevent older responses from overwriting newer data.
- Cache reads and failed fetches never reset `fetchedAt`. Corrupt caches or clock rollback causing negative age require refresh. Use elapsed/monotonic time where available during a session.
- If refresh fails, retain the last valid snapshot and allow local estimates with a refresh-failure message and source timestamp; show “Rates out of date” only when the applied FX quote is over 48 hours old or has an unverifiable timestamp. Do not call them latest. Offer Retry; automatic retries use backoff while active (1 minute, then 5, then 15 minutes maximum), coalesced across screens. With no valid snapshot, show unavailable and Retry.
- Build shopping-country options from the snapshot, not a hardcoded app list. A new supported country appears after refresh without an app release. If a previously selected country is removed, retain its label/history but mark it unsupported for new estimates and request a new selection.
- Historical saved results retain their original app-generated snapshot identifier, rates, timestamps, and totals. A cache refresh updates only the active calculation, not historical snapshots.

## Verification cases

Use a fake clock and per-endpoint request counters: first use makes two requests, 3:59:59 reuses the cache, and exactly 4:00:00 starts one shared refresh cycle with two requests. Verify restart persistence, no requests on price/country edits while fresh, partial refresh failure, malformed responses, null VAT, missing/reversed pairs, added/removed countries, offline first launch, expired offline cache, retry backoff, clock rollback, and recovery. Handle 401 as an authentication failure without repeatedly retrying the same invalid credentials; retain stale validated data with its label. Cover 500/network failures and prevent saved history from changing. Assert no item inputs or totals cross the data API boundary.

## Implementation verification

The data layer has 23 automated tests in `tests/reference-data.test.ts`, using fake time, storage, lifecycle scheduling, and HTTP responses. These verify country membership, exact four-hour expiry, restart cache reuse, shared refresh, offline states, validation, partial failures, immutable snapshots, retry backoff, clock rollback, and request boundaries. Native persistence and actual foreground/background behavior still require device testing. The calculator activates the shared store and subscribes to updates; stale data is exposed immediately when a refresh begins.

## Hosted development connection

Development builds on Android, iOS, and web default to `https://a2ckcxro8g.execute-api.us-east-1.amazonaws.com`. `EXPO_PUBLIC_FX_API_URL` configures another base URL (without `/v1`) in development or release builds. `EXPO_PUBLIC_APP_ENV=development` enables the development default in exported previews. Unconfigured release builds retain defaults. There is no automatic local API connection. Restart Expo with a cleared cache after changing configuration; web access requires backend CORS support.

Signed-in requests send the existing in-memory Cognito access token to both endpoints, with a 15-second timeout. Reject expired tokens before network access. Guests use dated, clearly identified defaults. Sign-in reselects the API store without resetting the calculator draft; sign-out/expiry reselects guest defaults. Authenticated API failures remain unavailable/retryable or retain the last valid API snapshot; they never substitute fixtures. Successful hosted responses use real reference provenance, preserving CityIndex source timestamps, not a live-quote claim. API caches include the URL and real mode, isolating them from former local/sample caches. Keep the four-hour TTL and on-device calculations unchanged.

Verification: TypeScript and 100 unit/integration tests passed, including hosted URL defaults/override, persisted API cache reuse, bearer headers, and authentication failure without sample substitution. A live unauthenticated countries request returned 401. Successful authenticated requests and native device behavior remain unverified.

## FX age warning (48 hours)

Remove the SAMPLE PROTOTYPE startup badge. Load the existing API countries, FX and VAT endpoints when the development API is reachable, otherwise start with hardcoded defaults. Release builds without production API/authentication configuration use defaults. Preserve the defaults' fixed original timestamp; never stamp them with launch/fetch time. Identify defaults in the calculator and result details and retain illustrative refund assumptions.

The four-hour cache TTL remains a refresh policy, not an FX freshness threshold. FX is stale strictly more than 48 hours after its source `asOf` (exactly 48 hours is not yet stale). A new fetch of an old quote remains stale. Invalid, missing, or future source dates are unverified and also warn. Show the amber FX warning only on Your savings after calculation, using the selected direct/reversed quote. Do not show stale-rate warnings on startup or the calculator form. Manual FX and same-currency calculations do not inherit automatic-rate staleness. Recheck time every 30 seconds and on foreground resume. Saved totals remain immutable, but reopened results and shared summaries also assess the original rate's age at viewing/sharing time.

## Current app refund policy

The country refund milestone supersedes the former unconditional full-VAT policy. Only a current available scheme whose minimum is met enables the full-VAT assumption. Known exclusions yield zero; unknown or overdue metadata compares without a refund. Regional rules are informative until purchase region is explicitly known. Historical results retain original assumptions and totals.
