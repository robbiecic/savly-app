# Product brief

Status: initial direction selected by the owner; detailed behavior remains open to refinement.

Serve travelers from any country, with a polished prototype using sample rates as the first deliverable. Milestones 1 and 2 together produce this prototype. Supported countries, FX rates, and VAT metadata load from the sibling fxService API, mocked for the prototype. Its contracts own the wire format; illustrative refund rules remain separate local prototype fixtures. All calculations run on-device.

## The user and their problem

A traveler standing in a shop wants to compare an overseas purchase with buying the same item at home. Mental currency conversion misses card fees and the difference between included VAT and an expected refund.

## Product promise

Enter an item and its overseas price. See an estimated home-currency cost, an understandable breakdown, and potential savings against a home price you provide.

## First usable version

- Set home country/residency and home currency once; remember them locally. Suggest currency from device locale without treating locale as proof of residency.
- Select shopping country once per trip; prepopulate its currency and remember it. No location permission required.
- For each item, enter its VAT-inclusive price. Item name and tax-inclusive home comparison price are optional.
- Automatically fetch supported shopping countries, FX rates, and VAT metadata from fxService; persist validated responses for four hours before refreshing on next active use. Prototype refund rules are separate illustrative local fixtures.
- Calculate all fees, refund amounts, and savings on-device. Price edits and country changes reuse cached data without additional API calls.
- If refresh fails, use the last validated dataset with a clear out-of-date label; first launch without data shows unavailable.
- Show the configured FX source with an editable 0% additional bank-fee assumption. Keep rate, fee, and refund overrides under “Edit assumptions.” No rate entry is required in the normal flow.
- Show **Without VAT refund**, **Estimated VAT refund**, and **With VAT refund** in home currency, including card fees in both cost totals.
- Show savings against the home price when supplied. Otherwise show cost estimates only.
- Share a savings/comparison summary through the native share sheet (including WhatsApp when installed), with a link to open Savly or download it from the relevant store. Sharing requires no Savly login.
- Retain recent shopping comparisons locally; optionally sign in to keep history across devices. Prototype account and sync states are mocked until a real backend is implemented.
- Offer a required monthly subscription or lifetime unlock after free installation, purchased through Google Play Billing or Apple App Store in-app purchases. Login remains optional for paying users.

The home price is necessary to claim savings. Without it, show estimated cost only. Currency conversion alone is not evidence of savings.

## Business model and accounts

Savly is a premium paid-access app: free installation, then a required monthly auto-renewing subscription or a one-time lifetime unlock. All payments and renewals are handled by Google Play Billing on Android or Apple App Store in-app purchases on iOS. No free functional tier or separate download charge is planned. Prices remain undecided.

After unlocking access, users may continue without an account or sign in to retain shopping and search history. Guest history is local; signed-in history is intended to sync privately and survive reinstall/device changes. Search history begins when a search feature exists; the current calculator does not include product search.

See [premium access and history specification](../specs/002-premium-and-history/spec.md). Mock billing and account flows belong in the prototype; real purchase validation and cloud retention are release requirements.

## Visual direction

Confirmed app name: **Savly**. Primary visual reference: [the owner's design board](../images/Savly-design-board.jpeg), interpreted in [the design brief](design-brief.md).

Premium shopping and travel companion: white and cool pale-gray surfaces, deep navy typography and primary buttons, soft green savings panels, thin borders, rounded cards, and clear price hierarchy. Lifestyle photography supports the travel identity. An unfavorable comparison needs equally clear treatment.

Proposed screens:

1. **Compare:** price-first entry, remembered country/currency settings, automatic results, and a secondary “Edit assumptions” action.
2. **Result:** cost with and without the estimated VAT refund; optional home-price savings, an expandable breakdown, and a Share savings/comparison action.
3. **History / Saved:** recent comparisons and saved items, plus an unobtrusive optional sign-in action.
4. **Premium access and account:** monthly/lifetime purchase choices, restore access, store subscription management, and optional login.

Prototype target: complete a straightforward comparison in under a minute. Validate with a real user; this is a target, not a measured result.

## Outside the first version

Receipt scanning, automatic product matching, refund applications, affiliate shopping, automatic customs calculations, and verified refund eligibility. Real billing and cloud sync follow the mocked prototype but are required for the premium release. Automatic indicative refund estimates are included.

## Decisions still open

- Additional currencies and shopping destinations to prioritize after the prototype.
- Live FX timing after the sample-rate prototype.
- Desired refund provider integrations, if any.
- Monthly and lifetime prices and launch currencies.
- Login provider, history retention, and cross-platform purchase portability.

The shopping-country list is supplied dynamically by the API. Account/history sync and billing verification are separate from this rates-only calculation API.

Mock refund coverage is explicit; unsupported destinations show “Refund estimate unavailable,” not a fabricated global rate.

Currency selection must remain separate from residency and shopping jurisdiction. A currency does not determine VAT eligibility.

## MVP sharing

See [sharing specification](../specs/003-sharing/spec.md). Messages contain the client-calculated estimate and an app/download link. A public landing page supplies store links when the app is absent. Domain and store URLs remain release setup tasks.
