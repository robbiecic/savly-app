# Implementation plan

First owner-facing deliverable: a polished prototype with sample rates for travelers from any country. Milestones 1 and 2 are implementation steps toward that deliverable.

## Architecture

Use Expo, React Native, and TypeScript for Android and iOS. Keep the calculation engine independent of screen components. Run all savings calculations on-device. Use the sibling fxService canonical API contracts and the app integration notes in api-contract.md with an asynchronous mock transport initially; no deployed server is required. Use a decimal arithmetic library for calculations and a small local storage layer when saving is introduced.

Proposed layout once scaffolded:

```text
src/
  app/                 screens and navigation
  components/          reusable controls and result cards
  domain/              input validation and calculation functions
  data/                reference-data client, four-hour cache, mock fixtures
  storage/             local comparison snapshots
  theme/               colors, typography, spacing
```

Use the current supported Expo starter and its compatible dependency versions at build time. Preserve these docs during scaffolding.

## Milestone 1 — Trustworthy calculation

Scaffold the project, add decimal arithmetic, implement typed input validation and pure calculations, and test the numeric examples and edge cases in AC1–AC8 and AC11. Implement the reference-data and four-hour cache contract in api-contract.md and mock success, failure, expired, and unsupported responses. No external network is needed. Output: a tested foundation with documented commands.

## Milestone 2 — Polished interactive prototype

Build Compare and Result screens using the visual direction. Fetch mocked fxService FX/VAT responses and apply separately labeled local refund fixtures automatically. Show the FX source, remember country/currency settings, and hide overrides under “Edit assumptions.” Show costs with and without refunds. Include empty, invalid, favorable, unfavorable, and equal-price states. Add native sharing of a client-generated summary and configurable app link per ../003-sharing/spec.md; cover SH1–SH4. Validate AC1–AC9 and AC11–AC18 through the interface. Output: a runnable prototype with launch instructions and screenshots where tools permit.

## Milestone 3 — History, premium access, and optional accounts

Add local snapshots, recent history, and saved items. Handle corrupted storage and confirm AC10. Implement mocked premium access and optional account flows per ../002-premium-and-history/spec.md. A paying guest needs no Savly account. Simulate cloud sync explicitly; do not claim local data is cloud-backed.

## Milestone 4 — Real-world data

Resolve launch markets. Replace the mock transport with the existing fxService backend. Resolve Cognito access for guest calculators, confirm CityIndex data usage and pair coverage, and agree a separate refund-data contract before enabling real automatic refunds. Research any country-specific VAT guidance from official sources and record its date. Before replacing illustrative refund fixtures with real data, specify supported jurisdictions, eligibility, categories, thresholds, provider fees, and rule updates.

## Milestone 5 — Production payments, accounts, and release readiness

Set monthly/lifetime prices, integrate Google Play Billing and Apple App Store in-app purchases with backend entitlement verification, and implement optional authentication/private cloud history with deletion and recovery. Verify PH1–PH9 with real services before release. Test on both Android and iOS, including keyboard interaction, accessibility, small screens, offline behavior, and persistence. Prepare app icon, screenshots, privacy disclosures based on actual data collection, signing, and store accounts. Publish the sharing fallback page on the owned domain, configure verified app links and real store URLs, and verify SH5–SH6 on installed/uninstalled devices. Store submission is a later release task.

## Working loop

For each milestone: read the spec → implement the smallest complete slice → run relevant checks → demonstrate the result → record passed criteria and remaining gaps. Update the spec whenever a product decision changes. Owner feedback guides the next iteration; routine implementation choices do not require repeated permission.
