> Current behavior: [Country refund thresholds and rules screen](tourist-refunds.md) supersedes unconditional full-VAT assumptions below. All new estimates deduct the standard 28% refund fee described below. Earlier sample-rule examples remain legacy engine regressions only.

# 001 — Shopping calculator

Status: calculation engine and illustrative refund-rule selection implemented and unit-tested. Reference-data client/cache and storage adapters are also implemented and unit-tested. Calculator UI wiring, remembered settings and sharing are implemented and browser-tested. Explicit local saving and reopening are implemented; automatic recent history and native device verification remain planned.

## User story

As a traveler, I want to enter an overseas price and compare its estimated net cost with a home price so I can decide whether to buy it.

## Interaction model

Each app launch begins with the photo-led Savly welcome screen inspired by the design board. While restoring sign-in, hide both buttons. For a returning signed-in user, keep this button-free splash visible for three seconds from launch, then open Calculate directly. If secure restoration or token renewal takes longer, wait for it to finish before navigating. Guests see the normal welcome buttons once restoration finishes; a new interactive sign-in opens Calculate immediately. **Get started** opens Compare without requiring an account. **Sign in** opens the Cognito sign-in flow described in spec 002. Welcome copy describes potential savings rather than guaranteed savings or refunds.

Present the shopping-country dropdown at the top of Compare, before price entry, with its flag, country name, and currency code. Show it only in the Calculate tab, below the Calculate/Saved tab bar and above the price form; hide it on Saved. Keep it visible outside the home-settings section; retain the remembered shopping country for repeat use. Tabs preserve the calculator draft. Show the built-in-defaults/API data-source message directly below the “Compare a price” title, only on Calculate. Hide the Scan tab and page until scanning is ready. Your Savings uses a header back arrow returning to the main Calculate tab, including when opened from Saved.

Remember home residency/currency and shopping country/currency after initial setup. Derive home currency from the selected residence country using the cached API country-to-currency mapping; remove the independent home-currency picker. Reconcile older saved currency choices with that mapping on startup and after reference refresh. Do not infer residence from locale. Until residence is selected, or if its currency metadata is unavailable, explain what is missing and do not calculate a total. Clear the home price and comparison overrides whenever its currency changes, so old amounts are not reinterpreted in another currency. For repeat comparisons, only the price is required. Home price is optional. Enter the item name only on Your savings when saving; Calculate has no item-name field. Display the home-price field as “Home price (USD)” (using the selected currency), without an “optional” suffix. Format numeric inputs with thousands separators as the user types (for example, 12345.67 displays as 12,345.67). Apply this to shopping price, home price, manual FX, and manual refund. Preserve the locale decimal separator; use narrow spaces for grouping when the decimal separator is a comma. Keep ungrouped strings in form state and calculations, preserving fractional precision, trailing zeros, and unfinished decimal input. Validate edits after a short debounce. **Calculate savings** opens a separate result page for valid inputs; invalid or incomplete inputs keep the user on the calculator. Back preserves the form.

Load supported countries, FX rates, and VAT metadata from the sibling fxService repository’s canonical endpoints, mocked initially, following [the app integration notes](api-contract.md), and persist validated data for four hours. The backend supplies VAT and tourist-refund threshold metadata; new comparisons follow [country refund thresholds](tourist-refunds.md). Perform all calculations and rule selection on-device; input changes reuse cached data without API requests. Use the configured FX source without adding a card/bank fee. FX and available VAT are automatically populated. Only when the current scheme and entered purchase value pass the supplied conditions, estimate P × v / (1 + v) as a gross potential refund, then deduct a 28% assumed fee; personal eligibility remains unverified. Null VAT means refund unavailable; compare the converted purchase cost against the home price without any refund. Calculate offers no manual FX, refund or fee inputs. Use built-in defaults or validated cached/API reference data automatically, retaining source timestamps and stale-data notices. Ignore legacy card fee preferences and FX/refund overrides for new calculations; saved snapshots retain their original totals.

Compare and Result are separate pages. Validation uses a 180 ms debounce; Calculate savings waits for valid, settled inputs. The result captures the submitted comparison and does not change during background reference refreshes. It presents potential savings first, then price, FX/refund details, Save, and Share. Save requires an item name and persists the displayed snapshot locally; the Saved list supports reopening, deletion, and confirmed clearing. Save failures remain retryable and never claim success. Shopping-country and residence pickers show a flag beside each country name in both the selected field and selection list. Flags are decorative; names remain accessible and searchable, and shopping-country currency codes remain visible. Country selectors use localized names when `Intl.DisplayNames` is available and bundled English names otherwise; missing optional internationalization APIs must not prevent startup. Decimal-separator detection supports engines without `NumberFormat.formatToParts`; unexpected asynchronous settings-initialization failures show an error and Retry rather than leaving the loader pending. Residency starts unselected and is never inferred; missing residency leaves automatic refunds unavailable.

## Inputs

| Input | Rule |
| --- | --- |
| Item name | Entered on Your savings only; required when saving |
| Shopping/home currencies | Explicit ISO currency codes from the dynamically fetched reference dataset |
| Overseas price P | Required, positive, VAT-inclusive, in shopping currency |
| Exchange rate r | API-populated, positive; home-currency units per 1 shopping-currency unit; editable override |
| Card FX fee f | Fixed at zero for new comparisons; retained only for legacy snapshot compatibility |
| VAT rate v | API-populated fraction from 0 through 1 for the selected country, or null when unknown |
| Sample provider fee | Optional illustrative fraction of included VAT; 28% for the Spain/US worked example, separate from bank fees |
| Net refund rate q | Prototype-fixture fraction of the VAT-inclusive price, after modeled provider fees |
| Expected refund R | Automatically P × q in shopping currency; advanced amount override allowed |
| Home comparison price H | Optional, positive, in home currency, including applicable purchase taxes |

The domain engine accepts normalized decimal strings with at most 18 digits before and after the decimal point; UI locale/whitespace normalization is handled before calling it. Monetary results are decimal strings. Savings amounts and percentages are signed; a negative value has the `more` outcome, and the UI formats its absolute magnitude in “Costs … more” copy.

Percentages in formulas are decimal fractions: 20% becomes 0.20. Reject malformed, negative, non-finite, and out-of-range values rather than silently correcting them. Respect currency precision; JPY has no fractional minor units. Same-currency comparisons use r = 1.

## Calculation contract

All formulas below execute exclusively in the client. The API returns FX rates and country/VAT metadata, never item-level amounts or calculated savings.

- Converted purchase cost = P × r.
- Estimated card fee = P × r × f.
- Included VAT, if v is supplied = P × v / (1 + v).
- Estimated refund in home currency = R × r.
- Cost without VAT refund = P × r + P × r × f.
- Estimated cost with VAT refund = P × r + P × r × f − R × r.
- Savings, only when H is supplied = H − estimated net cost; when VAT is null use cost without refund.
- Savings percentage = savings / H × 100.

R must not exceed P. If a VAT rate is supplied, R must not exceed included VAT, rounded to the shopping currency's minor unit. Use the separately supplied net refund rate q, never the VAT rate itself, to populate the expected refund automatically. Validate 0 ≤ q ≤ v / (1 + v). Show “Included VAT” separately from “Expected refund.”

For an explicitly configured local sample provider fee k, estimate gross refund as included VAT, provider fee as included VAT × k, and net refund as included VAT × (1 − k). This requires a separate labeled sample assumption of full eligibility before fees; never infer it from VAT metadata alone. A manual refund for a new estimate is a gross amount before the standard 28% fee when VAT metadata is present. Legacy sample fee models remain supported for historical snapshots, but are not selected for new comparisons.

Use decimal arithmetic, retain precision in intermediate values, and round displayed monetary values once using the currency's minor units and half-up rounding. Display savings percentages to one decimal place. Determine zero/positive/negative savings messaging from the rounded monetary difference to avoid “Save 0.00.”

## Result summary

Place the item name or name field above Take photo / Add photo, followed by Save / Share on Your savings. Below these actions, an “Expand details” button reveals the cost breakdown, FX provenance, and refund assumptions; details start collapsed and can be hidden again. Keep the savings summary and rate badge visible.

Your savings uses the same clickable home-country, flag, and Settings cog as Calculate and Saved. Tapping any part opens the existing Settings page.

On Your savings, savings and extra-cost summary amounts use the home currency symbol before the localized number (for example, “You could save $25.00” or “Costs €25.00 more”). Apply this to the before-refund summary too. Preserve exact stored digits and use the currency code as a fallback when a symbol is unavailable.

Show “Without VAT refund,” “Estimated VAT refund,” and “With VAT refund” in home currency. Both cost totals include the same card fee. “With VAT refund” is the estimated net cost used in savings comparisons; the refund is not a removal of all VAT. Keep detailed FX, VAT, provider assumptions, in an expandable breakdown. Built-in default FX is identified as “Default FX rate”; illustrative refund assumptions remain labeled. API fixture estimates remain labeled sample.

## Estimate assumptions visible to the shopper

The automatic refund is an indicative net estimate under the matched rule’s stated assumptions, not verified eligibility. Show a short “Estimated refund, subject to eligibility” note; detailed conditions stay collapsed. Purchase and refund use the same FX rate for this estimate; actual refund conversion and card settlement can differ. Card fees are modeled on the full purchase amount and are not refunded. Customs duties, import taxes, and travel costs are excluded. Explain these assumptions in the breakdown rather than promising guaranteed savings.

Refund eligibility is not verified by this version. Real schemes have conditions and may charge fees. See [European Commission refund guidance](https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/vat-refunds_en) and [Your Europe consumer guidance](https://europa.eu/youreurope/citizens/consumers/shopping/vat/index_en.htm), reviewed 2026-09-26. These references justify the distinction between VAT and refund; they are not a global rules database.

## Acceptance criteria

- **AC1:** Given EUR 120, USD per EUR 1.10, VAT 20%, fixture net refund rate 12.5% of gross price (EUR 15), legacy engine card fee 3% (historical compatibility test only), and home price USD 150: included VAT is EUR 20.00; converted cost USD 132.00; card fee USD 3.96; refund USD 16.50; net cost USD 119.46; savings USD 30.54 (20.4%).
- **AC2:** With the same inputs and fixture net refund rate 0: net cost is USD 135.96 and savings USD 14.04 (9.4%).
- **AC3:** With AC1 inputs but home price USD 100: show “Costs USD 19.46 more” (19.5%), not a positive savings claim.
- **AC4:** Without a home price, show estimated net cost and no savings amount or percentage.
- **AC5:** With EUR 120 and VAT 20%, a fixture or override refund of EUR 21 is invalid; explain that included VAT is EUR 20.
- **AC6:** Empty price, zero price/rate/home price, negative values, invalid text, and excessive refunds show field-level errors for user input or a rate-unavailable state for invalid API data and prevent affected calculations. An omitted home price is valid.
- **AC7:** Every rate shows its direction and provenance: “1 EUR = 1.10 USD · Sample rate” or “Manual rate.” Never label these live.
- **AC8:** Zero VAT and zero refund work; VAT 20% produces an explicitly assumed refund of all included VAT only after the current scheme/value checks pass. Null VAT shows refund unavailable while still comparing without a refund. Same-currency conversions use rate 1.
- **AC9:** Results announce estimated amounts, support screen readers and enlarged text, and communicate savings/extra cost with words as well as color. Target at least 44-point touch controls.
- **AC10:** In the saving milestone, save all inputs, app-generated reference snapshot identifier and source/fetch timestamps, automatic and overridden assumptions, both cost totals, calculation version, and timestamp as a snapshot. Restarting the app preserves it; later rate changes do not rewrite it. Delete removes only the selected comparison.
- **AC11:** A net cost equal to the home price at displayed precision says “Same estimated cost.” JPY results display whole yen. Verify a rounding boundary such as USD 1.005 displaying USD 1.01.

- **AC12:** With remembered home/trip settings, entering EUR 120 uses a cached mock dataset (fetched only if missing or expired): r = 1.10, v = 0.20, q = 0.20 / 1.20 under the full-included-VAT assumption, bank fee 0%. Show without refund USD 132.00, estimated refund USD 22.00, and with refund USD 110.00 without requiring any rate entry. With home price USD 150, savings are USD 40.00 (26.7%).
- **AC13:** New comparisons always exclude card fees, including after loading legacy nonzero preferences. There is no Edit assumptions action or manual FX/refund entry. Legacy override values cannot affect new calculations. Changing comparison context recalculates locally using the cached dataset. Older refresh responses cannot overwrite newer data.
- **AC14:** Without valid cached data, loading or unavailable FX shows no converted total. After a failed refresh, expired but previously validated cached data may support estimates with a refresh-failure message and source timestamp; show one badge reading “FX rates are stale. Login to get accurate rates.” if the applied source FX is over 48 hours old; omit the separate stale-rate alert on Your savings. Show Retry. When FX is valid but VAT is null, show the without-refund cost and its savings or extra cost against the home price, labeled as excluding a refund. An explicit zero refund is distinct and shows equal before/after costs.
- **AC15:** Persist home/trip settings across app restarts. Defaults appear already populated. Shopping country and residency remain separate client-side inputs; neither is required in the reference-data API request; mock assumptions remain visible as estimates, never verified eligibility or genuine Mastercard rates.

- **AC16:** All supported-country options come from the fetched dataset. Adding/removing a country in a refreshed fixture updates the selector without code changes; removed selections cannot generate new estimates.
- **AC17:** One successful refresh cycle (one rates request and one countries request) at time T serves every calculation and country switch until T + 4 hours, including after restart. At exactly T + 4 hours, next active use refreshes once. Simultaneous consumers share that refresh; no item inputs or computed totals pass through the data API.
- **AC18:** Failed refresh preserves the validated cache without resetting source timestamps; the 48-hour source-age warning remains independent of cache expiry. Offline first launch without cache shows unavailable. Recovery replaces the dataset for the next calculation; already submitted results and saved comparisons remain unchanged.

- **Historical AC19 (legacy fee model only):** The [Spain/USA worked example](spain-worked-example.md) uses VAT-inclusive EUR 450, home price USD 500, stale USDEUR 0.8887, 21% VAT, and an illustrative 28% fee on included VAT. Show converted cost USD 506.36, price difference USD −6.36, gross refund USD 87.88, fee USD 24.61, net refund USD 63.27, final cost USD 443.08, and savings USD 56.92 (11.4%). Preserve intermediate precision and stale/sample provenance through display, sharing, and saving.

## FX source and card assumptions

fxService supplies CityIndex MID bar closes. Label real rates with that source and timestamp, and prototype rates as sample data. Mastercard settlement data is not supplied by this backend and must not be implied by a card selection. The calculator excludes additional card/bank fees; actual card settlement may differ.

## Production integration requirements

Use the existing fxService backend and canonical contract. Confirm deployment URL, authorized guest access, provider usage rights, and supported pair coverage before production integration. The four-hour client cache and outage behavior are defined in api-contract.md. Keep secret provider keys off the mobile client. A rate fetch failure must not silently substitute a sample rate. Verified eligibility/refund-provider rules still require a separate source; the full-VAT refund is an explicit client-side assumption.

## Keyboard layout

The calculator, savings-name field, and country search remain usable with the soft keyboard open. Android uses native resizing plus explicit height avoidance and scrolls the focused input into the visible viewport after keyboard/layout changes. iOS uses padding avoidance. Forms and country options scroll within the remaining space. Native form scrolling dismisses the keyboard; browser scrolling preserves input focus so typing into lower fields is not interrupted, and action/selection taps remain available while it is open. Verify on native devices with small screens and enlarged text before release.

Card-fee inputs and zero-fee rows are removed from new calculator results and shares. Previously saved comparisons retain their original totals and show any nonzero card fee as a saved-estimate detail. VAT refund provider fees remain separate and unchanged.

## Responsive layout and rotation

Native iOS builds must use Expo's scene lifecycle so Savly launches on iOS 27 when built with Xcode 27. Keep this in the tracked Expo configuration (`expo-build-properties`, `ios.enableSceneSupport`) so regenerated native projects preserve it. Native startup, foreground/background events, and incoming sign-in URLs use Expo's scene forwarding.

Allow portrait and landscape on phones. Reflow live without resetting the active tab, form values, submitted result, or draft photo. Use two columns when safe-area width allows at least 680 points at the current text scale: calculator purchase/settings beside home-price/item/assumptions, result details beside save/photo/share controls, and a two-column Saved list. Narrow windows and larger accessibility text retain a readable single column. Width, rather than reduced keyboard height, selects the form layout. Content remains vertically scrollable without horizontal scrolling.

Welcome uses a compact side-by-side layout on wider screens and removes its portrait spacer on short screens. Country selection and full-screen photo modals support rotation; the full photo fits within the available space without cropping. Respect notches and safe areas in either orientation. Existing native builds must be rebuilt to remove the portrait orientation lock.

Startup no longer displays SAMPLE PROTOTYPE. Use API reference data when available or clearly identified hardcoded defaults. On Your savings only, after calculation, highlight FX source timestamps over 48 hours old, including defaults, as specified in [API integration notes](api-contract.md#fx-age-warning-48-hours). VAT data has no per-record timestamp in the current API contract; do not imply the FX warning verifies VAT freshness.

## Home-country settings

Home country (residency) is selected only on a dedicated Settings page, opened by tapping the home-country text, flag, or settings cog in the main header. The whole country-and-cog area is one Settings button, including Home / Not set before a country is selected. The calculator has no home-country selector or inline settings panel. Show the current home country with a small decorative flag in a fixed top-right header on Calculate, Saved, Settings, and Your savings. Until configured, show Home / Not set and direct users to Settings; never infer residency from locale.

Reuse and persist existing home-country preferences. Derive the home currency from the selected country's reference metadata for all new calculations. Changing currency clears the entered home price and overrides; submitted/saved comparisons retain their original inputs and totals. Settings explains unsupported currency data and persistence errors. Keep Calculate/Saved navigation and the shopping-country dropdown unchanged.

Your savings leads with the savings amount and percentage, before provenance or stale-rate warnings. When final savings are unavailable, keep the summary area visible: request a home price if missing; otherwise show the already-calculated price difference explicitly labeled before VAT refund and explain that final savings require refund data. Do not substitute an assumed zero refund or change saved totals.

## Current VAT refund assumption

Country scheme and minimum-purchase checks in [tourist-refunds.md](tourist-refunds.md) gate automatic refunds. All new automatic and manual refund estimates deduct an assumed fee of **28% of the gross potential refund**, once. This is a product estimate, not a verified provider charge. Automatic gross refund is included VAT: P × v / (1 + v); net refund is gross refund × 0.72. Manual overrides enter a gross refund before fees and must pass the existing included-VAT bound before deducting the fee. Zero refund has zero fee; unknown refunds stay unknown. No home price means no savings claim.

Keep full intermediate precision; round only final display amounts. Display/share gross refund, fee, net refund and final savings. Saved comparisons retain their original amounts and assumptions. Legacy sample-rule engine inputs already encode net refunds and remain supported for historical regression checks; they are not selected for new app comparisons.

EUR 120 with 20% VAT and EURUSD 1.10 has EUR 20 included VAT, USD 22 gross refund, USD 6.16 fee, USD 15.84 net refund, USD 116.16 net cost and USD 33.84 savings (22.6%) against USD 150 at home. Null VAT leaves USD 132 cost without a refund. Spain/USA at USDEUR 0.8887, EUR 450 and USD 500 home price gives USD 87.88 gross refund, USD 24.61 fee and USD 56.92 savings.

### UK/Australia regression example

Home country United Kingdom, shopping country Australia; GBP 200 at home, AUD 350 **including** 10% GST; supplied example quote 1 GBP = 1.9004 AUD. This is a fixed test quote, not live FX. With current qualifying scheme metadata and unverified personal eligibility:

| Result | Amount |
| --- | --- |
| Converted shopping price | GBP 184.17 |
| Included GST (350 × 0.10 / 1.10) | AUD 31.82 |
| Potential refund before fee | GBP 16.74 |
| Assumed refund fee (28%) | GBP 4.69 |
| Net refund | GBP 12.05 |
| Final overseas cost | GBP 172.12 |
| Potential savings | **GBP 27.88 (13.9%)** |

The owner confirmed included GST. The initially supplied GBP 18.42 refund, GBP 5.16 fee and GBP 29.09 savings instead used 10% of the full gross price; those are not the accepted tax-inclusive example. The regression exercises the form-to-calculator path, reversed quote, sharing and saved snapshots in `tests/australia-example.test.ts`.

### Required build checks

`npm run android`, `npm run ios`, `npm run export:mobile` and `npm run export:web` must run `npm run check:build` first and stop if TypeScript or any unit/integration/example test fails. Add future worked examples to `tests/*.test.ts`, which the gate discovers automatically. Direct Expo, Gradle or Xcode commands bypass npm hooks; run the same gate before using those commands. Device tests remain a separate release requirement.

## Persistent branding

Shopping-country and home-country selection open as native sheets on iPhone, below the camera notch and status bar. Measure safe areas within each modal so branding and controls remain unobstructed in portrait and landscape; keep the country list scrollable and search keyboard avoidance enabled.

Keep the italic Savly wordmark and airplane motif from the welcome screen visible at the top left, outside scrolling content, on Welcome, Calculate, Saved, Settings, Your savings, country selection, and the full-screen photo viewer. Use navy on light backgrounds and white on dark backgrounds, respecting safe areas. Keep home-country and navigation controls available beside or below the branding. System-owned camera, library, and share screens retain their platform UI.

Your savings automatically groups displayed amounts, percentages, and FX rates using the same separator convention as numeric inputs. Preserve stored decimal precision, currency trailing zeroes, signs, and saved calculation values.

## Complete guest FX coverage

Guests can calculate every combination of US, GB, AU, JP, ES and FR using ten bundled pairs (USD, GBP, AUD, JPY and EUR). Preserve the original EURUSD, USDJPY, AUDUSD and EURGBP values. Add the owner-provided 2026-10-07 values: GBPUSD 1.32, GBPJPY 208.8, GBPAUD 1.90, EURJPY 176.9, EURAUD 1.61 and AUDJPY 110.0. Each pair means one unit of its first currency buys the supplied amount of its second currency. Use direct quotes or their inverse, without triangulation.

The six additions have unknown quote dates and owner-provided provenance; never attribute them to CityIndex or treat their receipt date as market freshness. Accept undated owner defaults only in sample-mode reference data, retaining strict API validation. Keep four-hour caching and existing VAT/refund metadata. A new guest cache revision must prevent a still-fresh old four-pair cache from hiding the additional pairs. Saved results and authenticated caches retain their existing data.
