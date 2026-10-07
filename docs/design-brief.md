# Savly design brief

Status: interpreted from the owner's [design inspiration board](../images/Savly-design-board.jpeg). Use alongside the calculator specification.

## Brand and visual system

Confirmed name: **Savly**. Reference tagline: “Shop globally. Keep more of it.” The personality is polished, approachable, and travel-minded. Explore a bold navy wordmark with a small airplane motif; a production logo still needs to be created.

Use white and cool gray surfaces, navy text and buttons, subtle dividers, rounded cards, simple outline icons, and soft green savings highlights. Start with native system fonts, generous spacing, large prices, and short labels.

Suggested tokens, interpreted rather than sampled from the image:

| Token | Value | Purpose |
| --- | --- | --- |
| Background | #F7F8FC | App canvas |
| Surface | #FFFFFF | Cards and forms |
| Ink | #081126 | Text and primary buttons |
| Muted text | #626877 | Secondary information |
| Border | #E1E4EB | Outlines and dividers |
| Savings surface | #E0F3E6 | Favorable comparison panel |
| Savings text | #176534 | Savings figures |

Validate contrast during implementation. Support enlarged text and both Android and iOS layouts; the board's iPhone frames are presentation devices.

## Screen interpretation

1. **Compare:** Savly branding, a centered rounded shopping-country dropdown above the price form (flag, name, and currency), Calculate/Saved tabs (Scan hidden until ready) above the dropdown, which appears only on Calculate, remembered home settings, prominent price entry, optional item name and home price, a primary **Calculate savings** button opening a separate result page, and a country-specific VAT refund rules button.
2. **Result:** a separate page with a left header back arrow to Calculate and centered Your Savings title, potential savings first, Save and Share actions, and a simple summary showing “Without VAT refund,” “Estimated VAT refund,” and “With VAT refund,” followed by a green savings panel when a home price supports a favorable comparison. Align purchase cost, card fee, and expected refund in a clear breakdown. Keep bank-fee defaults and rate provenance in the expandable details, with a visible “Sample estimate” label for mocked results. Unfavorable results need clear wording without celebratory styling.
3. **Saved:** locally persisted named comparison snapshots that can be reopened or deleted. Automatic recent history remains a later milestone. Design direction: compact item cards with name, currency, price, savings if available, and snapshot date. Product thumbnails can come later; manual entry works without images.

A photo-led welcome screen opens on each app launch. Match the board’s white italic wordmark and airplane motif, dark lower gradient, and rounded white **Get started** button. Get started opens Compare; **Sign in** opens the Cognito sign-in flow. Use the standalone generated travel image documented in [welcome image notes](welcome-image.md). Do not use the entire board as a screen background or extract its product photographs as production assets.

## Scope and calculation alignment

The board depicts scanning, sign-in, trips, price alerts, sharing, live FX, and automatic worldwide tax rules. Scanning, trips, alerts, real live FX, and comprehensive worldwide tax rules remain future ideas. Sharing a text summary and app/download link is required for MVP. Optional sign-in for retained history and premium purchase screens are now in scope, mocked for the prototype. Automatic FX from mocked fxService responses and indicative refund estimates from separately labeled local fixtures are now prototype requirements. Show navigation only for implemented screens.

Its figures are illustrative, not test fixtures. For a VAT-inclusive price of EUR 1,500 at 20% VAT, included VAT is EUR 250 (1,500 × 20 / 120), not EUR 300. The expected net refund is automatically derived from a separate backend net-refund rate and may be lower. Use the calculator spec's verified examples for prototype results.

Avoid the board's “exactly how much” promise and unsupported “100+ countries” claim. Prefer “Estimate what you'll pay and compare potential savings.” Show “Sample rate” instead of a fabricated rate-update timestamp.

## Visual acceptance checks

- Compare and Result follow the board's navy, white, cool gray, and green direction.
- Primary prices and actions are easy to identify on a small phone.
- The breakdown remains readable with enlarged text.
- Shopping and residence pickers show decorative country flags beside names in selected fields and list rows. Use native flag emoji; appearance follows the platform. Currency codes disambiguate symbols; flags alone do not identify currencies.
- Unimplemented actions remain hidden. Sign in uses Cognito.
- Results match the calculator spec, including negative savings and missing home-price states.

## Premium and account screens

Carry the same visual system into purchase choices and optional login. Keep account creation optional after unlocking paid access. Include Restore purchases; avoid repeated sign-in prompts. After free installation, show monthly subscription and lifetime purchase choices through the platform store. Keep restore and store subscription management easy to find. See [premium specification](../specs/002-premium-and-history/spec.md).

## Share action

Use equal-width white outlined rounded buttons side by side: an outline heart with “Save” and an upload/share icon with “Share”, matching the board. After saving, fill the heart and show “Saved”. Keep the descriptive accessible share label “Share savings” for favorable results and “Share comparison” otherwise. Open the native share sheet directly. The public download landing page uses Savly branding and clear store buttons. See [sharing spec](../specs/003-sharing/spec.md).
