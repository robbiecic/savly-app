# 003 — Share savings (MVP)

Status: prototype formatter, native share action, configurable demo link, and local demo landing page implemented. Model/browser checks pass; received WhatsApp messages and native device routing remain unverified.

## User story

As a Savly user, I want to share my estimated savings with a friend through WhatsApp or another messaging app, so they can see the comparison and open or download Savly.

## Sender flow

Add a visible **Share savings** action on a valid result with positive home-price savings. Use **Share comparison** when savings are zero, negative, or no home price is entered. Tapping opens the native iOS/Android share sheet with a text summary and HTTPS app link. The user chooses WhatsApp, Messages, email, or another available destination and completes sending there. No Savly login, contact access, or WhatsApp-specific integration is required.

Generate the message entirely on-device from the displayed result snapshot. Do not request new rates, upload a comparison, or recompute using different assumptions while sharing. MVP sharing is text plus a link; a branded image card can follow later.

## Example message

Using calculator AC12, with an optional item name:

```text
I could save USD 34.50 (23.0%) with Savly!

Item: Travel bag
Shopping price: EUR 120.00
Home price: USD 150.00
Without VAT refund: USD 132.00
Estimated VAT refund: USD 16.50
With VAT refund: USD 115.50

Sample estimate · Refund subject to eligibility.
Open or download Savly: {SAVLY_APP_LINK}
Monthly subscription or lifetime purchase required to use Savly.
```

`{SAVLY_APP_LINK}` is configuration, not a real published address yet. Use an owned HTTPS domain with a stable `/app` path when available. Omit the item line if unnamed. Use currency codes and the same rounding as the result. With production data, replace “Sample estimate” with “Estimated using rates as of [source date/time].” Preserve stale-data and manual-override labels when applicable, and include “Excludes customs/import taxes” in the assumption footer. Do not describe an estimate as money already saved.

Without a home price, use “Here's my overseas shopping estimate from Savly,” omit home-price savings, and share available cost totals. For a negative comparison say “This would cost USD X more than at home”; for equal prices say “Same estimated cost as at home.” If refund data is unavailable, share only the without-refund cost and “Refund estimate unavailable,” with no invented after-refund total.

## Recipient flow

- Use iOS Universal Links and Android App Links for the same HTTPS address. When installed and the OS permits app opening, open Savly's entry screen, honoring existing subscription/lifetime access and optional login state.
- If not installed, or the browser keeps the link on the web, show a lightweight public landing page with Savly branding, a short explanation, and App Store / Google Play download buttons. State that use requires a monthly subscription or lifetime purchase. Desktop visitors can choose either store.
- The comparison summary remains readable in the received message without an account or purchase. The generic link does not expose history or bypass premium access. MVP links open the app, not an imported copy of the sender's calculation.
- Keep the shared link free of item prices, personal identifiers, account tokens, and history IDs. No share-record API, recipient tracking, or deferred result import is required.

Apple documents installed-app opening and browser fallback in [Universal Links](https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content); Android documents equivalent behavior in [App Links](https://developer.android.com/training/app-links/about). Reviewed 2026-09-26. Opening behavior can depend on browser and user settings; the web fallback must always be useful.

## Implementation and release dependencies

Use React Native's native share interface with the URL embedded in the message for cross-platform text sharing. Host the fallback page and platform association files on an owned HTTPS domain; configure iOS associated domains and Android verified links using production app identifiers/signing details.

Domain and store listing URLs are not yet supplied. Keep these configurable. In the local prototype, use an explicitly labeled demo link/landing page and state that production open/download routing is not verified. Do not invent working store listings. Working public links and installed/uninstalled device checks are required before MVP release.

## Acceptance criteria

- **SH1:** From AC12, share text shows USD 34.50 savings (23.0%), USD 132.00 without refund, USD 16.50 refund, and USD 115.50 with refund, plus the configured app link. No data API calls occur during sharing.
- **SH2:** A paying guest can share without Savly login. Native sharing offers available destinations; verify the received text and clickable link in WhatsApp on Android and iOS where installed. WhatsApp absence does not prevent sharing elsewhere.
- **SH3:** Missing, equal, or unfavorable home-price comparisons use accurate alternate wording. Mock, manual, stale, and unavailable-refund states retain their qualifications.
- **SH4:** Canceling sharing leaves the comparison unchanged. Failures allow retry. Do not show “Message delivered” merely because the share sheet opened or closed; the app cannot verify recipient delivery.
- **SH5:** On installed devices, the verified link opens Savly when platform settings allow it. On uninstalled devices and browser fallback, the landing page offers correct live store destinations and clear paid-access wording.
- **SH6:** The link contains no private comparison/account data, and the web page exposes no personal history. Following it never grants unpaid calculator access.

## Tasks

- [x] Add result share action and client-side text formatter.
- [x] Verify message variants and cancellation/failure handling with model tests and a simulated browser share API.
- [ ] Verify actual native share sheets and received WhatsApp text on Android and iOS.
- [x] Build a local branded demo landing page and configurable HTTPS app link (EXPO_PUBLIC_SAVLY_APP_LINK).
- [ ] Publish the fallback page and configure actual store listing URLs.
- [ ] Configure association files and native link handling once domain/app identifiers exist.
- [ ] Verify SH1–SH6, including received WhatsApp messages and installed/uninstalled routing.
